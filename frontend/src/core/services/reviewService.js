import { apiFetch } from './apiFetch';

const BASE_URL = '/api/reviews';

const reviewService = {
    // Setup a new review (Faculty/Admin/HOD)
    createReview: (data) => {
        return apiFetch(`${BASE_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    // Submit evaluations for a given review
    submitEvaluation: (reviewId, evaluationData) => {
        return apiFetch(`${BASE_URL}/${reviewId}/submit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evaluationData),
        });
    },

    // Get all reviews for a specific project
    getProjectReviews: (projectId) => {
        return apiFetch(`${BASE_URL}/project/${projectId}`, {
            method: 'GET',
        });
    },

    // Get student's review history
    getStudentHistory: () => {
        return apiFetch(`${BASE_URL}/student-history`, {
            method: 'GET',
        });
    },

    // Delete a review
    deleteReview: (reviewId) => {
        return apiFetch(`${BASE_URL}/${reviewId}`, {
            method: 'DELETE',
        });
    },

    // Get Admin review statistics
    getAdminStats: (reviewType, department, projectId) => {
        let url = `${BASE_URL}/admin-stats`;
        const params = new URLSearchParams();
        if (reviewType) params.append('reviewType', reviewType);
        if (department) params.append('department', department);
        if (projectId) params.append('projectId', projectId);
        if (params.toString()) url += `?${params.toString()}`;

        return apiFetch(url, {
            method: 'GET',
        });
    },

    // Get detailed student review list
    getDetailedList: (reviewType, department, projectId) => {
        let url = `${BASE_URL}/detailed-list`;
        const params = new URLSearchParams();
        if (reviewType) params.append('reviewType', reviewType);
        if (department) params.append('department', department);
        if (projectId) params.append('projectId', projectId);
        if (params.toString()) url += `?${params.toString()}`;

        return apiFetch(url, {
            method: 'GET',
        });
    },

    // Get distinct review titles
    getReviewTitles: () => {
        return apiFetch(`${BASE_URL}/titles`, {
            method: 'GET',
        });
    }
};

export default reviewService;
