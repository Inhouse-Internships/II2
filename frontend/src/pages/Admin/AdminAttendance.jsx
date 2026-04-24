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
    Select,
    MenuItem,
    InputLabel,
    FormControl,
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
    OpenInNew as OpenInNewIcon,
    Assignment as AssignmentIcon,
    People as PeopleIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    WorkspacePremium as WorkspacePremiumIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import StatusChip from '../../components/common/StatusChip';
import ProjectDetailsDialog from '../../components/common/ProjectDetailsDialog';


// --- COMPONENTS ---

const StudentAttendanceIndicator = ({ student }) => {
    const percentage = Math.round(student.percentage || 0);
    const color = percentage >= 75 ? 'success' : percentage >= 60 ? 'warning' : 'error';

    return (
        <Tooltip
            title={
                <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{student.name}</Typography>
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

export default function AdminAttendance(props) {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const context = props.context || {};
    const projectIdParam = context.navState?.projectId || searchParams.get('projectId');
    const markMode = searchParams.get('mode') === 'mark' || !!context.navState?.projectId;

    // Local state override for mark mode (works inside section-based sidebar)
    const [localMarkMode, setLocalMarkMode] = useState(false);
    const [localProjectId, setLocalProjectId] = useState(null);

    const effectiveMarkMode = localMarkMode || markMode;
    const effectiveProjectId = localProjectId || projectIdParam;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [analytics, setAnalytics] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [tabIndex, setTabIndex] = useState(0);
    const [filterBy, setFilterBy] = useState('Projects'); // 'Projects' or 'Departments'
    const [selectedDept, setSelectedDept] = useState(null);
    const [detailedRecords, setDetailedRecords] = useState([]);
    const [fetchingDetailed, setFetchingDetailed] = useState(false);

    // Mark view state
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedMarkDept, setSelectedMarkDept] = useState('');
    const [students, setStudents] = useState([]);
    const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
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

    useEffect(() => {
        if (!effectiveMarkMode) {
            fetchAnalytics();
        } else {
            fetchProjects();
        }
    }, [effectiveMarkMode]);

    useEffect(() => {
        if (effectiveMarkMode && projects.length > 0 && effectiveProjectId && !selectedProject) {
            const project = projects.find(p => p._id === effectiveProjectId);
            if (project) {
                setSelectedProject(project);
            }
        }
    }, [projects, effectiveMarkMode, effectiveProjectId]);

    useEffect(() => {
        if (effectiveMarkMode && selectedProject && targetDate) {
            fetchAttendanceDetails();
        }
    }, [selectedProject, targetDate, effectiveMarkMode]);

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

    const fetchDetailedRecords = async () => {
        try {
            setFetchingDetailed(true);
            const res = await apiFetch(`/api/attendance/department?date=${targetDate}`);
            if (res.ok) {
                const data = await res.json();
                setDetailedRecords(data.attendance || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setFetchingDetailed(false);
        }
    };

    useEffect(() => {
        if (tabIndex === 1 && !markMode) {
            fetchDetailedRecords();
        }
    }, [tabIndex, targetDate, markMode]);

    const fetchProjects = async () => {
        try {
            const res = await apiFetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                const list = data.data || data || [];
                setProjects(list);
            }
        } catch (err) { }
    };

    const markDeptOptions = Array.from(
        new Set(
            (projects || [])
                .map(p => p?.baseDept || p?.department)
                .filter(Boolean)
        )
    ).sort();

    const filteredMarkProjects = (projects || []).filter((p) => {
        if (!selectedMarkDept) return true;
        const dept = p?.baseDept || p?.department || '';
        return String(dept) === String(selectedMarkDept);
    });

    useEffect(() => {
        // If selected project is not in filtered list, reset it.
        if (!effectiveMarkMode) return;
        if (!selectedProject) return;
        if (selectedMarkDept && !filteredMarkProjects.some(p => String(p._id) === String(selectedProject._id))) {
            setSelectedProject(null);
        }
    }, [selectedMarkDept, effectiveMarkMode, selectedProject, projects]);

    const fetchAttendanceDetails = async () => {
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
                fetchAttendanceDetails(); // Refresh
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
            return p.title.toLowerCase().includes(q) ||
                (p.projectId || '').toLowerCase().includes(q) ||
                (p.baseDept || '').toLowerCase().includes(q) ||
                (p.guide || '').toLowerCase().includes(q) ||
                (p.coGuide || '').toLowerCase().includes(q);
        });

    const deptOptions = Array.from(new Set(analytics.map(p => p.baseDept).filter(Boolean))).sort();

    const deptRows = deptOptions.map(d => {
        const deptProjects = analytics.filter(p => p.baseDept === d);
        let totalSum = 0; let count = 0;
        deptProjects.forEach(p => {
            if (typeof p.overallAverage === 'number') { totalSum += p.overallAverage; count++; }
        });
        const avgCompletion = count > 0 ? (totalSum / count).toFixed(1) : "0.0";
        return { name: d, deptProjects, avgCompletion };
    });

    const projectColumns = [
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
        { id: "guide", label: "Guide", minWidth: 150 },
        { id: "coGuide", label: "Co-Guide", minWidth: 150 },
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
                        <LinearProgress variant="determinate" value={avg} sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                    </Box>
                );
            }
        },
        {
            id: "students",
            label: "Students Attendance",
            minWidth: 200,
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
                        <IconButton color="success" onClick={(e) => { e.stopPropagation(); setLocalMarkMode(true); setLocalProjectId(p._id); }}>
                            <CheckCircleIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="View Daily status">
                        <IconButton color="primary" onClick={(e) => { e.stopPropagation(); if (context.setSection) context.setSection('tasks', { projectId: p._id }); }}>
                            <AssignmentIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            )
        }
    ];

    const deptColumns = [
        { id: 'name', label: 'Department Name', minWidth: 200 },
        { id: 'projects', label: 'Total Projects', minWidth: 150, render: d => <Chip size="small" label={d.deptProjects.length} color="primary" variant="outlined" /> },
        {
            id: 'average', label: 'Dept Avg Attendance', minWidth: 150, render: d => {
                const avg = Math.round(d.avgCompletion || 0);
                const color = avg >= 75 ? '#2e7d32' : avg >= 60 ? '#ed6c02' : '#d32f2f';
                return (
                    <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ color }}>{avg}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={avg} sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                    </Box>
                );
            }
        },
        { id: 'actions', label: 'Actions', minWidth: 120, align: 'right', render: d => <Button variant="outlined" size="small" onClick={() => setSelectedDept(d.name)}>View Projects</Button> }
    ];

    if (!effectiveMarkMode) {
        // --- DASHBOARD VIEW ---
        return (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <PageHeader
                    title="Attendance Overview"
                    action={
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="contained"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => { setLocalMarkMode(true); setLocalProjectId(null); }}
                            >
                                View Attendance
                            </Button>
                        </Box>
                    }
                />

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
                        <Tab label="Manage Attendance" />
                        <Tab label="Detailed Records" />
                        <Tab label="Analytics" />
                    </Tabs>
                </Box>

                {tabIndex === 0 && (
                    <Box>
                        {!selectedDept && (
                            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                                <FormControl size="small" sx={{ minWidth: 200, bgcolor: 'background.paper' }}>
                                    <InputLabel>Filter by</InputLabel>
                                    <Select value={filterBy} label="Filter by" onChange={e => {
                                        setFilterBy(e.target.value);
                                        setSelectedDept(null);
                                    }}>
                                        <MenuItem value="Projects">Projects</MenuItem>
                                        <MenuItem value="Departments">Departments</MenuItem>
                                    </Select>
                                </FormControl>
                                <SearchBar
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClear={() => setSearchQuery('')}
                                    placeholder="Search Data"
                                />
                            </Box>
                        )}
                        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box> : (
                            <>
                                {filterBy === 'Projects' && !selectedDept && (
                                    <DataTable columns={projectColumns} rows={filteredAnalytics} />
                                )}

                                {filterBy === 'Departments' && !selectedDept && (
                                    <DataTable columns={deptColumns} rows={deptRows} />
                                )}

                                {filterBy === 'Departments' && selectedDept && (
                                    <Box>
                                        <Button onClick={() => setSelectedDept(null)} sx={{ mb: 2 }} color="inherit">← Back to Departments</Button>
                                        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Projects in {selectedDept}</Typography>
                                        <DataTable columns={projectColumns} rows={analytics.filter(p => p.baseDept === selectedDept)} />
                                    </Box>
                                )}
                            </>
                        )}
                        <ProjectDetailsDialog
                            open={detailsDialogOpen}
                            onClose={() => setDetailsDialogOpen(false)}
                            project={projectForDetails}
                        />
                    </Box>
                )}

                {tabIndex === 1 && (
                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" fontWeight="bold">Detailed Attendance Log</Typography>
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
                                { id: "date", label: "Date", render: r => new Date(r.date).toLocaleDateString() },
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
                                    label: "Location Status",
                                    render: r => (
                                        <Chip
                                            label={r.locationStatus || 'N/A'}
                                            size="small"
                                            variant="outlined"
                                            color={(r.locationStatus === 'Inside Campus') ? 'success' : (r.locationStatus === 'Outside Campus' ? 'error' : 'default')}
                                        />
                                    )
                                },
                                {
                                    id: "timestamp",
                                    label: "Timestamp",
                                    render: r => r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : 'N/A'
                                },
                                {
                                    id: "details",
                                    label: "Geo Details",
                                    render: r => r.latitude ? (
                                        <Tooltip title={`Lat: ${r.latitude}, Long: ${r.longitude}, Acc: ${r.accuracy}m`}>
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

                {tabIndex === 2 && (
                    <Box>
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <PeopleIcon sx={{ color: '#0369a1' }} />
                                                <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800 }}>Total Projects</Typography>
                                            </Box>
                                            <Typography variant="h3" fontWeight={900} color="#0c4a6e">{analytics.length}</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '1px solid #a7f3d0', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <TrendingUpIcon sx={{ color: '#047857' }} />
                                                <Typography variant="caption" sx={{ color: '#047857', fontWeight: 800 }}>Avg Attendance</Typography>
                                            </Box>
                                            <Typography variant="h3" fontWeight={900} color="#064e3b">
                                                {analytics.length > 0 ? Math.round(analytics.reduce((sum, p) => sum + (p.overallAverage || 0), 0) / analytics.length) : 0}%
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', border: '1px solid #fecaca', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <TrendingDownIcon sx={{ color: '#b91c1c' }} />
                                                <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 800 }}>Low Attendance</Typography>
                                            </Box>
                                            <Typography variant="h3" fontWeight={900} color="#7f1d1d">
                                                {analytics.filter(p => (p.overallAverage || 0) < 60).length}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="caption" color="#b91c1c" fontWeight="bold">Projects with &lt; 60% average</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                    <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <WorkspacePremiumIcon sx={{ color: '#6d28d9' }} />
                                                <Typography variant="caption" sx={{ color: '#6d28d9', fontWeight: 800 }}>Excellent</Typography>
                                            </Box>
                                            <Typography variant="h3" fontWeight={900} color="#4c1d95">
                                                {analytics.filter(p => (p.overallAverage || 0) >= 85).length}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="caption" color="#6d28d9" fontWeight="bold">Projects with &ge; 85% average</Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 7 }}>
                                <Paper sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0' }} elevation={0}>
                                    <Typography variant="h6" fontWeight="800" gutterBottom>Department Performance</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Average attendance status per department</Typography>
                                    <Stack spacing={3}>
                                        {deptRows.map((d, i) => (
                                            <Box key={i}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                                                    <Typography variant="body2" fontWeight="600">{d.name}</Typography>
                                                    <Typography variant="caption" fontWeight="bold" color="primary.main">
                                                        {d.avgCompletion}%
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ width: '100%', height: 8, bgcolor: '#f1f5f9', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                                                    <Box sx={{ width: `${Math.min(100, Math.max(0, d.avgCompletion))}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 4, transition: 'width 0.5s ease-in-out' }} />
                                                </Box>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                )}
            </Box>
        );
    }

    // --- MARK ATTENDANCE VIEW ---
    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <PageHeader
                title="View / Mark Attendance"
                action={
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => { setLocalMarkMode(false); setLocalProjectId(null); setSelectedProject(null); setSearchParams({}); }}
                    >
                        Back to Overview
                    </Button>
                }
            />

            <Snackbar open={!!successMsg} autoHideDuration={4000} onClose={() => setSuccessMsg('')} message={successMsg} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ p: 3, mb: 4, borderRadius: 4 }} elevation={0} variant="outlined">
                <Grid container spacing={3} alignItems="center">
                    <Grid size={{ xs: 12, md: 3 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Department</InputLabel>
                            <Select
                                value={selectedMarkDept}
                                label="Department"
                                onChange={(e) => {
                                    setSelectedMarkDept(e.target.value);
                                }}
                            >
                                <MenuItem value="">All Departments</MenuItem>
                                {markDeptOptions.map((d) => (
                                    <MenuItem key={d} value={d}>{d}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Autocomplete
                            options={filteredMarkProjects}
                            getOptionLabel={(p) => p?.title || ''}
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

            {!selectedProject ? <Alert severity="info">Please select a project.</Alert> : (
                <Card sx={{ borderRadius: 4 }} elevation={0} variant="outlined">
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" fontWeight={700}>Attendance List</Typography>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" onClick={() => markAll('Present')}>Mark All Present</Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => markAll('Absent')}>Mark All Absent</Button>
                        </Stack>
                    </Box>
                    <DataTable
                        columns={[
                            { id: "name", label: "Student Name", minWidth: 200, render: s => <Typography variant="body2" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, py: 1 }}>{s.name}</Typography> },
                            { id: "studentId", label: "Regd Number", minWidth: 150 },
                            ...distinctDates.map(date => ({
                                id: `date_${date}`,
                                label: date === new Date().toISOString().split('T')[0] ? `Today (${date})` : date,
                                align: "center",
                                minWidth: 120,
                                render: (s) => (
                                    <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ minWidth: 100 }}>
                                        <Button
                                            size="small"
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
                            }))
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
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
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
