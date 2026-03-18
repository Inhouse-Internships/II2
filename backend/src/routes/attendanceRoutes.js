const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');
const {
    markAttendance,
    getProjectAttendance,
    updateAttendance,
    hodModifyAttendance,
    getDepartmentAttendance,
    getMyAttendance,
    getAttendanceAnalytics,
    markSelfAttendance
} = require('../controllers/attendanceController');

const router = express.Router();

// Apply protect middleware to all attendance routes
router.use(authenticate);

// Faculty APIs
router.post('/mark', authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN), markAttendance);
router.put('/update', authorizeRoles(ROLES.FACULTY), updateAttendance);
router.get('/project/:projectId', authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN), getProjectAttendance);

// Analytics
router.get('/analytics', authorizeRoles(ROLES.HOD, ROLES.ADMIN), getAttendanceAnalytics);

// HOD APIs
router.put('/hod-modify', authorizeRoles(ROLES.HOD, ROLES.ADMIN), hodModifyAttendance);
router.get('/department', authorizeRoles(ROLES.HOD, ROLES.ADMIN), getDepartmentAttendance);

// Student APIs
router.get('/my', authorizeRoles(ROLES.STUDENT), getMyAttendance);
router.post('/self-mark', authorizeRoles(ROLES.STUDENT), markSelfAttendance);

module.exports = router;
