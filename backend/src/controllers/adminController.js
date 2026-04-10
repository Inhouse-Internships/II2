const Program = require('../models/Program');
const Department = require('../models/Department');
const Project = require('../models/Project');
const Setting = require('../models/Setting');
const User = require('../models/User');

const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { successResponse } = require('../utils/response');
const { hashPassword, validatePasswordStrength } = require('../utils/password');
const { sendMail } = require('../mailer');
const {
  ROLES,
  SETTING_KEYS,
  USER_STATUS,
  PROJECT_STATUS,
  FACULTY_ASSIGNMENT_ROLE
} = require('../utils/constants');
const {
  decrementSeatIfRequired,
  incrementSeatIfRequired,
  syncFacultyProjectByEmpId
} = require('../utils/projectUtils');
const { invalidateAnalyticsCache } = require('./analyticsController');
const { sanitizeUser, normalizeEmail, escapeRegex, checkEmailProhibited } = require('../utils/userUtils');

function parsePagination(query = {}) {
  const limit = Number(query.limit);
  const skip = Number(query.skip);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    skip: Number.isFinite(skip) && skip > 0 ? skip : 0
  };
}



function normalizeStatus(value, fallback = USER_STATUS.PENDING) {
  const status = String(value || '').toLowerCase();
  if (status === USER_STATUS.APPROVED.toLowerCase()) return USER_STATUS.APPROVED;
  if (status === USER_STATUS.REJECTED.toLowerCase()) return USER_STATUS.REJECTED;
  if (status === USER_STATUS.PENDING.toLowerCase()) return USER_STATUS.PENDING;
  return fallback;
}

function normalizeFacultyAssignmentRole(value) {
  return value === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE
    ? FACULTY_ASSIGNMENT_ROLE.CO_GUIDE
    : FACULTY_ASSIGNMENT_ROLE.GUIDE;
}



async function getBooleanSetting(key, fallback = false) {
  const setting = await Setting.findOne({ key }).lean();
  if (!setting) return fallback;
  return Boolean(setting.value);
}

async function findDepartmentByName(name) {
  if (!name) return null;
  return Department.findOne({ name: new RegExp(`^${escapeRegex(String(name).trim())}$`, 'i') });
}

function parseProjectInput(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return value._id || value.title || null;
  }
  return null;
}

async function resolveProjectId(projectInput) {
  const parsed = parseProjectInput(projectInput);
  if (!parsed) return null;

  const byId = await Project.findById(parsed).select('_id').lean();
  if (byId) return byId._id;

  const byTitle = await Project.findOne({ title: new RegExp(`^${escapeRegex(parsed)}$`, 'i') }).select('_id').lean();
  return byTitle ? byTitle._id : null;
}



function resolveManagedPassword(rawPassword) {
  if (rawPassword !== undefined && rawPassword !== null && String(rawPassword).trim() !== '') {
    return String(rawPassword);
  }

  if (env.DEFAULT_IMPORTED_USER_PASSWORD) {
    return env.DEFAULT_IMPORTED_USER_PASSWORD;
  }

  throw new AppError(
    500,
    'DEFAULT_IMPORTED_USER_PASSWORD is not configured. Provide a password or set the environment variable.'
  );
}

// Settings
const getSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.find().lean();
  return successResponse(res, settings);
});

const getAboutUsSetting = asyncHandler(async (req, res) => {
  const setting = await Setting.findOne({ key: SETTING_KEYS.ABOUT_US_TEXT }).lean();
  return successResponse(res, { aboutUsText: setting ? setting.value : '' });
});

const getLandingContent = asyncHandler(async (req, res) => {
  const [aboutUs, devTeam] = await Promise.all([
    Setting.findOne({ key: SETTING_KEYS.ABOUT_US_TEXT }).lean(),
    Setting.findOne({ key: SETTING_KEYS.DEVELOPMENT_TEAM }).lean()
  ]);
  return successResponse(res, {
    aboutUsText: aboutUs ? aboutUs.value : '',
    developmentTeam: devTeam ? devTeam.value : ''
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    throw new AppError(400, 'Setting key is required');
  }

  const setting = await Setting.findOneAndUpdate(
    { key },
    { value },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return successResponse(res, setting, 'Setting updated');
});

const getAutoApproveSetting = asyncHandler(async (req, res) => {
  const autoApprove = await getBooleanSetting(SETTING_KEYS.AUTO_APPROVE_STUDENT, false);
  return successResponse(res, { autoApprove });
});

const setAutoApproveSetting = asyncHandler(async (req, res) => {
  const autoApprove = Boolean(req.body.autoApprove);
  await Setting.findOneAndUpdate(
    { key: SETTING_KEYS.AUTO_APPROVE_STUDENT },
    { value: autoApprove },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return successResponse(res, { autoApprove }, 'Student auto-approval setting updated');
});

const getAutoApproveFacultySetting = asyncHandler(async (req, res) => {
  const autoApproveFaculty = await getBooleanSetting(SETTING_KEYS.AUTO_APPROVE_FACULTY, false);
  return successResponse(res, { autoApproveFaculty });
});

const setAutoApproveFacultySetting = asyncHandler(async (req, res) => {
  const autoApproveFaculty = Boolean(req.body.autoApproveFaculty);
  await Setting.findOneAndUpdate(
    { key: SETTING_KEYS.AUTO_APPROVE_FACULTY },
    { value: autoApproveFaculty },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return successResponse(res, { autoApproveFaculty }, 'Faculty auto-approval setting updated');
});

const getInternshipSettings = asyncHandler(async (req, res) => {
  const [startDateSetting, endDateSetting, visibilitySetting, hodEditSetting, studentRegSetting, facultyRegSetting, workingDaysSetting, minRequiredAttendanceSetting, campusLatSetting, campusLongSetting, campusRadiusSetting, campusAccuracySetting, winStartSetting, winEndSetting, timeCheckDisabledSetting, studentFreezeSetting] = await Promise.all([
    Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_START_DATE }).lean(),
    Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_END_DATE }).lean(),
    Setting.findOne({ key: SETTING_KEYS.GLOBAL_TASK_VISIBILITY }).lean(),
    Setting.findOne({ key: SETTING_KEYS.GLOBAL_HOD_TASK_EDIT_ENABLED }).lean(),
    Setting.findOne({ key: SETTING_KEYS.STUDENT_REGISTRATION_ENABLED }).lean(),
    Setting.findOne({ key: SETTING_KEYS.FACULTY_REGISTRATION_ENABLED }).lean(),
    Setting.findOne({ key: SETTING_KEYS.WORKING_DAYS }).lean(),
    Setting.findOne({ key: SETTING_KEYS.MIN_REQUIRED_ATTENDANCE }).lean(),
    Setting.findOne({ key: SETTING_KEYS.CAMPUS_LATITUDE }).lean(),
    Setting.findOne({ key: SETTING_KEYS.CAMPUS_LONGITUDE }).lean(),
    Setting.findOne({ key: SETTING_KEYS.CAMPUS_RADIUS }).lean(),
    Setting.findOne({ key: SETTING_KEYS.CAMPUS_ACCURACY_THRESHOLD }).lean(),
    Setting.findOne({ key: SETTING_KEYS.ATTENDANCE_WINDOW_START }).lean(),
    Setting.findOne({ key: SETTING_KEYS.ATTENDANCE_WINDOW_END }).lean(),
    Setting.findOne({ key: SETTING_KEYS.ATTENDANCE_TIME_CHECK_DISABLED }).lean(),
    Setting.findOne({ key: SETTING_KEYS.STUDENT_FREEZE }).lean()
  ]);

  return successResponse(res, {
    startDate: startDateSetting ? startDateSetting.value : null,
    endDate: endDateSetting ? endDateSetting.value : null,
    globalTaskVisibility: visibilitySetting ? Boolean(visibilitySetting.value) : false,
    globalHodTaskEditEnabled: hodEditSetting ? Boolean(hodEditSetting.value) : false,
    studentRegistrationEnabled: studentRegSetting ? Boolean(studentRegSetting.value) : true,
    facultyRegistrationEnabled: facultyRegSetting ? Boolean(facultyRegSetting.value) : true,
    workingDays: workingDaysSetting ? String(workingDaysSetting.value) : 'Mon-Sat',
    minRequiredAttendance: minRequiredAttendanceSetting ? Number(minRequiredAttendanceSetting.value) : 75,
    campusLatitude: campusLatSetting ? Number(campusLatSetting.value) : 17.088255,
    campusLongitude: campusLongSetting ? Number(campusLongSetting.value) : 82.067528,
    campusRadius: campusRadiusSetting ? Number(campusRadiusSetting.value) : 300,
    campusAccuracyThreshold: campusAccuracySetting ? Number(campusAccuracySetting.value) : 500,
    attendanceWindowStart: winStartSetting ? String(winStartSetting.value) : '09:00',
    attendanceWindowEnd: winEndSetting ? String(winEndSetting.value) : '10:30',
    attendanceTimeCheckDisabled: timeCheckDisabledSetting ? Boolean(timeCheckDisabledSetting.value) : false,
    studentFreeze: studentFreezeSetting ? Boolean(studentFreezeSetting.value) : false
  });
});

