const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');
const multer = require('multer');
const path = require('path');

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit
});

const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', '..', 'uploads', 'submissions'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const diskUpload = multer({ storage: diskStorage });

// Admin Routes
router.post('/admin/dates', authenticate, authorizeRoles(ROLES.ADMIN), taskController.setInternshipDates);
router.post('/admin/global-hod-edit', authenticate, authorizeRoles(ROLES.ADMIN), taskController.toggleGlobalHODTaskEdit);
router.post('/admin/create', authenticate, authorizeRoles(ROLES.ADMIN), taskController.createTask);
router.post('/admin/bulk-import', authenticate, authorizeRoles(ROLES.ADMIN), memoryUpload.single('file'), taskController.bulkImportTasks);
router.get('/admin/export-all', authenticate, authorizeRoles(ROLES.ADMIN), taskController.exportAllTasks);
router.get('/admin/analytics', authenticate, authorizeRoles(ROLES.ADMIN), taskController.getAdminTaskAnalytics);
router.get('/admin', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.FACULTY, ROLES.HOD), taskController.getAdminTasks);
router.put('/admin/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.FACULTY, ROLES.HOD), taskController.editTask);
router.delete('/admin/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.FACULTY, ROLES.HOD), taskController.deleteTask);
router.post('/admin/bulk-delete', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.FACULTY, ROLES.HOD), taskController.bulkDeleteTasks);


// Shared Routes
router.get('/project/:projectId', authenticate, taskController.getProjectTasks);

// Student Routes
router.get('/my-project', authenticate, authorizeRoles(ROLES.STUDENT), taskController.getMyProjectTasks);
router.get('/student/project', authenticate, authorizeRoles(ROLES.STUDENT), taskController.getStudentProjectWithTaskCount);
router.get('/student/submissions', authenticate, authorizeRoles(ROLES.STUDENT), taskController.getMySubmissions);
router.post('/student/submit/:taskId', authenticate, authorizeRoles(ROLES.STUDENT), diskUpload.single('file'), taskController.submitTask);
router.post('/student/weekly', authenticate, authorizeRoles(ROLES.STUDENT), taskController.submitWeeklyTask);

// Faculty & HOD Routes 
router.post('/faculty/create', authenticate, authorizeRoles(ROLES.FACULTY, ROLES.HOD), taskController.createFacultyTask);
router.put('/review/:taskId/:studentId', authenticate, authorizeRoles(ROLES.FACULTY, ROLES.HOD), taskController.reviewSubmission);
router.get('/faculty/projects', authenticate, authorizeRoles(ROLES.FACULTY), taskController.getFacultyProjectsWithTaskCount);
router.get('/faculty/project/:projectId/submissions', authenticate, authorizeRoles(ROLES.FACULTY, ROLES.HOD), taskController.getProjectSubmissions);
router.get('/faculty/submissions', authenticate, authorizeRoles(ROLES.FACULTY), taskController.getFacultySubmissions);
router.put('/faculty/submissions/:submissionId/review', authenticate, authorizeRoles(ROLES.FACULTY, ROLES.HOD), taskController.reviewSubmissionById);
router.get('/weekly/project/:projectId', authenticate, authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN, ROLES.STUDENT), taskController.getWeeklySubmissions);
router.put('/weekly/review/:id', authenticate, authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN), taskController.reviewWeeklySubmission);
router.put('/faculty/project/:projectId/visibility', authenticate, authorizeRoles(ROLES.FACULTY, ROLES.HOD), taskController.updateProjectTaskVisibility);
router.put('/faculty/task/:taskId/deadline', authenticate, authorizeRoles(ROLES.FACULTY), taskController.updateTaskDeadline);

module.exports = router;
