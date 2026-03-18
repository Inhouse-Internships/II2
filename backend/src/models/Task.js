const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        startDate: {
            type: String,
            required: true,
        },
        deadline: {
            type: String,
        },
        editableByHOD: {
            type: Boolean,
            default: false,
        },
        order: {
            type: Number,
            default: 0,
        },
        assignedDays: [
            {
                type: Date,
            },
        ],
    },
    { timestamps: true }
);

taskSchema.index({ project: 1 });
taskSchema.index({ deadline: 1 });
taskSchema.index({ project: 1, order: 1 });

module.exports = mongoose.model("Task", taskSchema);
