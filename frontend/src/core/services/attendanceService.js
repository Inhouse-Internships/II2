import { apiFetch } from './apiFetch';

const attendanceService = {
    // Get student's personal attendance history
    getMyAttendance: () => apiFetch('/attendance/my'),

    // Get project attendance (for Faculty/HOD/Admin)
    getProjectAttendance: (projectId, startDate = null, endDate = null, date = null) => {
        let url = `/attendance/project/${projectId}`;
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;
        return apiFetch(url);
    },

    // Faculty bulk marks attendance for a project
    markAttendance: (projectId, date, records) =>
        apiFetch('/attendance/mark', {
            method: 'POST',
            body: JSON.stringify({ projectId, date, records }),
        }),

    // Faculty updates a single attendance record before HOD modification
    updateAttendance: (attendanceId, attendanceStatus, remarks) =>
        apiFetch('/attendance/update', {
            method: 'PUT',
            body: JSON.stringify({ attendanceId, attendanceStatus, remarks }),
        }),

    // HOD overrides an attendance record
    hodModifyAttendance: (attendanceId, attendanceStatus, remarks) =>
        apiFetch('/attendance/hod-modify', {
            method: 'PUT',
            body: JSON.stringify({ attendanceId, attendanceStatus, remarks }),
        }),

    // HOD gets department-wide overview
    getDepartmentAttendance: (date = null, projectId = null) => {
        let url = '/attendance/department';
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (projectId) params.append('projectId', projectId);
        if (params.toString()) url += `?${params.toString()}`;
        return apiFetch(url);
    }
};

export default attendanceService;
