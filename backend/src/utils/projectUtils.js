const mongoose = require('mongoose');
const Project = require('../models/Project');
const AppError = require('./appError');
const { ROLES, USER_STATUS } = require('./constants');

async function getProjectWithDepartmentEntry(projectId, departmentName) {
    const project = await Project.findById(projectId).populate('departments.department');
    if (!project) {
        throw new AppError(404, 'Project not found');
    }

    const departmentEntry = project.departments?.find(
        (d) => d.department && d.department.name === departmentName
    );

    return { project, departmentEntry };
}

async function decrementSeatIfRequired(projectId, departmentName) {
    if (!projectId || !departmentName) return;

    const { project, departmentEntry } = await getProjectWithDepartmentEntry(projectId, departmentName);

    if (!departmentEntry) {
        throw new AppError(400, `Department '${departmentName}' is not assigned to this project`);
    }

    if ((departmentEntry.seats || 0) <= 0) {
        throw new AppError(400, `No seats available for department '${departmentName}'`);
    }

    departmentEntry.seats -= 1;
    await project.save();
}

async function incrementSeatIfRequired(projectId, departmentName) {
    if (!projectId || !departmentName) return;

    const { project, departmentEntry } = await getProjectWithDepartmentEntry(projectId, departmentName);
    if (!departmentEntry) return;

    departmentEntry.seats += 1;
    await project.save();
}

async function syncFacultyProjectByEmpId(input, type = 'project') {
    const User = require('../models/User');

    if (type === 'project') {
        const project = input;
        // Guide sync
        if (project.guideEmpId) {
            const faculty = await User.findOne({ employeeId: project.guideEmpId, role: ROLES.FACULTY });
            if (faculty) {
                let facultyUpdated = false;
                if (String(faculty.appliedProject) !== String(project._id)) {
                    if (faculty.appliedProject) {
                        await Project.findByIdAndUpdate(faculty.appliedProject, { guide: '' });
                    }
                    faculty.appliedProject = project._id;
                    faculty.status = USER_STATUS.APPROVED;
                    faculty.requestedProject = null;
                    facultyUpdated = true;
                }

                let projectUpdated = false;
                if (!project.guide || project.guide.trim() === '') {
                    project.guide = faculty.name;
                    projectUpdated = true;
                }

                if (facultyUpdated) await faculty.save();
                if (projectUpdated) await project.save();

                // Unassign other guides from this project
                await User.updateMany(
                    { role: ROLES.FACULTY, appliedProject: project._id, _id: { $ne: faculty._id } },
                    { $set: { appliedProject: null, status: USER_STATUS.PENDING } }
                );
            }
        }
        // Co-Guide sync
        if (project.coGuideEmpId) {
            const coFaculty = await User.findOne({ employeeId: project.coGuideEmpId, role: ROLES.FACULTY });
            if (coFaculty) {
                let coFacultyUpdated = false;
                if (String(coFaculty.coGuidedProject) !== String(project._id)) {
                    if (coFaculty.coGuidedProject) {
                        await Project.findByIdAndUpdate(coFaculty.coGuidedProject, { coGuide: '' });
                    }
                    coFaculty.coGuidedProject = project._id;
                    coFaculty.coGuideStatus = USER_STATUS.APPROVED;
                    coFaculty.requestedCoGuideProject = null;
                    coFacultyUpdated = true;
                }

                let projectUpdated = false;
                if (!project.coGuide || project.coGuide.trim() === '') {
                    project.coGuide = coFaculty.name;
                    projectUpdated = true;
                }

                if (coFacultyUpdated) await coFaculty.save();
                if (projectUpdated) await project.save();

                // Unassign other co-guides from this project
                await User.updateMany(
                    { role: ROLES.FACULTY, coGuidedProject: project._id, _id: { $ne: coFaculty._id } },
                    { $set: { coGuidedProject: null, coGuideStatus: USER_STATUS.PENDING } }
                );
            }
        }
    } else {
        const faculty = input;
        if (faculty.role !== ROLES.FACULTY || !faculty.employeeId) return;

        // Search for project where this faculty is guide
        const projectAsGuide = await Project.findOne({ guideEmpId: faculty.employeeId });
        if (projectAsGuide) {
            if (faculty.appliedProject && String(faculty.appliedProject) !== String(projectAsGuide._id)) {
                await Project.findByIdAndUpdate(faculty.appliedProject, { guide: '' });
            }
            faculty.appliedProject = projectAsGuide._id;
            faculty.status = USER_STATUS.APPROVED;
            faculty.requestedProject = null;

            if (!projectAsGuide.guide || projectAsGuide.guide.trim() === '') {
                projectAsGuide.guide = faculty.name;
                await projectAsGuide.save();
            }

            await User.updateMany(
                { role: ROLES.FACULTY, appliedProject: projectAsGuide._id, _id: { $ne: faculty._id } },
                { $set: { appliedProject: null, status: USER_STATUS.PENDING } }
            );
        }

        // Search for project where this faculty is co-guide
        const projectAsCoGuide = await Project.findOne({ coGuideEmpId: faculty.employeeId });
        if (projectAsCoGuide) {
            if (faculty.coGuidedProject && String(faculty.coGuidedProject) !== String(projectAsCoGuide._id)) {
                await Project.findByIdAndUpdate(faculty.coGuidedProject, { coGuide: '' });
            }
            faculty.coGuidedProject = projectAsCoGuide._id;
            faculty.coGuideStatus = USER_STATUS.APPROVED;
            faculty.requestedCoGuideProject = null;

            if (!projectAsCoGuide.coGuide || projectAsCoGuide.coGuide.trim() === '') {
                projectAsCoGuide.coGuide = faculty.name;
                await projectAsCoGuide.save();
            }

            await User.updateMany(
                { role: ROLES.FACULTY, coGuidedProject: projectAsCoGuide._id, _id: { $ne: faculty._id } },
                { $set: { coGuidedProject: null, coGuideStatus: USER_STATUS.PENDING } }
            );
        }
    }
}

