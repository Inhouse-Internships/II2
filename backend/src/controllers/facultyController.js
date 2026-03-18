const User = require('../models/User');
const Project = require('../models/Project');
const Setting = require('../models/Setting');

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { successResponse } = require('../utils/response');
const { hashPassword, validatePasswordStrength } = require('../utils/password');
const {
  ROLES,
  USER_STATUS,
  PROJECT_STATUS,
  SETTING_KEYS,
  FACULTY_ASSIGNMENT_ROLE,
  INTERVIEW_STATUS
} = require('../utils/constants');

function ensureFacultyAccess(req, facultyId) {
  if (String(req.user._id) !== String(facultyId)) {
    throw new AppError(403, 'You are not allowed to access this faculty resource');
  }
}

function normalizeGuideRole(role) {
  return role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE
    ? FACULTY_ASSIGNMENT_ROLE.CO_GUIDE
    : FACULTY_ASSIGNMENT_ROLE.GUIDE;
}

const getDashboard = asyncHandler(async (req, res) => {
  const facultyId = req.params.id;
  ensureFacultyAccess(req, facultyId);

  const faculty = await User.findById(facultyId)
    .populate('appliedProject')
    .populate('requestedProject')
    .populate('coGuidedProject')
    .populate('requestedCoGuideProject')
    .lean();

  if (!faculty || faculty.role !== ROLES.FACULTY) {
    throw new AppError(404, 'Faculty not found');
  }

  const projects = await Project.find({
    status: PROJECT_STATUS.OPEN,
    $or: [
      { baseDept: faculty.department },
      { guideDept: faculty.department },
      { coGuideDept: faculty.department }
    ]
  }).lean();
  return successResponse(res, { faculty, projects });
});

const applyForProject = asyncHandler(async (req, res) => {
  const facultyId = req.body.facultyId || req.user._id;
  const projectId = req.body.projectId;
  const role = normalizeGuideRole(req.body.role);

  ensureFacultyAccess(req, facultyId);

  if (!projectId) {
    throw new AppError(400, 'Project ID is required');
  }

  const faculty = await User.findById(facultyId);
  if (!faculty || faculty.role !== ROLES.FACULTY) {
    throw new AppError(404, 'Faculty not found');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE && String(faculty.appliedProject) === String(projectId)) {
    throw new AppError(400, 'You are already assigned as guide for this project');
  }

  if (role === FACULTY_ASSIGNMENT_ROLE.GUIDE && String(faculty.coGuidedProject) === String(projectId)) {
    throw new AppError(400, 'You are already assigned as co-guide for this project');
  }

  if (role === FACULTY_ASSIGNMENT_ROLE.GUIDE && project.guideDept && faculty.department !== project.guideDept) {
    throw new AppError(400, `Only faculties from ${project.guideDept} department can apply as guide for this project`);
  }

  if (role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE && project.coGuideDept && faculty.department !== project.coGuideDept) {
    throw new AppError(400, `Only faculties from ${project.coGuideDept} department can apply as co-guide for this project`);
  }

  const autoApproveSetting = await Setting.findOne({ key: SETTING_KEYS.AUTO_APPROVE_FACULTY }).lean();
  const autoApprove = Boolean(autoApproveSetting?.value);

  if (autoApprove) {
    if (role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE) {
      if (faculty.coGuidedProject) {
        await Project.findByIdAndUpdate(faculty.coGuidedProject, { coGuide: '' });
      }

      await User.updateMany(
        { coGuidedProject: projectId, role: ROLES.FACULTY },
        { $set: { coGuidedProject: null, coGuideStatus: USER_STATUS.PENDING } }
      );

      project.coGuide = faculty.name;
      faculty.coGuidedProject = projectId;
      faculty.coGuideStatus = USER_STATUS.APPROVED;
      faculty.requestedCoGuideProject = null;
    } else {
      if (faculty.appliedProject) {
        await Project.findByIdAndUpdate(faculty.appliedProject, { guide: '' });
      }

      await User.updateMany(
        { appliedProject: projectId, role: ROLES.FACULTY },
        { $set: { appliedProject: null, status: USER_STATUS.PENDING } }
      );

      project.guide = faculty.name;
      faculty.appliedProject = projectId;
      faculty.status = USER_STATUS.APPROVED;
      faculty.requestedProject = null;
    }

    await Promise.all([project.save(), faculty.save()]);
    return successResponse(res, {}, 'Application auto-approved');
  }

  if (role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE) {
    faculty.requestedCoGuideProject = projectId;
    faculty.coGuideStatus = USER_STATUS.PENDING;
  } else {
    faculty.requestedProject = projectId;
    faculty.status = USER_STATUS.PENDING;
  }

  await faculty.save();
  return successResponse(res, {}, 'Application submitted for approval');
});

