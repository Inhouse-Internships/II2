const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Project = require('../models/Project');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { ROLES, ATTENDANCE_STATUS, SETTING_KEYS } = require('../utils/constants');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { startOfDayIST: getStartOfDayIST, endOfDayIST: getEndOfDayIST, getISTTime: getCurrentDateIST, getISTTimeAsDate } = require('../utils/time');
const { calculateDistance } = require('../utils/location');
const { checkProjectAuthorization: isAuthorized } = require('../utils/projectUtils');

// Helper function to check if a user is authorized for a project
const checkProjectAuthorization = async (user, projectId) => {
    const authorized = await isAuthorized(user, projectId);
    if (!authorized) {
        throw new AppError(403, 'Not authorized for this project');
    }
};

// Helper function to validate if a date falls within the configured internship period
const validateInternshipDate = async (date) => {
    const [startSetting, endSetting] = await Promise.all([
        Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_START_DATE }).lean(),
        Setting.findOne({ key: SETTING_KEYS.INTERNSHIP_END_DATE }).lean()
    ]);

    if (!startSetting || !endSetting) return; // Dates not set, allowing for now or maybe enforce? User said "no one", so let's allow if not set or enforce? Usually better to enforce if dates are defined.

    const markDate = getStartOfDayIST(new Date(date)).toDate();
    const startDate = getStartOfDayIST(new Date(startSetting.value)).toDate();
    const endDate = getStartOfDayIST(new Date(endSetting.value)).toDate();

    if (markDate < startDate || markDate > endDate) {
        throw new AppError(403, `Attendance can only be marked within the internship period (${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()})`);
    }
};

// ==========================================
// FACULTY APIs
// ==========================================

// @desc    Faculty bulk marks student attendance
// @route   POST /api/attendance/mark
// @access  Private (Faculty, Admin)
const markAttendance = asyncHandler(async (req, res) => {
    const { projectId, date, records } = req.body;
    // records: [{ studentId: '..', attendanceStatus: 'Present', remarks: 'Good' }]

    if (!projectId || !date || !Array.isArray(records)) {
        throw new AppError(400, 'Project ID, date, and valid records array are required');
    }

    const user = req.user;
    const pid = new mongoose.Types.ObjectId(projectId);
    await checkProjectAuthorization(user, pid);
    await validateInternshipDate(date);

    const project = await Project.findById(pid);
    const targetStart = getStartOfDayIST(new Date(date)).toDate();
    const todayStart = getStartOfDayIST(getCurrentDateIST()).toDate();

    // Faculty can only mark attendance for the current day
    if (user.role === ROLES.FACULTY && targetStart.getTime() !== todayStart.getTime()) {
        throw new AppError(403, 'Faculty can only mark attendance for the current day');
    }

    // Deduplicate records to avoid 409 conflict in bulkWrite
    const uniqueRecordsMap = new Map();
    records.forEach(r => {
        if (r.studentId) uniqueRecordsMap.set(String(r.studentId), r);
    });

    const operations = Array.from(uniqueRecordsMap.values()).map(record => {
        if (!Object.values(ATTENDANCE_STATUS).includes(record.attendanceStatus)) {
            throw new AppError(400, `Invalid status: ${record.attendanceStatus}`);
        }

        const sid = new mongoose.Types.ObjectId(record.studentId);
        return {
            updateOne: {
                filter: {
                    studentId: sid,
                    projectId: pid,
                    date: targetStart
                },
                update: {
                    $setOnInsert: {
                        studentId: sid,
                        projectId: pid,
                        date: targetStart,
                        departmentId: project.baseDept || 'Unknown',
                        markedByRole: user.role,
                        facultyId: user._id
                    },
                    $set: {
                        attendanceStatus: record.attendanceStatus,
                        remarks: record.remarks || ''
                    }
                },
                upsert: true
            }
        };
    });

    if (operations.length > 0) {
        await Attendance.bulkWrite(operations);
    }

    successResponse(res, null, 'Attendance marked successfully');
});

// @desc    Get attendance for a specific project
// @route   GET /api/attendance/project/:projectId
// @access  Private (Faculty, HOD, Admin)
const getProjectAttendance = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { date, startDate, endDate } = req.query;

    await checkProjectAuthorization(req.user, projectId);

    let query = { projectId: projectId };

    if (date) {
        query.date = getStartOfDayIST(new Date(date)).toDate();
    } else if (startDate && endDate) {
        query.date = {
            $gte: getStartOfDayIST(new Date(startDate)).toDate(),
            $lte: getEndOfDayIST(new Date(endDate)).toDate()
        };
    }

    const attendanceRecords = await Attendance.find(query)
        .populate('studentId', 'name studentId email')
        .populate('facultyId', 'name')
        .populate('modifiedBy', 'name role')
        .sort({ date: -1 });

    successResponse(res, { attendance: attendanceRecords });
});

