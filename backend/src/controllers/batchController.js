const Project = require('../models/Project');
const User = require('../models/User');
const TaskSubmission = require('../models/TaskSubmission');
const Department = require('../models/Department');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { ROLES } = require('../utils/constants');

const executeBatch = asyncHandler(async (req, res) => {
    const { requests = [] } = req.body;
    const results = {};

    const promises = requests.map(async (request) => {
        const { id, method, url } = request;
        try {
            // Mock Response object for batch requests
            let currentStatus = 200;
            const mockRes = {
                status: (s) => {
                    currentStatus = s;
                    return mockRes;
                },
                json: (data) => {
                    results[id] = {
                        status: currentStatus,
                        data: data.data || data
                    };
                }
            };

            // No-op next function to satisfy asyncHandler wrappers
            const mockNext = (err) => {
                if (err) {
                    console.error(`Batch sub-request failure for ${url}:`, err);
                    results[id] = {
                        status: err.statusCode || 500,
                        error: err.message
                    };
                }
            };

            // Internal router

            if (url === '/api/analytics/university' && method === 'GET') {
                if (req.user.role !== ROLES.ADMIN) {
                    results[id] = { status: 403, error: 'Forbidden: insufficient role' };
                    return;
                }
                const { getUniversityAnalytics } = require('./analyticsController');
                await getUniversityAnalytics({ user: req.user }, mockRes, mockNext);
            }
            else if (url.startsWith('/api/analytics/department/') && method === 'GET') {
                if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.HOD) {
                    results[id] = { status: 403, error: 'Forbidden: insufficient role' };
                    return;
                }
                const deptName = decodeURIComponent(url.split('/').pop().split('?')[0]); // strip query if present
                const { getDepartmentAnalytics } = require('./analyticsController');
                const mockReq = { user: req.user, params: { departmentId: deptName } };
                await getDepartmentAnalytics(mockReq, mockRes, mockNext);
            }
            else if (url === '/api/analytics/guide' && method === 'GET') {
                if (req.user.role !== ROLES.FACULTY) {
                    results[id] = { status: 403, error: 'Forbidden: insufficient role' };
                    return;
                }
                const { getGuideAnalytics } = require('./analyticsController');
                await getGuideAnalytics({ user: req.user }, mockRes, mockNext);
            }
            else if (url.startsWith('/api/admin/students') && method === 'GET') {
                if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.HOD) {
                    results[id] = { status: 403, error: 'Forbidden: insufficient role' };
                    return;
                }
                const { getStudents } = require('./adminController');
                const query = {};
                const urlObj = new URL(url, 'http://localhost');
                urlObj.searchParams.forEach((v, k) => query[k] = v);
                const mockReq = { user: req.user, query };
                await getStudents(mockReq, mockRes, mockNext);
            }
            else if (url.startsWith('/api/projects') && method === 'GET') {
                const { getAllProjects } = require('./projectController');
                const query = {};
                const urlObj = new URL(url, 'http://localhost');
                urlObj.searchParams.forEach((v, k) => query[k] = v);
                const mockReq = { user: req.user, query };
                await getAllProjects(mockReq, mockRes, mockNext);
            }
            else if (url === '/api/admin/settings/landing-content' && method === 'GET') {
                const { getLandingContent } = require('./adminController');
                await getLandingContent({ user: req.user }, mockRes, mockNext);
            }
            else if (url.startsWith('/api/faculty/dashboard/') && method === 'GET') {
                const facultyId = url.split('/api/faculty/dashboard/')[1].split('?')[0];
                const { getDashboard } = require('./facultyController');
                const mockReq = { user: req.user, params: { id: facultyId } };
                await getDashboard(mockReq, mockRes, mockNext);
            }
            else if (url.startsWith('/api/student/dashboard/') && method === 'GET') {
                const studentId = url.split('/api/student/dashboard/')[1].split('?')[0];
                const { getDashboard } = require('./studentController');
                const mockReq = { user: req.user, params: { id: studentId } };
                await getDashboard(mockReq, mockRes, mockNext);
            }
            else if (url === '/api/reviews/student-history' && method === 'GET') {
                const { getStudentReviewHistory } = require('./reviewController');
                await getStudentReviewHistory({ user: req.user }, mockRes, mockNext);
            }
            else if (url === '/api/attendance/my' && method === 'GET') {
                const { getMyAttendance } = require('./attendanceController');
                await getMyAttendance({ user: req.user }, mockRes, mockNext);
            }
            else if (url === '/api/analytics/student' && method === 'GET') {
                const { getStudentAnalytics } = require('./analyticsController');
                await getStudentAnalytics({ user: req.user }, mockRes, mockNext);
            }
            else {
                results[id] = { status: 404, message: `Route ${url} not supported in batch router yet` };
            }
        } catch (err) {
            console.error(`Batch error for ${url}:`, err);
            results[id] = { status: 500, error: err.message };
        }
    });

    await Promise.all(promises);
    return successResponse(res, results);
});

module.exports = { executeBatch };
