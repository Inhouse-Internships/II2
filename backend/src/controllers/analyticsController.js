const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const Project = require('../models/Project');
const User = require('../models/User');
const Department = require('../models/Department');
const Program = require('../models/Program');
const Attendance = require('../models/Attendance');
const Review = require('../models/Review');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { ROLES } = require('../utils/constants');
const { cacheGet, cacheSet, cacheDelete } = require('../utils/cache');

const ANALYTICS_CACHE_TTL_MS = parseInt(process.env.ANALYTICS_CACHE_TTL_MS || '120000', 10);
const CACHE_KEY_UNIVERSITY = 'analytics:university';

/**
 * Call this from other controllers after mutations that affect analytics figures
 * (e.g., after approving a student, completing a task, etc.)
 */
function invalidateAnalyticsCache() {
  cacheDelete(CACHE_KEY_UNIVERSITY);
}

const getUniversityAnalytics = asyncHandler(async (req, res) => {
  // Serve from cache if available (avoids 8 DB queries on every dashboard reload)
  const cached = cacheGet(CACHE_KEY_UNIVERSITY);
  if (cached) {
    return successResponse(res, cached, 'Analytics fetched (cached)');
  }

  // Run all aggregations in parallel
  const [
    totalStudents,
    totalL1Students,
    totalDepartments,
    totalTasks,
    totalSubmissions,
    completionStats,
    studentAggregates,
    recentSubmissions,
    totalFeePaid
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT, level: { $gte: 2 } }),
    User.countDocuments({ role: ROLES.STUDENT, level: 1 }),
    Department.countDocuments(),
    Task.countDocuments(),
    TaskSubmission.countDocuments(),
    TaskSubmission.aggregate([
      {
        $group: {
          _id: null,
          averageCompletion: {
            $avg: { $ifNull: ['$facultyAdjustedPercentage', '$completionPercentage'] }
          }
        }
      }
    ]),
    TaskSubmission.aggregate([
      {
        $group: {
          _id: '$student',
          avgScore: {
            $avg: { $ifNull: ['$facultyAdjustedPercentage', '$completionPercentage'] }
          }
        }
      },
      {
        $facet: {
          top: [
            { $sort: { avgScore: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1, email: 1 } }],
                as: 'info'
              }
            },
            { $unwind: '$info' },
            { $project: { name: '$info.name', email: '$info.email', score: '$avgScore' } }
          ],
          bottom: [
            { $match: { avgScore: { $lt: 40 } } },
            { $sort: { avgScore: 1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1, email: 1 } }],
                as: 'info'
              }
            },
            { $unwind: '$info' },
            { $project: { name: '$info.name', email: '$info.email', score: '$avgScore' } }
          ]
        }
      }
    ]),
    TaskSubmission.find()
      .sort({ submittedAt: -1 })
      .limit(10)
      .populate('student', 'name email')
      .populate('task', 'title')
      .lean(),
    User.countDocuments({ role: ROLES.STUDENT, isFeePaid: true })
  ]);

  const result = {
    totalStudents,
    totalL1Students,
    totalDepartments,
    totalTasks,
    totalSubmissions,
    averageCompletion: completionStats[0]?.averageCompletion ?? 0,
    topStudents: studentAggregates[0]?.top ?? [],
    bottomStudents: studentAggregates[0]?.bottom ?? [],
    recentSubmissions,
    totalFeePaid
  };

  // Cache for configured TTL (default 2 minutes)
  cacheSet(CACHE_KEY_UNIVERSITY, result, ANALYTICS_CACHE_TTL_MS);

  return successResponse(res, result);
});