const updateInternshipSettings = asyncHandler(async (req, res) => {
  const { startDate, endDate, globalTaskVisibility, globalHodTaskEditEnabled, studentRegistrationEnabled, facultyRegistrationEnabled, workingDays, minRequiredAttendance, campusLatitude, campusLongitude, campusRadius, campusAccuracyThreshold, attendanceWindowStart, attendanceWindowEnd, attendanceTimeCheckDisabled, studentFreeze } = req.body;
  const { SETTING_KEYS } = require('../utils/constants');

  const updates = [];

  if (startDate) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.INTERNSHIP_START_DATE },
        update: { value: startDate },
        upsert: true
      }
    });
  }
  if (endDate) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.INTERNSHIP_END_DATE },
        update: { value: endDate },
        upsert: true
      }
    });
  }
  if (globalTaskVisibility !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.GLOBAL_TASK_VISIBILITY },
        update: { value: Boolean(globalTaskVisibility) },
        upsert: true
      }
    });
  }
  if (globalHodTaskEditEnabled !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.GLOBAL_HOD_TASK_EDIT_ENABLED },
        update: { value: Boolean(globalHodTaskEditEnabled) },
        upsert: true
      }
    });
  }
  if (studentRegistrationEnabled !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.STUDENT_REGISTRATION_ENABLED },
        update: { value: Boolean(studentRegistrationEnabled) },
        upsert: true
      }
    });
  }
  if (facultyRegistrationEnabled !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.FACULTY_REGISTRATION_ENABLED },
        update: { value: Boolean(facultyRegistrationEnabled) },
        upsert: true
      }
    });
  }
  if (workingDays) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.WORKING_DAYS },
        update: { value: String(workingDays) },
        upsert: true
      }
    });
  }
  if (minRequiredAttendance !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.MIN_REQUIRED_ATTENDANCE },
        update: { value: Number(minRequiredAttendance) },
        upsert: true
      }
    });
  }
  if (campusLatitude !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.CAMPUS_LATITUDE },
        update: { value: Number(campusLatitude) },
        upsert: true
      }
    });
  }
  if (campusLongitude !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.CAMPUS_LONGITUDE },
        update: { value: Number(campusLongitude) },
        upsert: true
      }
    });
  }
  if (campusRadius !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.CAMPUS_RADIUS },
        update: { value: Number(campusRadius) },
        upsert: true
      }
    });
  }
  if (campusAccuracyThreshold !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.CAMPUS_ACCURACY_THRESHOLD },
        update: { value: Number(campusAccuracyThreshold) },
        upsert: true
      }
    });
  }
  if (attendanceWindowStart) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.ATTENDANCE_WINDOW_START },
        update: { value: String(attendanceWindowStart) },
        upsert: true
      }
    });
  }
  if (attendanceWindowEnd) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.ATTENDANCE_WINDOW_END },
        update: { value: String(attendanceWindowEnd) },
        upsert: true
      }
    });
  }
  if (attendanceTimeCheckDisabled !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.ATTENDANCE_TIME_CHECK_DISABLED },
        update: { value: Boolean(attendanceTimeCheckDisabled) },
        upsert: true
      }
    });
  }
  if (studentFreeze !== undefined) {
    updates.push({
      updateOne: {
        filter: { key: SETTING_KEYS.STUDENT_FREEZE },
        update: { value: Boolean(studentFreeze) },
        upsert: true
      }
    });
  }

  if (updates.length > 0) {
    await Setting.bulkWrite(updates);
  }

  return successResponse(res, {}, 'Internship settings updated');
});

// Specific getters to avoid 404s in frontend until refactored
const getInternshipDates = asyncHandler(async (req, res) => {
  const [start, end] = await Promise.all([
    Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_START_DATE }).lean(),
    Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_END_DATE }).lean()
  ]);
  return successResponse(res, {
    startDate: start ? start.value : null,
    endDate: end ? end.value : null
  });
});

const getGlobalHodEditSetting = asyncHandler(async (req, res) => {
  const val = await getBooleanSetting(SETTING_KEYS.GLOBAL_HOD_TASK_EDIT_ENABLED, false);
  return successResponse(res, { enabled: val });
});


// Programs & Departments
const getPrograms = asyncHandler(async (req, res) => {
  const programs = await Program.find()
    .populate('departments')
    .sort({ name: 1 })
    .lean();

  return successResponse(res, programs);
});

const createProgram = asyncHandler(async (req, res) => {
  const { name, duration = 4, eligibleYears = [] } = req.body;

  if (!name || !String(name).trim()) {
    throw new AppError(400, 'Program name is required');
  }

  const existing = await Program.findOne({ name: String(name).trim() }).lean();
  if (existing) {
    throw new AppError(409, 'Program already exists');
  }

  const program = await Program.create({
    name: String(name).trim(),
    duration: Number(duration) || 4,
    eligibleYears: Array.isArray(eligibleYears) ? eligibleYears.map((year) => String(year)) : []
  });

  const populated = await program.populate('departments');
  return successResponse(res, populated, 'Program created', 201);
});

const updateProgram = asyncHandler(async (req, res) => {
  const { name, duration, eligibleYears } = req.body;

  const update = {};
  if (name !== undefined) update.name = String(name).trim();
  if (duration !== undefined) update.duration = Number(duration) || 4;
  if (eligibleYears !== undefined) {
    update.eligibleYears = Array.isArray(eligibleYears) ? eligibleYears.map((year) => String(year)) : [];
  }

  const program = await Program.findByIdAndUpdate(req.params.id, update, { new: true }).populate('departments');
  if (!program) {
    throw new AppError(404, 'Program not found');
  }

  return successResponse(res, program, 'Program updated');
});

const deleteProgram = asyncHandler(async (req, res) => {
  const program = await Program.findByIdAndDelete(req.params.id);
  if (!program) {
    throw new AppError(404, 'Program not found');
  }

  return successResponse(res, {}, 'Program deleted');
});