const withdrawApplication = asyncHandler(async (req, res) => {
  const facultyId = req.body.facultyId || req.user._id;
  const role = normalizeGuideRole(req.body.role);

  ensureFacultyAccess(req, facultyId);

  const faculty = await User.findById(facultyId);
  if (!faculty || faculty.role !== ROLES.FACULTY) {
    throw new AppError(404, 'Faculty not found');
  }

  if (role === FACULTY_ASSIGNMENT_ROLE.CO_GUIDE) {
    if (!faculty.coGuidedProject && !faculty.requestedCoGuideProject) {
      throw new AppError(400, 'No co-guide application found');
    }

    if (faculty.coGuidedProject) {
      await Project.findByIdAndUpdate(faculty.coGuidedProject, { coGuide: '' });
    }

    faculty.coGuidedProject = null;
    faculty.requestedCoGuideProject = null;
    faculty.coGuideStatus = USER_STATUS.PENDING;
  } else {
    if (!faculty.appliedProject && !faculty.requestedProject) {
      throw new AppError(400, 'No guide application found');
    }

    if (faculty.appliedProject) {
      await Project.findByIdAndUpdate(faculty.appliedProject, { guide: '' });
    }

    faculty.appliedProject = null;
    faculty.requestedProject = null;
    faculty.status = USER_STATUS.PENDING;
  }

  await faculty.save();
  return successResponse(res, {}, 'Application withdrawn successfully');
});

const updateProfile = asyncHandler(async (req, res) => {
  const facultyId = req.params.id;
  ensureFacultyAccess(req, facultyId);

  const { password } = req.body;
  if (!password) {
    throw new AppError(400, 'Password is required');
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    throw new AppError(400, passwordValidationError);
  }

  const faculty = await User.findById(facultyId).select('+password');
  if (!faculty || (faculty.role !== ROLES.FACULTY && faculty.role !== ROLES.HOD)) {
    throw new AppError(404, 'User not found');
  }

  faculty.password = await hashPassword(password);
  await faculty.save();

  return successResponse(res, {}, 'Password updated successfully');
});

const getProjectStudents = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  ensureFacultyAccess(req, req.user._id);

  const students = await User.find({
    role: ROLES.STUDENT,
    $or: [
      { appliedProject: projectId },
      { projectApplications: projectId },
      { 'applications.project': projectId }
    ]
  }).select('name email studentId department status level role appliedProject projectApplications applications').populate('appliedProject', 'title status').lean();

  const formattedStudents = students.map(student => {
    const app = (student.applications || []).find(a => String(a.project) === String(projectId));
    return {
      ...student,
      interviewStatus: app ? app.status : INTERVIEW_STATUS.PENDING,
      interviewNote: app ? app.interviewNote : '',
      isPrimary: String(student.appliedProject?._id || student.appliedProject) === String(projectId)
    };
  });

  return successResponse(res, { students: formattedStudents });
});