async function checkProjectAuthorization(user, projectOrId) {
    const Project = require('../models/Project');

    if (!user) return false;
    if (user.role === ROLES.ADMIN || user.role === ROLES.HOD) {
        return true;
    }

    let project;
    if (typeof projectOrId === 'string' || mongoose.Types.ObjectId.isValid(projectOrId)) {
        project = await Project.findById(projectOrId);
    } else {
        project = projectOrId;
    }

    if (!project) return false;

    const pid = project._id.toString();

    if (user.role === ROLES.FACULTY) {
        // 1. Check by ID reference in user object
        const isGuideById = user.appliedProject?.toString() === pid;
        const isCoGuideById = user.coGuidedProject?.toString() === pid;

        // 2. Check by matching employeeId in project object
        const matchesGuideEmpId = project.guideEmpId && user.employeeId && String(project.guideEmpId) === String(user.employeeId);
        const matchesCoGuideEmpId = project.coGuideEmpId && user.employeeId && String(project.coGuideEmpId) === String(user.employeeId);

        // 3. Fallback: check matching names
        const uName = (user.name || "").trim().toLowerCase();
        const gName = (project.guide || "").trim().toLowerCase();
        const cgName = (project.coGuide || "").trim().toLowerCase();
        const matchesGuideName = uName !== "" && gName === uName;
        const matchesCoGuideName = uName !== "" && cgName === uName;

        return !!(isGuideById || isCoGuideById || matchesGuideEmpId || matchesCoGuideEmpId || matchesGuideName || matchesCoGuideName);
    }

    if (user.role === ROLES.STUDENT) {
        return user.appliedProject?.toString() === pid;
    }

    return false;
}

module.exports = {
    getProjectWithDepartmentEntry,
    decrementSeatIfRequired,
    incrementSeatIfRequired,
    syncFacultyProjectByEmpId,
    checkProjectAuthorization
};