const addDepartmentToProgram = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    throw new AppError(400, 'Department name is required');
  }

  const program = await Program.findById(req.params.id);
  if (!program) {
    throw new AppError(404, 'Program not found');
  }

  const trimmed = String(name).trim();
  let department = await findDepartmentByName(trimmed);
  if (!department) {
    department = await Department.create({ name: trimmed, program: program._id });
  } else if (!department.program || String(department.program) !== String(program._id)) {
    department = await Department.findByIdAndUpdate(department._id, { program: program._id }, { new: true });
  }

  const alreadyExists = program.departments.some((deptId) => String(deptId) === String(department._id));
  if (!alreadyExists) {
    program.departments.push(department._id);
    await program.save();
  }

  const populated = await program.populate('departments');
  return successResponse(res, populated, 'Department added to program');
});

const removeDepartmentFromProgram = asyncHandler(async (req, res) => {
  const program = await Program.findById(req.params.id);
  if (!program) {
    throw new AppError(404, 'Program not found');
  }

  const beforeLength = program.departments.length;
  program.departments = program.departments.filter((deptId) => String(deptId) !== String(req.params.deptId));

  if (program.departments.length === beforeLength) {
    throw new AppError(404, 'Department not linked to this program');
  }

  await program.save();
  await Department.findByIdAndUpdate(req.params.deptId, { $unset: { program: "" } });

  const populated = await program.populate('departments');

  return successResponse(res, populated, 'Department removed from program');
});

const renameDepartment = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    throw new AppError(400, 'Department name is required');
  }

  const department = await Department.findByIdAndUpdate(
    req.params.id,
    { name: String(name).trim() },
    { new: true }
  );

  if (!department) {
    throw new AppError(404, 'Department not found');
  }

  return successResponse(res, department, 'Department updated');
});

const deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) {
    throw new AppError(404, 'Department not found');
  }

  // Check if used as baseDept in any project (ObjectId match)
  const usedAsBaseDept = await Project.findOne({ baseDept: department._id }).lean();
  if (usedAsBaseDept) {
    throw new AppError(400, `Cannot delete: Department is set as base department for project "${usedAsBaseDept.title}"`);
  }

  // Check if used in projects departments array (ObjectId match)
  const usedInProjects = await Project.findOne({ 'departments.department': department._id }).lean();
  if (usedInProjects) {
    throw new AppError(400, `Cannot delete: Department is assigned to project "${usedInProjects.title}"`);
  }

  // Check if used by any user
  const usedByUser = await User.findOne({ department: department.name }).lean();
  if (usedByUser) {
    throw new AppError(400, `Cannot delete: Department is assigned to user "${usedByUser.name}"`);
  }

  // Check if currently assigned to a program
  if (department.program) {
    throw new AppError(400, 'Cannot delete: Department is still assigned to a program. Remove it from the program first.');
  }

  await Department.findByIdAndDelete(req.params.id);
  return successResponse(res, {}, 'Department deleted successfully');
});

const getAllDbDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find().sort({ name: 1 }).lean();
  return successResponse(res, departments);
});

const getDepartmentProjectMatrix = asyncHandler(async (req, res) => {
  const { limit, skip } = parsePagination(req.query);

  const filter = {};
  if (req.user.role !== ROLES.ADMIN) {
    filter.status = 'Open';
  }

  let query = Project.find(filter)
    .populate('departments.department')
    .populate('baseDept guideDept coGuideDept', 'name')
    .sort({ createdAt: -1 });
  if (limit) query = query.limit(limit);
  if (skip) query = query.skip(skip);

  const projects = await query.lean();
  const projectIds = projects.map((project) => project._id);
  const projectIdsStr = projectIds.map((id) => String(id));

  let studentStatsRaw = [];
  let facultyGuides = [];
  let facultyCoGuides = [];

  if (projectIds.length > 0) {
    [studentStatsRaw, facultyGuides, facultyCoGuides] = await Promise.all([
      User.find({
        role: ROLES.STUDENT,
        $or: [
          { appliedProject: { $in: projectIds } },
          { projectApplications: { $in: projectIds } }
        ]
      })
        .select('appliedProject projectApplications department level')
        .lean(),
      User.find({
        role: ROLES.FACULTY,
        appliedProject: { $in: projectIds }
      })
        .select('name appliedProject')
        .lean(),
      User.find({
        role: ROLES.FACULTY,
        coGuidedProject: { $in: projectIds }
      })
        .select('name coGuidedProject')
        .lean()
    ]);
  }

  const totalByProject = new Map();
  const byProjectDepartment = new Map();
  const guideMap = new Map();
  const coGuideMap = new Map();

  studentStatsRaw.forEach((student) => {
    if (student.level === 2 && student.appliedProject && projectIdsStr.includes(String(student.appliedProject))) {
      const pIdStr = String(student.appliedProject);
      const deptKey = `${pIdStr}:${String(student.department || '')}`;
      totalByProject.set(pIdStr, (totalByProject.get(pIdStr) || 0) + 1);
      byProjectDepartment.set(deptKey, (byProjectDepartment.get(deptKey) || 0) + 1);
    }
  });

  facultyGuides.forEach((f) => {
    guideMap.set(String(f.appliedProject), f.name);
  });
  facultyCoGuides.forEach((f) => {
    coGuideMap.set(String(f.coGuidedProject), f.name);
  });

  const matrix = projects.map((project) => {
    const projectKey = String(project._id);
    const departments = (project.departments || []).map((entry) => {
      const departmentName = entry.department?.name || 'Unknown';
      const key = `${projectKey}:${departmentName}`;
      return {
        name: departmentName,
        total: entry.seats || 0,
        registered: byProjectDepartment.get(key) || 0,
        department: entry.department
      };
    });

    return {
      ...project,
      baseDept: project.baseDept ? (project.baseDept.name || project.baseDept) : '',
      guide: guideMap.get(projectKey) || project.guide || '',
      guideDept: project.guideDept ? (project.guideDept.name || project.guideDept) : '',
      coGuide: coGuideMap.get(projectKey) || project.coGuide || '',
      coGuideDept: project.coGuideDept ? (project.coGuideDept.name || project.coGuideDept) : '',
      projectId: project.projectId || project._id,
      projectTitle: project.title,
      projectTotalSeats: departments.reduce((sum, entry) => sum + (entry.total || 0), 0),
      projectTotalRegistered: totalByProject.get(projectKey) || 0,
      departments
    };
  });

  return successResponse(res, matrix);
});

