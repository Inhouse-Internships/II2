const ROLES = Object.freeze({
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
  HOD: 'hod'
});

const USER_STATUS = Object.freeze({
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
});

const PROJECT_STATUS = Object.freeze({
  OPEN: 'Open',
  CLOSED: 'Closed'
});

const TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
});

const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: 'Present',
  ABSENT: 'Absent',
  DENIED: 'Denied'
});

const SETTING_KEYS = Object.freeze({
  AUTO_APPROVE_STUDENT: 'autoApprove',
  AUTO_APPROVE_FACULTY: 'autoApproveFaculty',
  INTERNSHIP_START_DATE: 'internshipStartDate',
  INTERNSHIP_END_DATE: 'internshipEndDate',
  GLOBAL_HOD_TASK_EDIT_ENABLED: 'globalHodTaskEditEnabled',
  GLOBAL_TASK_VISIBILITY: 'globalTaskVisibility',
  HOD_PAST_ATTENDANCE_EDIT_ENABLED: 'hodPastAttendanceEditEnabled',
  STUDENT_REGISTRATION_ENABLED: 'studentRegistrationEnabled',
  FACULTY_REGISTRATION_ENABLED: 'facultyRegistrationEnabled',
  WORKING_DAYS: 'workingDays', // e.g. "Mon-Fri", "Mon-Sat"
  MIN_REQUIRED_ATTENDANCE: 'minRequiredAttendance', // e.g. 75
  ABOUT_US_TEXT: 'aboutUsText',
  DEVELOPMENT_TEAM: 'developmentTeam',
  CAMPUS_LATITUDE: 'campusLatitude',
  CAMPUS_LONGITUDE: 'campusLongitude',
  CAMPUS_RADIUS: 'campusRadius',
  CAMPUS_ACCURACY_THRESHOLD: 'campusAccuracyThreshold', // max allowed GPS accuracy in meters
  ATTENDANCE_WINDOW_START: 'attendanceWindowStart', // e.g. "09:00"
  ATTENDANCE_WINDOW_END: 'attendanceWindowEnd',       // e.g. "10:30"
  ATTENDANCE_TIME_CHECK_DISABLED: 'attendanceTimeCheckDisabled', // boolean, bypass time window for testing
  STUDENT_FREEZE: 'studentFreeze'
});

const FACULTY_ASSIGNMENT_ROLE = Object.freeze({
  GUIDE: 'guide',
  CO_GUIDE: 'co-guide'
});

const INTERVIEW_STATUS = Object.freeze({
  PENDING: 'Pending',
  QUALIFIED: 'Qualified',
  REJECTED: 'Rejected'
});

module.exports = {
  ROLES,
  USER_STATUS,
  PROJECT_STATUS,
  TASK_STATUS,
  ATTENDANCE_STATUS,
  SETTING_KEYS,
  FACULTY_ASSIGNMENT_ROLE,
  INTERVIEW_STATUS
};