// @desc    Faculty updates a specific attendance record BEFORE HOD modifies it
// @route   PUT /api/attendance/update
// @access  Private (Faculty)
const updateAttendance = asyncHandler(async (req, res) => {
    const { attendanceId, attendanceStatus, remarks } = req.body;
    const user = req.user;

    const record = await Attendance.findById(attendanceId);
    if (!record) throw new AppError(404, 'Attendance record not found');

    await checkProjectAuthorization(user, record.projectId);
    await validateInternshipDate(record.date);

    const todayStart = getStartOfDayIST(getCurrentDateIST()).toDate();

    // Faculty can only update attendance for the current day
    if (user.role === ROLES.FACULTY && record.date.getTime() !== todayStart.getTime()) {
        throw new AppError(403, 'Faculty can only update attendance for the current day');
    }

    // Check if HOD already modified it
    if (record.modifiedBy) {
        throw new AppError(403, 'Cannot update this record as it has already been modified by an HOD/Admin');
    }

    record.attendanceStatus = attendanceStatus || record.attendanceStatus;
    record.remarks = remarks !== undefined ? remarks : record.remarks;

    await record.save();

    successResponse(res, { record }, 'Attendance updated successfully');
});

// ==========================================
// HOD APIs
// ==========================================

// @desc    HOD overrides/modifies an existing attendance record
// @route   PUT /api/attendance/hod-modify
// @access  Private (HOD, Admin)
const hodModifyAttendance = asyncHandler(async (req, res) => {
    const { attendanceId, attendanceStatus, remarks } = req.body;
    const user = req.user;

    const record = await Attendance.findById(attendanceId);
    if (!record) throw new AppError(404, 'Attendance record not found');

    const project = await Project.findById(record.projectId);

    if (user.role === ROLES.HOD) {
        const hod = await User.findById(user._id);

        if (project.baseDept !== hod.department && hod.department) {
            throw new AppError(403, 'Project does not belong to your department');
        }
    }

    await validateInternshipDate(record.date);

    if (!Object.values(ATTENDANCE_STATUS).includes(attendanceStatus)) {
        throw new AppError(400, 'Invalid status');
    }

    record.previousAttendanceStatus = record.attendanceStatus;
    record.attendanceStatus = attendanceStatus;
    record.remarks = remarks !== undefined ? remarks : record.remarks;
    record.modifiedBy = user._id;
    record.modificationTimestamp = new Date();

    await record.save();

    successResponse(res, { record }, 'Attendance overridden successfully by HOD');
});

// @desc    HOD gets department attendance overview
// @route   GET /api/attendance/department
// @access  Private (HOD)
const getDepartmentAttendance = asyncHandler(async (req, res) => {
    const user = req.user;
    const { date, projectId } = req.query;

    const targetStart = date ? getStartOfDayIST(new Date(date)).toDate() : getStartOfDayIST(getCurrentDateIST()).toDate();
    const targetEnd = getEndOfDayIST(targetStart).toDate();

    let query = { date: { $gte: targetStart, $lte: targetEnd } };
    if (projectId) {
        query.projectId = projectId;
    }
    if (user.role === ROLES.HOD) {
        const hod = await User.findById(user._id);
        if (hod.department) {
            query.departmentId = hod.department;
        }
    }

    const records = await Attendance.find(query).populate('projectId', 'title projectId displayId')
        .populate('studentId', 'name studentId');

    successResponse(res, { attendance: records });
});

// ==========================================
// STUDENT APIs
// ==========================================

// @desc    Get student's own attendance records
// @route   GET /api/attendance/my
// @access  Private (Student)
const getMyAttendance = asyncHandler(async (req, res) => {
    const user = req.user;

    const studentData = await User.findById(user._id);
    if (!studentData.appliedProject) {
        return successResponse(res, { attendance: [], summary: { total: 0, present: 0, percentage: 0 } });
    }

    const records = await Attendance.find({
        studentId: user._id,
        projectId: studentData.appliedProject
    })
        .populate('facultyId', 'name')
        .sort({ date: -1 });

    const totalDays = records.length;
    const presentDays = records.filter(r => r.attendanceStatus === ATTENDANCE_STATUS.PRESENT).length;
    const absentDays = records.filter(r => r.attendanceStatus === ATTENDANCE_STATUS.ABSENT).length;
    const deniedDays = records.filter(r => r.attendanceStatus === ATTENDANCE_STATUS.DENIED).length;

    const percentage = (totalDays - deniedDays) > 0 ? ((presentDays / (totalDays - deniedDays)) * 100).toFixed(2) : 0;

    successResponse(res, {
        attendance: records,
        summary: {
            totalDays,
            presentDays,
            absentDays,
            deniedDays,
            percentage: Number(percentage)
        }
    });
});

