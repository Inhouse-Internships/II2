import React, { useState, useEffect, useMemo } from "react";
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    IconButton,
    Stack,
    Chip,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    CircularProgress,
    Tooltip,
    alpha,
    useTheme,
    InputBase,
    Container
} from "@mui/material";
import {
    Apartment as ApartmentIcon,
    ArrowBack as ArrowBackIcon,
    Folder as FolderIcon,
    Group as GroupIcon,
    Search as SearchIcon,
    Launch as LaunchIcon,
    Visibility as VisibilityIcon,
    BarChart as BarChartIcon
} from "@mui/icons-material";
import { apiFetch } from "../../core/services/apiFetch";
import PageHeader from "../../components/common/PageHeader";
import ProjectDetailsDialog from "../../components/common/ProjectDetailsDialog";
import DataTable from "../../components/common/DataTable";
import StatusChip from "../../components/common/StatusChip";
import FacultyDetailsDialog from "../../components/common/FacultyDetailsDialog";
import {
    Assignment as AssignmentIcon,
    CheckCircle as CheckCircleIcon,
    RateReview as RateReviewIcon
} from "@mui/icons-material";

export default function AdminDepartments(props) {
    const theme = useTheme();
    const context = props.context || {};

    const [loading, setLoading] = useState(true);
    const [matrixData, setMatrixData] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectLoading, setProjectLoading] = useState(false);
    const [localAvailableDepts, setLocalAvailableDepts] = useState([]);
    const [facultyDetailsOpen, setFacultyDetailsOpen] = useState(false);
    const [selectedFacultyName, setSelectedFacultyName] = useState("");

    useEffect(() => {
        fetchMatrix();
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        if (context.allDepartmentsData?.length > 0) return;
        try {
            const res = await apiFetch("/api/admin/all-db-departments");
            if (res.ok) {
                const data = await res.json();
                setLocalAvailableDepts(data.sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (err) {
            console.error("Failed to fetch departments from settings", err);
        }
    };

    const fetchMatrix = async () => {
        try {
            setLoading(true);
            const res = await apiFetch("/api/admin/departments");
            if (res.ok) {
                const data = await res.json();
                setMatrixData(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch department matrix", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectDetails = async (projectId) => {
        try {
            const res = await apiFetch(`/api/projects/${projectId}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            console.error("Failed to fetch project details", err);
        }
        return null;
    };

    const { allDepartmentsData: contextDepts = [] } = context;
    const availableDepts = contextDepts.length > 0 ? contextDepts : localAvailableDepts;

    // Group data by Department
    const departmentStats = useMemo(() => {
        const stats = {}; // { [deptName]: { projectCount, totalSeats, registeredCount, projects: [] } }

        // Initialize with all system departments
        availableDepts.forEach(dept => {
            if (!stats[dept.name]) {
                stats[dept.name] = {
                    name: dept.name,
                    projectCount: 0,
                    totalSeats: 0,
                    registeredCount: 0,
                    projects: []
                };
            }
        });

        matrixData.forEach(project => {
            // Priority: baseDept > first allocated department > General
            let bDept = project.baseDept;
            if (!bDept && project.departments && project.departments.length > 0) {
                bDept = project.departments[0].name;
            }
            if (!bDept) bDept = 'General';

            if (!stats[bDept]) {
                stats[bDept] = {
                    name: bDept,
                    projectCount: 0,
                    totalSeats: 0,
                    registeredCount: 0,
                    projects: []
                };
            }

            const totalProjectSeats = project.projectTotalSeats || 0;
            const totalProjectReg = project.projectTotalRegistered || 0;

            stats[bDept].projectCount += 1;
            stats[bDept].totalSeats += totalProjectSeats;
            stats[bDept].registeredCount += totalProjectReg;
            stats[bDept].projects.push({
                ...project,
                deptSeats: totalProjectSeats,
                deptRegistered: totalProjectReg
            });
        });

        // Filter out departments with 0 projects only if they were added via 'General' fallback
        // but the user wants the dept grid to show properly, so keep all system depts.
        return Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));
    }, [matrixData, availableDepts]);


    const handleOpenProject = async (projectSummary) => {
        setProjectLoading(true);
        const resObj = await fetchProjectDetails(projectSummary._id || projectSummary.projectId);
        if (resObj && (resObj.data || resObj.title)) {
            // Backend successResponse wraps data in .data, but some older endpoints might not
            setSelectedProject(resObj.data || resObj);
            setProjectDialogOpen(true);
        }
        setProjectLoading(false);
    };

    const handleFacultyClick = (name, event) => {
        if (event) event.stopPropagation();
        setSelectedFacultyName(name);
        setFacultyDetailsOpen(true);
    };

    const handleToggleStatus = async (project) => {
        try {
            const newStatus = project.status === 'Open' ? 'Closed' : 'Open';
            const res = await apiFetch(`/api/projects/${project._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                fetchMatrix();
                // If we have a selected dept, we need to update its local projects list too
                if (selectedDept) {
                    setSelectedDept(prev => ({
                        ...prev,
                        projects: prev.projects.map(p => p._id === project._id ? { ...p, status: newStatus } : p)
                    }));
                }
            }
        } catch (err) {
            console.error("Failed to toggle status", err);
        }
    };

    const columns = [
        {
            id: "title", label: "Title", minWidth: 200, render: (p) => (
                <Box>
                    <Typography
                        onClick={() => handleOpenProject(p)}
                        noWrap
                        sx={{
                            cursor: "pointer",
                            color: "primary.main",
                            fontWeight: "bold",
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            maxWidth: { xs: 180, sm: 250, md: '25vw' }
                        }}
                        title={p.title}
                    >
                        {p.title}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">{p.projectId || "-"} • {p.baseDept || "-"}</Typography>
                </Box>
            )
        },
        {
            id: "guide", label: "Guide", minWidth: 150, render: (p) => (
                <Box>
                    <Typography
                        noWrap
                        sx={{
                            cursor: p.guide ? 'pointer' : 'default',
                            maxWidth: { xs: 120, sm: 160, md: '12vw' },
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            fontWeight: p.guide ? 600 : 400,
                            color: p.guide ? 'text.primary' : 'text.disabled',
                            '&:hover': p.guide ? { textDecoration: 'underline' } : {}
                        }}
                        onClick={(e) => p.guide && handleFacultyClick(p.guide, e)}
                        title={p.guide || "Not Assigned"}
                    >
                        {p.guide || "Available"}
                    </Typography>
                    {p.guideDept && (
                        <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>{p.guideDept}</Typography>
                    )}
                </Box>
            )
        },
        {
            id: "coGuide", label: "Co-Guide", minWidth: 150, render: (p) => (
                <Box>
                    <Typography
                        noWrap
                        sx={{
                            cursor: p.coGuide ? 'pointer' : 'default',
                            maxWidth: { xs: 120, sm: 160, md: '12vw' },
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            fontWeight: p.coGuide ? 600 : 400,
                            color: p.coGuide ? 'text.primary' : 'text.disabled',
                            '&:hover': p.coGuide ? { textDecoration: 'underline' } : {}
                        }}
                        onClick={(e) => p.coGuide && handleFacultyClick(p.coGuide, e)}
                        title={p.coGuide || "Not Assigned"}
                    >
                        {p.coGuide || "Available"}
                    </Typography>
                    {p.coGuideDept && (
                        <Typography variant="caption" color="secondary" sx={{ fontWeight: 700 }}>{p.coGuideDept}</Typography>
                    )}
                </Box>
            )
        },
        {
            id: "seats", label: "Registered / Seats", minWidth: 150, render: (p) => {
                const d = p.departments?.find(it => it.name === selectedDept.name);
                const reg = d ? d.registered : (p.deptRegistered || 0);
                const total = d ? d.total : (p.deptSeats || 0);
                return (
                    <Typography
                        onDoubleClick={() => {
                            if (context.setSection) {
                                context.setSection("students", { projectId: p._id });
                            }
                        }}
                        sx={{ cursor: context.setSection ? "pointer" : "default", color: "primary.main", textDecoration: context.setSection ? "underline" : "none" }}
                        title={context.setSection ? "Double click to view assigned students" : ""}
                    >
                        {reg} / {total}
                    </Typography>
                );
            }
        },
        {
            id: "status", label: "Status", minWidth: 120, render: (p) => (
                <div onClick={() => handleToggleStatus(p)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <StatusChip status={p.status} />
                </div>
            )
        },
        {
            id: "actions", label: "Manage", minWidth: 150, render: (p) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Daily status">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (context.setSection) context.setSection("tasks", { projectId: p._id });
                            }}
                        >
                            <AssignmentIcon fontSize="small" color="primary" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Attendance">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (context.setSection) context.setSection("attendance", { projectId: p._id });
                            }}
                        >
                            <CheckCircleIcon fontSize="small" color="success" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Reviews">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (context.setSection) context.setSection("reviews", { projectId: p._id });
                            }}
                        >
                            <RateReviewIcon fontSize="small" color="secondary" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            )
        }
    ];

    if (loading && matrixData.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
            {!selectedDept ? (
                <>
                    <PageHeader
                        title="Departments"
                        subtitle="Detailed overview of project distribution and student registrations across departments."
                    />

                    <Grid container spacing={{ xs: 2, md: 3 }}>
                        {departmentStats.map((dept) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={dept.name}>
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: '20px',
                                        border: '1px solid #f1f5f9',
                                        bgcolor: '#ffffff',
                                        height: '100%',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)',
                                            borderColor: alpha(theme.palette.primary.main, 0.3),
                                        }
                                    }}
                                >
                                    <CardActionArea onClick={() => setSelectedDept(dept)} sx={{ height: '100%' }}>
                                        <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: '12px',
                                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                        color: theme.palette.primary.main
                                                    }}
                                                >
                                                    <ApartmentIcon fontSize="medium" />
                                                </Box>
                                                <Chip
                                                    label={`${dept.projectCount} Projects`}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 700,
                                                        bgcolor: '#f8fafc',
                                                        color: '#64748b',
                                                        border: '1px solid #e2e8f0',
                                                        fontSize: '0.75rem'
                                                    }}
                                                />
                                            </Box>

                                            <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#1e293b', lineHeight: 1.2, flexGrow: 1 }}>
                                                {dept.name}
                                            </Typography>

                                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Registered:</Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>{dept.registeredCount}</Typography>
                                            </Box>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        ))}
                        {departmentStats.length === 0 && (
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ p: 5, borderRadius: 6, textAlign: 'center', border: '1px dashed #cbd5e1', bgcolor: alpha('#f1f5f9', 0.5) }}>
                                    <Typography variant="h6" fontWeight={700} color="text.secondary">No departments available.</Typography>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                </>
            ) : (
                <>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
                        <IconButton
                            onClick={() => setSelectedDept(null)}
                            sx={{
                                bgcolor: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                '&:hover': { bgcolor: '#f8fafc' }
                            }}
                        >
                            <ArrowBackIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                                {selectedDept.name} Projects
                            </Typography>
                            <Typography variant="subtitle1" sx={{ color: '#64748b', mt: 0.5 }}>
                                {selectedDept.projectCount} active projects offering seats for this department
                            </Typography>
                        </Box>
                    </Stack>

                    <DataTable
                        columns={columns}
                        rows={selectedDept.projects}
                        loading={false}
                        emptyMessage="No projects available for this department."
                        stickyHeader={false}
                    />
                </>
            )}

            {selectedProject && (
                <ProjectDetailsDialog
                    open={projectDialogOpen}
                    onClose={() => {
                        setProjectDialogOpen(false);
                        setSelectedProject(null);
                    }}
                    project={selectedProject}
                />
            )}

            <FacultyDetailsDialog
                open={facultyDetailsOpen}
                onClose={() => setFacultyDetailsOpen(false)}
                facultyName={selectedFacultyName}
            />

            {(projectLoading) && (
                <Box sx={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    bgcolor: 'rgba(255,255,255,0.7)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <CircularProgress />
                </Box>
            )}
        </Box>
    );
}
