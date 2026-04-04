const User = require('../models/User');
const Project = require('../models/Project');
const Setting = require('../models/Setting');

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { successResponse } = require('../utils/response');
const { hashPassword, validatePasswordStrength } = require('../utils/password');
const { ROLES, USER_STATUS, PROJECT_STATUS, SETTING_KEYS } = require('../utils/constants');
const { invalidateAnalyticsCache } = require('./analyticsController');

function ensureStudentAccess(req, studentId) {
  if (String(req.user._id) !== String(studentId)) {
    throw new AppError(403, 'You are not allowed to access this student resource');
  }
}

async function getProjectEnrollmentStats(projectIds) {
  if (!projectIds.length) {
    return {
      guideMap: new Map(),
      coGuideMap: new Map(),
      studentCountMap: new Map(),
      departmentCountMap: new Map()
    };
  }

  const [guides, coGuides, studentCounts] = await Promise.all([
    User.find({
      role: ROLES.FACULTY,
      status: USER_STATUS.APPROVED,
      appliedProject: { $in: projectIds }
    })
      .select('name employeeId department appliedProject')
      .lean(),

    User.find({
      role: ROLES.FACULTY,
      coGuideStatus: USER_STATUS.APPROVED,
      coGuidedProject: { $in: projectIds }
    })
      .select('name employeeId department coGuidedProject')
      .lean(),

    User.aggregate([
      {
        $match: {
          role: ROLES.STUDENT,
          $or: [
            { appliedProject: { $in: projectIds } },
            { projectApplications: { $in: projectIds } }
          ]
        }
      },
      {
        $project: {
          department: 1,
          allApps: {
            $setUnion: [
              { $cond: [{ $ifNull: ['$appliedProject', false] }, ['$appliedProject'], []] },
              { $ifNull: ['$projectApplications', []] }
            ]
          }
        }
      },
      {
        $unwind: '$allApps'
      },
      {
        $match: {
          allApps: { $in: projectIds }
        }
      },
      {
        $group: {
          _id: {
            projectId: '$allApps',
            department: '$department'
          },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const guideMap = new Map();
  guides.forEach((faculty) => {
    if (faculty.appliedProject) {
      guideMap.set(String(faculty.appliedProject), {
        name: faculty.name,
        employeeId: faculty.employeeId,
        department: faculty.department
      });
    }
  });

  const coGuideMap = new Map();
  coGuides.forEach((faculty) => {
    if (faculty.coGuidedProject) {
      coGuideMap.set(String(faculty.coGuidedProject), {
        name: faculty.name,
        employeeId: faculty.employeeId,
        department: faculty.department
      });
    }
  });

  const studentCountMap = new Map();
  const departmentCountMap = new Map();

  studentCounts.forEach((entry) => {
    const projId = String(entry._id.projectId);
    const dept = entry._id.department || 'Unknown';
    const count = entry.count;

    studentCountMap.set(projId, (studentCountMap.get(projId) || 0) + count);

    if (!departmentCountMap.has(projId)) {
      departmentCountMap.set(projId, new Map());
    }
    departmentCountMap.get(projId).set(dept, count);
  });

  return {
    guideMap,
    coGuideMap,
    studentCountMap,
    departmentCountMap
  };
}

const getDashboard = asyncHandler(async (req, res) => {
  const studentId = req.params.id;
  ensureStudentAccess(req, studentId);

  const student = await User.findById(studentId)
    .populate({
      path: 'appliedProject',
      populate: { path: 'departments.department' }
    })
    .populate({
      path: 'projectApplications',
      populate: { path: 'departments.department' }
    })
    .populate({
      path: 'applications.project',
      populate: { path: 'departments.department' }
    })
    .lean();

  if (!student || student.role !== ROLES.STUDENT) {
    throw new AppError(404, 'Student not found');
  }

  // Process and transform all applied projects (primary + secondary)
  const getProjId = (p) => {
    if (!p) return null;
    return p._id ? String(p._id) : String(p);
  };

  const appliedIds = [
    getProjId(student.appliedProject),
    ...(student.projectApplications || []).map(getProjId)
  ].filter(Boolean);

  if (appliedIds.length > 0) {
    const { guideMap, coGuideMap, studentCountMap } = await getProjectEnrollmentStats(appliedIds);

    const transformProject = (proj) => {
      if (!proj) return proj;
      // If proj is just an ID, we can't do much here, but we'll try to keep it as is
      // Population should ideally have turned it into an object
      if (typeof proj !== 'object' || !proj._id) return proj;

      const pid = String(proj._id);
      const guide = guideMap.get(pid);
      const coGuide = coGuideMap.get(pid);

      proj.guide = guide ? guide.name : (proj.guide || '');
      proj.guideEmpId = guide ? guide.employeeId : (proj.guideEmpId || '');
      proj.guideDept = guide ? guide.department : (proj.guideDept || '');

      proj.coGuide = coGuide ? coGuide.name : (proj.coGuide || '');
      proj.coGuideEmpId = coGuide ? coGuide.employeeId : (proj.coGuideEmpId || '');
      proj.coGuideDept = coGuide ? coGuide.department : (proj.coGuideDept || '');

      proj.registeredCount = studentCountMap.get(pid) || 0;

      const projectDepartments = proj.departments || [];
      proj.totalSeats = projectDepartments.reduce((sum, entry) => sum + (entry.seats || 0), 0);
      proj.departments = projectDepartments
        .map((entry) => ({
          name: entry.department ? (typeof entry.department === 'object' ? entry.department.name : entry.department) : 'Unknown',
          seats: entry.seats || 0
        }))
        .filter((entry) => entry.name !== 'Unknown');

      return proj;
    };

    if (student.appliedProject) {
      student.appliedProject = transformProject(student.appliedProject);
    }

    if (student.projectApplications && student.projectApplications.length > 0) {
      student.projectApplications = student.projectApplications.map(transformProject).filter(Boolean);
    }

    // Also transform projects in the structured applications array
    if (student.applications && student.applications.length > 0) {
      student.applications = student.applications.map(app => {
        if (app.project) {
          app.project = transformProject(app.project);
        }
        return app;
      });
    }
  }

  // Ensure projects array for available projects is also processed
  const projects = await Project.find({ status: PROJECT_STATUS.OPEN })
    .populate('departments.department')
    .populate('baseDept guideDept coGuideDept', 'name')
    .lean();

  const allOpenProjectIds = projects.map((project) => project._id);
  const { guideMap, coGuideMap, studentCountMap, departmentCountMap } = await getProjectEnrollmentStats(allOpenProjectIds);

  const projectData = projects.map((project) => {
    const projId = String(project._id);
    const projDeptMap = departmentCountMap.get(projId) || new Map();

    const departments = (project.departments || []).map((entry) => {
      const deptName = entry.department ? entry.department.name : 'Unknown';
      return {
        name: deptName,
        seats: entry.seats || 0,
        registered: projDeptMap.get(deptName) || 0
      };
    }).filter((entry) => entry.name !== 'Unknown');

    const studentDepartmentEntry = departments.find((entry) => entry.name === student.department);

    const guide = guideMap.get(String(project._id));
    const coGuide = coGuideMap.get(String(project._id));

    return {
      _id: project._id,
      title: project.title,
      description: project.description,
      skillsRequired: project.skillsRequired || '',
      projectOutcome: project.projectOutcome || '',
      guide: guide ? guide.name : (project.guide || ''),
      guideEmpId: guide ? guide.employeeId : (project.guideEmpId || ''),
      guideDept: guide ? guide.department : (project.guideDept ? (project.guideDept.name || project.guideDept) : ''),
      coGuide: coGuide ? coGuide.name : (project.coGuide || ''),
      coGuideEmpId: coGuide ? coGuide.employeeId : (project.coGuideEmpId || ''),
      coGuideDept: coGuide ? coGuide.department : (project.coGuideDept ? (project.coGuideDept.name || project.coGuideDept) : ''),
      seatsAvailable: studentDepartmentEntry ? studentDepartmentEntry.seats : 0,
      isEligible: Boolean(studentDepartmentEntry),
      departments,
      status: project.status,
      totalSeats: departments.reduce((sum, entry) => sum + (entry.seats || 0), 0),
      registeredCount: studentCountMap.get(String(project._id)) || 0,
      teamLeader: project.teamLeader
    };
  });

  const freezeSetting = await Setting.findOne({ key: SETTING_KEYS.STUDENT_FREEZE }).lean();
  const studentFreeze = freezeSetting ? Boolean(freezeSetting.value) : false;

  return successResponse(res, { student, projects: projectData, studentFreeze });
});

const applyForProject = asyncHandler(async (req, res) => {
  const studentId = req.body.studentId || req.user._id;
  const projectId = req.body.projectId;

  ensureStudentAccess(req, studentId);

  if (!projectId) {
    throw new AppError(400, 'Project ID is required');
  }

  const freezeSetting = await Setting.findOne({ key: SETTING_KEYS.STUDENT_FREEZE }).lean();
  if (freezeSetting && freezeSetting.value) {
    throw new AppError(403, 'Student actions are currently frozen.');
  }

  const student = await User.findById(studentId);
  if (!student || student.role !== ROLES.STUDENT) {
    throw new AppError(404, 'Student not found');
  }

  // If already approved for a project, they cannot apply for more
  if (student.appliedProject && student.status === USER_STATUS.APPROVED) {
    throw new AppError(400, 'You are already in an approved project');
  }

  // Check if they already applied for this specific project
  const alreadyInApplied = student.appliedProject && String(student.appliedProject) === String(projectId);
  const alreadyInApplications = (student.projectApplications || []).some(id => String(id) === String(projectId));

  if (alreadyInApplied || alreadyInApplications) {
    throw new AppError(400, 'You have already applied for this project');
  }

  // Check the limit of 5 projects
  const currentCount = (student.appliedProject ? 1 : 0) + (student.projectApplications ? student.projectApplications.length : 0);
  if (currentCount >= 5) {
    throw new AppError(400, 'You can apply for a maximum of 5 projects only');
  }

  const project = await Project.findById(projectId)
    .populate('departments.department')
    .populate('baseDept guideDept coGuideDept', 'name');
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (project.status !== PROJECT_STATUS.OPEN) {
    throw new AppError(400, 'Project is closed');
  }

  const departmentEntry = project.departments.find(
    (entry) => entry.department && entry.department.name === student.department
  );

  if (!departmentEntry) {
    throw new AppError(400, 'Your department is not eligible for this project');
  }

  let applicationStatus = USER_STATUS.PENDING;

  // Ensure status is PENDING if we are adding applications
  student.status = USER_STATUS.PENDING;

  // Initialize arrays if they don't exist
  if (!student.projectApplications) student.projectApplications = [];
  if (!student.applications) student.applications = [];

  // If it's the first application, put it in appliedProject for backward compatibility
  if (!student.appliedProject) {
    student.appliedProject = projectId;
  } else {
    // Check again if already in list to be safe
    if (!student.projectApplications.includes(projectId)) {
      student.projectApplications.push(projectId);
    }
  }

  // Also maintain the structured applications array
  const alreadyInStruct = student.applications.some(a => String(a.project?._id || a.project) === String(projectId));
  if (!alreadyInStruct) {
    student.applications.push({
      project: projectId,
      status: 'Pending',
      updatedAt: Date.now()
    });
  }

  await student.save();
  invalidateAnalyticsCache();
  return successResponse(res, { status: applicationStatus }, 'Application submitted successfully');
});

const withdrawApplication = asyncHandler(async (req, res) => {
  const studentId = req.body.studentId || req.user._id;
  const projectId = req.body.projectId;

  ensureStudentAccess(req, studentId);

  const freezeSetting = await Setting.findOne({ key: SETTING_KEYS.STUDENT_FREEZE }).lean();
  if (freezeSetting && freezeSetting.value) {
    throw new AppError(403, 'Student actions are currently frozen.');
  }

  const student = await User.findById(studentId);
  if (!student || student.role !== ROLES.STUDENT) {
    throw new AppError(404, 'Student not found');
  }

  // If a specific project ID is provided, find and remove it
  if (projectId === 'ALL') {
    if (student.appliedProject) {
      const project = await Project.findById(student.appliedProject)
        .populate('departments.department')
        .populate('baseDept guideDept coGuideDept', 'name');
      if (project && project.allowWithdrawal === false) {
        throw new AppError(403, 'Withdrawal is disabled for your primary project');
      }
      if (project && student.status === USER_STATUS.APPROVED) {
        const departmentEntry = project.departments.find(
          (entry) => entry.department && entry.department.name === student.department
        );
        if (departmentEntry) {
          departmentEntry.seats += 1;
          await project.save();
        }
      }
    }

    student.appliedProject = null;
    student.projectApplications = [];
    student.status = USER_STATUS.PENDING;
  } else if (projectId) {
    if (student.appliedProject && String(student.appliedProject) === String(projectId)) {
      // Withdrawing from the primary project
      const project = await Project.findById(projectId)
        .populate('departments.department')
        .populate('baseDept guideDept coGuideDept', 'name');
      if (project && project.allowWithdrawal === false) {
        throw new AppError(403, 'Withdrawal is disabled for this project');
      }

      if (project && student.status === USER_STATUS.APPROVED) {
        const departmentEntry = project.departments.find(
          (entry) => entry.department && entry.department.name === student.department
        );
        if (departmentEntry) {
          departmentEntry.seats += 1;
          await project.save();
        }
      }

      // Clear the primary slot
      student.appliedProject = null;
      student.status = USER_STATUS.PENDING;

      // Promote next application if exists
      if (student.projectApplications && student.projectApplications.length > 0) {
        student.appliedProject = student.projectApplications.shift();
      }
    } else {
      // Withdrawing from a secondary application
      const beforeLength = student.projectApplications.length;
      student.projectApplications = (student.projectApplications || []).filter(
        id => String(id) !== String(projectId)
      );
      if (student.projectApplications.length === beforeLength) {
        throw new AppError(400, 'Application not found');
      }
    }
  } else {
    // Default legacy behavior: withdraw the primary application
    if (!student.appliedProject) {
      throw new AppError(400, 'No active application found');
    }

    const project = await Project.findById(student.appliedProject)
      .populate('departments.department')
      .populate('baseDept guideDept coGuideDept', 'name');
    if (project && project.allowWithdrawal === false) {
      throw new AppError(403, 'Withdrawal is disabled for this project');
    }

    if (project && student.status === USER_STATUS.APPROVED) {
      const departmentEntry = project.departments.find(
        (entry) => entry.department && entry.department.name === student.department
      );
      if (departmentEntry) {
        departmentEntry.seats += 1;
        await project.save();
      }
    }

    student.appliedProject = null;
    student.status = USER_STATUS.PENDING;

    // Promote next application if exists
    if (student.projectApplications && student.projectApplications.length > 0) {
      student.appliedProject = student.projectApplications.shift();
    }
  }

  // Synchronize applications array
  if (projectId === 'ALL') {
    student.applications = [];
  } else if (projectId) {
    student.applications = (student.applications || []).filter(a => String(a.project) !== String(projectId));
  }

  await student.save();
  invalidateAnalyticsCache();
  return successResponse(res, {}, 'Application withdrawn successfully');
});

const selectFinalProject = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { projectId } = req.body;

  ensureStudentAccess(req, studentId);

  const freezeSetting = await Setting.findOne({ key: SETTING_KEYS.STUDENT_FREEZE }).lean();
  if (freezeSetting && freezeSetting.value) {
    throw new AppError(403, 'Student actions are currently frozen.');
  }

  const student = await User.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  if (student.level >= 2) {
    throw new AppError(400, 'Project selection is already finalized and you are at Level 2');
  }

  const app = (student.applications || []).find(a => String(a.project) === String(projectId));
  if (!app || app.status !== 'Qualified') {
    throw new AppError(400, 'You can only select a project where you are Qualified');
  }

  // 1. Set as primary appliedProject
  student.appliedProject = projectId;
  student.status = USER_STATUS.APPROVED;
  student.level = 2; // Move to Level 2

  // 2. Clear all other applications
  student.projectApplications = [];
  student.applications = student.applications.filter(a => String(a.project) === String(projectId));

  // 3. Update Seat Count
  const { decrementSeatIfRequired } = require('../utils/projectUtils');
  await decrementSeatIfRequired(projectId, student.department);

  await student.save();

  invalidateAnalyticsCache();
  return successResponse(res, { student }, 'Project selection finalized successfully. Welcome to Level 2!');
});

const updateProfile = asyncHandler(async (req, res) => {
  const studentId = req.params.id;
  ensureStudentAccess(req, studentId);

  const { password } = req.body;
  if (!password) {
    throw new AppError(400, 'Password is required');
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    throw new AppError(400, passwordValidationError);
  }

  const student = await User.findById(studentId).select('+password');
  if (!student || student.role !== ROLES.STUDENT) {
    throw new AppError(404, 'Student not found');
  }

  student.password = await hashPassword(password);
  await student.save();

  return successResponse(res, {}, 'Password updated successfully');
});

const reorderApplications = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { applications } = req.body;

  ensureStudentAccess(req, studentId);

  const freezeSetting = await Setting.findOne({ key: SETTING_KEYS.STUDENT_FREEZE }).lean();
  if (freezeSetting && freezeSetting.value) {
    throw new AppError(403, 'Student actions are currently frozen.');
  }

  const student = await User.findById(studentId);
  if (!student || student.role !== ROLES.STUDENT) {
    throw new AppError(404, 'Student not found');
  }

  if (student.status === USER_STATUS.APPROVED) {
    throw new AppError(400, 'Cannot reorder applications after being approved');
  }

  const currentList = [student.appliedProject, ...(student.projectApplications || [])].filter(Boolean).map(String);
  const newList = (applications || []).filter(Boolean).map(String);

  if (currentList.length !== newList.length || !newList.every(id => currentList.includes(id))) {
    throw new AppError(400, 'Invalid applications list provided for reordering');
  }

  const updateData = newList.length > 0 ? {
    appliedProject: newList[0],
    projectApplications: newList.slice(1)
  } : {
    appliedProject: null,
    projectApplications: []
  };

  await User.findByIdAndUpdate(studentId, { $set: updateData });
  invalidateAnalyticsCache();
  return successResponse(res, {}, 'Applications reordered successfully');
});

module.exports = {
  getDashboard,
  applyForProject,
  withdrawApplication,
  updateProfile,
  reorderApplications,
  selectFinalProject
};

