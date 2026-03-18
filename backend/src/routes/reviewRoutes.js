const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authenticate = require('../middlewares/authenticate');
const authorizeRoles = require('../middlewares/authorizeRoles');
const { ROLES } = require('../utils/constants');

// Route for Students to view their own review history
router.get('/student-history',
    authenticate,
    authorizeRoles([ROLES.STUDENT]),
    reviewController.getStudentReviewHistory
);

// Route for Faculty/Guides/Admin/HOD to view reviews of a specific project
router.get('/project/:projectId',
    authenticate,
    authorizeRoles([ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN]),
    reviewController.getProjectReviews
);

// Route to schedule a new review (Faculty/HOD/Admin)
router.post('/',
    authenticate,
    authorizeRoles([ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN]),
    reviewController.createReview
);

// Route to submit evaluations (marks a review as COMPLETED)
router.put('/:id/submit',
    authenticate,
    authorizeRoles([ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN]),
    reviewController.submitEvaluation
);

// Route to delete a scheduled review
router.delete('/:id',
    authenticate,
    authorizeRoles([ROLES.FACULTY, ROLES.HOD, ROLES.ADMIN]),
    reviewController.deleteReview
);

// Route for Admin/HOD to get review statistics
router.get('/admin-stats',
    authenticate,
    authorizeRoles([ROLES.HOD, ROLES.ADMIN]),
    reviewController.getAdminReviewStats
);

// Route for Admin/HOD to get detailed student review list
router.get('/detailed-list',
    authenticate,
    authorizeRoles([ROLES.HOD, ROLES.ADMIN]),
    reviewController.getDetailedReviewList
);

// Route for Admin/HOD to get distinct review titles
router.get('/titles',
    authenticate,
    authorizeRoles([ROLES.HOD, ROLES.ADMIN]),
    reviewController.getDistinctReviewTitles
);

module.exports = router;
