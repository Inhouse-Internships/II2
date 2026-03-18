const mongoose = require("mongoose");
const { TASK_STATUS } = require("../utils/constants");

const weeklySubmissionSchema = new mongoose.Schema(
    {
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
        weekNumber: {
            type: Number,
            required: true,
        },
        description: {
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
        submittedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

weeklySubmissionSchema.index({ student: 1, weekNumber: 1 }, { unique: true });
weeklySubmissionSchema.index({ project: 1 });
weeklySubmissionSchema.index({ status: 1 });

module.exports = mongoose.model("WeeklySubmission", weeklySubmissionSchema);