const approveStudent = asyncHandler(async (req, res) => {
  const facultyId = req.user._id;
  const { studentId } = req.params;

  const faculty = await User.findById(facultyId);
  if (!faculty) throw new AppError(404, 'Faculty not found');

  const student = await User.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  const { projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || student.appliedProject;

  if (!projectId) {
    throw new AppError(400, 'Project ID is required for approval');
  }

  // Find which application this is
  const isPrimary = String(student.appliedProject) === String(projectId);
  const isInApplications = (student.projectApplications || []).some(id => String(id) === String(projectId));

  if (!isPrimary && !isInApplications) {
    throw new AppError(400, 'Student has not applied for this project');
  }

  // Ensure faculty is guide or co-guide for the project they are trying to approve
  const isAuthorized = String(faculty.appliedProject) === String(projectId) ||
    String(faculty.coGuidedProject) === String(projectId);

  if (!isAuthorized) {
    throw new AppError(403, 'You are not authorized to approve students for this project');
  }

  const project = await Project.findById(projectId);
  if (!project) throw new AppError(404, 'Project not found');

  if (project.status === 'Closed') {
    throw new AppError(400, 'Cannot approve student. The project is Closed.');
  }

  student.status = USER_STATUS.APPROVED;
  // Set this project as the primary one if it wasn't already
  if (String(student.appliedProject) !== String(projectId)) {
    // If they had a different primary project, move it to applications if it wasn't there
    if (student.appliedProject) {
      if (!student.projectApplications.includes(student.appliedProject)) {
        student.projectApplications.push(student.appliedProject);
      }
    }
    student.appliedProject = projectId;
    // Remove from applications list as it's now primary
    student.projectApplications = student.projectApplications.filter(id => String(id) !== String(projectId));
  }

  // Update structured applications array
  if (student.applications) {
    const app = student.applications.find(a => String(a.project) === String(projectId));
    if (app) app.status = 'Qualified';
  }

  await student.save();

  return successResponse(res, {}, 'Student approved successfully');
});

const rejectStudent = asyncHandler(async (req, res) => {
  const facultyId = req.user._id;
  const { studentId } = req.params;

  const faculty = await User.findById(facultyId);
  if (!faculty) throw new AppError(404, 'Faculty not found');

  const student = await User.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  const { projectId: bodyProjectId } = req.body;
  const projectId = bodyProjectId || student.appliedProject;

  if (!projectId) {
    throw new AppError(400, 'Project ID is required for rejection');
  }

  // Check both fields
  const isPrimary = String(student.appliedProject) === String(projectId);
  const isInApplications = (student.projectApplications || []).some(id => String(id) === String(projectId));

  if (!isPrimary && !isInApplications) {
    throw new AppError(400, 'Student has not applied for this project');
  }

  if (String(faculty.appliedProject) !== String(projectId) &&
    String(faculty.coGuidedProject) !== String(projectId)) {
    throw new AppError(403, 'You are not authorized to reject students for this project');
  }

  student.status = 'Rejected';

  // Sync status in applications array
  if (student.applications) {
    const app = student.applications.find(a => String(a.project) === String(projectId));
    if (app) app.status = 'Rejected';
  }

  await student.save();

  return successResponse(res, {}, 'Student rejected successfully');
});

const updateInterviewStatus = asyncHandler(async (req, res) => {
  const { studentId, projectId, status, note } = req.body;
  const facultyId = req.user._id;

  if (!Object.values(INTERVIEW_STATUS).includes(status)) {
    throw new AppError(400, 'Invalid status');
  }

  const student = await User.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');

  let application = (student.applications || []).find(a => String(a.project) === String(projectId));

  if (!application) {
    const hasApplied = String(student.appliedProject) === String(projectId) ||
      (student.projectApplications || []).some(p => String(p) === String(projectId));

    if (!hasApplied) throw new AppError(400, 'Student has not applied for this project');

    student.applications.push({
      project: projectId,
      status: status,
      interviewNote: note,
      updatedBy: facultyId,
      updatedAt: Date.now()
    });
  } else {
    application.status = status;
    application.interviewNote = note;
    application.updatedBy = facultyId;
    application.updatedAt = Date.now();
  }

  await student.save();
  return successResponse(res, {}, 'Interview result updated successfully');
});

module.exports = {
  getDashboard,
  applyForProject,
  withdrawApplication,
  updateProfile,
  getProjectStudents,
  updateInterviewStatus,
  approveStudent,
  rejectStudent
};