const getDepartmentAnalytics = asyncHandler(async (req, res) => {
  let departmentName = req.params.departmentId;
  if (req.user.role === 'hod' && req.user.department) {
    departmentName = req.user.department;
  }

  // Find the department document to get its ObjectId
  const deptDoc = await Department.findOne({ name: departmentName });
  if (!deptDoc) {
    return successResponse(res, {
      overall: { totalTasks: 0, totalSubmissions: 0, averageCompletion: 0, delayRate: 0 },
      projectStats: []
    }, "Department Analytics (Empty)");
  }

  const projectFilter = { baseDept: deptDoc._id };
  if (req.user.role !== ROLES.ADMIN) {
    projectFilter.status = 'Open';
  }

  const [projects, totalStudents, totalL1Students, totalL2Students, guides] = await Promise.all([
    Project.find(projectFilter)
      .select('_id title projectId guide coGuide')
      .sort({ status: -1, createdAt: -1 })
      .lean(),
    User.countDocuments({ role: ROLES.STUDENT, department: departmentName }),
    User.countDocuments({ role: ROLES.STUDENT, department: departmentName, level: 1 }),
    User.countDocuments({ role: ROLES.STUDENT, department: departmentName, level: { $gte: 2 } }),
    User.countDocuments({ role: ROLES.FACULTY, department: departmentName })
  ]);

  const projectIds = projects.map(p => p._id);

  // Find all tasks for these projects
  const tasks = await Task.find({ project: { $in: projectIds } }).lean();
  const taskIds = tasks.map(t => t._id);

  // Find all submissions for these tasks
  const submissions = await TaskSubmission.find({ task: { $in: taskIds } }).lean();

  // Map tasks for quick lookup
  const taskMap = {};
  tasks.forEach(t => { taskMap[String(t._id)] = t; });

  let totalDeptCompletionPercentages = 0;
  const totalDeptSubmissions = submissions.length;
  const pendingApprovals = submissions.filter(s => s.status === 'pending').length;



  let deptDelayedCount = 0;

  // Aggregate project-wise metrics
  const projStatsMap = {};
  projects.forEach(p => {
    projStatsMap[String(p._id)] = {
      projectId: p._id,
      displayId: p.projectId,
      projectTitle: p.title,
      guide: p.guide,
      coGuide: p.coGuide,
      totalTasks: 0,
      totalSubmissions: 0,
      completedTasks: 0,
      sumCompletion: 0,
      delayedCount: 0
    };
  });

  tasks.forEach(t => {
    const pId = String(t.project);
    if (projStatsMap[pId]) {
      projStatsMap[pId].totalTasks += 1;
    }
  });

  submissions.forEach(sub => {
    const tId = String(sub.task);
    const task = taskMap[tId];
    const pId = task ? String(task.project) : null;

    const completion = sub.facultyAdjustedPercentage ?? sub.completionPercentage ?? 0;
    totalDeptCompletionPercentages += completion;

    let isDelayed = false;
    if (task && task.deadline) {
      if (new Date(sub.submittedAt) > new Date(task.deadline)) {
        isDelayed = true;
        deptDelayedCount += 1;
      }
    }

    if (pId && projStatsMap[pId]) {
      projStatsMap[pId].totalSubmissions += 1;
      projStatsMap[pId].sumCompletion += completion;
      if (sub.status === 'approved') projStatsMap[pId].completedTasks += 1;
      if (isDelayed) projStatsMap[pId].delayedCount += 1;
    }
  });

  const deptAvgCompletion = totalDeptSubmissions > 0 ? totalDeptCompletionPercentages / totalDeptSubmissions : 0;
  const deptDelayRate = totalDeptSubmissions > 0 ? (deptDelayedCount / totalDeptSubmissions) * 100 : 0;

  const projectStatsList = projects.map(p => {
    const st = projStatsMap[String(p._id)];
    return {
      projectId: st.projectId,
      displayId: st.displayId,
      projectTitle: st.projectTitle,
      guide: st.guide,
      coGuide: st.coGuide,
      totalTasks: st.totalTasks,
      totalSubmissions: st.totalSubmissions,
      completedTasks: st.completedTasks,
      averageCompletion: st.totalSubmissions > 0 ? st.sumCompletion / st.totalSubmissions : 0,
      delayRate: st.totalSubmissions > 0 ? (st.delayedCount / st.totalSubmissions) * 100 : 0
    };
  });

  return successResponse(res, {
    totalStudents,
    totalL1Students,
    totalL2Students,
    totalSubmissions: totalDeptSubmissions,
    pendingApprovals,
    averageCompletion: deptAvgCompletion,
    totalGuides,
    overall: {
      totalTasks: tasks.length,
      totalSubmissions: totalDeptSubmissions,
      averageCompletion: deptAvgCompletion,
      delayRate: deptDelayRate
    },
    projectStats: projectStatsList
  }, "Department Analytics retrieved");
});

const getGuideAnalytics = asyncHandler(async (req, res) => {
  const guideId = req.user._id;
  const guide = await User.findById(guideId);
  if (!guide) throw new AppError(404, "Guide not found");

  // Students under Guide's applied project
  let studentIds = [];
  if (guide.appliedProject || guide.coGuidedProject) {
    const projects = [guide.appliedProject, guide.coGuidedProject].filter(Boolean);
    const students = await User.find({ role: 'student', appliedProject: { $in: projects } }).select('_id name email');
    studentIds = students.map(s => s._id);

    const submissions = await TaskSubmission.find({ student: { $in: studentIds } });
    const avg = submissions.length ? submissions.reduce((s, x) => s + (x.facultyAdjustedPercentage ?? x.completionPercentage), 0) / submissions.length : 0;

    return successResponse(res, {
      totalSupervisedStudents: students.length,
      totalSubmissions: submissions.length,
      pendingReviews: submissions.filter(s => s.status === 'pending').length,
      averageStudentCompletion: avg,
      students
    }, "Guide Analytics retrieved");
  }

  return successResponse(res, { totalSupervisedStudents: 0, totalSubmissions: 0, pendingReviews: 0, averageStudentCompletion: 0, students: [] }, "Guide Analytics retrieved");
});

const getStudentAnalytics = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const student = await User.findById(studentId);

  if (student.level < 2) {
    return successResponse(res, { message: "No analytics available for Level 1 students" }, "Student Analytics");
  }

  const submissions = await TaskSubmission.find({ student: studentId }).populate('task', 'title deadline assignedDays');
  const totalSubmissions = submissions.length;
  const approved = submissions.filter(s => s.status === 'approved').length;

  let totalScore = 0;
  submissions.forEach(s => totalScore += (s.facultyAdjustedPercentage ?? s.completionPercentage));
  const averageScore = totalSubmissions > 0 ? totalScore / totalSubmissions : 0;

  return successResponse(res, {
    totalSubmissions,
    approvedSubmissions: approved,
    averageScore,
    recentSubmissions: submissions.slice(-5)
  }, "Student Analytics retrieved");
});

module.exports = {
  getUniversityAnalytics,
  getDepartmentAnalytics,
  getGuideAnalytics,
  getStudentAnalytics,
  invalidateAnalyticsCache
};
