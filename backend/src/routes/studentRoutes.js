const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');

router.use(authenticate, authorizeRoles(ROLES.STUDENT));

router.get('/dashboard/:id', studentController.getDashboard);
router.post('/apply', studentController.applyForProject);
router.post('/withdraw', studentController.withdrawApplication);
router.post('/reorder-applications', studentController.reorderApplications);
router.post('/select-final-project', studentController.selectFinalProject);
router.put('/profile/:id', studentController.updateProfile);

module.exports = router;
