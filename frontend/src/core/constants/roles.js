export const ROLES = Object.freeze({
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
  HOD: 'hod'
});

export const ROLE_LIST = Object.freeze(Object.values(ROLES));

export const TASK_STATUS = Object.freeze({
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
});