// Students admin operations
const getStudents = asyncHandler(async (req, res) => {
  const {
    search,
    program,
    projectId,
    department,
    status,
    year,
    level,
    isFeePaid,
    missingDetails,
    page = 1,
    limit = 20
  } = req.query;

  const filter = { role: ROLES.STUDENT };

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
      { studentId: regex },
      { phone: regex },
      { department: regex },
      { program: regex },
      { year: regex }
    ];
  }

  if (program && program !== 'All') filter.program = program;
  if (department && department !== 'All') {
    filter.department = department;
  }
  if (status && status !== 'All') filter.status = status;
  if (year && year !== 'All') filter.year = year;
  if (level && level !== 'All') filter.level = Number(level);
  if (isFeePaid !== undefined && isFeePaid !== 'All') {
    if (String(isFeePaid) === 'true') {
      filter.isFeePaid = true;
    } else {
      filter.isFeePaid = { $ne: true };
    }
  }


  if (projectId && projectId !== 'All') {
    if (projectId === 'unassigned') {
      const unassignedFilter = { appliedProject: null, projectApplications: { $size: 0 } };
      if (filter.$and) {
        filter.$and.push(unassignedFilter);
      } else {
        filter.$and = [unassignedFilter];
      }
    } else if (projectId === 'assigned') {
      const assignedFilter = { $or: [{ appliedProject: { $ne: null } }, { projectApplications: { $not: { $size: 0 } } }] };
      if (filter.$and) {
        filter.$and.push(assignedFilter);
      } else {
        filter.$and = [assignedFilter];
      }
    } else {
      const pIdFilter = { $or: [{ appliedProject: projectId }, { projectApplications: projectId }] };
      if (filter.$and) {
        filter.$and.push(pIdFilter);
      } else {
        filter.$and = [pIdFilter];
      }
    }
  }

  if (String(missingDetails).toLowerCase() === 'true') {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { phone: { $in: [null, ''] } },
          { department: { $in: [null, ''] } },
          { year: { $in: [null, ''] } },
          { program: { $in: [null, ''] } }
        ]
      }
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));
  const skipNum = (pageNum - 1) * limitNum;

  const [students, total] = await Promise.all([
    User.find(filter)
      .populate({
        path: 'appliedProject',
        select: 'title projectId baseDept description guide guideDept guideEmpId coGuide coGuideDept coGuideEmpId skillsRequired projectOutcome teamLeader status totalSeats registeredCount departments',
        populate: [
          { path: 'baseDept', select: 'name' },
          { path: 'guideDept', select: 'name' },
          { path: 'coGuideDept', select: 'name' },
          { path: 'departments.department', select: 'name' }
        ]
      })
      .populate({
        path: 'projectApplications',
        select: 'title projectId baseDept description guide guideDept guideEmpId coGuide coGuideDept coGuideEmpId skillsRequired projectOutcome teamLeader status totalSeats registeredCount departments',
        populate: [
          { path: 'baseDept', select: 'name' },
          { path: 'guideDept', select: 'name' },
          { path: 'coGuideDept', select: 'name' },
          { path: 'departments.department', select: 'name' }
        ]
      })
      .select('name email phone studentId department program year status level appliedProject projectApplications applications createdAt isFeePaid')
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter)
  ]);

  return successResponse(res, {
    data: students,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

const createStudent = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  payload.role = ROLES.STUDENT;

  if (!payload.name || !payload.department || !payload.program || !payload.year || !payload.phone) {
    throw new AppError(400, 'Missing required student fields');
  }

  const studentId = payload.studentId ? String(payload.studentId).toUpperCase() : null;
  const email = payload.email
    ? String(payload.email).trim().toLowerCase()
    : (studentId ? `${studentId.trim().toLowerCase()}${env.UNIVERSITY_EMAIL_DOMAIN.toLowerCase()}` : null);

  if (!email) {
    throw new AppError(400, 'Email or student ID is required');
  }
  checkEmailProhibited(email);

  const existing = await User.findOne({
    $or: [
      { email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } },
      ...(studentId ? [{ studentId }] : [])
    ]
  }).lean();
  if (existing) {
    throw new AppError(409, 'Student already exists with same email or ID');
  }

  const appliedProject = await resolveProjectId(payload.appliedProject || payload.project);
  const status = normalizeStatus(payload.status, appliedProject ? USER_STATUS.PENDING : USER_STATUS.PENDING);

  if (appliedProject && status === USER_STATUS.APPROVED) {
    await decrementSeatIfRequired(appliedProject, payload.department);
  }

  const student = await User.create({
    ...payload,
    studentId,
    email,
    appliedProject,
    status,
    password: await hashPassword(resolveManagedPassword(payload.password)),
    role: ROLES.STUDENT,
    level: Number(payload.level) || 1
  });

  invalidateAnalyticsCache();
  return successResponse(res, sanitizeUser(student), 'Student created', 201);
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT }).select('+password');
  if (!student) {
    throw new AppError(404, 'Student not found');
  }

  const previous = {
    appliedProject: student.appliedProject,
    department: student.department,
    status: student.status
  };

  const nextAppliedProject = await resolveProjectId(req.body.appliedProject || req.body.project || student.appliedProject);
  const nextDepartment = req.body.department !== undefined ? req.body.department : student.department;
  const nextStatus = normalizeStatus(req.body.status, student.status);

  const approvedBefore = previous.status === USER_STATUS.APPROVED && previous.appliedProject;
  if (approvedBefore) {
    const changedProject = String(previous.appliedProject) !== String(nextAppliedProject || '');
    const changedDepartment = previous.department !== nextDepartment;
    const noLongerApproved = nextStatus !== USER_STATUS.APPROVED;
    if (changedProject || changedDepartment || noLongerApproved) {
      await incrementSeatIfRequired(previous.appliedProject, previous.department);
    }
  }

  if (nextAppliedProject && nextStatus === USER_STATUS.APPROVED) {
    const shouldReserve =
      !approvedBefore ||
      String(previous.appliedProject) !== String(nextAppliedProject) ||
      previous.department !== nextDepartment;

    if (shouldReserve) {
      await decrementSeatIfRequired(nextAppliedProject, nextDepartment);
    }
  }

  student.name = req.body.name ?? student.name;
  if (req.body.email) {
    const nextEmail = String(req.body.email).trim();
    checkEmailProhibited(nextEmail);
    student.email = nextEmail;
  }
  student.phone = req.body.phone ?? student.phone;
  student.year = req.body.year ?? student.year;
  student.studentId = req.body.studentId ? String(req.body.studentId).toUpperCase() : student.studentId;
  student.department = nextDepartment;
  student.program = req.body.program ?? student.program;

  // Reset level to 1 if project is removed or changed
  if (String(student.appliedProject || '') !== String(nextAppliedProject || '')) {
    student.level = 1;
    student.guide = '';
    if (!nextAppliedProject) {
      student.status = USER_STATUS.PENDING;
    }
  }

  student.appliedProject = nextAppliedProject;
  student.status = nextStatus;
  student.guide = req.body.guide ?? student.guide;
  student.level = req.body.level ? Number(req.body.level) : (student.level || 1);
  if (req.body.isFeePaid !== undefined) {
    student.isFeePaid = req.body.isFeePaid;
  }


  if (req.body.password) {
    student.password = await hashPassword(req.body.password);
  }

  await student.save();

  // If project changed or student removed from project, handle Team Leader logic
  const changedProject = String(previous.appliedProject || '') !== String(nextAppliedProject || '');
  if (changedProject && previous.appliedProject) {
    const oldProject = await Project.findById(previous.appliedProject);
    if (oldProject && String(oldProject.teamLeader) === String(student._id)) {
      const newLeader = await User.findOne({
        appliedProject: oldProject._id,
        role: ROLES.STUDENT,
        level: 2,
        _id: { $ne: student._id },
        status: { $ne: USER_STATUS.REJECTED }
      }).sort({ createdAt: 1 }).lean();

      oldProject.teamLeader = newLeader ? newLeader._id : null;
      await oldProject.save();
    }
  }

  if (changedProject && nextAppliedProject && student.level === 2) {
    const newProject = await Project.findById(nextAppliedProject);
    if (newProject && !newProject.teamLeader) {
      newProject.teamLeader = student._id;
      await newProject.save();
    }
  }

  const populated = await User.findById(student._id).populate('appliedProject').lean();

  invalidateAnalyticsCache();
  return successResponse(res, populated, 'Student updated');
});

