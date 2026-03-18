const Review = require('../models/Review');
const Project = require('../models/Project');
const User = require('../models/User');
const { checkProjectAuthorization } = require('../utils/projectUtils');

// Create/Schedule a new review
exports.createReview = async (req, res) => {
    try {
        const { projectId, title, description, scheduledAt, evaluationCriteria } = req.body;

        // Verify project exists
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Ensure only Guide, Co-Guide, HOD or Admin can schedule
        if (req.user.role === 'student') {
            return res.status(403).json({ message: 'Students cannot schedule reviews' });
        }

        const isAuthorized = await checkProjectAuthorization(req.user, project);
        if (!isAuthorized) {
            return res.status(403).json({ message: 'You are not authorized for this project' });
        }

        const newReview = new Review({
            project: projectId,
            createdBy: req.user._id,
            title,
            description,
            scheduledAt,
            evaluationCriteria,
            status: 'SCHEDULED'
        });

        await newReview.save();
        res.status(201).json({ message: 'Review scheduled successfully', review: newReview });
    } catch (error) {
        console.error('Create Review Error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A scheduled review with this title already exists for this project.' });
        }
        res.status(500).json({ message: 'Server Error scheduling review' });
    }
};

// Submit evaluations for a review
exports.submitEvaluation = async (req, res) => {
    try {
        const { id } = req.params;
        const { scores, totalScore, completionPercentage, feedback, implementationStatus, output } = req.body;

        const review = await Review.findById(id).populate('project');
        if (!review) return res.status(404).json({ message: 'Review not found' });

        if (review.status === 'COMPLETED') {
            return res.status(400).json({ message: 'Review is already completed' });
        }

        // Check authorization
        const isAuthorized = await checkProjectAuthorization(req.user, review.project);
        if (!isAuthorized) {
            return res.status(403).json({ message: 'You are not authorized to evaluate this project' });
        }

        // Validate that awarded marks don't exceed max marks
        if (scores && review.evaluationCriteria) {
            for (const score of scores) {
                const criterion = review.evaluationCriteria.find(c => c.label === score.label);
                if (criterion && score.awardedMarks > criterion.maxMarks) {
                    return res.status(400).json({
                        message: `Awarded marks (${score.awardedMarks}) cannot exceed max marks (${criterion.maxMarks}) for "${score.label}"`
                    });
                }
                if (score.awardedMarks < 0) {
                    return res.status(400).json({ message: `Marks cannot be negative for "${score.label}"` });
                }
            }
        }

        review.scores = scores;
        review.totalScore = totalScore;
        review.completionPercentage = completionPercentage;
        review.feedback = feedback;
        review.implementationStatus = implementationStatus;
        review.output = output;
        review.status = 'COMPLETED';
        await review.save();

        res.json({ message: 'Evaluation submitted successfully', review });
    } catch (error) {
        console.error('Submit Evaluation Error:', error);
        res.status(500).json({ message: 'Server Error submitting evaluation' });
    }
};

// Get reviews for a specific project
exports.getProjectReviews = async (req, res) => {
    try {
        const { projectId } = req.params;
        const reviews = await Review.find({ project: projectId })
            .populate('createdBy', 'name email role')
            .sort({ scheduledAt: 1 });

        res.json({ reviews });
    } catch (error) {
        console.error('Get Project Reviews Error:', error);
        res.status(500).json({ message: 'Server Error fetching reviews' });
    }
};

// Get all reviews involving the logged-in student
exports.getStudentReviewHistory = async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const student = await User.findById(req.user._id);
        if (!student.appliedProject) {
            return res.json({ reviews: [] });
        }

        const reviews = await Review.find({ project: student.appliedProject })
            .populate('createdBy', 'name email')
            .sort({ scheduledAt: 1 });

        res.json({ reviews });
    } catch (error) {
        console.error('Get Student Reviews Error:', error);
        res.status(500).json({ message: 'Server Error fetching student reviews' });
    }
};

// Delete a scheduled review
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findById(id).populate('project');

        if (!review) return res.status(404).json({ message: 'Review not found' });

        const isAuthorized = await checkProjectAuthorization(req.user, review.project);
        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to delete' });
        }

        if (review.status === 'COMPLETED') {
            return res.status(400).json({ message: 'Cannot delete a completed review' });
        }

        await Review.findByIdAndDelete(id);
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete Review Error:', error);
        res.status(500).json({ message: 'Server Error deleting review' });
    }
};

