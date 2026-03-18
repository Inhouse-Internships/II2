import { apiFetch } from './apiFetch';

async function request(path, options = {}) {
  const response = await apiFetch(`/api/daily-status${path}`, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
  }

  return payload;
}

// Student: Submit a daily status
export const submitDailyStatus = (statusData) =>
  request('/student', {
    method: 'POST',
    body: JSON.stringify(statusData)
  });

// Student: Get own daily statuses for a project
export const getStudentDailyStatuses = (projectId) =>
  request(`/student/${projectId}`);

// Student: Edit a daily status
export const editDailyStatus = (statusId, statusData) =>
  request(`/student/${statusId}`, {
    method: 'PUT',
    body: JSON.stringify(statusData)
  });

// Student: Delete a daily status
export const deleteDailyStatus = (statusId) =>
  request(`/student/${statusId}`, {
    method: 'DELETE'
  });

// Faculty: Get daily statuses for a project
export const getFacultyDailyStatuses = (projectId) =>
  request(`/faculty/${projectId}`);

// Faculty: Review a daily status
export const reviewDailyStatus = (statusId, reviewData) =>
  request(`/faculty/${statusId}`, {
    method: 'PUT',
    body: JSON.stringify(reviewData)
  });

// Admin: Get all daily statuses
export const getAllDailyStatuses = () =>
  request('/admin');