const approveStudent = asyncHandler(async (req, res) => {
  const studentId = req.params.id;
  const { projectId } = req.body;

  const student = await User.findOne({ _id: studentId, role: ROLES.STUDENT });
  if (!student) throw new AppError(404, 'Student not found');

  const oldProjectId = student.appliedProject;

  // If a specific project is being approved, ensure it's set as the appliedProject
  if (projectId && String(student.appliedProject) !== String(projectId)) {
    const isInApplications = (student.projectApplications || []).some(id => String(id) === String(projectId));
    if (isInApplications) {
      // Move current appliedProject to applications and set the new one
      const currentApplied = student.appliedProject;
      student.appliedProject = projectId;
      student.projectApplications = (student.projectApplications || []).filter(id => String(id) !== String(projectId));
      if (currentApplied) student.projectApplications.push(currentApplied);
    } else {
      throw new AppError(400, 'Student has not applied for this project');
    }
  }

  if (!student.appliedProject) throw new AppError(400, 'Student has no project assigned');

  if (student.status !== USER_STATUS.APPROVED) {
    // New approval
    await decrementSeatIfRequired(student.appliedProject, student.department);
    // Sync status in applications array
    if (student.applications) {
      const app = student.applications.find(a => String(a.project) === String(student.appliedProject));
      if (app) app.status = 'Qualified';
    }

    student.status = USER_STATUS.APPROVED;
    await student.save();
  } else if (projectId && String(oldProjectId) !== String(projectId)) {
    // Reassignment for already approved student
    await incrementSeatIfRequired(oldProjectId, student.department);
    await decrementSeatIfRequired(student.appliedProject, student.department);

    // Sync status in applications array
    if (student.applications) {
      // Set old one back to Pending if it's there
      const oldApp = student.applications.find(a => String(a.project) === String(oldProjectId));
      if (oldApp) oldApp.status = 'Pending';

      // Set new one to Qualified
      const newApp = student.applications.find(a => String(a.project) === String(student.appliedProject));
      if (newApp) newApp.status = 'Qualified';
    }

    await student.save();
  }

  invalidateAnalyticsCache();
  return successResponse(res, {}, 'Student approved/reassigned successfully');
});

const rejectStudent = asyncHandler(async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT });
  if (!student) throw new AppError(404, 'Student not found');

  if (student.status === USER_STATUS.APPROVED && student.appliedProject) {
    await incrementSeatIfRequired(student.appliedProject, student.department);
  }

  student.status = USER_STATUS.REJECTED;

  // Sync status in applications array
  if (student.applications) {
    const app = student.applications.find(a => String(a.project) === String(student.appliedProject));
    if (app) app.status = 'Rejected';
  }

  await student.save();

  invalidateAnalyticsCache();
  return successResponse(res, {}, 'Student rejected');
});

const deleteStudent = asyncHandler(async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT });
  if (!student) throw new AppError(404, 'Student not found');

  if (student.status === USER_STATUS.APPROVED && student.appliedProject) {
    await incrementSeatIfRequired(student.appliedProject, student.department);

    // Handle Team Leader reassignment if the deleted student was the leader
    const project = await Project.findById(student.appliedProject);
    if (project && String(project.teamLeader) === String(student._id)) {
      const newLeader = await User.findOne({
        appliedProject: project._id,
        role: ROLES.STUDENT,
        level: 2,
        _id: { $ne: student._id },
        status: { $ne: USER_STATUS.REJECTED }
      }).sort({ createdAt: 1 }).lean();

      project.teamLeader = newLeader ? newLeader._id : null;
      await project.save();
    }
  }

  await User.deleteOne({ _id: student._id });
  invalidateAnalyticsCache();
  return successResponse(res, {}, 'Student deleted');
});

const deleteRejectedStudents = asyncHandler(async (req, res) => {
  await User.deleteMany({ role: ROLES.STUDENT, status: USER_STATUS.REJECTED });
  invalidateAnalyticsCache();
  return successResponse(res, {}, 'Rejected students deleted');
});

const moveStudentLevel = asyncHandler(async (req, res) => {
  const { studentIds = [], level } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new AppError(400, 'studentIds must be a non-empty array');
  }

  const nextLevel = Number(level);
  if (!Number.isInteger(nextLevel) || nextLevel < 1) {
    throw new AppError(400, 'Invalid level');
  }

  // Find all students being moved
  const studentsToMove = await User.find({ _id: { $in: studentIds }, role: ROLES.STUDENT }).lean();

  // Track projects impacted by level changes
  const projectsToUpdate = new Set();
  studentsToMove.forEach(s => {
    if (s.appliedProject) projectsToUpdate.add(String(s.appliedProject));
  });

  // Execute the level update
  const result = await User.updateMany(
    { _id: { $in: studentIds }, role: ROLES.STUDENT },
    { $set: { level: nextLevel } }
  );

  // Handle Team Leader logic for affected projects
  for (const pid of projectsToUpdate) {
    const project = await Project.findById(pid);
    if (!project) continue;

    const currentLeaderId = project.teamLeader ? String(project.teamLeader) : null;

    // Check if current leader is still valid
    let leaderIsValid = false;
    if (currentLeaderId) {
      const leader = await User.findOne({ _id: currentLeaderId, role: ROLES.STUDENT, appliedProject: project._id }).lean();
      if (leader && leader.level === 2 && leader.status !== USER_STATUS.REJECTED) {
        leaderIsValid = true;
      }
    }

    if (!leaderIsValid) {
      // Find a new leader: any Level 2 student in this project
      const newLeader = await User.findOne({
        appliedProject: project._id,
        role: ROLES.STUDENT,
        level: 2,
        status: { $ne: USER_STATUS.REJECTED }
      }).sort({ createdAt: 1 }).lean();

      project.teamLeader = newLeader ? newLeader._id : null;
      await project.save();
    }
  }

  invalidateAnalyticsCache();
  return successResponse(res, { modifiedCount: result.modifiedCount }, 'Student levels updated');
});

const bulkImportStudents = asyncHandler(async (req, res) => {
  const students = Array.isArray(req.body.students) ? req.body.students : [];
  if (students.length === 0) {
    throw new AppError(400, 'No student data provided');
  }

  const errors = [];
  let created = 0;

  for (let index = 0; index < students.length; index += 1) {
    const row = students[index];
    try {
      const studentId = getValue(row, ['studentId', 'StudentID', 'Student ID', 'Roll No', 'Registration No']);
      const formattedStudentId = studentId ? String(studentId).toUpperCase() : null;

      let email = getValue(row, ['email', 'Email', 'EmailID', 'Email ID']);
      if (email) {
        email = String(email).toLowerCase();
      } else if (formattedStudentId) {
        email = `${formattedStudentId.toLowerCase()}${env.UNIVERSITY_EMAIL_DOMAIN.toLowerCase()}`;
      }

      checkEmailProhibited(email);

      const name = getValue(row, ['name', 'Name', 'FullName', 'Full Name', 'Student Name']);
      if (!name || !email) {
        errors.push(`Row ${index + 1}: Missing required name/email`);
        continue;
      }

      const duplicate = await User.findOne({ $or: [{ email }, ...(formattedStudentId ? [{ studentId: formattedStudentId }] : [])] }).lean();
      if (duplicate) {
        errors.push(`Row ${index + 1}: Duplicate student (${email})`);
        continue;
      }

      const projectInput = getValue(row, ['project', 'appliedProject', 'Project', 'Applied Project', 'Project Name', 'ProjectID']);
      const appliedProject = await resolveProjectId(projectInput);

      const statusInput = getValue(row, ['status', 'Status', 'Admission Status']);
      const status = normalizeStatus(statusInput, appliedProject ? USER_STATUS.PENDING : USER_STATUS.PENDING);

      const department = getValue(row, ['department', 'Department', 'Dept', 'Branch']);
      const program = getValue(row, ['program', 'Program', 'Degree', 'Course']);
      const phone = getValue(row, ['phone', 'Phone', 'Mobile', 'Contact', 'PhoneNo']);
      const year = getValue(row, ['year', 'Year', 'Batch', 'Academic Year']);
      const password = getValue(row, ['password', 'Password', 'Pass']);
      const levelInput = getValue(row, ['level', 'Level', 'Internship Level']);

      if (appliedProject && status === USER_STATUS.APPROVED) {
        await decrementSeatIfRequired(appliedProject, department);
      }

      await User.create({
        name,
        email,
        phone,
        studentId: formattedStudentId,
        department,
        program,
        year,
        guide: getValue(row, ['guide', 'Guide', 'Primary Guide']),
        guideDept: getValue(row, ['guideDept', 'Guide Dept', 'GuideDept']),
        coGuide: getValue(row, ['coGuide', 'CoGuide', 'Co-Guide', 'Second Guide']),
        coGuideDept: getValue(row, ['coGuideDept', 'Co-Guide Dept', 'CoGuideDept']),
        appliedProject,
        status,
        password: await hashPassword(resolveManagedPassword(password)),
        role: ROLES.STUDENT,
        level: Number(levelInput) || 1
      });

      created += 1;
    } catch (error) {
      errors.push(`Row ${index + 1}: ${error.message}`);
    }
  }

  invalidateAnalyticsCache();
  return successResponse(res, { created, total: students.length, errors }, 'Student import processed');
});

