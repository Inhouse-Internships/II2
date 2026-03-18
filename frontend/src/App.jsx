import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress, ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
  },
});

const AdminLayout = lazy(() => import("./layouts/AdminSidebar"));
const HODLayout = lazy(() => import("./layouts/HODSidebar"));
const Login = lazy(() => import("./pages/Login/Login"));
const Register = lazy(() => import("./pages/Login/Register"));
const StudentDashboard = lazy(() => import("./pages/Student/StudentDashboard"));
const FacultyDashboard = lazy(() => import("./pages/Faculty/FacultyDashboard"));
const ForgotPassword = lazy(() => import("./pages/Login/ForgotPassword"));
import AuthGuard from "./components/guards/AuthGuard";
import RoleGuard from "./components/guards/RoleGuard";
import { ROLES } from "./core/constants/roles";
import ErrorBoundary from "./components/common/ErrorBoundary";
import LandingPage from "./pages/Landing/LandingPage";

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route element={<AuthGuard />}>
                <Route element={<RoleGuard allowedRoles={[ROLES.STUDENT]} />}>
                  <Route path="/student" element={<StudentDashboard />} />
                </Route>

                <Route element={<RoleGuard allowedRoles={[ROLES.FACULTY]} />}>
                  <Route path="/faculty" element={<FacultyDashboard />} />
                </Route>

                <Route element={<RoleGuard allowedRoles={[ROLES.HOD]} />}>
                  <Route path="/hod" element={<HODLayout />} />
                </Route>

                <Route element={<RoleGuard allowedRoles={[ROLES.ADMIN]} />}>
                  <Route path="/admin" element={<AdminLayout />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
