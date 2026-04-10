import { apiFetch } from '../../core/services/apiFetch';
import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import "./StudentDashboard.css";
import Profile from "../../components/common/Profile";
import { ROLES } from "../../core/constants/roles";
import {
  Typography,
  Box,
  Paper,
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Stack,
  Divider,
  CssBaseline,
  IconButton,
  TextField,
  Drawer,
  Avatar
} from "@mui/material";

import { useTheme, alpha } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import {
  Close as CloseIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Info as InfoIcon,
  Book as BookIcon,
  Assignment as AssignmentIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  HowToReg as HowToRegIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon
} from "@mui/icons-material";

import InfoNote from '../../components/common/InfoNote';
import SearchBar from "../../components/common/SearchBar";
import StatusChip from "../../components/common/StatusChip";
import PageHeader from "../../components/common/PageHeader";
import BrandingBanner from "../../components/common/BrandingBanner";
import reviewService from "../../core/services/reviewService";
import RoleSidebar from "../../components/navigation/RoleSidebar";
import { clearAuthSession, getAuthUser } from "../../core/utils/auth";
import useRequireRole from "../../core/hooks/useRequireRole";

// Lazy loaded sub-modules
const StudentTasks = lazy(() => import("./StudentTasks"));
const StudentAttendance = lazy(() => import("./StudentAttendance"));
const StudentReviews = lazy(() => import("./StudentReviews"));

// Lazy loaded dialogs
const ConfirmDialog = lazy(() => import("../../components/common/ConfirmDialog"));
const ProjectDetailsDialog = lazy(() => import("../../components/common/ProjectDetailsDialog"));
const About = lazy(() => import("../../components/common/About"));

const SectionLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
    <CircularProgress />
  </Box>
);

