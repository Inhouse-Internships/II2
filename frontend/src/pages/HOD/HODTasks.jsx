import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, CircularProgress, Alert, Paper, Table, TableBody, TableCell, TableHead, TableRow, Stack, Chip, Button, IconButton, Tooltip, LinearProgress, Pagination
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Assignment as AssignmentIcon,
    AssignmentTurnedIn as AssignmentTurnedInIcon,
    CheckCircle as CheckCircleIcon,
    Pending as PendingIcon,
    WarningAmber as WarningAmberIcon,
    HourglassEmpty as HourglassEmptyIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import SearchBar from '../../components/common/SearchBar';
import ProjectDetailsDialog from '../../components/common/ProjectDetailsDialog';
import StatusChip from '../../components/common/StatusChip';
import FacultyDetailsDialog from "../../components/common/FacultyDetailsDialog"; // Added

export default function HODTasks(props) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const context = props.context || {};
    const projectIdParam = context.navState?.projectId || searchParams.get('projectId');

    // States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analytics, setAnalytics] = useState(null);

    // Specific Project State
    const [projectTasks, setProjectTasks] = useState([]);
    const [projectDetails, setProjectDetails] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [internshipSettings, setInternshipSettings] = useState(null);

    // Project Details Dialog State
    const [projectDetailsOpen, setProjectDetailsOpen] = useState(false); // Renamed
    const [projectDetailsData, setProjectDetailsData] = useState(null); // Renamed

    // Faculty Details Dialog State
    const [facultyDetailsOpen, setFacultyDetailsOpen] = useState(false); // Added
    const [selectedFacultyName, setSelectedFacultyName] = useState(""); // Added
    const [searchQuery, setSearchQuery] = useState("");
    const [taskSearchQuery, setTaskSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);

    const handleProjectTitleClick = async (projectId) => {
        try {
            const res = await apiFetch(`/api/projects/${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setProjectDetailsData(data.data || data.project || data); // Renamed
                setProjectDetailsOpen(true); // Renamed
            }
        } catch (err) {
            console.error("Failed to load project details", err);
        }
    };

    useEffect(() => {
        if (projectIdParam) {
            fetchProjectTasks(projectIdParam, 1);
        } else {
            fetchDepartmentAnalytics();
        }
    }, [projectIdParam]);

    useEffect(() => {
        apiFetch("/api/admin/settings/internship")
            .then(r => r.ok ? r.json() : null)
            .then(data => data && setInternshipSettings(data))
            .catch(err => console.error(err));
    }, []);

    const fetchDepartmentAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/api/analytics/department");
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
            } else {
                setError("Failed to load department daily status analytics.");
            }
        } catch (err) {
            setError("Error loading data. Please check your network connection.");
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectTasks = async (projId, pageNumber = 1) => {
        setLoading(true);
        setError(null);
        try {
            // Parallel fetch for tasks, project details, and submissions
            const [tasksRes, projRes, subsRes] = await Promise.all([
                apiFetch(`/api/tasks/admin?projectId=${projId}`),
                apiFetch(`/api/projects/${projId}`),
                apiFetch(`/api/tasks/faculty/project/${projId}/submissions`)
            ]);

            if (tasksRes.ok && projRes.ok) {
                const tasksData = await tasksRes.json();
                const projData = await projRes.json();
                const subsData = subsRes.ok ? await subsRes.json() : [];

                setProjectTasks(tasksData.data || []);
                setPage(tasksData.page || 1);
                setTotalPages(tasksData.totalPages || 1);
                setSubmissions(subsData || []);

                setProjectDetails(projData.data || projData.project || projData);
            } else {
                setError("Failed to load project details or tasks.");
            }
        } catch (err) {
            setError("Error loading project tasks. Make sure backend endpoints are available for HODs.");
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (event, value) => {
        fetchProjectTasks(projectIdParam, value);
    };

    const handleFacultyClick = (name, e) => {
        if (e) e.stopPropagation();
        setSelectedFacultyName(name);
        setFacultyDetailsOpen(true);
    };

    const filteredProjectStats = (analytics?.projectStats || []).filter(p => {
        const query = searchQuery.toLowerCase();
        const title = (p.projectTitle || "").toLowerCase();
        return title.includes(query) ||
            (p.displayId || "").toLowerCase().includes(query) ||
            (p.guide || "").toLowerCase().includes(query) ||
            (p.coGuide || "").toLowerCase().includes(query);
    });

    const displayedTasks = useMemo(() => {
        if (!taskSearchQuery) return projectTasks;
        const q = taskSearchQuery.toLowerCase();
        return projectTasks.filter(t =>
            (t.title || "").toLowerCase().includes(q) ||
            (t.description || "").toLowerCase().includes(q) ||
            (t.startDate && String(t.startDate).toLowerCase().includes(q)) ||
            (t.deadline && String(t.deadline).toLowerCase().includes(q))
        );
    }, [projectTasks, taskSearchQuery]);

    const currentProjectStats = useMemo(() => {
        if (!analytics?.projectStats || !projectIdParam) return null;
        return analytics.projectStats.find(p => String(p.projectId) === String(projectIdParam));
    }, [analytics, projectIdParam]);

    if (loading) return <Box sx={{ p: 4, textAlign: 'center', mt: 10 }}><CircularProgress /></Box>;

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {!projectIdParam ? (
                // --- DEPARTMENT ANALYTICS VIEW ---
                <>
                    <PageHeader title="Daily Status" subtitle="High-level overview of submission and completion progress" />

                    {analytics && analytics.overall && (
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                <Card sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f0f9ff', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box>
                                                <Typography variant="overline" color="#0369a1" fontWeight="bold">Total Tasks</Typography>
                                                <Typography variant="h3" color="#0c4a6e" fontWeight="900">
                                                    {analytics.overall.totalTasks}
                                                </Typography>
                                            </Box>
                                            <AssignmentIcon sx={{ fontSize: 40, color: '#0369a1', opacity: 0.8 }} />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                <Card sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fdf4ff', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box>
                                                <Typography variant="overline" color="#15803d" fontWeight="bold">Submissions</Typography>
                                                <Typography variant="h3" color="#14532d" fontWeight="900">
                                                    {analytics.overall.totalSubmissions}
                                                </Typography>
                                            </Box>
                                            <AssignmentTurnedInIcon sx={{ fontSize: 40, color: '#15803d', opacity: 0.8 }} /> {/* Changed icon */}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                <Card sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f0fdf4', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box>
                                                <Typography variant="overline" color="#6d28d9" fontWeight="bold">Completion%</Typography>
                                                <Typography variant="h3" color="#4c1d95" fontWeight="900">
                                                    {(Number(analytics.overall.averageCompletion) || 0).toFixed(1)}%
                                                </Typography>
                                            </Box>
                                            <CheckCircleIcon sx={{ fontSize: 40, color: '#6d28d9', opacity: 0.8 }} />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
                                <Card sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fef2f2', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box>
                                                <Typography variant="overline" color="#b45309" fontWeight="bold">Delay Rate</Typography>
                                                <Typography variant="h3" color="#78350f" fontWeight="900">
                                                    {(Number(analytics.overall.delayRate) || 0).toFixed(1)}%
                                                </Typography>
                                            </Box>
                                            <HourglassEmptyIcon sx={{ fontSize: 40, color: '#b45309', opacity: 0.8 }} />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}

                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" fontWeight="800">Project Action Items</Typography>
                            <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                                <SearchBar
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClear={() => setSearchQuery("")}
                                    isFocused={searchFocused}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setSearchFocused(false)}
                                    placeholder="Search Data"
                                />
                            </Stack>
                        </Box>
                        <DataTable
                            columns={[
                                {
                                    id: "projectTitle",
                                    label: "Project",
                                    minWidth: 280,
                                    render: p => (
                                        <Box>
                                            <Typography
                                                fontWeight="700"
                                                color="primary.main"
                                                noWrap
                                                sx={{
                                                    cursor: 'pointer',
                                                    maxWidth: { xs: 180, sm: 250, md: '25vw' },
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    '&:hover': { textDecoration: 'underline' }
                                                }}
                                                onClick={() => navigate(`/hod/tasks?projectId=${p.projectId}`)}
                                                title={p.projectTitle}
                                            >
                                                {p.projectTitle}
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                                                {p.displayId || "N/A"} • {(analytics?.overall?.departmentId || "Department")}
                                            </Typography>
                                        </Box>
                                    )
                                },
                                {
                                    id: "guide", label: "Guide", minWidth: 160, render: p => p.guide ? (
                                        <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden', '&:hover': { textDecoration: 'underline' } }} onClick={(e) => handleFacultyClick(p.guide, e)} title={p.guide}>{p.guide}</Typography>
                                    ) : "-"
                                },
                                {
                                    id: "coGuide", label: "Co-Guide", minWidth: 160, render: p => p.coGuide ? (
                                        <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden', '&:hover': { textDecoration: 'underline' } }} onClick={(e) => handleFacultyClick(p.coGuide, e)} title={p.coGuide}>{p.coGuide}</Typography>
                                    ) : "-"
                                },
                                { id: "totalTasks", label: "Total Tasks", minWidth: 100 },
                                { id: "completedTasks", label: "Completed", minWidth: 100, render: p => p.completedTasks || 0 },
                                {
                                    id: "actions", label: "Actions", minWidth: 120, align: "right", render: p => (
                                        <Tooltip title="View Tasks" arrow placement="top">
                                            <IconButton color="primary" onClick={() => navigate(`/hod/tasks?projectId=${p.projectId}`)}>
                                                <AssignmentIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )
                                }
                            ]}
                            rows={filteredProjectStats}
                            emptyMessage="No project task statistics found in your department."
                            loading={false}
                        />
                    </Paper>
                </>
            ) : (
                // --- SPECIFIC PROJECT TASKS VIEW ---
                <>
                    <PageHeader
                        title={projectDetails?.title || "Daily Status"}
                        subtitle={`Daily status tracking for ${projectDetails?.projectId || ''}`}
                        action={
                            <Stack direction="row" spacing={2} alignItems="center">
                                <SearchBar
                                    value={taskSearchQuery}
                                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                                    onClear={() => setTaskSearchQuery("")}
                                    placeholder="Search Data"
                                />
                                <Button
                                    variant="outlined"
                                    startIcon={<ArrowBackIcon />}
                                    onClick={() => navigate('/hod/tasks')}
                                >
                                    Back
                                </Button>
                            </Stack>
                        }
                    />

                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <AssignmentIcon sx={{ color: '#0369a1' }} />
                                            <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800 }}>Total Tasks</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#0c4a6e">{currentProjectStats?.totalTasks || 0}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '1px solid #a7f3d0', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <AssignmentTurnedInIcon sx={{ color: '#047857' }} />
                                            <Typography variant="caption" sx={{ color: '#047857', fontWeight: 800 }}>Completed</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#064e3b">{currentProjectStats?.completedTasks || 0}</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <CheckCircleIcon sx={{ color: '#6d28d9' }} />
                                            <Typography variant="caption" sx={{ color: '#6d28d9', fontWeight: 800 }}>Avg Completion</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#4c1d95">{Math.round(currentProjectStats?.averageCompletion || 0)}%</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', border: '1px solid #fecaca', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <HourglassEmptyIcon sx={{ color: '#b91c1c' }} />
                                            <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 800 }}>Delay Rate</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#7f1d1d">{(currentProjectStats?.delayRate || 0).toFixed(1)}%</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, mb: 4 }}>
                        <DataTable
                            columns={[
                                { id: "order", label: "Day", minWidth: 80, render: t => <Typography variant="body2" fontWeight="bold">Day {t.order || '-'}</Typography> },
                                {
                                    id: "title", label: "Task", minWidth: 200, render: t => (
                                        <Box>
                                            <Typography fontWeight="bold" color="text.primary" variant="subtitle2">{t.title}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {t.description}
                                            </Typography>
                                        </Box>
                                    )
                                },
                                {
                                    id: "dates", label: "Schedule", minWidth: 150, render: t => (
                                        <Box>
                                            <Typography variant="caption" display="block">Start: {t.startDate || "N/A"}</Typography>
                                            <Typography variant="caption" color="error">End: {t.deadline || "N/A"}</Typography>
                                        </Box>
                                    )
                                },
                                {
                                    id: "status", label: "Status", minWidth: 140, render: t => <StatusChip status={t.status || "Not Submitted"} />
                                },
                                {
                                    id: "remarks", label: "Faculty Remarks", minWidth: 200, render: t => (
                                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }} noWrap title={t.remarks}>
                                            {t.remarks || "-"}
                                        </Typography>
                                    )
                                }
                            ]}
                            rows={displayedTasks}
                            emptyMessage={`No tasks have been assigned to ${projectDetails?.title || 'this project'} yet.`}
                            loading={false}
                        />

                        {totalPages > 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3, borderTop: '1px solid #e2e8f0' }}>
                                <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" />
                            </Box>
                        )}
                    </Card>
                </>
            )}

            {/* Project Details Dialog */}
            <ProjectDetailsDialog
                open={projectDetailsOpen} // Renamed
                onClose={() => setProjectDetailsOpen(false)} // Renamed
                project={projectDetailsData} // Renamed
                renderStatus={proj => <StatusChip status={proj.status} />}
                customActions={<Button onClick={() => setProjectDetailsOpen(false)}>Close</Button>} // Updated customActions
            />

            {/* Faculty Details Dialog */}
            <FacultyDetailsDialog
                open={facultyDetailsOpen}
                onClose={() => setFacultyDetailsOpen(false)}
                facultyName={selectedFacultyName}
            />
        </Box>
    );
}
