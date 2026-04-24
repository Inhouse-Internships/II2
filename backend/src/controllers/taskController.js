const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { TASK_STATUS, ROLES } = require('../utils/constants');
const xlsx = require('xlsx');
const Setting = require('../models/Setting');
const WeeklySubmission = require('../models/WeeklySubmission');
const { SETTING_KEYS } = require('../utils/constants');
const { invalidateAnalyticsCache } = require('./analyticsController');

/**
 * @desc    Set universal internship dates
 * @route   POST /api/tasks/admin/dates
 */
const setInternshipDates = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Start and end dates are required' });
    }
    // Update all tasks
    await Task.updateMany({}, { $set: { startDate, deadline: endDate } });
    invalidateAnalyticsCache();
    res.json({ message: 'Internship dates updated for all tasks' });
});

/**
 * @desc    Toggle global HOD task editing
 * @route   POST /api/tasks/admin/global-hod-edit
 */
const toggleGlobalHODTaskEdit = asyncHandler(async (req, res) => {
    const { enabled } = req.body;
    await Task.updateMany({}, { $set: { editableByHOD: enabled } });
    invalidateAnalyticsCache();
    res.json({ message: `HOD task editing ${enabled ? 'enabled' : 'disabled'} globally` });
});

/**
 * @desc    Create a new task
 * @route   POST /api/tasks/admin/create
 */
const createTask = asyncHandler(async (req, res) => {
    const { title, description, startDate, deadline, project, editableByHOD } = req.body;

    // Determine the next order number safely
    const existingTasksCount = await Task.countDocuments({ project });
    const lastTask = await Task.findOne({ project }).sort({ order: -1 }).lean();
    const startOrder = (lastTask && typeof lastTask.order === 'number') ? Math.max(lastTask.order, existingTasksCount) : existingTasksCount;

    const task = await Task.create({
        title,
        description,
        startDate,
        deadline,
        project,
        editableByHOD,
        order: startOrder + 1
    });
    invalidateAnalyticsCache();
    res.status(201).json(task);
});

/**
 * @desc    Create a new task by Faculty
 * @route   POST /api/tasks/faculty/create
 */
const createFacultyTask = asyncHandler(async (req, res) => {
    const { title, description, startDate, deadline, project } = req.body;

    const existingTasksCount = await Task.countDocuments({ project });
    const lastTask = await Task.findOne({ project }).sort({ order: -1 }).lean();
    const startOrder = (lastTask && typeof lastTask.order === 'number') ? Math.max(lastTask.order, existingTasksCount) : existingTasksCount;

    const task = await Task.create({
        title,
        description,
        startDate,
        deadline,
        project,
        order: startOrder + 1
    });
    invalidateAnalyticsCache();
    res.status(201).json(task);
});

/**
 * @desc    Bulk import tasks
 * @route   POST /api/tasks/admin/bulk-import
 */
const bulkImportTasks = asyncHandler(async (req, res) => {
    let tasksToParse = [];
    let projectId = req.body.projectId;

    if (req.file) {
        // Excel file provided via multer
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        tasksToParse = xlsx.utils.sheet_to_json(sheet);
    } else if (req.body.tasks && Array.isArray(req.body.tasks)) {
        // Fallback to JSON array
        tasksToParse = req.body.tasks;
    } else {
        return res.status(400).json({ message: 'No file uploaded or JSON tasks provided' });
    }

    if (!projectId && req.body.project) projectId = req.body.project;
    if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
    }

    const existingTasksCount = await Task.countDocuments({ project: projectId });
    const lastTask = await Task.findOne({ project: projectId }).sort({ order: -1 }).lean();
    const startOrder = (lastTask && typeof lastTask.order === 'number') ? Math.max(lastTask.order, existingTasksCount) : existingTasksCount;

    const formattedTasks = tasksToParse.map((t, index) => ({
        title: t.Title || t.title,
        startDate: t["Start Date"] || t.startDate || t.Day || t.day || "",
        deadline: t.Deadline || t.deadline || "",
        project: projectId,
        order: startOrder + index + 1
    }));

    await Task.insertMany(formattedTasks);
    invalidateAnalyticsCache();
    res.json({ message: `${tasksToParse.length} tasks imported successfully` });
});

