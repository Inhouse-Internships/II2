const Project = require('../models/Project');
const User = require('../models/User');
const Program = require('../models/Program');
const Department = require('../models/Department');

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { successResponse } = require('../utils/response');
const { ROLES, USER_STATUS } = require('../utils/constants');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const Attendance = require('../models/Attendance');
const DailyStatus = require('../models/DailyStatus');
const Review = require('../models/Review');
const { invalidateAnalyticsCache } = require('./analyticsController');

function parsePagination(query = {}) {
  const limit = Number(query.limit);
  const skip = Number(query.skip);

  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    skip: Number.isFinite(skip) && skip > 0 ? skip : 0
  };
}

async function buildProjectMaps(projectIds) {
  if (!projectIds.length) {
    return {
      guideMap: new Map(),
      coGuideMap: new Map(),
      studentCountMap: new Map(),
      studentsByProjectMap: new Map(),
      studentsByProjectDepartmentMap: new Map()
    };
  }

  const [guides, coGuides, students] = await Promise.all([
    User.find({ role: ROLES.FACULTY, status: USER_STATUS.APPROVED, appliedProject: { $in: projectIds } })
      .select('name phone department appliedProject employeeId')
      .lean(),

    User.find({ role: ROLES.FACULTY, coGuideStatus: USER_STATUS.APPROVED, coGuidedProject: { $in: projectIds } })
      .select('name phone department coGuidedProject employeeId')
      .lean(),

    User.find({
      role: ROLES.STUDENT,
      $or: [
        { appliedProject: { $in: projectIds } },
        { projectApplications: { $in: projectIds } }
      ]
    })
      .select('_id name studentId department phone email level appliedProject projectApplications')
      .lean()
  ]);

  const guideMap = new Map();
  guides.forEach((entry) => {
    guideMap.set(String(entry.appliedProject), {
      name: entry.name,
      phone: entry.phone || '',
      department: entry.department || '',
      employeeId: entry.employeeId || ''
    });
  });

  const coGuideMap = new Map();
  coGuides.forEach((entry) => {
    coGuideMap.set(String(entry.coGuidedProject), {
      name: entry.name,
      phone: entry.phone || '',
      department: entry.department || '',
      employeeId: entry.employeeId || ''
    });
  });

  const studentCountMap = new Map();
  const studentsByProjectMap = new Map();
  const studentsByProjectDepartmentMap = new Map();

  const pidSet = new Set(projectIds.map(String));

  students.forEach((student) => {
    // A student can have one primary (appliedProject) and multiple secondary (projectApplications)
    const applications = new Set();
    if (student.appliedProject && pidSet.has(String(student.appliedProject))) {
      applications.add(String(student.appliedProject));
    }
    (student.projectApplications || []).forEach(p => {
      if (pidSet.has(String(p))) {
        applications.add(String(p));
      }
    });

    applications.forEach(projectKey => {
      studentCountMap.set(projectKey, (studentCountMap.get(projectKey) || 0) + 1);

      // For studentsByProjectMap, we mainly care about assigned students or those who applied
      if (!studentsByProjectMap.has(projectKey)) {
        studentsByProjectMap.set(projectKey, []);
      }
      studentsByProjectMap.get(projectKey).push(student);

      const deptKey = `${projectKey}:${student.department || ''}`;
      studentsByProjectDepartmentMap.set(deptKey, (studentsByProjectDepartmentMap.get(deptKey) || 0) + 1);
    });
  });

  return {
    guideMap,
    coGuideMap,
    studentCountMap,
    studentsByProjectMap,
    studentsByProjectDepartmentMap
  };
}

