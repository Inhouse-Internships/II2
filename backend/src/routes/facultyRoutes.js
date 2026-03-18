const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');

router.use(authenticate, authorizeRoles([ROLES.FACULTY, ROLES.HOD]));

router.get('/dashboard/:id', facultyController.getDashboard);
router.post('/apply', facultyController.applyForProject);
router.post('/withdraw', facultyController.withdrawApplication);
router.put('/profile/:id', facultyController.updateProfile);
router.get('/projects/:projectId/students', facultyController.getProjectStudents);
router.post('/interview-status', facultyController.updateInterviewStatus);
router.post('/students/:studentId/approve', facultyController.approveStudent);
router.post('/students/:studentId/reject', facultyController.rejectStudent);

module.exports = router;