/**
 * @desc    Export all tasks
 * @route   GET /api/tasks/admin/export-all
 */
const exportAllTasks = asyncHandler(async (req, res) => {
    const { projectId } = req.query;
    const filter = (projectId && projectId !== 'all') ? { project: projectId } : {};
    const tasks = await Task.find(filter).populate('project', 'title').lean();
    return res.status(200).json(tasks);
});

/**
 * @desc    Get all tasks for Admin UI
 * @route   GET /api/tasks/admin
 */
const getAdminTasks = asyncHandler(async (req, res) => {
    const { projectId } = req.query;
    const filter = projectId ? { project: projectId } : {};

    // Fetch global start date for date calculations
    const startDateSetting = await Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_START_DATE }).lean();
    const globalStartDate = startDateSetting ? new Date(startDateSetting.value) : null;

    const tasks = await Task.find(filter).populate('project', 'title').sort({ order: 1, createdAt: 1 }).lean();

    const taskIds = tasks.map(t => t._id);
    const submissions = await TaskSubmission.find({ task: { $in: taskIds } }, 'task completionPercentage facultyAdjustedPercentage remarks status student fileUrl fileName descriptionOfWork submittedAt')
        .populate('student', 'name studentId')
        .lean();

    const submissionMap = {};
    submissions.forEach(s => {
        const taskId = String(s.task);
        if (!submissionMap[taskId]) submissionMap[taskId] = [];
        submissionMap[taskId].push(s);
    });

    const tasksWithStats = tasks.map(t => {
        const subs = submissionMap[String(t._id)] || [];
        const submissionCount = subs.length;

        // Dynamic date calculation
        let calculatedStart = t.startDate;
        let calculatedEnd = t.deadline;

        if (globalStartDate && t.order) {
            const dStart = new Date(globalStartDate);
            dStart.setDate(dStart.getDate() + (t.order - 1));
            calculatedStart = dStart.toISOString().split('T')[0];

            const dEnd = new Date(dStart);
            calculatedEnd = dEnd.toISOString().split('T')[0];
        }

        const remarks = subs.find(s => s.remarks)?.remarks || "";
        const status = subs.length > 0 ? subs[0].status : "Not Submitted";

        return {
            ...t,
            startDate: calculatedStart,
            deadline: calculatedEnd,
            submissionCount,
            remarks,
            status,
            submissions: subs
        };
    });

    res.json(tasksWithStats);
});

/**
 * @desc    Edit a task
 * @route   PUT /api/tasks/admin/:id
 */
const editTask = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await Task.findByIdAndUpdate(id, req.body, { new: true });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    invalidateAnalyticsCache();
    res.json(task);
});

/**
 * @desc    Delete a task
 * @route   DELETE /api/tasks/admin/:id
 */
const deleteTask = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Cascade delete submissions
    await TaskSubmission.deleteMany({ task: id });
    
    const task = await Task.findByIdAndDelete(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    
    invalidateAnalyticsCache();
    res.json({ message: 'Task deleted successfully' });
});

/**
 * @desc    Bulk delete tasks
 * @route   DELETE /api/tasks/admin/bulk-delete
 */
const bulkDeleteTasks = asyncHandler(async (req, res) => {
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: 'No tasks provided for deletion' });
    }

    // Cascade delete submissions
    await TaskSubmission.deleteMany({ task: { $in: taskIds } });

    await Task.deleteMany({ _id: { $in: taskIds } });
    invalidateAnalyticsCache();
    res.json({ message: `${taskIds.length} tasks deleted successfully` });
});

/**
 * @desc    Get Admin Task Analytics
 * @route   GET /api/tasks/admin/analytics
 */