const assignTeamLeader = asyncHandler(async (req, res) => {
  const { projectId, studentId } = req.params;

  const project = await Project.findById(projectId);
  if (!project) throw new AppError(404, 'Project not found');

  const student = await User.findOne({ _id: studentId, role: ROLES.STUDENT, appliedProject: project._id });
  if (!student) throw new AppError(404, 'Student not found in this project');
  if (student.level !== 2) throw new AppError(400, 'Only Level 2 students can be team leaders');
  if (student.status === USER_STATUS.REJECTED) throw new AppError(400, 'Rejected students cannot be team leaders');

  project.teamLeader = student._id;
  await project.save();

  invalidateAnalyticsCache();
  return successResponse(res, { teamLeader: student._id }, 'Team leader assigned successfully');
});

// Faculty admin operations
const getFaculty = asyncHandler(async (req, res) => {
  const faculty = await User.find({ role: ROLES.FACULTY })
    .populate({
      path: 'appliedProject',
      populate: [
        { path: 'baseDept', select: 'name' },
        { path: 'guideDept', select: 'name' },
        { path: 'coGuideDept', select: 'name' },
        { path: 'departments.department', select: 'name' }
      ]
    })
    .populate('requestedProject')
    .populate('coGuidedProject')
    .populate('requestedCoGuideProject')
    .sort({ createdAt: -1 })
    .lean();

  return successResponse(res, faculty);
});

const assignFacultyProject = asyncHandler(async (req, res) => {
  const faculty = await User.findOne({ _id: req.params.id, role: ROLES.FACULTY });
  if (!faculty) throw new AppError(404, 'Faculty not found');

  const role = normalizeFacultyAssignmentRole(req.body.role);
  const projectId = req.body.projectId ? String(req.body.projectId) : '';

  if (role === FACULTY_ASSIGNMENT_ROLE.GUIDE) {
    if (faculty.appliedProject && String(faculty.appliedProject) !== projectId) {
      await Project.findByIdAndUpdate(faculty.appliedProject, { guide: '', guideEmpId: '' });
    }

    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) throw new AppError(404, 'Project not found');

      await User.updateMany(
        { role: ROLES.FACULTY, appliedProject: project._id, _id: { $ne: faculty._id } },
        { $set: { appliedProject: null, status: USER_STATUS.PENDING } }
      );

      project.guide = faculty.name;
      project.guideEmpId = faculty.employeeId || '';
      await project.save();

      faculty.appliedProject = project._id;
      faculty.status = USER_STATUS.APPROVED;
      faculty.requestedProject = null;
    } else {
      faculty.appliedProject = null;
      faculty.status = USER_STATUS.PENDING;
      faculty.requestedProject = null;
    }
  } else {
    if (faculty.coGuidedProject && String(faculty.coGuidedProject) !== projectId) {
      await Project.findByIdAndUpdate(faculty.coGuidedProject, { coGuide: '', coGuideEmpId: '' });
    }

    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) throw new AppError(404, 'Project not found');

      await User.updateMany(
        { role: ROLES.FACULTY, coGuidedProject: project._id, _id: { $ne: faculty._id } },
        { $set: { coGuidedProject: null, coGuideStatus: USER_STATUS.PENDING } }
      );

      project.coGuide = faculty.name;
      project.coGuideEmpId = faculty.employeeId || '';
      await project.save();

      faculty.coGuidedProject = project._id;
      faculty.coGuideStatus = USER_STATUS.APPROVED;
      faculty.requestedCoGuideProject = null;
    } else {
      faculty.coGuidedProject = null;
      faculty.coGuideStatus = USER_STATUS.PENDING;
      faculty.requestedCoGuideProject = null;
    }
  }

  await faculty.save();
  const populated = await User.findById(faculty._id)
    .populate('appliedProject')
    .populate('requestedProject')
    .populate('coGuidedProject')
    .populate('requestedCoGuideProject')
    .lean();

  return successResponse(res, populated, 'Faculty project assignment updated');
});

const approveFaculty = asyncHandler(async (req, res) => {
  const role = normalizeFacultyAssignmentRole(req.body.role);
  const faculty = await User.findOne({ _id: req.params.id, role: ROLES.FACULTY });
  if (!faculty) throw new AppError(404, 'Faculty not found');

  if (role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE) {
    if (!faculty.requestedCoGuideProject) throw new AppError(400, 'No co-guide request found');

    if (faculty.coGuidedProject && String(faculty.coGuidedProject) !== String(faculty.requestedCoGuideProject)) {
      await Project.findByIdAndUpdate(faculty.coGuidedProject, { coGuide: '' });
    }

    const project = await Project.findById(faculty.requestedCoGuideProject);
    if (!project) throw new AppError(404, 'Requested project not found');

    await User.updateMany(
      { role: ROLES.FACULTY, coGuidedProject: project._id, _id: { $ne: faculty._id } },
      { $set: { coGuidedProject: null, coGuideStatus: USER_STATUS.PENDING } }
    );

    project.coGuide = faculty.name;
    await project.save();

    faculty.coGuidedProject = project._id;
    faculty.coGuideStatus = USER_STATUS.APPROVED;
    faculty.requestedCoGuideProject = null;
  } else {
    if (!faculty.requestedProject) throw new AppError(400, 'No guide request found');

    if (faculty.appliedProject && String(faculty.appliedProject) !== String(faculty.requestedProject)) {
      await Project.findByIdAndUpdate(faculty.appliedProject, { guide: '' });
    }

    const project = await Project.findById(faculty.requestedProject);
    if (!project) throw new AppError(404, 'Requested project not found');

    await User.updateMany(
      { role: ROLES.FACULTY, appliedProject: project._id, _id: { $ne: faculty._id } },
      { $set: { appliedProject: null, status: USER_STATUS.PENDING } }
    );

    project.guide = faculty.name;
    await project.save();

    faculty.appliedProject = project._id;
    faculty.status = USER_STATUS.APPROVED;
    faculty.requestedProject = null;
  }

  await faculty.save();
  return successResponse(res, {}, 'Faculty request approved');
});

