const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');

router.get('/', authenticate, projectController.getAllProjects);

router.get('/:id', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.HOD, ROLES.FACULTY), projectController.getProjectById);
router.get('/:id/departments', projectController.getProjectDepartments);

router.use(authenticate, authorizeRoles(ROLES.ADMIN, ROLES.HOD));

router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.patch('/:id/status', projectController.updateProjectStatus);
router.delete('/:projectId/departments/:deptId', projectController.deleteProjectDepartment);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