const getAllProjects = asyncHandler(async (req, res) => {
  const { limit, skip, baseDept, guideDept, coGuideDept, status, search, program } = req.query;
  const pagination = parsePagination({ limit, skip });

  let filter = {};

  const resolveDept = async (deptName) => {
    if (!deptName) return null;
    if (deptName.match(/^[0-9a-fA-F]{24}$/)) return deptName; // Already ObjectId
    const d = await Department.findOne({ name: deptName }).lean();
    return d ? d._id : deptName;
  };

  if (req.user && req.user.role === ROLES.FACULTY) {
    const deptId = await resolveDept(req.user.department);
    filter.$or = [
      { baseDept: deptId },
      { guideDept: deptId },
      { coGuideDept: deptId }
    ];
  } else if (req.user && req.user.role === ROLES.HOD) {
    const deptId = await resolveDept(req.user.department);
    filter.$or = [
      { baseDept: deptId },
      { coGuideDept: deptId }
    ];
  } else {
    if (baseDept) {
      if (baseDept === 'Assigned') filter.baseDept = { $ne: null, $exists: true };
      else if (baseDept !== 'All') filter.baseDept = await resolveDept(baseDept);
    }
    if (guideDept) {
      if (guideDept === 'Assigned') filter.guide = { $ne: '', $exists: true };
      else if (guideDept !== 'All') filter.guideDept = await resolveDept(guideDept);
    }
    if (coGuideDept) {
      if (coGuideDept === 'Assigned') filter.coGuide = { $ne: '', $exists: true };
      else if (coGuideDept !== 'All') filter.coGuideDept = await resolveDept(coGuideDept);
    }
  }

  if (status && status !== 'All') filter.status = status;

  if (program && program !== 'All') {
    const selectedProg = await Program.findOne({ name: program }).populate('departments').lean();
    if (selectedProg) {
      const deptIds = selectedProg.departments.map(d => d._id);
      const deptNames = selectedProg.departments.map(d => d.name);

      const programFilter = {
        $or: [
          { 'departments.department': { $in: deptIds } },
          { baseDept: { $in: deptNames } }
        ]
      };

      if (filter.$or) {
        filter = { $and: [filter, programFilter] };
      } else {
        filter = { ...filter, ...programFilter };
      }
    }
  }

  if (search) {
    const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const searchFilter = {
      $or: [
        { title: regex },
        { projectId: regex },
        { guide: regex },
        { coGuide: regex },
        { guideEmpId: regex },
        { coGuideEmpId: regex },
        { description: regex },
        { skillsRequired: regex },
        { projectOutcome: regex }
      ]
    };

    if (filter.$or) {
      filter = { $and: [filter, searchFilter] };
    } else {
      filter = { ...filter, ...searchFilter };
    }
  }

  let query = Project.find(filter)
    .populate('departments.department', 'name')
    .populate('baseDept guideDept coGuideDept', 'name')
    .select('title projectId baseDept description status guide guideDept guideEmpId coGuide coGuideDept coGuideEmpId skillsRequired projectOutcome teamLeader departments registeredCount totalSeats hasLevel2Student hasLevel1Student createdAt')
    .sort({ status: -1, createdAt: -1 });
  if (pagination.limit) query = query.limit(pagination.limit);
  if (pagination.skip) query = query.skip(pagination.skip);

  const projects = await query.lean();
  const projectIds = projects.map((project) => project._id);

  const {
    guideMap,
    coGuideMap,
    studentCountMap,
    studentsByProjectMap,
    studentsByProjectDepartmentMap
  } = await buildProjectMaps(projectIds);

  const result = projects.map((project) => {
    const projectKey = String(project._id);
    const projectStudents = studentsByProjectMap.get(projectKey) || [];

    const departments = (project.departments || []).map((entry) => {
      const name = entry.department ? entry.department.name : '';
      const deptKey = `${projectKey}:${name}`;

      return {
        name,
        seats: entry.seats || 0,
        registered: studentsByProjectDepartmentMap.get(deptKey) || 0
      };
    });

    const guide = guideMap.get(projectKey);
    const coGuide = coGuideMap.get(projectKey);

    return {
      ...project,
      baseDept: project.baseDept ? (project.baseDept.name || project.baseDept) : '',
      guide: guide ? guide.name : (project.guide || ''),
      guidePhone: guide ? guide.phone : '',
      guideDept: (guide && guide.department) ? guide.department : (project.guideDept ? (project.guideDept.name || project.guideDept) : ''),
      guideEmpId: guide ? guide.employeeId : (project.guideEmpId || ''),
      coGuide: coGuide ? coGuide.name : (project.coGuide || ''),
      coGuidePhone: coGuide ? coGuide.phone : '',
      coGuideDept: (coGuide && coGuide.department) ? coGuide.department : (project.coGuideDept ? (project.coGuideDept.name || project.coGuideDept) : ''),
      coGuideEmpId: coGuide ? coGuide.employeeId : (project.coGuideEmpId || ''),
      students: projectStudents,
      departments,
      registeredCount: studentCountMap.get(projectKey) || 0,
      totalSeats: departments.reduce((sum, entry) => sum + (entry.seats || 0), 0),
      hasLevel2Student: projectStudents.some((student) => student.level === 2),
      hasLevel1Student: projectStudents.some((student) => student.level === 1)
    };
  });

  const total = await Project.countDocuments(filter);
  return successResponse(res, {
    data: result,
    pagination: {
      total,
      limit: pagination.limit,
      skip: pagination.skip,
      totalPages: pagination.limit ? Math.ceil(total / pagination.limit) : 1
    }
  });
});

