const mongoose = require('mongoose');

const dailyStatusSchema = new mongoose.Schema({
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
    workDone: { type: String, required: true },
    blockers: { type: String, default: '' },
    hoursSpent: { type: Number, required: true },
    facultyReview: {
        status: { type: String, enum: ['Pending', 'Reviewed'], default: 'Pending' },
        feedback: { type: String, default: '' },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date }
    }
}, { timestamps: true });

dailyStatusSchema.index({ student: 1, date: -1 });
dailyStatusSchema.index({ project: 1, date: -1 });

module.exports = mongoose.model('DailyStatus', dailyStatusSchema);
