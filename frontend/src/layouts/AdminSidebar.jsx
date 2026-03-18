import React, { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu as MenuIcon,
  Folder as FolderIcon,
  People as PeopleIcon,
  Apartment as ApartmentIcon,
  ImportExport as ImportExportIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  School as SchoolIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Stairs as StairsIcon,
  Mail as MailIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Assignment as AssignmentIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  RateReview as RateReviewIcon,
} from "@mui/icons-material";
import {
  Box, Button, IconButton, Typography,
  Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Drawer,
  useMediaQuery, useTheme, CircularProgress
} from "@mui/material";
import RoleSidebar from "../components/navigation/RoleSidebar";
import { clearAuthSession } from "../core/utils/auth";

// Lazy load admin pages
const AdminDashboard = lazy(() => import("../pages/Admin/AdminDashboard"));
const AdminProjects = lazy(() => import("../pages/Admin/AdminProjects"));
const AdminDepartments = lazy(() => import("../pages/Admin/AdminDepartments"));
const AdminStudents = lazy(() => import("../pages/Admin/AdminStudents"));
const AdminFaculty = lazy(() => import("../pages/Admin/AdminFaculty"));
const AdminHODs = lazy(() => import("../pages/Admin/AdminHODs"));
const AdminLevels = lazy(() => import("../pages/Admin/AdminLevels"));
const AdminAttendance = lazy(() => import("../pages/Admin/AdminAttendance"));
const AdminReviews = lazy(() => import("../pages/Admin/AdminReviews"));
const AdminMail = lazy(() => import("../pages/Admin/AdminMail"));
const AdminImportExport = lazy(() => import("../pages/Admin/AdminImportExport"));
const AdminTasks = lazy(() => import("../pages/Admin/AdminTasks"));
const AdminSettings = lazy(() => import("../pages/Admin/AdminSettings"));
const About = lazy(() => import("../components/common/About"));
const Profile = lazy(() => import("../components/common/Profile"));
import { getAuthUser } from "../core/utils/auth";
import { ROLES } from "../core/constants/roles";

const SectionLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, mt: 5 }}>
    <CircularProgress />
  </Box>
);

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [section, setSection] = useState(() => {
    return sessionStorage.getItem("adminSection") || "dashboard";
  });

  useEffect(() => {
    sessionStorage.setItem("adminSection", section);
  }, [section]);
  const [navState, setNavState] = useState({});

  const navigateToSection = (key, state = {}) => {
    setSection(key);
    setNavState(state || {});
    if (key === "settings" || key === "about") {
      setOpenMore(true);
    }
  };

  // Global State for Caching Metadata (Large data remains in components)
  const [programsData, setProgramsData] = useState([]);
  const [allDepartmentsData, setAllDepartmentsData] = useState([]);
  const [projectsData, setProjectsData] = useState([]);

  useEffect(() => {
    if (location.pathname.includes("/admin/settings") || location.pathname.includes("/admin/about")) {
      setOpenMore(true);
    }
  }, [location.pathname]);

  const handleLogoutClick = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  const handleNavSelect = (key) => {
    navigateToSection(key);
    if (key === "settings" || key === "about") {
      setOpenMore(true);
    }
    if (isMobile) setMobileOpen(false);
  };

  const sidebarItems = [
    { key: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
    { key: "projects", label: "Projects", icon: <FolderIcon /> },
    { key: "departments", label: "Departments", icon: <ApartmentIcon /> },
    { key: "students", label: "Students", icon: <PeopleIcon /> },
    { key: "faculty", label: "Faculty", icon: <SchoolIcon /> },
    { key: "hod", label: "HOD", icon: <SupervisorAccountIcon /> },
    { key: "levels", label: "Levels", icon: <StairsIcon /> },
    { key: "attendance", label: "Attendance", icon: <CheckCircleOutlineIcon /> },
    { key: "tasks", label: "Daily Status", icon: <AssignmentIcon /> },
    { key: "reviews", label: "Reviews", icon: <RateReviewIcon /> },
    { key: "mail", label: "Mail", icon: <MailIcon /> },
    { key: "import-export", label: "Data Management", icon: <ImportExportIcon /> },
    { key: "profile", label: "Profile", icon: <PersonIcon /> }
  ];

  const sidebarSecondaryItems = [
    { key: "settings", label: "Settings", icon: <SettingsIcon /> },
    { key: "about", label: "About", icon: <InfoIcon /> }
  ];

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* MOBILE DRAWER */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: { xs: "82vw", sm: 280 },
              maxWidth: 320,
              bgcolor: "#f9f9f9",
              boxSizing: "border-box"
            }
          }}
        >
          <RoleSidebar
            title="Aditya"
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            mobile
            onMobileClose={() => setMobileOpen(false)}
            items={sidebarItems}
            secondaryItems={sidebarSecondaryItems}
            selectedKey={section}
            onSelect={handleNavSelect}
            onLogout={handleLogoutClick}
            secondaryOpen={openMore}
            setSecondaryOpen={setOpenMore}
            secondaryLabel="More"
          />
        </Drawer>
      ) : (
        /* DESKTOP SIDEBAR */
        <Box
          onMouseEnter={() => setCollapsed(false)}
          sx={{
            width: !collapsed ? 210 : 64,
            transition: "width 0.3s",
            background: "#f9f9f9",
            borderRight: "1px solid #ddd",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }}
        >
          <RoleSidebar
            title="Aditya"
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            items={sidebarItems}
            secondaryItems={sidebarSecondaryItems}
            selectedKey={section}
            onSelect={handleNavSelect}
            onLogout={handleLogoutClick}
            secondaryOpen={openMore}
            setSecondaryOpen={setOpenMore}
            secondaryLabel="More"
          />
        </Box>
      )}

      {/* CONTENT */}
      <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Mobile top bar */}
        {isMobile && (
          <Box sx={{ display: "flex", alignItems: "center", p: 1.5, borderBottom: "1px solid #ddd", bgcolor: "#f9f9f9" }}>
            <IconButton onClick={() => setMobileOpen(true)} size="small" aria-label="Open navigation menu">
              <MenuIcon />
            </IconButton>
            <Box sx={{ ml: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography sx={{
                fontSize: '1rem',
                fontWeight: 900,
                color: '#f26522',
                letterSpacing: '0.38em',
                lineHeight: 1,
                fontFamily: '"Arial Black", Arial, sans-serif',
                ml: '0.38em'
              }}>
                ADITYA
              </Typography>
              <Typography sx={{
                fontSize: '0.5rem',
                fontWeight: 800,
                color: '#004b87',
                letterSpacing: '0.35em',
                mt: 0.5,
                lineHeight: 1,
                fontFamily: 'Arial, sans-serif',
                ml: '0.35em'
              }}>
                UNIVERSITY
              </Typography>
            </Box>
          </Box>
        )}
        <Box sx={{ p: { xs: 2, sm: 3 }, flex: 1 }}>
          <Suspense fallback={<SectionLoader />}>
            {(() => {
              const sharedContext = {
                programsData, setProgramsData,
                allDepartmentsData, setAllDepartmentsData,
                projectsData, setProjectsData,
                setSection: navigateToSection, // Use the wrapper
                navState // Pass the state
              };

              switch (section) {
                case "dashboard": return <AdminDashboard context={sharedContext} />;
                case "projects": return <AdminProjects context={sharedContext} />;
                case "departments": return <AdminDepartments context={sharedContext} />;
                case "students": return <AdminStudents context={sharedContext} />;
                case "faculty": return <AdminFaculty context={sharedContext} />;
                case "hod": return <AdminHODs context={sharedContext} />;
                case "levels": return <AdminLevels context={sharedContext} />;

                case "attendance": return <AdminAttendance context={sharedContext} />;
                case "tasks": return <AdminTasks context={sharedContext} />;
                case "reviews": return <AdminReviews context={sharedContext} />;
                case "mail": return <AdminMail context={sharedContext} />;
                case "import-export": return <AdminImportExport context={sharedContext} />;
                case "settings": return <AdminSettings context={sharedContext} />;
                case "about": return <About context={sharedContext} />;
                case "profile": return <Profile user={getAuthUser()} role={ROLES.ADMIN} />;
                default: return <AdminDashboard context={sharedContext} />;
              }
            })()}
          </Suspense>
        </Box>
      </Box>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
      >
        <DialogTitle>Confirm Logout</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to logout?
          </DialogContentText>
          <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
            Press Enter to logout
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmLogout} color="error" autoFocus>
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
