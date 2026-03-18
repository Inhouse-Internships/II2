import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken, getAuthUser, hasRole } from '../utils/auth';

export default function useRequireRole(requiredRoles = []) {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const roles = useMemo(
    () => (Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles].filter(Boolean)),
    [requiredRoles]
  );
  const roleKey = roles.join('|');

  useEffect(() => {
    const token = getAuthToken();
    const authUser = getAuthUser();

    if (!token || !authUser || !hasRole(authUser, roles)) {
      setAuthorized(false);
      setUser(null);
      navigate('/login');
    } else {
      setAuthorized(true);
      setUser(authUser);
    }

    setAuthLoading(false);
  }, [navigate, roleKey]);

  return {
    authorized,
    authLoading,
    user
  };
}
