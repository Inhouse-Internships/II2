const mongoose = require("mongoose");
const { TASK_STATUS } = require("../utils/constants");

const taskSubmissionSchema = new mongoose.Schema(
    {
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        descriptionOfWork: {
            type: String,
            required: true,
            trim: true,
        },
        completionPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        status: {
            type: String,
            enum: Object.values(TASK_STATUS),
            default: TASK_STATUS.PENDING,
        },
        remarks: {
            type: String,
            trim: true,
        },
        facultyAdjustedPercentage: {
            type: Number,
            min: 0,
            max: 100,
        },
        fileUrl: {
            type: String,
        },
        fileName: {
            type: String,
        },
        submittedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

taskSubmissionSchema.index({ task: 1 });
taskSubmissionSchema.index({ student: 1 });
taskSubmissionSchema.index({ project: 1 });
taskSubmissionSchema.index({ status: 1 });
taskSubmissionSchema.index({ submittedAt: -1 });
taskSubmissionSchema.index({ project: 1, status: 1 });
taskSubmissionSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model("TaskSubmission", taskSubmissionSchema);
