import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import "./FacultyDashboard.css";
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  CssBaseline,
  IconButton,
  Avatar,
  Paper,
  TextField,
  FormControlLabel,
  Switch,
  Divider,
  Drawer,
  Stack
} from "@mui/material";

import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import {
  Menu as MenuIcon,
  Info as InfoIcon,
  Assignment as AssignmentIcon,
  Book as BookIcon,
  People as PeopleIcon,
  Timeline as TimelineIcon,
  Dashboard as DashboardIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Assessment as AssessmentIcon
} from "@mui/icons-material";


import { apiFetch } from '../../core/services/apiFetch';
import StatusChip from "../../components/common/StatusChip";
import PageHeader from "../../components/common/PageHeader";
import BrandingBanner from "../../components/common/BrandingBanner";
import RoleSidebar from "../../components/navigation/RoleSidebar";
import SearchBar from "../../components/common/SearchBar";
import { clearAuthSession } from "../../core/utils/auth";
import { ROLES } from "../../core/constants/roles";
import useRequireRole from "../../core/hooks/useRequireRole";

// Lazy loaded components

const FacultyAttendance = lazy(() => import("./FacultyAttendance"));
const FacultyReviews = lazy(() => import("./FacultyReviews"));
const FacultyStudents = lazy(() => import("./FacultyStudents"));
const FacultyTasks = lazy(() => import("./FacultyTasks"));
const About = lazy(() => import("../../components/common/About"));
const ConfirmDialog = lazy(() => import("../../components/common/ConfirmDialog"));
const ProjectDetailsDialog = lazy(() => import("../../components/common/ProjectDetailsDialog"));
const Profile = lazy(() => import("../../components/common/Profile"));

const SectionLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
    <CircularProgress />
  </Box>
);

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const { user } = useRequireRole(ROLES.FACULTY);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [faculty, setFaculty] = useState(null);
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [section, setSection] = useState(() => {
    const saved = sessionStorage.getItem("facultySection");
    if (saved === "projects") return "marketplace";
    return saved || "dashboard";
  });

  useEffect(() => {
    sessionStorage.setItem("facultySection", section);
  }, [section]);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [applyData, setApplyData] = useState({ projectId: null, role: null });
  const [viewProject, setViewProject] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openSecondary, setOpenSecondary] = useState(false);

  const [navState, setNavState] = useState({});
  const navigateToSection = (key, state = {}) => {
    setSection(key);
    setNavState(state || {});
  };

  const fetchFaculty = async () => {
    if (user?._id) {
      fetchDashboard(user._id);
    }
  };

  const viewProjectCloseButtonRef = useRef(null);

  useEffect(() => {
    fetchFaculty();
  }, [user?._id]);

  const fetchDashboard = async (id) => {
    try {
      const { batchFetch } = await import('../../core/services/apiFetch');
      const results = await batchFetch([
        { id: 'dashboard', method: 'GET', url: `/api/faculty/dashboard/${id}` },
        { id: 'projects', method: 'GET', url: `/api/projects?status=Open${user?.department ? `&baseDept=${encodeURIComponent(user.department)}` : ''}` },
        { id: 'analytics', method: 'GET', url: "/api/analytics/guide" }
      ]);

      if (results.dashboard?.status !== 200) throw new Error(`Dashboard error: ${results.dashboard?.status}`);
      if (results.projects?.status !== 200) throw new Error(`Projects error: ${results.projects?.status}`);
      if (results.analytics?.status !== 200) throw new Error(`Analytics error: ${results.analytics?.status}`);

      const dashboardData = results.dashboard.data;
      const projectsData = results.projects.data;
      const analyticsData = results.analytics.data;

      setFaculty(dashboardData.faculty || dashboardData);
      setProjects(Array.isArray(projectsData) ? projectsData : (projectsData.data || []));
      setAnalytics(analyticsData);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (projectId, role) => {
    setApplyData({ projectId, role });
    setApplyConfirmOpen(true);
  };

  const openProjectDetailsDialog = (project) => {
    if (!project || !project._id) return;

    // Find the most up-to-date version of the project from the main 'projects' list
    const fullProjectDetails = projects.find((p) => p._id === project._id);

    let processedProject = fullProjectDetails ? { ...fullProjectDetails } : { ...project };

    // Ensure departments are in the correct format {name, seats}
    if (Array.isArray(processedProject.departments)) {
      processedProject.departments = processedProject.departments.map((d) => ({
        name: d.department?.name || d.name || "Unknown",
        seats: d.seats || 0,
        totalSeats: d.totalSeats ?? d.seats ?? 0,
        registeredCount: d.registeredCount ?? 0,
      })).filter(d => d.name !== 'Unknown');
    } else {
      processedProject.departments = [];
    }

    // Ensure totalSeats and registeredCount are present
    processedProject.totalSeats = processedProject.totalSeats ?? processedProject.departments.reduce((sum, d) => sum + (d.seats || 0), 0);
    processedProject.registeredCount = processedProject.registeredCount ?? 0;

    // Ensure coGuide is present
    processedProject.coGuide = processedProject.coGuide || "N/A";
    // Ensure status is present
    processedProject.status = processedProject.status || "Unknown";

    setViewProject(processedProject);
    setViewOpen(true);
  };

  const confirmApply = async () => {
    const { projectId, role } = applyData;
    try {
      const res = await apiFetch("/api/faculty/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyId: faculty._id, projectId, role })
      });
      if (res.ok) {
        fetchDashboard(faculty._id);
      } else {
        const data = await res.json();
        alert(data.message || "Failed to apply");
      }
    } catch (err) {
      alert("Server error");
    } finally {
      setApplyConfirmOpen(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPassError("");
    setPassMessage("");
    if (!password || !confirmPassword) {
      setPassError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setPassError("Passwords do not match");
      return;
    }

    try {
      const res = await apiFetch(`/api/faculty/profile/${faculty._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        setPassMessage("Password updated successfully");
        setPassword("");
        setConfirmPassword("");
      } else {
        setPassError(data.message || "Update failed");
      }
    } catch (err) {
      setPassError("Server error");
    }
  };

  const handleWithdraw = async (role) => {
    if (!window.confirm(`Withdraw ${role} application?`)) return;
    try {
      const res = await apiFetch("/api/faculty/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facultyId: faculty._id, role })
      });
      if (res.ok) {
        fetchDashboard(faculty._id);
      }
    } catch (err) {
      alert("Server error");
    }
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
    if (isMobile) setMobileOpen(false);
  };

  const sidebarItems = [
    { key: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
    { key: "marketplace", label: "Projects", icon: <AssignmentIcon /> },
    {
      key: "students",
      label: "Students",
      icon: <PeopleIcon />,
      hidden: !(faculty?.appliedProject || faculty?.coGuidedProject)
    },
    {
      key: "attendance",
      label: "Attendance",
      icon: <BookIcon />,
      hidden: !(faculty?.appliedProject || faculty?.coGuidedProject)
    },
    {
      key: "tasks",
      label: "Daily Status",
      icon: <AssignmentIcon />,
      hidden: !(faculty?.appliedProject || faculty?.coGuidedProject)
    },
    {
      key: "reviews",
      label: "Reviews",
      icon: <AssessmentIcon />,
      hidden: !(faculty?.appliedProject || faculty?.coGuidedProject)
    },
    { key: "profile", label: "Profile", icon: <SupervisorAccountIcon /> }
  ];

  const sidebarSecondaryItems = [
    { key: "about", label: "About", icon: <InfoIcon /> }
  ];

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}><CircularProgress /></Box>;
  if (error) return <Container sx={{ mt: 5 }}><Alert severity="error">{error}</Alert></Container>;
  if (!faculty) return null;

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <style>{`
        *:not(input, textarea, [contenteditable]) {
          caret-color: transparent;
        }
      `}</style>
      <CssBaseline />

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
            selectedKey={section === "dashboard" ? "dashboard" : (section === "projects" ? "marketplace" : section)}
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
            selectedKey={section === "dashboard" ? "dashboard" : (section === "projects" ? "marketplace" : section)}
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
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Container maxWidth="lg" disableGutters>
            <Suspense fallback={<SectionLoader />}>
              {section === "dashboard" && (() => {
                const hasGuideRole = !!(faculty.appliedProject || faculty.requestedProject);
                const hasCoGuideRole = !!(faculty.coGuidedProject || faculty.requestedCoGuideProject);

                return (
                  <>
                    <PageHeader
                      title={faculty.name}
                      isWelcome
                      action={<BrandingBanner onClick={() => handleNavSelect('about')} />}
                    />

                    {/* STATUS CARDS */}
                    <Grid container spacing={3} sx={{ mb: 6 }}>
                      {/* Guide Status */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card elevation={0} sx={{ p: 0, height: '100%', borderRadius: 5, border: '1px solid #e2e8f0', background: 'white', overflow: 'hidden', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' } }}>
                          <Box sx={{ p: 1, bgcolor: '#f1f5f9' }} />
                          <CardContent sx={{ p: 4 }}>
                            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'primary.light', color: 'white', display: 'flex' }}>
                                <AssignmentIcon />
                              </Box>
                              <Box>
                                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 1.2 }}>Primary Role</Typography>
                                <Typography variant="h5" fontWeight={900} color="#1e293b">Project Guide</Typography>
                              </Box>
                            </Stack>

                            <Box sx={{ mt: 3, p: 3, bgcolor: '#f8fafc', borderRadius: 4, border: '1px dashed #cbd5e1' }}>
                              {faculty.appliedProject || faculty.requestedProject ? (
                                <Stack spacing={2}>
                                  <Typography
                                    variant="h6"
                                    fontWeight={800}
                                    sx={{ color: 'primary.main', cursor: "pointer", '&:hover': { color: 'primary.dark' } }}
                                    onClick={() => openProjectDetailsDialog(faculty.appliedProject || faculty.requestedProject)}
                                  >
                                    {faculty.appliedProject?.title || faculty.requestedProject?.title}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <StatusChip status={faculty.status} />
                                    {faculty.status === "Pending" && (
                                      <Button
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        onClick={() => handleWithdraw("guide")}
                                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                                      >
                                        Withdraw Request
                                      </Button>
                                    )}
                                  </Box>
                                </Stack>
                              ) : (
                                <Box sx={{ py: 2, textAlign: 'center' }}>
                                  <Typography variant="body2" color="text.secondary" fontWeight={500}>Strategic mentorship slot available</Typography>
                                </Box>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>

                      {/* Co-Guide Status */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card elevation={0} sx={{ p: 0, height: '100%', borderRadius: 5, border: '1px solid #e2e8f0', background: 'white', overflow: 'hidden', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' } }}>
                          <Box sx={{ p: 1, bgcolor: '#fdf2f8' }} />
                          <CardContent sx={{ p: 4 }}>
                            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'secondary.light', color: 'white', display: 'flex' }}>
                                <SupervisorAccountIcon />
                              </Box>
                              <Box>
                                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 1.2 }}>Support Role</Typography>
                                <Typography variant="h5" fontWeight={900} color="#1e293b">Co-Guide</Typography>
                              </Box>
                            </Stack>

                            <Box sx={{ mt: 3, p: 3, bgcolor: '#fff5f7', borderRadius: 4, border: '1px dashed #fbcfe8' }}>
                              {faculty.coGuidedProject || faculty.requestedCoGuideProject ? (
                                <Stack spacing={2}>
                                  <Typography
                                    variant="h6"
                                    fontWeight={800}
                                    sx={{ color: 'secondary.main', cursor: "pointer", '&:hover': { color: 'secondary.dark' } }}
                                    onClick={() => openProjectDetailsDialog(faculty.coGuidedProject || faculty.requestedCoGuideProject)}
                                  >
                                    {faculty.coGuidedProject?.title || faculty.requestedCoGuideProject?.title}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <StatusChip status={faculty.coGuideStatus} />
                                    {faculty.coGuideStatus === "Pending" && (
                                      <Button
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        onClick={() => handleWithdraw("co-guide")}
                                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                                      >
                                        Withdraw Request
                                      </Button>
                                    )}
                                  </Box>
                                </Stack>
                              ) : (
                                <Box sx={{ py: 2, textAlign: 'center' }}>
                                  <Typography variant="body2" color="text.secondary" fontWeight={500}>Support guidance slot available</Typography>
                                </Box>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>

                    {/* ANALYTICS */}
                    {analytics && (faculty.appliedProject || faculty.coGuidedProject) && (
                      <Box sx={{ mb: 6 }}>
                        <Typography variant="h6" fontWeight={800} color="#1e293b" mb={3}>Mentorship & Guidance Impact</Typography>
                        <Grid container spacing={3}>
                          {[
                            { label: 'Total Students', value: analytics.totalSupervisedStudents, icon: <PeopleIcon />, color: '#0ea5e9', bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)' },
                            { label: 'Submissions', value: analytics.totalSubmissions, icon: <AssignmentIcon />, color: '#64748b', bg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' },
                            { label: 'Pending Reviews', value: analytics.pendingReviews, icon: <AssessmentIcon />, color: '#f59e0b', bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' },
                            { label: 'Success Rate', value: `${Math.round(analytics.averageStudentCompletion)}%`, icon: <TimelineIcon />, color: '#8b5cf6', bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' }
                          ].map((stat, idx) => (
                            <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
                              <Card elevation={0} sx={{ height: '100%', borderRadius: 4, background: stat.bg, border: '1px solid rgba(0,0,0,0.05)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 12px 20px -10px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.5)', color: stat.color, display: 'flex' }}>
                                      {stat.icon}
                                    </Box>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: 1 }}>{stat.label.toUpperCase()}</Typography>
                                  </Box>
                                  <Typography variant="h3" fontWeight={900} color="#1e293b">{stat.value}</Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}


                  </>
                );
              })()}

              {section === "marketplace" && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, p: 3, background: 'linear-gradient(90deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: 4, border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                      <Typography variant="h5" fontWeight={900} color="#1e293b">Projects</Typography>
                      <Typography variant="body2" color="text.secondary">select projects as guide or coguide</Typography>
                    </Box>
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ gap: 2 }}>
                      <SearchBar
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery("")}
                        placeholder="Search Data"
                        isFocused={searchFocused}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showUnassignedOnly}
                            onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                          />
                        }
                        label={<Typography variant="body2" fontWeight={700}>Hide Occupied Slots</Typography>}
                      />
                    </Stack>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 4 }}>
                    {projects.filter(p => {
                      const matchesStatus = p.status === "Open";
                      const matchesUnassigned = !showUnassignedOnly || !p.guide || p.guide === "None";
                      const q = searchQuery.toLowerCase();
                      const matchesSearch = !searchQuery ||
                        (p.title || "").toLowerCase().includes(q) ||
                        (p.projectId || "").toLowerCase().includes(q) ||
                        (p.description || "").toLowerCase().includes(q) ||
                        (p.guide || "").toLowerCase().includes(q) ||
                        (p.coGuide || "").toLowerCase().includes(q) ||
                        (p.guideDept || "").toLowerCase().includes(q) ||
                        (p.coGuideDept || "").toLowerCase().includes(q) ||
                        (p.baseDept || "").toLowerCase().includes(q);
                      return matchesStatus && matchesUnassigned && matchesSearch;
                    }).map((project) => (
                      <Box key={project._id} sx={{ height: '100%' }}>
                        <Card
                          elevation={0}
                          sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            borderRadius: 5,
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.3s ease',
                            bgcolor: 'white',
                            overflow: 'hidden',
                            '&:hover': {
                              transform: 'translateY(-10px)',
                              boxShadow: '0 20px 30px -10px rgba(0,0,0,0.1)',
                              borderColor: 'primary.light'
                            }
                          }}
                        >
                          <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ px: 1.5, py: 0.5, borderRadius: 2, bgcolor: 'primary.light', color: 'white', fontWeight: 800 }}>{project.projectId}</Typography>
                            <StatusChip status="Open" size="small" />
                          </Box>
                          <CardContent sx={{ p: 3, flexGrow: 1 }}>
                            <Typography
                              variant="h6"
                              fontWeight={800}
                              gutterBottom
                              sx={{ lineHeight: 1.3, color: '#1e293b', minHeight: '3.4rem', cursor: "pointer", '&:hover': { color: 'primary.main' } }}
                              onClick={() => openProjectDetailsDialog(project)}
                            >
                              {project.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              height: '3.2rem',
                              mb: 3,
                              lineHeight: 1.6
                            }}>
                              {project.description || "In-depth project research and development phase for specialized technical domain."}
                            </Typography>

                            <Stack spacing={2} sx={{ mb: 1 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', p: 1.5, borderRadius: 3, bgcolor: '#f1f5f9' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="caption" fontWeight={700} color="text.secondary">Guide</Typography>
                                  <Typography variant="caption" sx={{ px: 1, py: 0.2, borderRadius: 1.5, bgcolor: project.guide ? '#e2e8f0' : '#dcfce7', color: project.guide ? '#64748b' : '#15803d', fontWeight: 800 }}>
                                    {project.guide || "Available"}
                                  </Typography>
                                </Box>
                                {project.guideDept && (
                                  <Typography variant="caption" color="primary" sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.65rem' }}>
                                    Required Dept: {project.guideDept}
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', flexDirection: 'column', p: 1.5, borderRadius: 3, bgcolor: '#f1f5f9' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="caption" fontWeight={700} color="text.secondary">Co-Guide</Typography>
                                  <Typography variant="caption" sx={{ px: 1, py: 0.2, borderRadius: 1.5, bgcolor: project.coGuide ? '#e2e8f0' : '#dcfce7', color: project.coGuide ? '#64748b' : '#15803d', fontWeight: 800 }}>
                                    {project.coGuide || "Available"}
                                  </Typography>
                                </Box>
                                {project.coGuideDept && (
                                  <Typography variant="caption" color="secondary" sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.65rem' }}>
                                    Required Dept: {project.coGuideDept}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>
                          </CardContent>
                          <CardActions sx={{ p: 3, pt: 0, justifyContent: 'center', gap: 1.5 }}>
                            <Button
                              variant="contained"
                              disableElevation
                              fullWidth
                              disabled={(faculty.appliedProject?._id === project._id) || (faculty.requestedProject?._id === project._id) || (faculty.coGuidedProject?._id === project._id) || (project.guide) || (project.guideDept && faculty.department !== project.guideDept)}
                              onClick={() => handleApply(project._id, "guide")}
                              sx={{ borderRadius: 3, py: 1, textTransform: 'none', fontWeight: 700, bgcolor: '#1e293b', '&:hover': { bgcolor: '#0f172a' } }}
                            >
                              {project.guideDept && faculty.department !== project.guideDept
                                ? "Restricted"
                                : (faculty.appliedProject?.title === project.title || faculty.requestedProject?.title === project.title)
                                  ? "Guiding"
                                  : "Guide"}
                            </Button>
                            <Button
                              variant="outlined"
                              fullWidth
                              disabled={(faculty.coGuidedProject?._id === project._id) || (faculty.requestedCoGuideProject?._id === project._id) || (faculty.appliedProject?._id === project._id) || (project.coGuide) || (project.coGuideDept && faculty.department !== project.coGuideDept)}
                              onClick={() => handleApply(project._id, "co-guide")}
                              sx={{ borderRadius: 3, py: 1, textTransform: 'none', fontWeight: 700, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                            >
                              {project.coGuideDept && faculty.department !== project.coGuideDept
                                ? "Restricted"
                                : (faculty.coGuidedProject?.title === project.title || faculty.requestedCoGuideProject?.title === project.title)
                                  ? "Co-Guiding"
                                  : "Co-Guide"}
                            </Button>
                          </CardActions>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {section === "attendance" && (
                <FacultyAttendance
                  context={{ setSection: navigateToSection, navState }}
                  projects={[faculty?.appliedProject, faculty?.coGuidedProject].filter(Boolean)}
                />
              )}
              {section === "students" && (
                <FacultyStudents
                  context={{ setSection: navigateToSection, navState }}
                  projects={[faculty?.appliedProject, faculty?.coGuidedProject].filter(Boolean)}
                />
              )}
              {section === "reviews" && (
                <FacultyReviews
                  context={{ setSection: navigateToSection, navState }}
                  projects={[faculty?.appliedProject, faculty?.coGuidedProject].filter(Boolean)}
                />
              )}
              {section === "tasks" && (
                <FacultyTasks
                  context={{ setSection: navigateToSection, navState }}
                  projects={[faculty?.appliedProject, faculty?.coGuidedProject].filter(Boolean)}
                />
              )}
              {section === "profile" && (
                <Profile user={faculty} role={ROLES.FACULTY} />
              )}
              {section === "about" && (
                <About />
              )}
            </Suspense>
          </Container>
        </Box>
      </Box>

      <Suspense fallback={null}>
        <ProjectDetailsDialog
          open={viewOpen}
          onClose={() => setViewOpen(false)}
          project={viewProject}
        />

        <ConfirmDialog
          open={applyConfirmOpen}
          onCancel={() => setApplyConfirmOpen(false)}
          onConfirm={confirmApply}
          title="Confirm Application"
          content={
            <Box>
              Are you sure you want to register as <strong>{applyData.role}</strong> for this project?
            </Box>
          }
          confirmText="Confirm"
          confirmColor="primary"
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
      </Suspense>
    </Box>
  );
}