// @desc    Student marks their own attendance via Geo-Location
// @route   POST /api/attendance/self-mark
// @access  Private (Student)
const markSelfAttendance = asyncHandler(async (req, res) => {
    const { latitude, longitude, accuracy } = req.body;
    const user = req.user;


    if (latitude === undefined || longitude === undefined || accuracy === undefined) {
        throw new AppError(400, 'Latitude, longitude, and accuracy are required');
    }

    // 2. Validate Time Window (configurable via admin settings)
    const now = getISTTimeAsDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeMinutes = hours * 60 + minutes;

    const [winStartSet, winEndSet, timeCheckDisabledSet] = await Promise.all([
        Setting.findOne({ key: SETTING_KEYS.ATTENDANCE_WINDOW_START }).lean(),
        Setting.findOne({ key: SETTING_KEYS.ATTENDANCE_WINDOW_END }).lean(),
        Setting.findOne({ key: SETTING_KEYS.ATTENDANCE_TIME_CHECK_DISABLED }).lean()
    ]);

    const parseTimeToMinutes = (timeStr, fallback) => {
        if (!timeStr) return fallback;
        const [h, m] = String(timeStr).split(':').map(Number);
        return (isNaN(h) || isNaN(m)) ? fallback : h * 60 + m;
    };

    const startTimeMinutes = parseTimeToMinutes(winStartSet?.value, 9 * 60);       // default 09:00
    const endTimeMinutes = parseTimeToMinutes(winEndSet?.value, 10 * 60 + 30); // default 10:30
    const timeCheckDisabled = timeCheckDisabledSet ? Boolean(timeCheckDisabledSet.value) : false;

    const fmtTime = (totalMins) => {
        const hh = Math.floor(totalMins / 60);
        const mm = totalMins % 60;
        const suffix = hh >= 12 ? 'PM' : 'AM';
        const displayH = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
        return `${displayH}:${String(mm).padStart(2, '0')} ${suffix}`;
    };


    if (!timeCheckDisabled && (currentTimeMinutes < startTimeMinutes || currentTimeMinutes > endTimeMinutes)) {
        throw new AppError(403, `Attendance can only be marked between ${fmtTime(startTimeMinutes)} and ${fmtTime(endTimeMinutes)}. Current IST time: ${hours}:${String(minutes).padStart(2, '0')}.`);
    }

    // 3. Get Student and Project Details
    const studentData = await User.findById(user._id);
    if (!studentData.appliedProject) {
        throw new AppError(400, 'No project assigned to you. Please contact your administrator.');
    }

    const project = await Project.findById(studentData.appliedProject);
    if (!project) {
        throw new AppError(404, 'Project not found.');
    }

    // 4. Check for duplicate entry today
    const todayStart = getStartOfDayIST(now).toDate();
    const existingRecord = await Attendance.findOne({
        studentId: user._id,
        projectId: project._id,
        date: todayStart
    });

    // Only block if already marked as 'Present'
    if (existingRecord && existingRecord.attendanceStatus === ATTENDANCE_STATUS.PRESENT) {
        throw new AppError(400, 'Attendance already marked for today.');
    }

    // 5. Verify Location settings & accuracy
    const [latSet, longSet, radSet, accSet] = await Promise.all([
        Setting.findOne({ key: SETTING_KEYS.CAMPUS_LATITUDE }).lean(),
        Setting.findOne({ key: SETTING_KEYS.CAMPUS_LONGITUDE }).lean(),
        Setting.findOne({ key: SETTING_KEYS.CAMPUS_RADIUS }).lean(),
        Setting.findOne({ key: SETTING_KEYS.CAMPUS_ACCURACY_THRESHOLD }).lean()
    ]);

    const campusLat = latSet ? Number(latSet.value) : 17.088255;   // Aditya University, Gandepalli
    const campusLong = longSet ? Number(longSet.value) : 82.067528; // Aditya University, Gandepalli
    const allowedRadius = radSet ? Number(radSet.value) : 300; // meters
    const accuracyThreshold = accSet ? Number(accSet.value) : 500; // meters (500m covers Wi-Fi/desktop)

    // Validate accuracy against configurable threshold
    if (!timeCheckDisabled && accuracy > accuracyThreshold) {
        throw new AppError(400, `Location accuracy is too low (${accuracy.toFixed(0)}m reported, max allowed is ${accuracyThreshold}m). Please enable GPS or move to a better location.`);
    }

    const distance = calculateDistance(latitude, longitude, campusLat, campusLong);
    const isInside = timeCheckDisabled || (distance <= allowedRadius);

    // 6. Record Attendance
    // Find the faculty responsible for this project (Guide or Co-Guide)
    const assignedFaculty = await User.findOne({
        role: ROLES.FACULTY,
        $or: [
            { appliedProject: project._id },
            { coGuidedProject: project._id }
        ]
    }).lean();

    const attendanceRecord = await Attendance.findOneAndUpdate(
        {
            studentId: user._id,
            projectId: project._id,
            date: todayStart
        },
        {
            facultyId: assignedFaculty ? assignedFaculty._id : user._id,
            departmentId: project.baseDept || 'Unknown',
            attendanceStatus: isInside ? ATTENDANCE_STATUS.PRESENT : ATTENDANCE_STATUS.DENIED,
            latitude,
            longitude,
            accuracy,
            locationStatus: timeCheckDisabled ? 'Inside Campus (Test Mode)' : (isInside ? 'Inside Campus' : 'Outside Campus'),
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            markedByRole: ROLES.STUDENT,
            remarks: timeCheckDisabled ? 'Self-marked (Test Mode Bypass)' : (isInside ? 'Self-marked (Inside Campus)' : 'Denied (Outside Campus)')
        },
        { upsert: true, new: true }
    );

    if (!isInside) {
        throw new AppError(403, 'Attendance can only be marked within the college campus.');
    }

    successResponse(res, { attendanceRecord }, 'Attendance marked successfully. You are inside campus.');
});

