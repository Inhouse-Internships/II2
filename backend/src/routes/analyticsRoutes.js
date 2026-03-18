const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');

// Admin Analytics
router.get('/university', authenticate, authorizeRoles(ROLES.ADMIN), analyticsController.getUniversityAnalytics);

// Admin & HOD Analytics
router.get(['/department', '/department/:departmentId'], authenticate, authorizeRoles(ROLES.ADMIN, ROLES.HOD), analyticsController.getDepartmentAnalytics);

// Guide Analytics
router.get('/guide', authenticate, authorizeRoles(ROLES.FACULTY), analyticsController.getGuideAnalytics);

// Student Analytics
router.get('/student', authenticate, authorizeRoles(ROLES.STUDENT), analyticsController.getStudentAnalytics);

// Dashboard Summary API
// router.get('/dashboard-summary', authenticate, analyticsController.getDashboardSummary);

module.exports = router;