const getAdminTaskAnalytics = asyncHandler(async (req, res) => {
    const now = new Date();

    const [taskStats, submissionStats, projectStats] = await Promise.all([
        // Task general stats
        Task.aggregate([
            {
                $facet: {
                    total: [{ $count: "count" }],
                    active: [
                        {
                            $match: {
                                $or: [
                                    { deadline: { $exists: false } },
                                    { deadline: "" },
                                    {
                                        $expr: {
                                            $gte: [
                                                { $dateFromString: { dateString: "$deadline", onError: new Date("9999-12-31"), onNull: new Date("9999-12-31") } },
                                                now
                                            ]
                                        }
                                    }
                                ]
                            }
                        },
                        { $count: "count" }
                    ]
                }
            }
        ]),

        // Submission detailed stats
        TaskSubmission.aggregate([
            {
                $lookup: {
                    from: 'tasks',
                    localField: 'task',
                    foreignField: '_id',
                    as: 'taskInfo'
                }
            },
            { $unwind: { path: "$taskInfo", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: null,
                    totalSubmissions: { $sum: 1 },
                    approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
                    sumCompletion: { $sum: { $ifNull: ["$facultyAdjustedPercentage", { $ifNull: ["$completionPercentage", 0] }] } },
                    delayedCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $not: [{ $in: ["$taskInfo.deadline", [null, ""]] }] },
                                        {
                                            $gt: [
                                                "$submittedAt",
                                                { $dateFromString: { dateString: "$taskInfo.deadline", onError: new Date("1970-01-01"), onNull: new Date("1970-01-01") } }
                                            ]
                                        }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]),

        // Project-wise stats
        Task.aggregate([
            { $group: { _id: "$project", taskCount: { $sum: 1 } } },
            { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'projectDetails' } },
            { $unwind: "$projectDetails" },
            {
                $lookup: {
                    from: 'tasksubmissions',
                    localField: '_id',
                    foreignField: 'project',
                    as: 'subs'
                }
            },
            {
                $project: {
                    _id: 1,
                    projectName: "$projectDetails.title",
                    taskCount: 1,
                    submissionCount: { $size: "$subs" },
                    avgProjectCompletion: {
                        $avg: "$subs.completionPercentage"
                    }
                }
            },
            { $sort: { taskCount: -1 } }
        ])
    ]);

    const taskData = taskStats[0] || { total: [], active: [] };
    const subData = submissionStats[0] || { totalSubmissions: 0, approved: 0, pending: 0, rejected: 0, sumCompletion: 0, delayedCount: 0 };

    res.json({
        totalTasks: taskData.total[0]?.count || 0,
        activeTasks: taskData.active[0]?.count || 0,
        totalSubmissions: subData.totalSubmissions,
        statusBreakdown: {
            approved: subData.approved,
            pending: subData.pending,
            rejected: subData.rejected
        },
        averageCompletion: subData.totalSubmissions > 0 ? (subData.sumCompletion / subData.totalSubmissions).toFixed(2) : 0,
        delayRate: subData.totalSubmissions > 0 ? ((subData.delayedCount / subData.totalSubmissions) * 100).toFixed(2) : 0,
        projectStats: projectStats
    });
});

/**
 * @desc    Get all tasks for a project
 * @route   GET /api/tasks/project/:projectId
 */
const getProjectTasks = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const totalTasks = await Task.countDocuments({ project: projectId });
    const tasks = await Task.find({ project: projectId })
        .sort({ order: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

    res.json({
        data: tasks,
        totalTasks,
        page,
        limit,
        totalPages: Math.ceil(totalTasks / limit)
    });
});

/**
 * @desc    Submit a task
 * @route   POST /api/tasks/student/submit/:taskId
 */
const submitTask = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { descriptionOfWork, project, status: reqStatus, completionPercentage } = req.body;
    const studentId = req.user._id;

    if (!project) return res.status(400).json({ message: 'Project ID is required' });

    // Verify project exists
    const projectDoc = await require('../models/Project').findById(project).lean();
    if (!projectDoc) return res.status(404).json({ message: 'Project not found' });

    // Harmonize status logic: check if explicitly "completed" or if percentage is 100
    const isCompleted = (reqStatus && reqStatus.toLowerCase() === 'completed') || completionPercentage === 100 || completionPercentage === '100';

    const updatePayload = {
        descriptionOfWork: descriptionOfWork || (isCompleted ? "Task completed" : "Task not completed"),
        completionPercentage: isCompleted ? 100 : 0,
        project,
        status: isCompleted ? TASK_STATUS.PENDING : TASK_STATUS.REJECTED,
        submittedAt: new Date()
    };

    if (req.file) {
        updatePayload.fileUrl = `/uploads/submissions/${req.file.filename}`;
        updatePayload.fileName = req.file.originalname;
    }

    const submission = await TaskSubmission.findOneAndUpdate(
        { task: taskId, student: studentId },
        updatePayload,
        { upsert: true, new: true }
    );
    invalidateAnalyticsCache();
    res.json({ message: 'Task status updated', submission });
});