const getProjectById = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('departments.department', 'name')
    .populate('baseDept guideDept coGuideDept', 'name')
    .lean();
  if (!project) throw new AppError(404, 'Project not found');

  const {
    guideMap,
    coGuideMap,
    studentCountMap,
    studentsByProjectMap,
    studentsByProjectDepartmentMap
  } = await buildProjectMaps([project._id]);

  const projectKey = String(project._id);
  const projectStudents = studentsByProjectMap.get(projectKey) || [];

  const departments = (project.departments || []).map((entry) => {
    const name = entry.department ? entry.department.name : '';
    const deptKey = `${projectKey}:${name}`;

    return {
      name,
      seats: entry.seats || 0,
      registered: studentsByProjectDepartmentMap.get(deptKey) || 0
    };
  });

  const guide = guideMap.get(projectKey);
  const coGuide = coGuideMap.get(projectKey);

  const result = {
    ...project,
    guide: guide ? guide.name : (project.guide || ''),
    guideEmpId: guide ? guide.employeeId : (project.guideEmpId || ''),
    guideDept: (guide && guide.department) ? guide.department : (project.guideDept || ''),
    guidePhone: guide ? guide.phone : '',
    coGuide: coGuide ? coGuide.name : (project.coGuide || ''),
    coGuideEmpId: coGuide ? coGuide.employeeId : (project.coGuideEmpId || ''),
    coGuideDept: (coGuide && coGuide.department) ? coGuide.department : (project.coGuideDept || ''),
    coGuidePhone: coGuide ? coGuide.phone : '',
    skillsRequired: project.skillsRequired || '',
    projectOutcome: project.projectOutcome || '',
    students: projectStudents,
    departments,
    registeredCount: studentCountMap.get(projectKey) || 0,
    totalSeats: departments.reduce((sum, entry) => sum + (entry.seats || 0), 0)
  };

  return successResponse(res, result);
});

const createProject = asyncHandler(async (req, res) => {
  const { title, baseDept, projectId, ...otherFields } = req.body;
  if (!baseDept) throw new AppError(400, "Base Department is required");

  let newProjectId = projectId;
  if (newProjectId) {
    const existing = await Project.findOne({ projectId: newProjectId }).lean();
    if (existing) throw new AppError(409, "Project ID already exists");
  } else {
    try {
      newProjectId = await Project.generateProjectId(baseDept);
    } catch (err) {
      throw new AppError(400, err.message);
    }
  }

  const Department = require('../models/Department');
  const resolveDeptName = async (name) => {
    if (!name) return null;
    if (name.match(/^[0-9a-fA-F]{24}$/)) return name;
    let d = await Department.findOne({ name });
    if (!d) d = await Department.create({ name });
    return d._id;
  };

  const resolvedBaseDeptId = await resolveDeptName(baseDept);
  if (otherFields.guideDept) otherFields.guideDept = await resolveDeptName(otherFields.guideDept);
  if (otherFields.coGuideDept) otherFields.coGuideDept = await resolveDeptName(otherFields.coGuideDept);

  if (Array.isArray(otherFields.departments)) {
    const Department = require('../models/Department');
    const mappedDepartments = [];
    for (const entry of otherFields.departments) {
      if (entry.name) {
        let deptDoc = await Department.findOne({ name: entry.name });
        if (!deptDoc) {
          deptDoc = await Department.create({ name: entry.name });
        }
        mappedDepartments.push({
          department: deptDoc._id,
          seats: Number(entry.seats) || 0
        });
      } else if (entry.department) {
        mappedDepartments.push(entry);
      }
    }
    otherFields.departments = mappedDepartments;
  }

  const project = await Project.create({ title, baseDept: resolvedBaseDeptId, projectId: newProjectId, ...otherFields });
  return successResponse(res, project, 'Project created', 201);
});