const rejectFaculty = asyncHandler(async (req, res) => {
  const role = normalizeFacultyAssignmentRole(req.body.role);
  const faculty = await User.findOne({ _id: req.params.id, role: ROLES.FACULTY });
  if (!faculty) throw new AppError(404, 'Faculty not found');

  if (role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE) {
    faculty.requestedCoGuideProject = null;
    faculty.coGuideStatus = USER_STATUS.REJECTED;
  } else {
    faculty.requestedProject = null;
    faculty.status = USER_STATUS.REJECTED;
  }

  await faculty.save();
  return successResponse(res, {}, 'Faculty request rejected');
});

const updateFaculty = asyncHandler(async (req, res) => {
  const { name, email, employeeId, department, phone, password } = req.body;
  const faculty = await User.findOne({ _id: req.params.id, role: ROLES.FACULTY }).select('+password');
  if (!faculty) {
    throw new AppError(404, 'Faculty not found');
  }

  faculty.name = name ?? faculty.name;
  if (email) {
    const nextEmail = String(email).trim();
    checkEmailProhibited(nextEmail);
    faculty.email = nextEmail;
  }
  if (employeeId && !/^\d+$/.test(String(employeeId).trim())) {
    throw new AppError(400, 'Employee ID must contain only digits');
  }

  faculty.employeeId = employeeId ?? faculty.employeeId;
  faculty.department = department ?? faculty.department;
  faculty.phone = phone ?? faculty.phone;

  if (password && String(password).trim() !== '') {
    faculty.password = await hashPassword(password);
  }

  await syncFacultyProjectByEmpId(faculty, 'faculty');
  await faculty.save();
  return successResponse(res, sanitizeUser(faculty), 'Faculty updated successfully');
});

const createFaculty = asyncHandler(async (req, res) => {
  const { name, email: rawEmail, phone, password, employeeId, department } = req.body;

  if (employeeId && !/^\d+$/.test(String(employeeId).trim())) {
    throw new AppError(400, 'Employee ID must contain only digits');
  }

  if (!name || !rawEmail || !department) {
    throw new AppError(400, 'Name, email, and department are required');
  }

  let email = String(rawEmail || '').trim().toLowerCase();
  if (!email.includes('@')) {
    email = `${email}${env.UNIVERSITY_EMAIL_DOMAIN.toLowerCase()}`;
  }

  checkEmailProhibited(email);

  const existing = await User.findOne({ email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } }).lean();
  if (existing) {
    throw new AppError(409, 'User with this email already exists');
  }

  const faculty = await User.create({
    name,
    email,
    phone,
    employeeId,
    department,
    password: await hashPassword(resolveManagedPassword(password)),
    role: ROLES.FACULTY,
    status: USER_STATUS.APPROVED
  });

  await syncFacultyProjectByEmpId(faculty, 'faculty');
  await faculty.save();

  invalidateAnalyticsCache();
  return successResponse(res, sanitizeUser(faculty), 'Faculty created successfully', 201);
});

const deleteFaculty = asyncHandler(async (req, res) => {
  const faculty = await User.findOne({ _id: req.params.id, role: ROLES.FACULTY });
  if (!faculty) throw new AppError(404, 'Faculty not found');

  if (faculty.appliedProject) {
    await Project.findByIdAndUpdate(faculty.appliedProject, { guide: '' });
  }
  if (faculty.coGuidedProject) {
    await Project.findByIdAndUpdate(faculty.coGuidedProject, { coGuide: '' });
  }

  await User.deleteOne({ _id: faculty._id });
  return successResponse(res, {}, 'Faculty deleted');
});

const createHOD = asyncHandler(async (req, res) => {
  const { name, department, program, phone, password } = req.body;
  let email = String(req.body.email || '').trim().toLowerCase();

  if (!name || !email || !department) {
    throw new AppError(400, 'Name, email, and department are required');
  }

  if (!email.includes('@')) {
    email = `${email}${env.UNIVERSITY_EMAIL_DOMAIN.toLowerCase()}`;
  }

  checkEmailProhibited(email);

  const existing = await User.findOne({ email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } }).lean();
  if (existing) {
    throw new AppError(409, 'User with this email already exists');
  }

  const hod = await User.create({
    name,
    email: String(email).trim(),
    department,
    program,
    phone,
    password: await hashPassword(resolveManagedPassword(password)),
    role: ROLES.HOD,
    status: USER_STATUS.APPROVED
  });

  invalidateAnalyticsCache();
  return successResponse(res, sanitizeUser(hod), 'HOD created successfully', 201);
});

const getHODs = asyncHandler(async (req, res) => {
  const hods = await User.find({ role: ROLES.HOD }).select('-password').sort({ createdAt: -1 }).lean();

  const projects = await Project.find().populate('departments.department', 'name').lean();

  const hodsWithDetails = hods.map(hod => {
    let projectsHandling = 0;
    if (hod.department) {
      projectsHandling = projects.filter(p =>
        p.departments && p.departments.some(d => d.department && String(d.department.name).toLowerCase() === String(hod.department).toLowerCase())
      ).length;
    }
    return { ...hod, projectsHandling };
  });

  return successResponse(res, hodsWithDetails, 'HODs retrieved successfully');
});

const updateHOD = asyncHandler(async (req, res) => {
  const { name, department, program, phone, password } = req.body;
  const hod = await User.findOne({ _id: req.params.id, role: ROLES.HOD }).select('+password');
  if (!hod) {
    throw new AppError(404, 'HOD not found');
  }

  hod.name = name ?? hod.name;
  if (req.body.email) {
    const nextEmail = String(req.body.email).trim();
    checkEmailProhibited(nextEmail);
    hod.email = nextEmail;
  }
  hod.department = department ?? hod.department;
  hod.program = program ?? hod.program;
  hod.phone = phone ?? hod.phone;

  if (password && String(password).trim() !== '') {
    hod.password = await hashPassword(password);
  }

  await hod.save();
  return successResponse(res, sanitizeUser(hod), 'HOD updated successfully');
});

const deleteHOD = asyncHandler(async (req, res) => {
  const hod = await User.findOne({ _id: req.params.id, role: ROLES.HOD });
  if (!hod) {
    throw new AppError(404, 'HOD not found');
  }

  await User.deleteOne({ _id: hod._id });
  return successResponse(res, {}, 'HOD deleted successfully');
});

// Project bulk import
function getValue(row, keys = []) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return undefined;
}

function parseDepartmentSpec(spec) {
  const raw = String(spec || '').trim();
  if (!raw) return [];

  return raw
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [name, seatsRaw] = chunk.split(':');
      return {
        name: String(name || '').trim(),
        seats: Number(seatsRaw || 0)
      };
    })
    .filter((entry) => entry.name && Number.isFinite(entry.seats) && entry.seats >= 0);
}

