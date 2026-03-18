import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getAuthUser, hasRole, getDefaultRouteForRole } from '../../core/utils/auth';

export default function RoleGuard({ allowedRoles = [], children }) {
  const user = getAuthUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRole(user, allowedRoles)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children || <Outlet />;
}
