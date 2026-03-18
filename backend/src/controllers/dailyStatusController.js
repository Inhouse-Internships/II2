const DailyStatus = require('../models/DailyStatus');
const Project = require('../models/Project');
const { successResponse } = require('../utils/response');

// Submit status (Student)
exports.submitStatus = async (req, res, next) => {
    try {
        console.log('Daily Status Submission Body:', req.body);
        const { project, projectId: pId, workDone, blockers, hoursSpent, date } = req.body;
        const finalProjectId = project || pId;

        console.log('Final Project ID extracted:', finalProjectId);

        if (!finalProjectId) {
            return res.status(400).json({ success: false, message: 'Project ID is required' });
        }

        const projectDoc = await Project.findById(finalProjectId);
        if (!projectDoc) return res.status(404).json({ success: false, message: 'Project not found' });

        const status = new DailyStatus({
            project: finalProjectId,
            student: req.user._id,
            workDone,
            blockers,
            hoursSpent,
            date: date || new Date()
        });

        await status.save();
        return successResponse(res, status, 'Daily status submitted', 201);
    } catch (error) {
        next(error);
    }
};

// Get student's statuses (Student)
exports.getStudentStatuses = async (req, res, next) => {
    try {
        const statuses = await DailyStatus.find({
            student: req.user._id,
            project: req.params.projectId
        }).sort({ date: -1 });
        return successResponse(res, statuses);
    } catch (error) {
        next(error);
    }
};

// Edit status (Student)
exports.editStatus = async (req, res, next) => {
    try {
        const { workDone, blockers, hoursSpent } = req.body;
        const status = await DailyStatus.findOneAndUpdate(
            { _id: req.params.id, student: req.user._id },
            { workDone, blockers, hoursSpent },
            { new: true }
        );
        if (!status) return res.status(404).json({ success: false, message: 'Status not found' });
        return successResponse(res, status, 'Status updated');
    } catch (error) {
        next(error);
    }
};

// Delete status (Student)
exports.deleteStatus = async (req, res, next) => {
    try {
        const status = await DailyStatus.findOneAndDelete({
            _id: req.params.id,
            student: req.user._id,
            'facultyReview.status': 'Pending' // Only allow deleting if not reviewed
        });

        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Status not found or already reviewed and cannot be deleted'
            });
        }

        return successResponse(res, null, 'Daily status deleted successfully');
    } catch (error) {
        next(error);
    }
};

// Get project statuses (Faculty)
exports.getFacultyStatuses = async (req, res, next) => {
    try {
        const statuses = await DailyStatus.find({ project: req.params.projectId })
            .populate('student', 'name email registerNumber')
            .sort({ date: -1 });
        return successResponse(res, statuses);
    } catch (error) {
        next(error);
    }
};

// Review status (Faculty)
exports.reviewStatus = async (req, res, next) => {
    try {
        const { feedback } = req.body;
        const status = await DailyStatus.findById(req.params.id);
        if (!status) return res.status(404).json({ success: false, message: 'Status not found' });

        status.facultyReview = {
            status: 'Reviewed',
            feedback,
            reviewedBy: req.user._id,
            reviewedAt: new Date()
        };

        await status.save();
        return successResponse(res, status, 'Status reviewed');
    } catch (error) {
        next(error);
    }
};

// Admin: get all statuses
exports.getAllStatuses = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;

        const total = await DailyStatus.countDocuments();
        const statuses = await DailyStatus.find()
            .populate('student', 'name')
            .populate('project', 'title')
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        return successResponse(res, {
            statuses,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        }, 'All statuses retrieved');
    } catch (error) {
        next(error);
    }
};