export default function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [upcomingReviews, setUpcomingReviews] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [studentFreeze, setStudentFreeze] = useState(false);
  const [section, setSection] = useState(() => {
    const saved = sessionStorage.getItem("studentSection");
    return saved || "dashboard";
  });

  useEffect(() => {
    sessionStorage.setItem("studentSection", section);
  }, [section]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passMessage, setPassMessage] = useState("");
  const [passError, setPassError] = useState("");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [applyProjectId, setApplyProjectId] = useState(null);
  const navigate = useNavigate();
  const { authorized, authLoading, user } = useRequireRole(ROLES.STUDENT);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [viewProject, setViewProject] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState({ type: '', text: '' });

  const withdrawConfirmButtonRef = useRef(null);
  const applyConfirmButtonRef = useRef(null);
  const viewProjectCloseButtonRef = useRef(null);

  const fetchDashboard = async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }

    try {
      const { batchFetch } = await import('../../core/services/apiFetch');
      const studentId = user._id;

      const batchRequests = [
        { id: 'dashboard', method: 'GET', url: `/api/student/dashboard/${studentId}` },
        { id: 'reviews', method: 'GET', url: "/api/reviews/student-history" },
        { id: 'attendance', method: 'GET', url: "/api/attendance/my" }
      ];

      if (user.level >= 2) {
        batchRequests.push({ id: 'analytics', method: 'GET', url: "/api/analytics/student" });
      }

      const results = await batchFetch(batchRequests);

      if (results.dashboard?.status === 200) {
        const dashData = results.dashboard.data;
        setStudent(dashData.student);
        setProjects(dashData.projects);
        setStudentFreeze(dashData.studentFreeze || false);
      } else {
        const errorMsg = results.dashboard?.error || `Dashboard API returned status ${results.dashboard?.status || 'Unknown'}`;
        throw new Error(errorMsg);
      }

      if (results.analytics?.status === 200) {
        setAnalytics(results.analytics.data);
      }

      if (results.reviews?.status === 200) {
        const rData = results.reviews.data;
        setUpcomingReviews((rData.reviews || []).filter(r => r.status === 'SCHEDULED'));
      }

      if (results.attendance?.status === 200) {
        const attData = results.attendance.data;
        const attendanceList = attData?.attendance || attData?.data?.attendance || [];

        const now = new Date();
        const todayRec = attendanceList.find(a => {
          const recDate = new Date(a.date);
          return recDate.getDate() === now.getDate() &&
            recDate.getMonth() === now.getMonth() &&
            recDate.getFullYear() === now.getFullYear();
        });

        const status = todayRec?.attendanceStatus;
        setTodayAttendance(status === 'Present' ? 'Present' : 'Not Marked');
      }

    } catch (err) {
      console.error("fetchDashboard error:", err);
      setError(err.message || "Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized && user?._id) {
      fetchDashboard();
    }
  }, [authorized, user?._id]);

  const handleApply = (projectId) => {
    setApplyProjectId(projectId);
    setApplyConfirmOpen(true);
  };

  const confirmApply = async () => {
    setApplyConfirmOpen(false);
    try {
      const res = await apiFetch("/api/student/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student._id, projectId: applyProjectId })
      });

      const data = await res.json();
      if (res.ok) {
        fetchDashboard();
      } else {
        alert(data.message || "Application failed");
      }
    } catch (err) {
      alert("Server error");
    } finally {
      setApplyProjectId(null);
    }
  };

  const openProjectDetailsDialog = (project) => {
    if (!project) return;
    setViewProject(project);
    setViewOpen(true);
  };

  const [withdrawProjectId, setWithdrawProjectId] = useState(null);

  const handleWithdraw = (projectId = null) => {
    // If projectId is an event (e.g. from onClick={handleWithdraw}), treat as 'ALL'
    const id = (projectId && typeof projectId === 'string') ? projectId : 'ALL';
    setWithdrawProjectId(id);
    setWithdrawDialogOpen(true);
  };

  const confirmWithdraw = async () => {
    setWithdrawDialogOpen(false);
    try {
      const res = await apiFetch("/api/student/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student._id,
          projectId: withdrawProjectId
        })
      });

      const data = await res.json();
      if (res.ok) {
        fetchDashboard(); // Refresh data quietly
      } else {
        alert(data.message || "Withdrawal failed");
      }
    } catch (err) {
      alert("Server error");
    } finally {
      setWithdrawProjectId(null);
    }
  };

  const [reordering, setReordering] = useState(false);
  const handleReorder = async (currentIndex, direction) => {
    if (reordering) return;
    const list = [student.appliedProject, ...(student.projectApplications || [])].filter(Boolean);
    if (direction === 'up' && currentIndex > 0) {
      const temp = list[currentIndex];
      list[currentIndex] = list[currentIndex - 1];
      list[currentIndex - 1] = temp;
    } else if (direction === 'down' && currentIndex < list.length - 1) {
      const temp = list[currentIndex];
      list[currentIndex] = list[currentIndex + 1];
      list[currentIndex + 1] = temp;
    } else {
      return;
    }

    setReordering(true);
    try {
      const res = await apiFetch("/api/student/reorder-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applications: list.map(p => typeof p === 'object' ? p._id : p) })
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReordering(false);
    }
  };

  const handleFinalSelection = async (projectId) => {
    if (!window.confirm("Are you sure you want to select this as your final project? This action will cancel all other applications and move you to Level 2. It cannot be changed later.")) return;

    try {
      const res = await apiFetch("/api/student/select-final-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json();
      if (res.ok) {
        fetchDashboard();
      } else {
        alert(data.message || "Final selection failed");
      }
    } catch (err) {
      alert("Server error during final selection");
    }
  };

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      setPassError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setPassError("Passwords do not match");
      return;
    }

    try {
      const res = await apiFetch(`/api/student/profile/${student._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (res.ok) {
        setPassMessage(data.message);
        setPassError("");
        setPassword("");
        setConfirmPassword("");
      } else {
        setPassError(data.message || "Update failed");
        setPassMessage("");
      }
    } catch (err) {
      setPassError("Server error");
    }
  };

  const handleMarkAttendance = () => {
    if (!navigator.geolocation) {
      setAttendanceMessage({ type: 'error', text: 'Geolocation is not supported by your browser. Please use a modern browser like Chrome or Firefox.' });
      return;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      setAttendanceMessage({
        type: 'error',
        text: 'Location access requires a secure (HTTPS) connection. Please contact your administrator.'
      });
      return;
    }

    setMarkingAttendance(true);
    setAttendanceMessage({ type: 'info', text: 'Requesting location permission... Please click "Allow" when prompted.' });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setAttendanceMessage({ type: 'info', text: `Location acquired (±${Math.round(accuracy)}m). Verifying with server...` });
        try {
          const res = await apiFetch("/api/attendance/self-mark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude, longitude, accuracy })
          });

          const data = await res.json();
          if (res.ok) {
            setAttendanceMessage({ type: 'success', text: data.message });
            setTodayAttendance('Present');
          } else {
            setAttendanceMessage({ type: 'error', text: data.message || "Failed to mark attendance" });
          }
        } catch (err) {
          setAttendanceMessage({ type: 'error', text: 'Server error occurred. Please try again.' });
        } finally {
          setMarkingAttendance(false);
        }
      },
      (error) => {
        let errorMsg = 'Failed to get location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Location permission was denied. To fix this: open your browser settings → Site Settings → Location → Allow for this site, then try again.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Your location could not be determined. Make sure GPS/Location Services are enabled on your device and try again.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Location request timed out. Please move to an area with better GPS signal and try again.';
            break;
          default:
            errorMsg = `Location error: ${error.message || 'Unknown error occurred.'}`;
        }
        setAttendanceMessage({ type: 'error', text: errorMsg });
        setMarkingAttendance(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  const handleNavSelect = (s) => {
    setSection(s);
    if (s === "about") {
      setOpenSecondary(true);
    }
    if (isMobile) setMobileSidebarOpen(false);
  };

  const sidebarItems = [
    { key: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
    { key: "projects", label: "Projects", icon: <AssignmentIcon />, hidden: student?.level >= 2 },
    { key: "tasks", label: "My Tasks", icon: <BookIcon />, hidden: !student?.appliedProject || student?.level < 2 },
    { key: "attendance", label: "Attendance", icon: <CheckCircleOutlineIcon />, hidden: !student?.appliedProject || student?.level < 2 },
    { key: "reviews", label: "Reviews", icon: <AssignmentIcon />, hidden: !student?.appliedProject || student?.level < 2 },
    { key: "profile", label: "Profile", icon: <PersonIcon /> }
  ];

  const sidebarSecondaryItems = [
    { key: "about", label: "About", icon: <InfoIcon /> }
  ];

  if (authLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authorized) return null;

  if (loading) return <Container sx={{ mt: 5, textAlign: "center" }}><CircularProgress /></Container>;
  if (error) return <Container sx={{ mt: 5 }}><Alert severity="error">{error}</Alert></Container>;
  if (!student) return <Container sx={{ mt: 5 }}><Alert severity="error">Student details not found. Please try logging in again.</Alert></Container>;

  return (
    <Box sx={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      bgcolor: "#f5f7fa",
      '&::-webkit-scrollbar': { display: 'none' },
      msOverflowStyle: 'none',
      scrollbarWidth: 'none'
    }}>
      <style>{`
      `}</style>
      <CssBaseline />
      {/* MOBILE DRAWER */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: { xs: "82vw", sm: 280 },
              maxWidth: 320,
              bgcolor: "#f9f9f9",
              boxSizing: "border-box",
            },
          }}
        >
          <RoleSidebar
            title="Aditya"
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            mobile
            onMobileClose={() => setMobileSidebarOpen(false)}
            items={sidebarItems}
            secondaryItems={sidebarSecondaryItems}
            selectedKey={section === "update-password" ? "profile" : section}
            onSelect={handleNavSelect}
            onLogout={handleLogout}
            secondaryOpen={openSecondary}
            setSecondaryOpen={setOpenSecondary}
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
            height: "100vh",
            flexShrink: 0,
          }}
        >
          <RoleSidebar
            title="Aditya"
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            items={sidebarItems}
            secondaryItems={sidebarSecondaryItems}
            selectedKey={section === "update-password" ? "profile" : section}
            onSelect={handleNavSelect}
            onLogout={handleLogout}
            secondaryOpen={openSecondary}
            setSecondaryOpen={setOpenSecondary}
            secondaryLabel="More"
          />
        </Box>
      )}

      {/* MAIN CONTENT */}
      <Box component="main" sx={{
        flexGrow: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none',
        scrollbarWidth: 'none'
      }}>
        {isMobile &&
          <Box sx={{ display: "flex", alignItems: "center", p: 1.5, borderBottom: "1px solid #ddd", bgcolor: "#f9f9f9" }}>
            <IconButton onClick={() => setMobileSidebarOpen(true)} size="small" aria-label="Open navigation menu">
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
          </Box>}
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Container maxWidth="xl" sx={{ px: { xs: 0, sm: 2 } }}>
            <Suspense fallback={<SectionLoader />}>
              {section === "dashboard" && (
                <>
                  {/* HEADER & PROFILE CARD */}
                  <PageHeader
                    title={student.name}
                    isWelcome
                    action={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <BrandingBanner onClick={() => handleNavSelect('about')} />
                        <Box
                          onClick={() => setSection("profile")}
                          sx={{ cursor: "pointer", display: { xs: "none", md: "block" } }}
                          title="Go to Profile">
                          <Avatar
                            sx={{
                              width: 56,
                              height: 56,
                              bgcolor: "primary.main",
                              fontSize: "1.5rem",
                              boxShadow: 3,
                              transition: "transform 0.2s",
                              "&:hover": { transform: "scale(1.1)" },
                            }}
                          >
                            {student.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </Box>
                      </Box>
                    }
                  />


                  {/* STATUS SECTION */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 4,
                      mb: 4,
                      border: "1px solid #e2e8f0",
                      borderRadius: 4,
                      background: "#fff",
                      boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                    <Typography variant="h6" fontWeight={800} mb={3}>Your Internship Status</Typography>

                    {student.appliedProject && student.status === 'Approved' && student.level >= 2 ? (
                      <Grid container spacing={4} alignItems="center">
                        <Grid size={{ xs: 12, lg: (student.level >= 2 && student.status === 'Approved') ? 12 : 8 }}>
                          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            <Box sx={{ flex: '1 1 300px' }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Selected Project</Typography>
                              <Typography
                                variant="h6"
                                fontWeight={700}
                                color="primary.main"
                                onClick={() => openProjectDetailsDialog(student.appliedProject)}
                                sx={{ cursor: "pointer", mt: 0.5, lineHeight: 1.3 }}
                              >
                                {student.appliedProject.title}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Assigned Guide</Typography>
                              <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>{student.appliedProject.guide || "Not assigned"}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Assigned Co-Guide</Typography>
                              <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>{student.appliedProject.coGuide || "Not assigned"}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>Current Stage</Typography>
                              <Box sx={{ mt: 1 }}>
                                <StatusChip status={student.status} level={student.level} size="medium" />
                              </Box>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                          {student.appliedProject.allowWithdrawal !== false && student.level < 2 && !studentFreeze && (
                            <Button variant="outlined" color="error" sx={{ borderRadius: 3, fontWeight: 700, textTransform: 'none' }} onClick={handleWithdraw}>
                              Withdraw from Program
                            </Button>
                          )}
                        </Grid>
                      </Grid>
                    ) : (
                      <Box>
                        {(student.appliedProject || (student.projectApplications && student.projectApplications.length > 0)) ? (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom fontWeight={700} color="text.secondary">
                              {student.level >= 2 ? "FINAL PROJECT" : `PENDING APPLICATIONS (${(student.appliedProject ? 1 : 0) + (student.projectApplications || []).length}/5)`}
                            </Typography>
                            <Stack spacing={2} sx={{ mt: 1 }}>
                              {[student.appliedProject, ...(student.projectApplications || [])].filter(Boolean).map((p, idx, arr) => {
                                const appInfo = (student.applications || []).find(a => String(a.project?._id || a.project) === String(p._id));
                                const interviewStatus = appInfo?.status || "Pending";

                                return (
                                  <Box
                                    key={p._id || idx}
                                    sx={{
                                      p: 2,
                                      border: '1px solid #edf2f7',
                                      borderRadius: 2,
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      '&:hover': { bgcolor: '#f8fafc' }
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      {student.level < 2 && !studentFreeze && (
                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                          <IconButton
                                            size="small"
                                            disabled={idx === 0 || reordering}
                                            onClick={() => handleReorder(idx, 'up')}
                                            title="Move Up"
                                          >
                                            <KeyboardArrowUpIcon fontSize="small" />
                                          </IconButton>
                                          <IconButton
                                            size="small"
                                            disabled={idx === arr.length - 1 || reordering}
                                            onClick={() => handleReorder(idx, 'down')}
                                            title="Move Down"
                                          >
                                            <KeyboardArrowDownIcon fontSize="small" />
                                          </IconButton>
                                        </Box>
                                      )}
                                      <Box>
                                        <Typography
                                          variant="body1"
                                          fontWeight={600}
                                          color="primary"
                                          sx={{ cursor: 'pointer' }}
                                          onClick={() => openProjectDetailsDialog(p)}
                                        >
                                          {p.title}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {student.level >= 2 ? "Selected Project" : `Priority ${idx + 1}`}
                                        </Typography>
                                      </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <StatusChip
                                        status={(student.status === 'Approved' && String(student.appliedProject?._id || student.appliedProject) === String(p._id)) || interviewStatus === 'Qualified' ? 'Approved' : (interviewStatus === 'Rejected' ? 'Rejected' : 'Pending')}
                                        label={(student.status === 'Approved' && String(student.appliedProject?._id || student.appliedProject) === String(p._id)) ? 'Approved' : interviewStatus}
                                        size="small"
                                      />

                                      {interviewStatus === 'Qualified' && student.level < 2 && !studentFreeze && (
                                        <Button
                                          variant="contained"
                                          size="small"
                                          color="success"
                                          sx={{ ml: 1, textTransform: 'none', borderRadius: 2 }}
                                          onClick={() => handleFinalSelection(p._id)}
                                        >
                                          Select Final Project
                                        </Button>
                                      )}

                                      {/* Removed CloseIcon withdrawal button as requested */}

                                    </Box>
                                  </Box>
                                );
                              })}
                            </Stack>
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                              {!studentFreeze && (
                                <Button
                                  variant="text"
                                  color="error"
                                  size="small"
                                  sx={{ textTransform: 'none' }}
                                  onClick={() => handleWithdraw(null)}
                                >
                                  Withdraw all applications
                                </Button>
                              )}
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ textAlign: 'center', py: 4, bgcolor: '#f8fafc', borderRadius: 4, border: '1px dashed #cbd5e1' }}>
                            <Typography variant="body1" color="text.secondary" mb={3}>
                              You haven't applied for any projects yet.
                            </Typography>
                            <Button
                              variant="contained"
                              size="large"
                              onClick={() => setSection("projects")}
                              sx={{ borderRadius: 3, textTransform: 'none', px: 4, fontWeight: 700 }}
                            >
                              Browse & Apply Projects
                            </Button>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Paper>

                  {/* MY PERFORMANCE (Level 2+) */}
                  {student.level >= 2 && analytics && (
                    <Box sx={{ mb: 6 }}>
                      <Typography variant="h6" fontWeight={800} mb={3} sx={{ color: '#0f172a' }}>My Internship Performance</Typography>
                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                            <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                  <AssignmentIcon sx={{ color: '#0369a1' }} />
                                  <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800 }}>Total Submissions</Typography>
                                </Box>
                                <Typography variant="h3" fontWeight={900} color="#0c4a6e">{analytics.totalSubmissions}</Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Card elevation={0} sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 4,
                            background: todayAttendance === 'Present'
                              ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                              : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                            border: todayAttendance === 'Present'
                              ? '1px solid #10b981'
                              : '1px solid #8b5cf6',
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            boxShadow: todayAttendance === 'Present'
                              ? '0 4px 12px rgba(16, 185, 129, 0.08)'
                              : '0 4px 12px rgba(139, 92, 246, 0.08)',
                            '&:hover': {
                              transform: 'translateY(-5px)',
                              boxShadow: todayAttendance === 'Present'
                                ? '0 12px 24px rgba(16, 185, 129, 0.15)'
                                : '0 12px 24px rgba(139, 92, 246, 0.15)'
                            }
                          }}>
                            <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <HowToRegIcon sx={{ color: todayAttendance === 'Present' ? '#059669' : '#7c3aed' }} />
                                <Typography variant="caption" sx={{ color: todayAttendance === 'Present' ? '#059669' : '#7c3aed', fontWeight: 800, letterSpacing: 0.5 }}>TODAY'S ATTENDANCE</Typography>
                              </Box>
                              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Typography
                                  variant={todayAttendance === 'Not Marked' ? "h6" : "h4"}
                                  fontWeight={900}
                                  sx={{
                                    mb: todayAttendance === 'Not Marked' ? 1.5 : 2,
                                    fontSize: todayAttendance === 'Not Marked' ? '1.25rem' : undefined,
                                    color: todayAttendance === 'Present' ? '#064e3b' : '#4c1d95'
                                  }}
                                >
                                  {todayAttendance || 'Loading...'}
                                </Typography>

                                {todayAttendance === 'Not Marked' && (
                                  <Box>
                                    <Button
                                      variant="contained"
                                      fullWidth
                                      size="small"
                                      onClick={handleMarkAttendance}
                                      disabled={markingAttendance}
                                      startIcon={markingAttendance ? <CircularProgress size={16} color="inherit" /> : <HowToRegIcon sx={{ fontSize: '1rem !important' }} />}
                                      sx={{
                                        borderRadius: '12px',
                                        py: 1,
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        fontSize: '0.85rem',
                                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                                        '&:hover': {
                                          background: 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)',
                                          boxShadow: '0 6px 16px rgba(124, 58, 237, 0.3)',
                                          transform: 'translateY(-1px)'
                                        },
                                        '&.Mui-disabled': {
                                          bgcolor: '#cbd5e1',
                                          color: '#94a3b8'
                                        },
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      {markingAttendance ? 'Verifying...' : 'Mark Attendance'}
                                    </Button>
                                    {attendanceMessage.text && (
                                      <Alert
                                        severity={attendanceMessage.type}
                                        sx={{ mt: 1.5, borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500 }}
                                        onClose={() => setAttendanceMessage({ type: '', text: '' })}
                                      >
                                        {attendanceMessage.text}
                                      </Alert>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  <InfoNote notes={[
                    "Students can apply for a maximum of 5 projects and track their application status on the Dashboard.",
                    "To be promoted to Level 2, a student must appear for the project selection interview.",
                    "For any Clarifications Mails us - InhouseInternships@adityauniversity.in"
                  ]} />

                  {/* UPCOMING REVIEWS WIDGET */}
                  {upcomingReviews.length > 0 && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 2, sm: 3 },
                        mb: 4,
                        border: "1px solid #1976d2",
                        borderRadius: 2,
                        bgcolor: "#e3f2fd",
                      }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, color: '#1565c0' }}>
                        <AssignmentIcon /> Upcoming Scheduled Review
                      </Typography>
                      <Grid container spacing={2}>
                        {upcomingReviews.map(r => (
                          <Grid key={r._id} size={{ xs: 12, md: 6 }}>
                            <Card elevation={0} sx={{ border: '1px solid #bbdefb' }}>
                              <CardContent sx={{ pb: 1 }}>
                                <Typography variant="subtitle1" fontWeight="bold" color="primary.main">{r.title}</Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>{r.description}</Typography>
                                <Typography variant="body2"><strong>Scheduled:</strong> {new Date(r.scheduledAt).toLocaleString()}</Typography>
                              </CardContent>
                              <CardActions>
                                <Button size="small" variant="outlined" onClick={() => setSection('reviews')}>Go to Reviews</Button>
                              </CardActions>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </Paper>
                  )}

                  {/* DASHBOARD END */}
                </>
              )}

              {section === "projects" && (
                <>
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 4,
                    flexWrap: 'wrap',
                    gap: 3
                  }}>
                    <Box>
                      <Typography variant="h4" fontWeight="800" sx={{ color: "#1e293b", letterSpacing: '-0.5px' }}>
                        Projects
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        Browse and connect with internship opportunities
                      </Typography>
                    </Box>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
                      <SearchBar
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery("")}
                        placeholder="Search Data"
                        isFocused={searchFocused}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showAllProjects}
                            onChange={e => setShowAllProjects(e.target.checked)}
                          />
                        }
                        label="Show All Projects"
                        sx={{ ml: 0, whiteSpace: 'nowrap' }}
                      />
                    </Stack>
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
                    {projects.filter(p => {
                      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
                      return matchesSearch && (showAllProjects || p.isEligible);
                    }).map((project) => (
                      <Box key={project._id} sx={{ height: '100%' }}>
                        <Card
                          elevation={1}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: 2,
                            transition: 'transform 0.2s',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 4
                            }
                          }}
                        >
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Box sx={{ mb: 1.5 }}>
                              <Typography
                                variant="subtitle1"
                                fontWeight="800"
                                sx={{
                                  lineHeight: 1.3,
                                  color: "primary.main",
                                  mb: 0.5
                                }}
                              >
                                {project.title}
                              </Typography>
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              mb: 2,
                              height: '60px'
                            }}>
                              {project.description || "No description provided."}
                            </Typography>

                            <Divider sx={{ my: 1.5 }} />

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                Eligible Departments:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {project.departments && project.departments.length > 0 ? (
                                  project.departments.map(d => (
                                    <Chip
                                      key={d.department?._id || d.name}
                                      label={`${d.department?.name || d.name}`}
                                      size="small"
                                      variant={d.seats > 0 ? "outlined" : "filled"}
                                      color={d.seats > 0 ? "primary" : "default"}
                                      sx={{ fontSize: '0.7rem', height: 20 }}
                                    />
                                  ))
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    No specific departments
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </CardContent>
                          <CardActions sx={{ p: 2, pt: 0 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => openProjectDetailsDialog(project)}
                            >
                              Details
                            </Button>
                            <Button
                              size="small"
                              variant={((String(student.appliedProject?._id || student.appliedProject) === String(project._id)) ||
                                (student.projectApplications || []).some(ap => String(ap._id || ap) === String(project._id)))
                                ? "outlined" : "contained"}
                              color={((String(student.appliedProject?._id || student.appliedProject) === String(project._id)) ||
                                (student.projectApplications || []).some(ap => String(ap._id || ap) === String(project._id)))
                                ? "error" : "primary"}
                              disabled={
                                studentFreeze ||
                                !project.isEligible ||
                                (student.status === 'Approved' && student.appliedProject && (String(student.appliedProject?._id || student.appliedProject) !== String(project._id))) || // Can't apply/withdraw others if approved elsewhere, but user wants withdraw?
                                (!((String(student.appliedProject?._id || student.appliedProject) === String(project._id)) ||
                                  (student.projectApplications || []).some(ap => String(ap._id || ap) === String(project._id))) &&
                                  ((student.status === 'Approved' && student.appliedProject) ||
                                    ((student.appliedProject ? 1 : 0) + (student.projectApplications || []).length >= 5)))
                              }
                              onClick={() => {
                                const isApplied = (String(student.appliedProject?._id || student.appliedProject) === String(project._id)) ||
                                  (student.projectApplications || []).some(ap => String(ap._id || ap) === String(project._id));
                                if (isApplied) {
                                  handleWithdraw(project._id);
                                } else {
                                  handleApply(project._id);
                                }
                              }}
                              sx={{ ml: 'auto' }}
                            >
                              {(String(student.appliedProject?._id || student.appliedProject) === String(project._id) ||
                                (student.projectApplications || []).some(ap => String(ap._id || ap) === String(project._id)))
                                ? "Withdraw" :
                                ((student.status === 'Approved' && student.appliedProject) ||
                                  ((student.appliedProject ? 1 : 0) + (student.projectApplications || []).length >= 5))
                                  ? "Locked" : "Apply"}
                            </Button>
                          </CardActions>
                        </Card>
                      </Box>
                    ))}
                    {projects.length === 0 && (
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Typography color="textSecondary" textAlign="center">No open projects found.</Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )}
              {section === "profile" && (
                <Profile user={student} role={ROLES.STUDENT} />
              )}
              {section === "tasks" && (
                student?.appliedProject ? (
                  student.level >= 2 ? (
                    <StudentTasks projectId={student.appliedProject._id} />
                  ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="h6" color="text.secondary">
                        You must be promoted to Level 2 to access project tasks.
                      </Typography>
                    </Box>
                  )
                ) : (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                      You have not applied to any project yet.
                    </Typography>
                  </Box>
                )
              )}
              {section === "attendance" && (
                student.level >= 2 ? (
                  <StudentAttendance />
                ) : (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                      You must be promoted to Level 2 to access attendance records.
                    </Typography>
                  </Box>
                )
              )}

              {section === "reviews" && (
                student.level >= 2 ? (
                  <StudentReviews />
                ) : (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">
                      You must be promoted to Level 2 to access reviews.
                    </Typography>
                  </Box>
                )
              )}
              {section === "about" && (
                <About />
              )}
            </Suspense>
          </Container >
        </Box >
      </Box >

      {/* VIEW PROJECT DETAILS DIALOG */}
      < Suspense fallback={null} >
        <ProjectDetailsDialog
          open={viewOpen}
          onClose={() => setViewOpen(false)}
          project={viewProject}
          customActions={
            <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'flex-end' }}>
              {viewProject && student.level < 2 && !studentFreeze && (
                ((String(student.appliedProject?._id || student.appliedProject) === String(viewProject._id)) ||
                  (student.projectApplications || []).some(ap => String(ap._id || ap) === String(viewProject._id)))
              ) && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      handleWithdraw(viewProject._id);
                      setViewOpen(false);
                    }}
                    sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                  >
                    Withdraw
                  </Button>
                )}
              <Button
                onClick={() => setViewOpen(false)}
                ref={viewProjectCloseButtonRef}
                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
              >
                Close
              </Button>
            </Box>
          }
        />

        {/* WITHDRAW CONFIRMATION DIALOG */}
        <ConfirmDialog
          open={withdrawDialogOpen}
          onCancel={() => setWithdrawDialogOpen(false)}
          onConfirm={confirmWithdraw}
          title="Confirm Withdrawal"
          content="Are you sure you want to withdraw your application? This action cannot be undone immediately if seats are filled by others."
          confirmText="Withdraw"
          confirmColor="error"
          confirmRef={withdrawConfirmButtonRef}
        />

        {/* APPLY CONFIRMATION DIALOG */}
        <ConfirmDialog
          open={applyConfirmOpen}
          onCancel={() => setApplyConfirmOpen(false)}
          onConfirm={confirmApply}
          title="Confirm Application"
          content="Are you sure you want to apply for this project?"
          confirmText="Apply"
          confirmColor="primary"
          confirmRef={applyConfirmButtonRef}
        />

        {/* LOGOUT CONFIRMATION DIALOG */}
        <ConfirmDialog
          open={logoutConfirmOpen}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={confirmLogout}
          title="Confirm Logout"
          content={
            <Box>
              <Typography variant="body2">Are you sure you want to log out?</Typography>
              <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
                Press Enter to logout
              </Typography>
            </Box>
          }
          confirmText="Logout"
          confirmColor="error"
        />
      </Suspense >
    </Box >
  );
}

