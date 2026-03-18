import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Paper,
    Chip,
    Button,
    Stack,
    Tooltip,
    Grid,
    LinearProgress,
    IconButton,
    TextField,
    Autocomplete,
    Snackbar,
    Tabs,
    Tab
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../core/services/apiFetch';
import attendanceService from '../../core/services/attendanceService';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import SearchBar from '../../components/common/SearchBar';
import {
    CheckCircle as CheckCircleIcon,
    Assignment as AssignmentIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import ProjectDetailsDialog from '../../components/common/ProjectDetailsDialog';
import FacultyDetailsDialog from '../../components/common/FacultyDetailsDialog';

// --- COMPONENTS ---

const StudentAttendanceIndicator = ({ student }) => {
    const percentage = Math.round(student.percentage || 0);
    const color = percentage >= 75 ? 'success' : percentage >= 60 ? 'warning' : 'error';

    return (
        <Tooltip
            title={
                <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{student?.name || "Unknown"}</Typography>
                    <Typography variant="caption" display="block">Regd: {student.studentId}</Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 1, borderTop: '1px solid rgba(255,255,255,0.2)', pt: 0.5 }}>
                        Attendance: {percentage}% ({student.presentDays}/{student.totalDays} days)
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {student.records?.slice(0, 7).reverse().map((r, i) => (
                            <Box
                                key={i}
                                sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: r.status === 'Present' ? '#4caf50' : '#f44336'
                                }}
                                title={`${new Date(r.date).toLocaleDateString()}: ${r.status}`}
                            />
                        ))}
                    </Box>
                </Box>
            }
            arrow
        >
            <Box sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `${color}.light`,
                color: `${color}.dark`,
                fontSize: '0.65rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: `${color}.main`,
                transition: 'transform 0.2s',
                '&:hover': { transform: 'scale(1.2)', zIndex: 1 }
            }}>
                {percentage}%
            </Box>
        </Tooltip>
    );
};

// --- MAIN PAGE ---