// Admin/HOD Review Stats
exports.getAdminReviewStats = async (req, res) => {
    try {
        const { reviewType, department, projectId } = req.query;

        // 1. Get Summary Stats (Total, Completed, Pending) for the selected review type
        const projectsQuery = {};
        if (department) {
            projectsQuery.baseDept = department;
        }
        if (projectId) {
            projectsQuery._id = projectId;
        }

        const allProjects = await Project.find(projectsQuery).select('_id').lean();
        const projectIds = allProjects.map(p => p._id);

        const reviewQuery = { project: { $in: projectIds } };
        if (reviewType) {
            reviewQuery.title = reviewType;
        }

        const reviews = await Review.find(reviewQuery).select('status project').lean();

        // General overview: count projects that have at least one COMPLETED review
        const projectsWithCompletedReview = new Set(reviews.filter(r => r.status === 'COMPLETED').map(r => r.project.toString()));
        const projectsWithScheduledReview = new Set(reviews.filter(r => r.status === 'SCHEDULED').map(r => r.project.toString()));

        const summary = {
            totalProjects: allProjects.length,
            completed: projectsWithCompletedReview.size,
            scheduled: [...projectsWithScheduledReview].filter(id => !projectsWithCompletedReview.has(id)).length,
            pending: allProjects.length - projectsWithCompletedReview.size
        };

        // 2. Department-wise Stats
        const depts = await Project.distinct('baseDept');
        const deptStats = await Promise.all(depts.map(async (dept) => {
            const deptProjectsQuery = { baseDept: dept };
            if (projectId) deptProjectsQuery._id = projectId;

            const deptProjects = await Project.find(deptProjectsQuery).select('_id').lean();
            if (deptProjects.length === 0) return null;

            const deptProjectIds = deptProjects.map(p => p._id);

            const r1Completed = await Review.countDocuments({ project: { $in: deptProjectIds }, title: 'Review 1', status: 'COMPLETED' });
            const r2Completed = await Review.countDocuments({ project: { $in: deptProjectIds }, title: 'Review 2', status: 'COMPLETED' });
            const r3Completed = await Review.countDocuments({ project: { $in: deptProjectIds }, title: 'Review 3', status: 'COMPLETED' });

            return {
                department: dept,
                review1: { completed: r1Completed, total: deptProjects.length },
                review2: { completed: r2Completed, total: deptProjects.length },
                review3: { completed: r3Completed, total: deptProjects.length },
                totalProjects: deptProjects.length
            };
        }));

        // 3. Project-wise Stats (Individual projects as rows, reviews as columns)
        const projectStats = await Promise.all(allProjects.map(async (project) => {
            const r1 = await Review.findOne({ project: project._id, title: 'Review 1' }).select('status').lean();
            const r2 = await Review.findOne({ project: project._id, title: 'Review 2' }).select('status').lean();
            const r3 = await Review.findOne({ project: project._id, title: 'Review 3' }).select('status').lean();

            // Also get project title for display
            const projectData = await Project.findById(project._id).select('title').lean();

            return {
                projectId: project._id,
                title: projectData?.title || 'Unknown Project',
                review1: r1 ? r1.status : 'NOT_SCHEDULED',
                review2: r2 ? r2.status : 'NOT_SCHEDULED',
                review3: r3 ? r3.status : 'NOT_SCHEDULED'
            };
        }));

        res.json({
            summary,
            deptStats: deptStats.filter(d => d !== null),
            projectStats
        });
    } catch (error) {
        console.error('Get Admin Review Stats Error:', error);
        res.status(500).json({ message: 'Server Error fetching stats' });
    }
};

// Detailed Student Review List
exports.getDetailedReviewList = async (req, res) => {
    try {
        const { reviewType, department, projectId } = req.query;

        const projectsQuery = {};
        if (department) {
            projectsQuery.baseDept = department;
        }
        if (projectId) {
            projectsQuery._id = projectId;
        }

        const projects = await Project.find(projectsQuery).select('_id title').lean();
        const projectIds = projects.map(p => p._id);

        const reviewsQuery = {
            project: { $in: projectIds },
            status: 'COMPLETED'
        };
        if (reviewType) {
            reviewsQuery.title = reviewType;
        }

        const reviews = await Review.find(reviewsQuery).populate('project').lean();

        // Get all students for these projects
        const studentQuery = { appliedProject: { $in: projectIds }, role: 'student' };

        const students = await User.find(studentQuery).select('name studentId appliedProject').lean();

        const detailedList = students.map(student => {
            const projectReview = reviews.find(r => r.project._id.toString() === student.appliedProject.toString());
            const project = projects.find(p => p._id.toString() === student.appliedProject.toString());

            return {
                projectTitle: project ? project.title : 'N/A',
                studentName: student.name,
                registrationNumber: student.studentId,
                implementationStatus: projectReview ? projectReview.implementationStatus : 'Pending',
                output: projectReview ? projectReview.output : 'N/A'
            };
        });

        res.json({ detailedList });
    } catch (error) {
        console.error('Get Detailed Review List Error:', error);
        res.status(500).json({ message: 'Server Error fetching detailed list' });
    }
};

// Get distinct review titles
exports.getDistinctReviewTitles = async (req, res) => {
    try {
        const titles = await Review.distinct('title');
        // Ensure default titles are present if none exist yet
        const defaultTitles = ['Review 1', 'Review 2', 'Review 3'];
        const combinedTitles = Array.from(new Set([...defaultTitles, ...titles])).sort();
        res.json({ titles: combinedTitles });
    } catch (error) {
        console.error('Get Distinct Titles Error:', error);
        res.status(500).json({ message: 'Server Error fetching titles' });
    }
};
