const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Public endpoints required for registration flow
router.get('/programs', adminController.getPrograms);

router.get('/settings/about-us', adminController.getAboutUsSetting);
router.get('/settings/landing-content', adminController.getLandingContent);

router.get('/students', authenticate, authorizeRoles([ROLES.ADMIN, ROLES.HOD]), adminController.getStudents);

router.get('/settings/hod-edit', authenticate, authorizeRoles([ROLES.ADMIN, ROLES.HOD]), adminController.getGlobalHodEditSetting);
router.get('/settings/internship', authenticate, authorizeRoles([ROLES.ADMIN, ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT]), adminController.getInternshipSettings);

router.get('/all-db-departments', authenticate, authorizeRoles([ROLES.ADMIN, ROLES.HOD]), adminController.getAllDbDepartments);
router.get('/faculty', authenticate, authorizeRoles([ROLES.ADMIN, ROLES.HOD]), adminController.getFaculty);
router.post('/projects/:projectId/team-leader/:studentId', authenticate, authorizeRoles([ROLES.ADMIN]), adminController.assignTeamLeader);

router.use(authenticate, authorizeRoles(ROLES.ADMIN));

router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

router.get('/settings/auto-approve', adminController.getAutoApproveSetting);
router.post('/settings/auto-approve', adminController.setAutoApproveSetting);
router.get('/settings/auto-approve-faculty', adminController.getAutoApproveFacultySetting);
router.post('/settings/auto-approve-faculty', adminController.setAutoApproveFacultySetting);

router.put('/settings/internship', adminController.updateInternshipSettings);
router.get('/settings/dates', adminController.getInternshipDates);

router.get('/departments', adminController.getDepartmentProjectMatrix);

router.post('/programs', adminController.createProgram);
router.put('/programs/:id', adminController.updateProgram);
router.delete('/programs/:id', adminController.deleteProgram);
router.post('/programs/:id/departments', adminController.addDepartmentToProgram);
router.delete('/programs/:id/departments/:deptId', adminController.removeDepartmentFromProgram);
router.put('/departments/:id', adminController.renameDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

router.post('/students', adminController.createStudent);
router.put('/students/:id', adminController.updateStudent);
router.post('/students/:id/approve', adminController.approveStudent);
router.post('/students/:id/reject', adminController.rejectStudent);
router.delete('/students/:id', adminController.deleteStudent);
router.delete('/students/rejected', adminController.deleteRejectedStudents);
router.post('/students/move-level', adminController.moveStudentLevel);
router.post('/students/bulk-import', adminController.bulkImportStudents);

router.post('/faculty', adminController.createFaculty);
router.put('/faculty/:id', adminController.updateFaculty);
router.put('/faculty/:id/project', adminController.assignFacultyProject);
router.post('/faculty/:id/approve', adminController.approveFaculty);
router.post('/faculty/:id/reject', adminController.rejectFaculty);
router.delete('/faculty/:id', adminController.deleteFaculty);

router.post('/hod', adminController.createHOD);
router.get('/hod', adminController.getHODs);
router.put('/hod/:id', adminController.updateHOD);
router.delete('/hod/:id', adminController.deleteHOD);

router.post('/projects/bulk-import', adminController.bulkImportProjects);


router.post('/mail/send', upload.array('attachments'), adminController.sendBulkMail);
router.put('/profile/:id', adminController.updateProfile);

module.exports = router;