/**
 * @desc    Submit weekly progress report
 * @route   POST /api/tasks/student/weekly
 */
const submitWeeklyTask = asyncHandler(async (req, res) => {
    const { weekNumber, description, completionPercentage, project } = req.body;
    const studentId = req.user._id;

    if (!project || !weekNumber || !description || completionPercentage === undefined) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Verify project exists
    const projectDoc = await require('../models/Project').findById(project).lean();
    if (!projectDoc) return res.status(404).json({ message: 'Project not found' });

    const submission = await WeeklySubmission.findOneAndUpdate(
        { student: studentId, weekNumber, project },
        {
            description,
            completionPercentage,
            status: TASK_STATUS.PENDING,
            submittedAt: new Date()
        },
        { upsert: true, new: true }
    );
    invalidateAnalyticsCache();
    res.json({ message: 'Weekly report submitted', submission });
});

/**
 * @desc    Get weekly submissions for a project
 * @route   GET /api/tasks/weekly/project/:projectId
 */
const getWeeklySubmissions = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    // Security check for students: can only see their own project's reports
    if (req.user.role === ROLES.STUDENT && String(req.user.appliedProject) !== String(projectId)) {
        return res.status(403).json({ message: 'Forbidden: you can only view reports for your own project' });
    }

    const submissions = await WeeklySubmission.find({ project: projectId })
        .populate('student', 'name studentId department')
        .sort({ weekNumber: 1 })
        .lean();
    res.json(submissions);
});

/**
 * @desc    Review weekly submission
 * @route   PUT /api/tasks/weekly/review/:id
 */
const reviewWeeklySubmission = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const submission = await WeeklySubmission.findById(id);
    if (!submission) return res.status(404).json({ message: 'Weekly report not found' });

    if (status) submission.status = status;
    if (remarks !== undefined) submission.remarks = remarks;

    await submission.save();
    invalidateAnalyticsCache();
    res.json({ message: 'Weekly report reviewed', submission });
});

/**
 * @desc    Review a submission
 * @route   PUT /api/tasks/review/:taskId/:studentId
 */
const reviewSubmission = asyncHandler(async (req, res) => {
    const { taskId, studentId } = req.params;
    const { status, remarks, facultyAdjustedPercentage } = req.body;

    const submission = await TaskSubmission.findOne({ task: taskId, student: studentId });
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    if (status) submission.status = status;
    if (remarks !== undefined) submission.remarks = remarks;
    if (facultyAdjustedPercentage !== undefined) submission.facultyAdjustedPercentage = facultyAdjustedPercentage;

    await submission.save();
    invalidateAnalyticsCache();
    res.json({ message: 'Review updated', submission });
});

/**
 * @desc    Get all submissions for a project
 * @route   GET /api/tasks/faculty/project/:projectId/submissions
 */
const getProjectSubmissions = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const submissions = await TaskSubmission.find({ project: projectId })
        .populate('student', 'name studentId department')
        .populate('task', 'title deadline')
        .lean();

    res.json(submissions);
});

/**
 * @desc    Get all submissions for a faculty's students
 * @route   GET /api/tasks/faculty/submissions
 */
const getFacultySubmissions = asyncHandler(async (req, res) => {
    const facultyId = req.user._id;
    const faculty = await User.findById(facultyId);

    if (!faculty || (!faculty.appliedProject && !faculty.coGuidedProject)) {
        return res.json({ data: [] });
    }

    const projects = [faculty.appliedProject, faculty.coGuidedProject].filter(Boolean);
    const students = await User.find({ role: 'student', appliedProject: { $in: projects } }).select('_id');
    const studentIds = students.map(s => s._id);

    const submissions = await TaskSubmission.find({ student: { $in: studentIds } })
        .populate('student', 'name email department studentId')
        .populate('task', 'title description deadline')
        .sort({ submittedAt: -1 })
        .lean();

    res.json({ data: submissions });
});