const bulkImportProjects = asyncHandler(async (req, res) => {
  const projects = Array.isArray(req.body.projects) ? req.body.projects : [];
  const departmentProgramMap = req.body.departmentProgramMap || {};
  if (projects.length === 0) {
    throw new AppError(400, 'No project data provided');
  }

  const errors = [];
  let processed = 0;

  for (let index = 0; index < projects.length; index += 1) {
    const row = projects[index];
    try {
      const title = getValue(row, ['title', 'Title', 'Project Title']);
      const description = getValue(row, ['description', 'Description', 'Project Description', 'Abstract', 'About']) || '';
      const statusRaw = getValue(row, ['status', 'Status']) || PROJECT_STATUS.OPEN;
      const guide = getValue(row, ['guide', 'Guide', 'Primary Guide']) || '';
      const guideEmpId = getValue(row, ['guideEmpId', 'Guide Emp ID', 'Guide Emp Id', 'GuideEmpID', 'Emp ID']) || '';
      const coGuide = getValue(row, ['coGuide', 'CoGuide', 'Co-Guide', 'Second Guide']) || '';
      const guideDept = getValue(row, ['guideDept', 'Guide Dept', 'GuideDept', 'Department', 'Guide Department', 'guideDepartment']) || '';
      const coGuideEmpId = getValue(row, ['coGuideEmpId', 'Co-Guide Emp ID', 'CoGuideEmpId', 'CoGuideEmpID', 'Co Emp ID']) || '';
      const coGuideDept = getValue(row, ['coGuideDept', 'Co-Guide Dept', 'CoGuideDept', 'Co-Dept', 'Co-Guide Department', 'Co-Guide Dept', 'Co guide department', 'coGuideDepartment']) || '';

      if (guideEmpId && !/^\d+$/.test(String(guideEmpId).trim())) {
        errors.push(`Row ${index + 1}: Guide Emp ID must contain only digits`);
        continue;
      }
      if (coGuideEmpId && !/^\d+$/.test(String(coGuideEmpId).trim())) {
        errors.push(`Row ${index + 1}: Co-Guide Emp ID must contain only digits`);
        continue;
      }

      const skillsRequired = getValue(row, ['skillsRequired', 'Skills Required', 'Skills', 'SkillsRequired', 'Prerequisites']) || '';
      const projectOutcome = getValue(row, ['projectOutcome', 'Project Outcome', 'Outcome', 'ProjectOutcome', 'Deliverables']) || '';
      const deptSpec = getValue(row, ['departments', 'Departments', 'Assigned Depts']) || '';
      const baseDept = getValue(row, ['baseDept', 'Base Dept', 'Base Department', 'Hosting Dept']);
      let projectIdVal = getValue(row, ['projectId', 'Project ID', 'Project Id', 'Id', 'ID']) || null;

      if (!title || !baseDept) {
        errors.push(`Row ${index + 1}: Missing project title or Base Dept`);
        continue;
      }

      if (projectIdVal) {
        const existingId = await Project.findOne({ projectId: projectIdVal, title: { $ne: String(title).trim() } }).lean();
        if (existingId) {
          errors.push(`Row ${index + 1}: Project ID ${projectIdVal} belongs to another project`);
          continue;
        }
      } else {
        const existingProj = await Project.findOne({ title: String(title).trim() }).lean();
        if (existingProj && existingProj.projectId) {
          projectIdVal = existingProj.projectId;
        } else {
          projectIdVal = await Project.generateProjectId(String(baseDept).trim());
        }
      }

      const parsedDepartments = parseDepartmentSpec(deptSpec);
      if (parsedDepartments.length === 0) {
        errors.push(`Row ${index + 1}: Invalid departments format`);
        continue;
      }

      const departmentEntries = [];
      for (const entry of parsedDepartments) {
        let department = await findDepartmentByName(entry.name);
        const programId = departmentProgramMap[entry.name] || departmentProgramMap[entry.name.trim()];

        if (!department) {
          const createData = { name: entry.name };
          if (programId) createData.program = programId;
          department = await Department.create(createData);
        } else if (programId && (!department.program || String(department.program) !== String(programId))) {
          department = await Department.findByIdAndUpdate(department._id, { program: programId }, { new: true });
        }

        if (programId) {
          await Program.findByIdAndUpdate(programId, { $addToSet: { departments: department._id } });
        }

        departmentEntries.push({
          department: department._id,
          seats: entry.seats
        });
      }

      const updatedProject = await Project.findOneAndUpdate(
        { title: String(title).trim() },
        {
          title: String(title).trim(),
          projectId: projectIdVal ? String(projectIdVal).trim() : null,
          baseDept: baseDept ? String(baseDept).trim() : null,
          description: String(description),
          guide: String(guide),
          guideEmpId: String(guideEmpId),
          guideDept: String(guideDept),
          coGuide: String(coGuide),
          coGuideEmpId: String(coGuideEmpId),
          coGuideDept: String(coGuideDept),
          skillsRequired: String(skillsRequired),
          projectOutcome: String(projectOutcome),
          status: String(statusRaw).toLowerCase() === 'closed' ? PROJECT_STATUS.CLOSED : PROJECT_STATUS.OPEN,
          departments: departmentEntries
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (updatedProject) {
        await syncFacultyProjectByEmpId(updatedProject, 'project');
      }

      processed += 1;
    } catch (error) {
      errors.push(`Row ${index + 1}: ${error.message}`);
    }
  }

  return successResponse(res, { processed, total: projects.length, errors }, 'Project import processed');
});

// Mail
const sendBulkMail = asyncHandler(async (req, res) => {
  let { recipients = [], subject = '', body = '' } = req.body;

  // Handle case where recipients is sent as a string (common with FormData)
  if (typeof recipients === 'string') {
    try {
      recipients = JSON.parse(recipients);
    } catch (e) {
      recipients = recipients.split(',').map(r => r.trim());
    }
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new AppError(400, 'Recipients are required');
  }
  if (!String(subject).trim() || !String(body).trim()) {
    throw new AppError(400, 'Subject and body are required');
  }

  // Handle Attachments
  const attachments = (req.files || []).map(file => ({
    filename: file.originalname,
    content: file.buffer
  }));

  const sendResults = await Promise.allSettled(
    recipients.map((recipient) => sendMail({
      to: recipient,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">${body.replace(/\n/g, '<br>')}</div>`,
      attachments
    }))
  );

  const rejected = sendResults.filter((result) => result.status === 'rejected');
  const failedCount = rejected.length;
  const sentCount = recipients.length - failedCount;

  if (failedCount > 0) {
    console.error('Email Failures:', rejected.map(r => r.reason));
  }

  return successResponse(res, { sent: sentCount, failed: failedCount }, failedCount ? 'Mail sent with partial failures' : 'Mail sent successfully');
});

const updateProfile = asyncHandler(async (req, res) => {
  const adminId = req.params.id;
  if (String(req.user._id) !== String(adminId)) {
    throw new AppError(403, 'You are not allowed to access this resource');
  }

  const { password } = req.body;
  if (!password) {
    throw new AppError(400, 'Password is required');
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    throw new AppError(400, passwordValidationError);
  }

  const admin = await User.findById(adminId).select('+password');
  if (!admin || admin.role !== ROLES.ADMIN) {
    throw new AppError(404, 'Admin not found');
  }

  admin.password = await hashPassword(password);
  await admin.save();

  return successResponse(res, {}, 'Password updated successfully');
});



module.exports = {
  getSettings,
  updateSettings,
  getAboutUsSetting,
  getLandingContent,
  getAutoApproveSetting,
  setAutoApproveSetting,
  getAutoApproveFacultySetting,
  setAutoApproveFacultySetting,

  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  addDepartmentToProgram,
  removeDepartmentFromProgram,
  renameDepartment,
  deleteDepartment,
  getAllDbDepartments,
  getDepartmentProjectMatrix,

  getStudents,
  createStudent,
  updateStudent,
  approveStudent,
  rejectStudent,
  deleteStudent,
  deleteRejectedStudents,
  moveStudentLevel,
  bulkImportStudents,

  getFaculty,
  assignFacultyProject,
  approveFaculty,
  rejectFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  createHOD,
  getHODs,
  updateHOD,
  deleteHOD,

  bulkImportProjects,
  sendBulkMail,
  assignTeamLeader,

  getInternshipSettings,
  updateInternshipSettings,
  getInternshipDates,
  getGlobalHodEditSetting,
  updateProfile
};
