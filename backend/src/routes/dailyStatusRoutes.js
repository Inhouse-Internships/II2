const express = require('express');
const router = express.Router();
const controller = require('../controllers/dailyStatusController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');

// Apply authentication to all routes
router.use(authenticate);

// Student routes
router.post('/student', authorizeRoles(ROLES.STUDENT), controller.submitStatus);
router.get('/student/:projectId', authorizeRoles(ROLES.STUDENT), controller.getStudentStatuses);
router.put('/student/:id', authorizeRoles(ROLES.STUDENT), controller.editStatus);
router.delete('/student/:id', authorizeRoles(ROLES.STUDENT), controller.deleteStatus);

// Faculty routes
router.get('/faculty/:projectId', authorizeRoles(ROLES.FACULTY), controller.getFacultyStatuses);
router.put('/faculty/:id', authorizeRoles(ROLES.FACULTY), controller.reviewStatus);

// Admin routes
router.get('/admin', authorizeRoles(ROLES.ADMIN), controller.getAllStatuses);

module.exports = router;