export default function HODAttendance(props) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const context = props.context || {};
    const projectIdParam = context.navState?.projectId || searchParams.get('projectId');
    const mode = context.navState?.projectId ? 'mark' : (searchParams.get('mode') || 'dashboard'); // dashboard, mark

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [analytics, setAnalytics] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [tabIndex, setTabIndex] = useState(0);
    const [detailedRecords, setDetailedRecords] = useState([]);
    const [fetchingDetailed, setFetchingDetailed] = useState(false);

    // Shared state
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);

    // Mark view state
    const [students, setStudents] = useState([]);
    const [attendanceForm, setAttendanceForm] = useState({});
    const [originalForm, setOriginalForm] = useState({});
    const [distinctDates, setDistinctDates] = useState([]);

    // Dialog State
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [projectForDetails, setProjectForDetails] = useState(null);
    const [internshipSettings, setInternshipSettings] = useState(null);

    useEffect(() => {
        fetchInternshipSettings();
    }, []);

    const fetchInternshipSettings = async () => {
        try {
            const res = await apiFetch('/api/admin/settings/internship');
            if (res.ok) {
                const data = await res.json();
                setInternshipSettings(data.data || data);
            }
        } catch (err) { }
    };

    const [facultyDetailsOpen, setFacultyDetailsOpen] = useState(false);
    const [selectedFacultyName, setSelectedFacultyName] = useState("");

    const handleFacultyClick = (name, e) => {
        if (e) e.stopPropagation();
        setSelectedFacultyName(name);
        setFacultyDetailsOpen(true);
    };

    useEffect(() => {
        if (mode === 'dashboard') {
            if (tabIndex === 0) fetchAnalytics();
            if (tabIndex === 1) fetchDetailedRecords();
        } else {
            fetchProjects();
        }
    }, [mode, tabIndex, targetDate]);

    useEffect(() => {
        if (mode !== 'dashboard' && projects.length > 0 && projectIdParam && !selectedProject) {
            const project = projects.find(p => p._id === projectIdParam);
            if (project) {
                setSelectedProject(project);
            }
        }
    }, [projects, mode, projectIdParam]);

    useEffect(() => {
        if (mode === 'mark' && selectedProject && targetDate) {
            fetchAttendanceForm();
        }
    }, [selectedProject, targetDate, mode]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/api/attendance/analytics');
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data.data || data || []);
            } else {
                setError('Failed to fetch attendance analytics');
            }
        } catch (err) {
            setError('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await apiFetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data.data || data || []);
            }
        } catch (err) { }
    };

    const fetchDetailedRecords = async () => {
        setFetchingDetailed(true);
        try {
            const res = await apiFetch(`/api/attendance/department?date=${targetDate}`);
            if (res.ok) {
                const data = await res.json();
                setDetailedRecords(data.attendance || []);
            }
        } catch (err) {
            console.error('Error fetching detailed records:', err);
        } finally {
            setFetchingDetailed(false);
        }
    };

    const fetchAttendanceForm = async () => {
        setLoading(true);
        try {
            // Get students for project
            const projRes = await apiFetch(`/api/projects/${selectedProject._id}`);
            let projStudents = [];
            if (projRes.ok) {
                const projData = await projRes.json();
                projStudents = projData.students || projData.project?.students || [];
            }

            if (projStudents.length === 0) {
                const allRes = await apiFetch('/api/admin/students');
                if (allRes.ok) {
                    const allJson = await allRes.json();
                    const allData = allJson.data || allJson;
                    projStudents = (allData.students || allData || []).filter(s => {
                        const sid = s.appliedProject?._id || s.appliedProject;
                        return String(sid) === String(selectedProject._id);
                    });
                }
            }
            setStudents(projStudents);

            // Fetch current marking for all dates
            const attRes = await attendanceService.getProjectAttendance(selectedProject._id);
            if (attRes.ok) {
                const attData = await attRes.json();

                // Extract distinct dates
                const datesSet = new Set();
                (attData.attendance || []).forEach(r => {
                    const d = new Date(r.date).toISOString().split('T')[0];
                    datesSet.add(d);
                });
                datesSet.add(targetDate);
                const sortedDates = Array.from(datesSet).sort((a, b) => new Date(b) - new Date(a)); // Newest first
                setDistinctDates(sortedDates);

                const formState = {};
                projStudents.forEach(s => {
                    formState[s._id] = {};
                });

                (attData.attendance || []).forEach(r => {
                    const d = new Date(r.date).toISOString().split('T')[0];
                    const sId = String(r.studentId?._id || r.studentId);
                    if (formState[sId]) {
                        formState[sId][d] = r.attendanceStatus;
                    }
                });
                setAttendanceForm(formState);
                setOriginalForm(JSON.parse(JSON.stringify(formState)));
            }
        } catch (err) {
            setError('Failed to load project details');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAttendance = async () => {
        const groupedByDate = {};
        let hasChanges = false;

        Object.keys(attendanceForm).forEach(sId => {
            Object.keys(attendanceForm[sId]).forEach(date => {
                const status = attendanceForm[sId][date];
                const origStatus = originalForm[sId]?.[date];
                if (status !== origStatus) {
                    if (!groupedByDate[date]) groupedByDate[date] = [];
                    groupedByDate[date].push({ studentId: sId, attendanceStatus: status, remarks: '' });
                    hasChanges = true;
                }
            });
        });

        if (!hasChanges) {
            setSuccessMsg('No changes to save');
            return;
        }

        setLoading(true);
        try {
            let allOk = true;
            for (const date of Object.keys(groupedByDate)) {
                const res = await attendanceService.markAttendance(selectedProject._id, date, groupedByDate[date]);
                if (!res.ok) allOk = false;
            }
            if (allOk) {
                setSuccessMsg('Attendance saved successfully');
                fetchAttendanceForm();
            } else {
                setError('Failed to save some records');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const markAll = (status) => {
        const newForm = { ...attendanceForm };
        students.forEach(s => {
            newForm[s._id] = { ...(newForm[s._id] || {}) };
            newForm[s._id][targetDate] = status;
        });
        setAttendanceForm(newForm);
    };

    const filteredAnalytics = [...analytics]
        .sort((a, b) => b._id.localeCompare(a._id))
        .filter(p => {
            const q = searchQuery.toLowerCase();
            const title = (p.title || "").toLowerCase();
            return title.includes(q) ||
                (p.projectId || '').toLowerCase().includes(q) ||
                (p.baseDept || '').toLowerCase().includes(q) ||
                (p.guide || '').toLowerCase().includes(q) ||
                (p.coGuide || '').toLowerCase().includes(q);
        });

    // --- RENDER DASHBOARD ---
    if (mode === 'dashboard') {
        return (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <PageHeader
                    title="Attendance Overview"
                    subtitle="Monitor attendance across department projects"
                    action={
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {tabIndex === 0 && (
                                <SearchBar
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClear={() => setSearchQuery('')}
                                    placeholder="Search Data"
                                />
                            )}
                            <Button
                                variant="contained"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => setSearchParams({ mode: 'mark' })}
                            >
                                View Attendance
                            </Button>
                        </Box>
                    }
                />

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
                        <Tab label="Project Summary" />
                        <Tab label="Detailed Log" />
                    </Tabs>
                </Box>

                {tabIndex === 0 && (
                    <>
                        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box> : (
                            <DataTable
                                columns={[
                                    {
                                        id: "title",
                                        label: "Project",
                                        minWidth: 250,
                                        render: (p) => (
                                            <Box>
                                                <Typography noWrap variant="subtitle2" fontWeight={700} color="primary.main" title={p.title} onClick={() => { setProjectForDetails(p); setDetailsDialogOpen(true); }} sx={{
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    maxWidth: { xs: 180, sm: 250, md: '25vw' },
                                                    cursor: 'pointer',
                                                    '&:hover': { textDecoration: 'underline' }
                                                }}>{p.title}</Typography>
                                                <Typography variant="caption" color="textSecondary">{p.projectId} • {p.baseDept}</Typography>
                                            </Box>
                                        )
                                    },
                                    {
                                        id: "guide", label: "Guide", minWidth: 150, render: p => p.guide ? (
                                            <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden', '&:hover': { textDecoration: 'underline' } }} onClick={(e) => handleFacultyClick(p.guide, e)} title={p.guide}>{p.guide}</Typography>
                                        ) : "-"
                                    },
                                    {
                                        id: "coGuide", label: "Co-Guide", minWidth: 150, render: p => p.coGuide ? (
                                            <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden', '&:hover': { textDecoration: 'underline' } }} onClick={(e) => handleFacultyClick(p.coGuide, e)} title={p.coGuide}>{p.coGuide}</Typography>
                                        ) : "-"
                                    },
                                    {
                                        id: "average",
                                        label: "Project Avg",
                                        minWidth: 150,
                                        render: (p) => {
                                            const avg = Math.round(p.overallAverage || 0);
                                            const color = avg >= 75 ? '#2e7d32' : avg >= 60 ? '#ed6c02' : '#d32f2f';
                                            return (
                                                <Box sx={{ width: '100%' }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                        <Typography variant="body2" fontWeight={700} sx={{ color }}>{avg}%</Typography>
                                                    </Box>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={avg}
                                                        sx={{
                                                            height: 6,
                                                            borderRadius: 3,
                                                            bgcolor: '#e2e8f0',
                                                            '& .MuiLinearProgress-bar': { bgcolor: color }
                                                        }}
                                                    />
                                                </Box>
                                            );
                                        }
                                    },
                                    {
                                        id: "students",
                                        label: "Students Attendance",
                                        minWidth: 350,
                                        render: (p) => (
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ py: 0.5 }}>
                                                {p.studentStats?.map((s) => (
                                                    <StudentAttendanceIndicator key={s._id} student={s} />
                                                ))}
                                            </Stack>
                                        )
                                    },
                                    {
                                        id: "actions",
                                        label: "Manage",
                                        align: "center",
                                        minWidth: 100,
                                        render: (p) => (
                                            <Stack direction="row" spacing={0.5} justifyContent="center">
                                                <Tooltip title="View Attendance">
                                                    <IconButton color="success" onClick={() => setSearchParams({ mode: 'mark', projectId: p._id })}>
                                                        <CheckCircleIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="View Daily Status">
                                                    <IconButton color="primary" onClick={() => navigate(`/hod/tasks?projectId=${p._id}`)}>
                                                        <AssignmentIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        )
                                    }
                                ]}
                                rows={filteredAnalytics}
                            />
                        )}
                    </>
                )}

                {tabIndex === 1 && (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" fontWeight="bold">Detailed Log - {targetDate}</Typography>
                            <TextField
                                type="date"
                                size="small"
                                label="Filter Date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Box>
                        <DataTable
                            loading={fetchingDetailed}
                            columns={[
                                { id: "sno", label: "S.No", render: (row, i) => i + 1 },
                                { id: "studentName", label: "Student Name", render: r => r.studentId?.name || 'N/A' },
                                { id: "regNo", label: "Register Number", render: r => r.studentId?.studentId || 'N/A' },
                                { id: "project", label: "Project Title", render: r => r.projectId?.title || 'N/A' },
                                {
                                    id: "status",
                                    label: "Status",
                                    render: r => (
                                        <Chip
                                            label={r.attendanceStatus}
                                            size="small"
                                            color={r.attendanceStatus === 'Present' ? 'success' : r.attendanceStatus === 'Denied' ? 'error' : 'default'}
                                        />
                                    )
                                },
                                {
                                    id: "locationStatus",
                                    label: "Geo Status",
                                    render: r => (
                                        <Chip
                                            label={r.locationStatus || 'N/A'}
                                            size="small"
                                            variant="outlined"
                                            color={r.locationStatus === 'Inside Campus' ? 'success' : (r.locationStatus === 'Outside Campus' ? 'error' : 'default')}
                                        />
                                    )
                                },
                                {
                                    id: "timestamp",
                                    label: "Marked At",
                                    render: r => r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : 'N/A'
                                },
                                {
                                    id: "details",
                                    label: "Coordinates",
                                    render: r => r.latitude ? (
                                        <Tooltip title={`Accuracy: ${r.accuracy}m | IP: ${r.ipAddress || 'Unknown'}`}>
                                            <Typography variant="caption" sx={{ cursor: 'help' }}>
                                                {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                                            </Typography>
                                        </Tooltip>
                                    ) : '-'
                                }
                            ]}
                            rows={detailedRecords}
                        />
                    </Box>
                )}
                <ProjectDetailsDialog
                    open={detailsDialogOpen}
                    onClose={() => setDetailsDialogOpen(false)}
                    project={projectForDetails}
                />
                <FacultyDetailsDialog
                    open={facultyDetailsOpen}
                    onClose={() => setFacultyDetailsOpen(false)}
                    facultyName={selectedFacultyName}
                />
                <Snackbar open={!!successMsg} autoHideDuration={4000} onClose={() => setSuccessMsg('')} message={successMsg} />
            </Box>
        );
    }

    // --- RENDER MARK VIEW ---
    const isToday = targetDate === new Date().toISOString().split('T')[0];

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <PageHeader
                title="View / Mark Attendance"
                subtitle="View or mark student attendance for a specific project. Note: Edits restricted to today's date."
                action={
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => setSearchParams({})}
                    >
                        Back to Overview
                    </Button>
                }
            />

            <Snackbar open={!!successMsg} autoHideDuration={4000} onClose={() => setSuccessMsg('')} message={successMsg} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ p: 3, mb: 4, borderRadius: 4 }} elevation={0} variant="outlined">
                <Grid container spacing={3} alignItems="center">
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Autocomplete
                            options={projects}
                            getOptionLabel={(p) => `${p.title} (${p.projectId})`}
                            value={selectedProject}
                            onChange={(e, v) => setSelectedProject(v)}
                            renderInput={(params) => <TextField {...params} label="Select Project" size="small" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            type="date"
                            label="Target Date"
                            fullWidth
                            size="small"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            inputProps={{
                                min: internshipSettings?.startDate || undefined,
                                max: internshipSettings?.endDate || undefined
                            }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {!selectedProject ? <Alert severity="info">Please select a project to continue.</Alert> : (
                <Card sx={{ borderRadius: 4 }} elevation={0} variant="outlined">
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" fontWeight={700}>Attendance List</Typography>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" disabled={!isToday} onClick={() => markAll('Present')}>Mark All Present</Button>
                            <Button size="small" variant="outlined" color="error" disabled={!isToday} onClick={() => markAll('Absent')}>Mark All Absent</Button>
                        </Stack>
                    </Box>
                    <DataTable
                        loading={loading}
                        columns={[
                            { id: "name", label: "Student Name", minWidth: 200, render: s => <Typography variant="body2" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, py: 1 }}>{s.name}</Typography> },
                            { id: "studentId", label: "Regd Number", minWidth: 150 },
                            ...distinctDates.map(date => {
                                const isDateToday = date === new Date().toISOString().split('T')[0];
                                return {
                                    id: `date_${date}`,
                                    label: isDateToday ? `Today (${date})` : date,
                                    align: "center",
                                    minWidth: 120,
                                    render: (s) => (
                                        <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ minWidth: 100 }}>
                                            <Button
                                                size="small"
                                                disabled={!isDateToday}
                                                variant={attendanceForm[s._id]?.[date] === 'Present' ? "contained" : "outlined"}
                                                color="success"
                                                sx={{ minWidth: 32, p: 0.5, borderRadius: 1 }}
                                                onClick={() => {
                                                    const newForm = { ...attendanceForm };
                                                    newForm[s._id] = { ...(newForm[s._id] || {}) };
                                                    newForm[s._id][date] = 'Present';
                                                    setAttendanceForm(newForm);
                                                }}
                                            >P</Button>
                                            <Button
                                                size="small"
                                                disabled={!isDateToday}
                                                variant={attendanceForm[s._id]?.[date] === 'Absent' ? "contained" : "outlined"}
                                                color="error"
                                                sx={{ minWidth: 32, p: 0.5, borderRadius: 1 }}
                                                onClick={() => {
                                                    const newForm = { ...attendanceForm };
                                                    newForm[s._id] = { ...(newForm[s._id] || {}) };
                                                    newForm[s._id][date] = 'Absent';
                                                    setAttendanceForm(newForm);
                                                }}
                                            >A</Button>
                                        </Stack>
                                    )
                                };
                            })
                        ]}
                        rows={students}
                        hover={false}
                        getRowSx={(s) => {
                            const status = attendanceForm[s._id]?.[targetDate];
                            if (status === 'Present') return { bgcolor: 'rgba(16, 185, 129, 0.08)' };
                            if (status === 'Absent') return { bgcolor: 'rgba(239, 68, 68, 0.08)' };
                            return {};
                        }}
                    />
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0' }}>
                        <Typography variant="body2" color="text.secondary">Editing is restricted to today's date.</Typography>
                        <Button variant="contained" size="large" onClick={handleSaveAttendance} disabled={loading}>
                            {loading ? <CircularProgress size={24} /> : 'Save Attendance'}
                        </Button>
                    </Box>
                </Card>
            )}

            <ProjectDetailsDialog
                open={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                project={projectForDetails}
            />
        </Box>
    );
}
