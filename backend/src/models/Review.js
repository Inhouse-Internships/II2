const mongoose = require('mongoose');

const evaluationCriteriaSchema = new mongoose.Schema({
    label: { type: String, required: true },
    maxMarks: { type: Number, required: true },
});

const reviewSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    scheduledAt: { type: Date, required: true },
    status: {
        type: String,
        enum: ['SCHEDULED', 'COMPLETED'],
        default: 'SCHEDULED'
    },
    evaluationCriteria: [evaluationCriteriaSchema],
    scores: [
        {
            label: { type: String, required: true },
            awardedMarks: { type: Number, required: true },
        }
    ],
    totalScore: { type: Number },
    completionPercentage: { type: Number },
    feedback: { type: String },
    implementationStatus: {
        type: String,
        enum: ['Completed', 'In Progress', 'Pending'],
        default: 'Pending'
    },
    output: { type: String }
}, { timestamps: true });

// Prevent multiple SCHEDULED reviews with the exact same title for the same project
reviewSchema.index({ project: 1, title: 1 }, {
    unique: true,
    partialFilterExpression: { status: 'SCHEDULED' }
});

reviewSchema.index({ project: 1 });
reviewSchema.index({ createdBy: 1 });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