// @desc    Get attendance analytics for all projects (Admin/HOD)
// @route   GET /api/attendance/analytics
// @access  Private (Admin, HOD)
const getAttendanceAnalytics = asyncHandler(async (req, res) => {
    const user = req.user;
    let projectMatch = {};

    if (user.role === ROLES.HOD && user.department) {
        projectMatch.baseDept = user.department;
    }

    const projects = await Project.find(projectMatch)
        .select('_id title projectId guide coGuide baseDept status')
        .populate('baseDept', 'name')
        .lean();

    const mappedProjects = projects.map(p => ({
        ...p,
        baseDept: p.baseDept ? (p.baseDept.name || p.baseDept) : ''
    }));

    const projectIds = mappedProjects.map(p => p._id);

    // Aggregate attendance data in one go
    const attendanceStats = await Attendance.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $sort: { date: -1 } },
        {
            $group: {
                _id: "$studentId",
                projectId: { $first: "$projectId" },
                totalDays: { $sum: 1 },
                presentDays: { $sum: { $cond: [{ $eq: ["$attendanceStatus", ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
                lastRecords: { $push: { date: "$date", status: "$attendanceStatus" } }
            }
        },
        {
            $project: {
                totalDays: 1,
                presentDays: 1,
                projectId: 1,
                percentage: {
                    $cond: [
                        { $gt: ["$totalDays", 0] },
                        { $multiply: [{ $divide: ["$presentDays", "$totalDays"] }, 100] },
                        0
                    ]
                },
                records: { $slice: ["$lastRecords", 10] }
            }
        }
    ]);

    // Map stats for easy lookup
    const statsMapByStudent = Object.fromEntries(attendanceStats.map(s => [String(s._id), s]));

    // Get all students for these projects
    const students = await User.find({ role: ROLES.STUDENT, appliedProject: { $in: projectIds } })
        .select('_id name studentId appliedProject')
        .lean();

    const finalizedProjects = mappedProjects.map(p => {
        const pId = String(p._id);
        const projectStudents = students.filter(s => String(s.appliedProject) === pId);

        const studentStats = projectStudents.map(s => {
            const stat = statsMapByStudent[String(s._id)] || { totalDays: 0, presentDays: 0, percentage: 0, records: [] };
            return {
                _id: s._id,
                name: s.name,
                studentId: s.studentId,
                totalDays: stat.totalDays,
                presentDays: stat.presentDays,
                percentage: stat.percentage,
                records: stat.records
            };
        });

        const overallAvg = studentStats.length > 0
            ? studentStats.reduce((sum, s) => sum + s.percentage, 0) / studentStats.length
            : 0;

        return {
            ...p,
            totalStudents: studentStats.length,
            overallAverage: overallAvg,
            studentStats
        };
    });

    successResponse(res, finalizedProjects, 'Attendance analytics retrieved');
});

module.exports = {
    markAttendance,
    getProjectAttendance,
    updateAttendance,
    hodModifyAttendance,
    getDepartmentAttendance,
    getMyAttendance,
    getAttendanceAnalytics,
    markSelfAttendance
};
