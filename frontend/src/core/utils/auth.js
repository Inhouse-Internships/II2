import { ROLES } from '../constants/roles';

export const AUTH_STORAGE_KEYS = Object.freeze({
  USER: 'user',
  TOKEN: 'token'
});

export function getAuthToken() {
  return localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession({ token, user }) {
  if (token) {
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token);
  }
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
  localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
}

export function isAuthenticated() {
  return Boolean(getAuthToken() && getAuthUser());
}

export function hasRole(user, allowedRoles = []) {
  if (!user || !user.role) return false;
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  return allowedRoles.includes(user.role);
}

export function getDefaultRouteForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return '/admin';
    case ROLES.FACULTY:
      return '/faculty';
    case ROLES.STUDENT:
      return '/student';
    case ROLES.HOD:
      return '/hod';
    default:
      return '/login';
  }
}