const updateProject = asyncHandler(async (req, res) => {
  const { projectId, baseDept } = req.body;

  if (projectId === "") delete req.body.projectId;
  if (baseDept === "") delete req.body.baseDept;

  if (req.body.projectId) {
    const existing = await Project.findOne({ projectId: req.body.projectId, _id: { $ne: req.params.id } }).lean();
    if (existing) throw new AppError(409, 'Project ID already exists');
  }

  const oldProject = await Project.findById(req.params.id).lean();

  const Department = require('../models/Department');
  const resolveDeptName = async (name) => {
    if (!name) return null;
    if (name.match(/^[0-9a-fA-F]{24}$/)) return name;
    let d = await Department.findOne({ name });
    if (!d) d = await Department.create({ name });
    return d._id;
  };

  if (req.body.baseDept) req.body.baseDept = await resolveDeptName(req.body.baseDept);
  if (req.body.guideDept) req.body.guideDept = await resolveDeptName(req.body.guideDept);
  if (req.body.coGuideDept) req.body.coGuideDept = await resolveDeptName(req.body.coGuideDept);

  if (Array.isArray(req.body.departments)) {
    const Department = require('../models/Department');
    const mappedDepartments = [];
    for (const entry of req.body.departments) {
      if (entry.name) {
        let deptDoc = await Department.findOne({ name: entry.name });
        if (!deptDoc) {
          deptDoc = await Department.create({ name: entry.name });
        }
        mappedDepartments.push({
          department: deptDoc._id,
          seats: Number(entry.seats) || 0
        });
      } else if (entry.department) {
        mappedDepartments.push(entry);
      }
    }
    req.body.departments = mappedDepartments;
  }

  const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  return successResponse(res, project, 'Project updated');
});

const getProjectDepartments = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate('departments.department');
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  return successResponse(res, project.departments || []);
});

const updateProjectStatus = asyncHandler(async (req, res) => {
  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  );

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  return successResponse(res, project, 'Project status updated');
});

const deleteProjectDepartment = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  const deptIdToRemove = req.params.deptId;
  const originalLength = project.departments.length;

  project.departments = project.departments.filter(
    (entry) => String(entry.department) !== String(deptIdToRemove)
  );

  await project.save();

  if (project.departments.length < originalLength) {
    const Department = require('../models/Department');
    const Program = require('../models/Program');
    const deptDoc = await Department.findById(deptIdToRemove);

    if (deptDoc) {
      const isUsed = await Project.exists({
        $or: [
          { baseDept: deptDoc._id },
          { 'departments.department': deptDoc._id }
        ]
      });

      if (!isUsed) {
        await Program.updateMany(
          { departments: deptDoc._id },
          { $pull: { departments: deptDoc._id } }
        );
        await Department.findByIdAndDelete(deptDoc._id);
      }
    }
  }

  return successResponse(res, project.departments, 'Department removed from project');
});

const deleteProject = asyncHandler(async (req, res) => {
  const projectId = req.params.id;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  // Find all departments used by this project to check if they become orphaned
  const deptsToCheck = new Set();
  const Department = require('../models/Department');
  const Program = require('../models/Program');

  if (project.baseDept) {
    const baseDeptDoc = await Department.findOne({ name: project.baseDept }).lean();
    if (baseDeptDoc) deptsToCheck.add(baseDeptDoc._id.toString());
  }

  for (const entry of (project.departments || [])) {
    if (entry.department) deptsToCheck.add(entry.department.toString());
  }

  // 1. CLEAR USER ASSIGNMENTS & DEMOTE L2 STUDENTS
  // This handles students assigned to the project (Level 2) and faculty guiding it
  await User.updateMany(
    {
      $or: [
        { appliedProject: projectId },
        { requestedProject: projectId },
        { coGuidedProject: projectId },
        { requestedCoGuideProject: projectId }
      ]
    },
    {
      $set: {
        appliedProject: null,
        requestedProject: null,
        coGuidedProject: null,
        requestedCoGuideProject: null,
        status: USER_STATUS.PENDING,
        coGuideStatus: USER_STATUS.PENDING,
        guide: '',
        level: 1
      }
    }
  );

  // 2. CLEANUP APPLICATIONS ARRAYS
  // Remove this project from any student's application list
  await User.updateMany(
    {
      $or: [
        { projectApplications: projectId },
        { "applications.project": projectId }
      ]
    },
    {
      $pull: {
        projectApplications: projectId,
        applications: { project: projectId }
      }
    }
  );

  // 3. CLEANUP ASSOCIATED DATA
  await Promise.all([
    Task.deleteMany({ project: projectId }),
    TaskSubmission.deleteMany({ project: projectId }),
    Attendance.deleteMany({ project: projectId }),
    DailyStatus.deleteMany({ project: projectId }),
    Review.deleteMany({ project: projectId })
  ]);

  // 4. DELETE THE PROJECT
  await Project.findByIdAndDelete(projectId);
  invalidateAnalyticsCache();
  return successResponse(res, {}, 'Project deleted and all associated data/assignments cleaned up');
});

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  getProjectDepartments,
  updateProjectStatus,
  deleteProjectDepartment,
  deleteProject
};