/**
 * @desc    Review a submission by ID
 * @route   PUT /api/tasks/faculty/submissions/:submissionId/review
 */
const reviewSubmissionById = asyncHandler(async (req, res) => {
    const { submissionId } = req.params;
    const { status, remarks, facultyAdjustedPercentage } = req.body;

    const submission = await TaskSubmission.findById(submissionId);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    if (status) submission.status = status.toLowerCase();
    if (remarks !== undefined) submission.remarks = remarks;
    if (facultyAdjustedPercentage !== undefined) submission.facultyAdjustedPercentage = facultyAdjustedPercentage;

    await submission.save();
    invalidateAnalyticsCache();
    res.json({ message: 'Review updated', submission });
});

/**
 * @desc    Update project task visibility/editability
 * @route   PUT /api/tasks/faculty/project/:projectId/visibility
 */
const updateProjectTaskVisibility = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { editableByHOD } = req.body;
    await Task.updateMany({ project: projectId }, { $set: { editableByHOD } });
    invalidateAnalyticsCache();
    res.json({ message: 'Task visibility updated' });
});

/**
 * @desc    Update a specific task deadline
 * @route   PUT /api/tasks/faculty/task/:taskId/deadline
 */
const updateTaskDeadline = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { deadline } = req.body;
    await Task.findByIdAndUpdate(taskId, { deadline });
    invalidateAnalyticsCache();
    res.json({ message: 'Deadline updated' });
});

/**
 * @desc    Get tasks for student's project
 * @route   GET /api/tasks/my-project
 */
const getMyProjectTasks = asyncHandler(async (req, res) => {
    const student = await User.findById(req.user._id);
    if (!student || !student.appliedProject) {
        return res.json({ data: [] });
    }
    const tasks = await Task.find({ project: student.appliedProject }).sort({ order: 1, createdAt: 1 }).lean();
    res.json({ data: tasks });
});

/**
 * @desc    Get all submissions by the student
 * @route   GET /api/tasks/student/submissions
 */
const getMySubmissions = asyncHandler(async (req, res) => {
    const submissions = await TaskSubmission.find({ student: req.user._id }).lean();
    res.json({ data: submissions });
});

/**
 * @desc    Get projects for a faculty with task counts
 * @route   GET /api/tasks/faculty/projects
 */
const getFacultyProjectsWithTaskCount = asyncHandler(async (req, res) => {
    const facultyId = req.user._id;
    const faculty = await User.findById(facultyId).lean();

    if (!faculty) return res.json({ data: [] });

    const projects = [faculty.appliedProject, faculty.coGuidedProject].filter(Boolean);
    if (projects.length === 0) return res.json({ data: [] });

    const projectDocs = await require('../models/Project').find({ _id: { $in: projects } }).lean();

    const result = await Promise.all(projectDocs.map(async (proj) => {
        const taskCount = await Task.countDocuments({ project: proj._id });
        return {
            ...proj,
            taskCount
        };
    }));

    res.json({ data: result });
});

/**
 * @desc    Get assigned project for student with task counts
 * @route   GET /api/tasks/student/project
 */
const getStudentProjectWithTaskCount = asyncHandler(async (req, res) => {
    const studentId = req.user._id;
    const student = await User.findById(studentId).populate('appliedProject').lean();

    if (!student || !student.appliedProject) {
        return res.json({ data: null });
    }

    const taskCount = await Task.countDocuments({ project: student.appliedProject._id });

    res.json({ data: { ...student.appliedProject, taskCount } });
});

module.exports = {
    setInternshipDates,
    toggleGlobalHODTaskEdit,
    createTask,
    bulkImportTasks,
    exportAllTasks,
    getAdminTasks,
    editTask,
    deleteTask,
    bulkDeleteTasks,
    getAdminTaskAnalytics,
    getProjectTasks,
    submitTask,
    reviewSubmission,
    reviewSubmissionById,
    getProjectSubmissions,
    getFacultySubmissions,
    getMyProjectTasks,
    getMySubmissions,
    getFacultyProjectsWithTaskCount,
    getStudentProjectWithTaskCount,
    updateProjectTaskVisibility,
    updateTaskDeadline,
    submitWeeklyTask,
    getWeeklySubmissions,
    reviewWeeklySubmission,
    createFacultyTask
};
