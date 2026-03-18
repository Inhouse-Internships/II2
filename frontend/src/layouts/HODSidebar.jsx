import {
    Box, Button, IconButton, Typography, Dialog,
    DialogTitle, DialogContent, DialogContentText,
    DialogActions, Drawer, useMediaQuery, useTheme, CircularProgress
} from "@mui/material";
import React, { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const HODDashboard = lazy(() => import("../pages/HOD/HODDashboard"));
const HODProjects = lazy(() => import("../pages/HOD/HODProjects"));
const HODStudents = lazy(() => import("../pages/HOD/HODStudents"));
const HODAttendance = lazy(() => import("../pages/HOD/HODAttendance"));
const HODTasks = lazy(() => import("../pages/HOD/HODTasks"));
const AdminReviews = lazy(() => import("../pages/Admin/AdminReviews"));
const About = lazy(() => import("../components/common/About"));
const Profile = lazy(() => import("../components/common/Profile"));
import { getAuthUser } from "../core/utils/auth";
import { ROLES } from "../core/constants/roles";

const SectionLoader = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, mt: 5 }}>
        <CircularProgress />
    </Box>
);

import {
    Menu as MenuIcon,
    Folder as FolderIcon,
    Dashboard as DashboardIcon,
    CheckCircleOutline as CheckCircleOutlineIcon,
    Assignment as AssignmentIcon,
    RateReview as RateReviewIcon,
    Groups as GroupsIcon,
    Info as InfoIcon,
    Person as PersonIcon
} from "@mui/icons-material";
import RoleSidebar from "../components/navigation/RoleSidebar";
import { clearAuthSession } from "../core/utils/auth";

export default function HODLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [section, setSection] = useState(() => {
        return sessionStorage.getItem("hodSection") || "dashboard";
    });

    useEffect(() => {
        sessionStorage.setItem("hodSection", section);
    }, [section]);
    const [navState, setNavState] = useState({});

    const navigateToSection = (key, state = {}) => {
        setSection(key);
        setNavState(state || {});
    };

    const handleLogoutClick = () => {
        setLogoutConfirmOpen(true);
    };

    const confirmLogout = () => {
        clearAuthSession();
        navigate("/login");
    };

    const handleNavSelect = (key) => {
        navigateToSection(key);
        if (isMobile) setMobileOpen(false);
    };

    const sidebarItems = [
        { key: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
        { key: "projects", label: "Projects", icon: <FolderIcon /> },
        { key: "students", label: "Students", icon: <GroupsIcon /> },
        { key: "attendance", label: "Attendance", icon: <CheckCircleOutlineIcon /> },
        { key: "tasks", label: "Daily Status", icon: <AssignmentIcon /> },
        { key: "reviews", label: "Reviews", icon: <RateReviewIcon /> },
        { key: "profile", label: "Profile", icon: <PersonIcon /> }
    ];

    const sidebarSecondaryItems = [
        { key: "about", label: "About", icon: <InfoIcon /> }
    ];

    return (
        <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
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
                    />
                </Drawer>
            ) : (
                <Box
                    onMouseEnter={() => setCollapsed(false)}
                    sx={{
                        width: !collapsed ? 210 : 64,
                        transition: "width 0.3s",
                        background: "#f9f9f9",
                        borderRight: "1px solid #ddd",
                        display: "flex",
                        flexDirection: "column",
                        overflowY: "auto",
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
                    />
                </Box>
            )}

            <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {isMobile && (
                    <Box sx={{ display: "flex", alignItems: "center", p: 1.5, borderBottom: "1px solid #ddd", bgcolor: "#f9f9f9" }}>
                        <IconButton onClick={() => setMobileOpen(true)} size="small">
                            <MenuIcon />
                        </IconButton>
                        <Box sx={{ ml: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 0.5 }}>
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
                                setSection: navigateToSection,
                                navState
                            };
                            switch (section) {
                                case "dashboard": return <HODDashboard context={sharedContext} />;
                                case "projects": return <HODProjects context={sharedContext} />;
                                case "students": return <HODStudents context={sharedContext} />;
                                case "attendance": return <HODAttendance context={sharedContext} />;
                                case "tasks": return <HODTasks context={sharedContext} />;
                                case "reviews": return <AdminReviews context={sharedContext} />;

                                case "about": return <About context={sharedContext} />;
                                case "profile": return <Profile user={getAuthUser()} role={ROLES.HOD} />;
                                default: return <HODDashboard context={sharedContext} />;
                            }
                        })()}
                    </Suspense>
                </Box>
            </Box>

            <Dialog open={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)}>
                <DialogTitle>Confirm Logout</DialogTitle>
                <DialogContent>
                    <DialogContentText>Are you sure you want to logout?</DialogContentText>
                    <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
                        Press Enter to logout
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLogoutConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={confirmLogout} color="error" autoFocus>Logout</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
