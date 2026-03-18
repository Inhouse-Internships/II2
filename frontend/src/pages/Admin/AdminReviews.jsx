import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    TextField,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Autocomplete,
    Grid,
    Menu,
    LinearProgress
} from '@mui/material';
import {
    KeyboardArrowDown as KeyboardArrowDownIcon,
    FilterAlt as FilterAltIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Visibility as VisibilityIcon
} from "@mui/icons-material";

import reviewService from '../../core/services/reviewService';
import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import useRequireRole from '../../core/hooks/useRequireRole';
import { ROLES } from '../../core/constants/roles';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ProjectDetailsDialog from '../../components/common/ProjectDetailsDialog';

export default function AdminReviews(props) {
    const context = props.context || {};
    const { user } = useRequireRole([ROLES.ADMIN, ROLES.HOD]);
    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [error, setError] = useState('');

    // Filter states
    const [reviewType, setReviewType] = useState('Review 1');
    const [titles, setTitles] = useState(['Review 1', 'Review 2', 'Review 3']);
    const [department, setDepartment] = useState('');
    const [departments, setDepartments] = useState([]);

    // View modes: 'DEPARTMENT' or 'TITLE'
    const [viewMode, setViewMode] = useState('TITLE');
    const [viewAnchor, setViewAnchor] = useState(null);

    // Anchor states for dropdown menus
    const [deptAnchor, setDeptAnchor] = useState(null);

    // Filter states
    const [selectedProjectId, setSelectedProjectId] = useState(context.navState?.projectId || null);
    const [summaryFilter, setSummaryFilter] = useState('all');

    // Data states
    const [summary, setSummary] = useState({ totalProjects: 0, completed: 0, scheduled: 0, pending: 0 });
    const [deptStats, setDeptStats] = useState([]);
    const [projectStats, setProjectStats] = useState([]);
    const [detailedList, setDetailedList] = useState([]);

    // Project management states (for scheduling)
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectReviews, setProjectReviews] = useState([]);

    // Dialog states
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [evalOpen, setEvalOpen] = useState(false);
    const [detailedOpen, setDetailedOpen] = useState(false);
    const [currentEvalReview, setCurrentEvalReview] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [reviewToDelete, setReviewToDelete] = useState(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

    // Form states for scheduling
    const [newReview, setNewReview] = useState({
        title: '',
        description: '',
        scheduledAt: '',
        evaluationCriteria: [{ label: 'Implementation & Output', maxMarks: 20 }]
    });

    // Form states for evaluation
    const [evalForm, setEvalForm] = useState({
        scores: [],
        feedback: '',
        completionPercentage: '',
        implementationStatus: 'Pending',
        output: ''
    });

    useEffect(() => {
        fetchDepartments();
        fetchProjects();
        fetchTitles();
        if (user?.role === ROLES.HOD && user?.department) {
            setDepartment(user.department);
        }
    }, [user]);

    const fetchTitles = async () => {
        try {
            const res = await reviewService.getReviewTitles();
            if (res.ok) {
                const data = await res.json();
                setTitles(data.titles || []);
                if (data.titles.length > 0 && !data.titles.includes(reviewType)) {
                    setReviewType(data.titles[0]);
                }
            }
        } catch (err) {
            console.error('Fetch Titles Error:', err);
        }
    };


    useEffect(() => {
        fetchStats();
    }, [department, selectedProjectId, reviewType]);

    const fetchDepartments = async () => {
        try {
            const res = await apiFetch('/api/departments');
            if (res.ok) {
                const data = await res.json();
                setDepartments(data.data || data || []);
            }
        } catch (err) {
            console.error('Fetch Departments Error:', err);
        }
    };

    const fetchProjects = async () => {
        try {
            let url = '/api/projects';
            if (user?.role === ROLES.HOD && user?.department) {
                url += `?baseDept=${user.department}`;
            }
            const res = await apiFetch(url);
            if (res.ok) {
                const data = await res.json();
                setProjects(data.data || data || []);
            }
        } catch (err) {
            console.error('Fetch Projects Error:', err);
        }
    };

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const res = await reviewService.getAdminStats(reviewType, department, selectedProjectId);
            if (res.ok) {
                const data = await res.json();
                setSummary(data.summary);
                setDeptStats(data.deptStats);
                setProjectStats(data.projectStats || []);
            }
        } catch (err) {
            console.error('Fetch Stats Error:', err);
            setError('Failed to fetch review statistics');
        } finally {
            setStatsLoading(false);
        }
    };

    const handleReviewClick = async (type, dept) => {
        setLoading(true);
        try {
            const res = await reviewService.getDetailedList(type, dept || department, selectedProjectId);
            if (res.ok) {
                const data = await res.json();
                setDetailedList(data.detailedList);
                setDetailedOpen(true);
            }
        } catch (err) {
            console.error('Fetch Detailed List Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedProject) {
            fetchProjectReviews();
        }
    }, [selectedProject]);

    const fetchProjectReviews = async () => {
        try {
            const res = await reviewService.getProjectReviews(selectedProject._id);
            if (res.ok) {
                const data = await res.json();
                setProjectReviews(data.reviews || []);
            }
        } catch (err) {
            console.error('Fetch Project Reviews Error:', err);
        }
    };

    // --- Scheduling & Evaluation Logic ---
    const handleScheduleSubmit = async () => {
        if (!newReview.scheduledAt) {
            alert("Please select a date and time");
            return;
        }
        try {
            const res = await reviewService.createReview({
                projectId: selectedProject._id,
                ...newReview
            });
            if (res.ok) {
                setScheduleOpen(false);
                fetchProjectReviews();
                fetchStats();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to schedule review");
            }
        } catch (err) {
            alert("Server error scheduling review");
        }
    };

    const handleAddCriteria = () => {
        setNewReview(prev => ({
            ...prev,
            evaluationCriteria: [...prev.evaluationCriteria, { label: '', maxMarks: 10 }]
        }));
    };

    const handleCriteriaChange = (index, field, value) => {
        const updated = [...newReview.evaluationCriteria];
        updated[index][field] = value;
        setNewReview(prev => ({ ...prev, evaluationCriteria: updated }));
    };

    const handleRemoveCriteria = (index) => {
        const updated = newReview.evaluationCriteria.filter((_, i) => i !== index);
        setNewReview(prev => ({ ...prev, evaluationCriteria: updated }));
    };

    const openEvaluationPanel = (review) => {
        setCurrentEvalReview(review);
        if (review.status === 'COMPLETED') {
            setEvalForm({
                scores: review.scores || [],
                feedback: review.feedback || '',
                completionPercentage: review.completionPercentage || '',
                implementationStatus: review.implementationStatus || 'Pending',
                output: review.output || ''
            });
        } else {
            setEvalForm({
                scores: review.evaluationCriteria.map(c => ({ label: c.label, awardedMarks: 0 })),
                feedback: '',
                completionPercentage: '',
                implementationStatus: 'Pending',
                output: ''
            });
        }
        setEvalOpen(true);
    };

    const handleScoreChange = (label, val) => {
        setEvalForm(prev => {
            const updatedScores = prev.scores.map(sc => sc.label === label ? { ...sc, awardedMarks: Number(val) } : sc);
            return { ...prev, scores: updatedScores };
        });
    };

    const handleFeedbackChange = (field, val) => {
        setEvalForm(prev => ({ ...prev, [field]: val }));
    };

    const handleSubmitEvaluation = async () => {
        try {
            const payload = {
                scores: evalForm.scores,
                totalScore: evalForm.scores.reduce((sum, s) => sum + (s.awardedMarks || 0), 0),
                feedback: evalForm.feedback,
                completionPercentage: Number(evalForm.completionPercentage) || 0,
                implementationStatus: evalForm.implementationStatus,
                output: evalForm.output
            };

            const res = await reviewService.submitEvaluation(currentEvalReview._id, payload);
            if (res.ok) {
                setEvalOpen(false);
                fetchProjectReviews();
                fetchStats();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to submit evaluation");
            }
        } catch (err) {
            alert("Server error submitting evaluation");
        }
    };

    const handleDeleteReview = (id) => {
        setReviewToDelete(id);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteReview = async () => {
        if (!reviewToDelete) return;
        try {
            const res = await reviewService.deleteReview(reviewToDelete);
            if (res.ok) {
                fetchProjectReviews();
                fetchStats();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to delete");
            }
        } catch (err) {
            alert("Server error deleting review");
        } finally {
            setDeleteConfirmOpen(false);
            setReviewToDelete(null);
        }
    };

    return (
        <Box sx={{ pb: 4 }}>
            <PageHeader title={user?.role === ROLES.ADMIN ? "Admin Review Management" : "Department Review Management"} />

            {/* Filters Section */}
            <Paper sx={{ p: 2, mb: 4, borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }} elevation={0}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={12}>
                        <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="nowrap" justifyContent="flex-start">
                            <Box sx={{ minWidth: 200 }}>
                                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 0.5, ml: 1 }}>VIEW BY</Typography>
                                <Button
                                    variant="outlined"
                                    onClick={(e) => setViewAnchor(e.currentTarget)}
                                    endIcon={<KeyboardArrowDownIcon />}
                                    sx={{
                                        borderRadius: 3,
                                        bgcolor: 'white',
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        width: '100%',
                                        justifyContent: 'space-between',
                                        border: '1px solid #e2e8f0',
                                        color: '#1e293b',
                                        height: 48,
                                        '&:hover': { bgcolor: '#f1f5f9' }
                                    }}
                                >
                                    {viewMode === 'DEPARTMENT' ? 'Departments' : 'Projects'}
                                </Button>
                                <Menu
                                    anchorEl={viewAnchor}
                                    open={Boolean(viewAnchor)}
                                    onClose={() => setViewAnchor(null)}
                                    PaperProps={{ sx: { borderRadius: 3, mt: 1, minWidth: 180, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' } }}
                                >
                                    <MenuItem onClick={() => { setViewMode('TITLE'); setViewAnchor(null); }} sx={{ fontWeight: 600 }}>Projects</MenuItem>
                                    <MenuItem onClick={() => { setViewMode('DEPARTMENT'); setViewAnchor(null); }} sx={{ fontWeight: 600 }}>Departments</MenuItem>
                                </Menu>
                            </Box>

                            {viewMode === 'TITLE' && (
                                <>
                                    <Box sx={{ minWidth: 220 }}>
                                        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 0.5, ml: 1 }}>DEPARTMENT</Typography>
                                        <Button
                                            variant="outlined"
                                            onClick={(e) => setDeptAnchor(e.currentTarget)}
                                            endIcon={<KeyboardArrowDownIcon />}
                                            disabled={user?.role === ROLES.HOD}
                                            sx={{
                                                borderRadius: 3,
                                                bgcolor: 'white',
                                                textTransform: 'none',
                                                fontWeight: 700,
                                                width: '100%',
                                                justifyContent: 'space-between',
                                                border: '1px solid #e2e8f0',
                                                color: '#1e293b',
                                                height: 48,
                                                '&:hover': { bgcolor: '#f1f5f9' }
                                            }}
                                        >
                                            {department || "All Departments"}
                                        </Button>
                                        <Menu
                                            anchorEl={deptAnchor}
                                            open={Boolean(deptAnchor)}
                                            onClose={() => setDeptAnchor(null)}
                                            PaperProps={{ sx: { borderRadius: 3, mt: 1, minWidth: 220, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' } }}
                                        >
                                            <MenuItem onClick={() => { setDepartment(''); setDeptAnchor(null); }} sx={{ fontWeight: 600, fontSize: '0.9rem' }}>All Departments</MenuItem>
                                            {departments.map((dept) => (
                                                <MenuItem
                                                    key={dept._id}
                                                    selected={dept.name === department}
                                                    onClick={() => { setDepartment(dept.name); setDeptAnchor(null); }}
                                                    sx={{ fontWeight: 600, fontSize: '0.9rem' }}
                                                >
                                                    {dept.name}
                                                </MenuItem>
                                            ))}
                                        </Menu>
                                    </Box>

                                    <Box sx={{ minWidth: 250, flexGrow: 1 }}>
                                        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 0.5, ml: 1 }}>SEARCH PROJECT</Typography>
                                        <Autocomplete
                                            options={projects}
                                            getOptionLabel={(option) => option.title || ""}
                                            value={projects.find(p => p._id === selectedProjectId) || null}
                                            onChange={(event, newValue) => {
                                                setSelectedProjectId(newValue ? newValue._id : null);
                                            }}
                                            filterOptions={(options, { inputValue }) => {
                                                const query = inputValue.toLowerCase();
                                                return options.filter(option =>
                                                    (option.title || '').toLowerCase().includes(query) ||
                                                    (option.projectId || '').toLowerCase().includes(query)
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    placeholder="Search project by title..."
                                                    size="small"
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            borderRadius: 3,
                                                            bgcolor: 'white',
                                                            height: 48
                                                        }
                                                    }}
                                                />
                                            )}
                                        />
                                    </Box>
                                </>
                            )}

                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setScheduleOpen(true)}
                                sx={{
                                    borderRadius: 3,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    px: 3,
                                    height: 48,
                                    boxShadow: 'none',
                                    bgcolor: '#1e293b',
                                    '&:hover': { bgcolor: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }
                                }}
                            >
                                Schedule Review
                            </Button>
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>

            {/* Summary Section */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <Select
                        value={reviewType}
                        onChange={(e) => { setReviewType(e.target.value); setSummaryFilter('all'); }}
                        sx={{ fontWeight: 700, fontSize: '1.1rem', borderRadius: 3, bgcolor: 'white' }}
                    >
                        {titles.map((t) => (
                            <MenuItem key={t} value={t} sx={{ fontWeight: 600 }}>{t}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Typography variant="h6" fontWeight={700}>
                    Summary {department && ` - ${department}`}
                </Typography>
            </Stack>
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <Card
                        onClick={() => setSummaryFilter('all')}
                        sx={{
                            bgcolor: summaryFilter === 'all' ? '#e0e7ff' : '#f8fafc',
                            border: summaryFilter === 'all' ? '2px solid #6366f1' : '1px solid #e2e8f0',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                        }}
                    >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="overline" color="textSecondary" fontWeight={600}>Total Projects</Typography>
                            <Typography variant="h3" fontWeight={800} color="primary.main">
                                {summary.totalProjects}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <Card
                        onClick={() => setSummaryFilter('completed')}
                        sx={{
                            bgcolor: summaryFilter === 'completed' ? '#dcfce7' : '#f0fdf4',
                            border: summaryFilter === 'completed' ? '2px solid #22c55e' : '1px solid #dcfce7',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                        }}
                    >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="overline" color="textSecondary" fontWeight={600}>Completed</Typography>
                            <Typography variant="h3" fontWeight={800} color="success.main">
                                {summary.completed}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <Card
                        onClick={() => setSummaryFilter('scheduled')}
                        sx={{
                            bgcolor: summaryFilter === 'scheduled' ? '#dbeafe' : '#eff6ff',
                            border: summaryFilter === 'scheduled' ? '2px solid #3b82f6' : '1px solid #dbeafe',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                        }}
                    >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="overline" color="textSecondary" fontWeight={600}>Scheduled</Typography>
                            <Typography variant="h3" fontWeight={800} color="info.main">
                                {summary.scheduled || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <Card
                        onClick={() => setSummaryFilter('notScheduled')}
                        sx={{
                            bgcolor: summaryFilter === 'notScheduled' ? '#ffedd5' : '#fff7ed',
                            border: summaryFilter === 'notScheduled' ? '2px solid #f97316' : '1px solid #ffedd5',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                        }}
                    >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="overline" color="textSecondary" fontWeight={600}>Not Scheduled</Typography>
                            <Typography variant="h3" fontWeight={800} color="warning.main">
                                {summary.pending}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Department-wise Statistics Table */}
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 2, mb: 2 }}>
                {viewMode === 'DEPARTMENT' ? 'Department-wise Review Statistics' : 'Project-wise Review Status'}
            </Typography>

            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0', mb: 4, overflow: 'hidden' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            {viewMode === 'DEPARTMENT' ? (
                                <>
                                    <TableCell sx={{ fontWeight: 800, color: '#475569', py: 2.5 }}>Department Name</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 1</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 2</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 3</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Total Projects</TableCell>
                                </>
                            ) : (
                                <>
                                    <TableCell sx={{ fontWeight: 800, color: '#475569', py: 2.5 }}>Project Title</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 1</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 2</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 3</TableCell>
                                </>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {viewMode === 'DEPARTMENT' ? (
                            deptStats.map((row) => (
                                <TableRow key={row.department} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell
                                        component="th"
                                        scope="row"
                                        onClick={() => {
                                            setDepartment(row.department);
                                            setSelectedProjectId(null);
                                            setViewMode('TITLE');
                                        }}
                                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    >
                                        <Typography variant="subtitle2" fontWeight={700} color="primary.main">{row.department}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={`${row.review1.completed}/${row.review1.total}`}
                                            color={row.review1.completed === row.review1.total && row.review1.total > 0 ? "success" : "warning"}
                                            size="small"
                                            onClick={() => handleReviewClick('Review 1', row.department)}
                                            sx={{ fontWeight: 700, borderRadius: 2 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={`${row.review2.completed}/${row.review2.total}`}
                                            color={row.review2.completed === row.review2.total && row.review2.total > 0 ? "success" : "warning"}
                                            size="small"
                                            onClick={() => handleReviewClick('Review 2', row.department)}
                                            sx={{ fontWeight: 700, borderRadius: 2 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={`${row.review3.completed}/${row.review3.total}`}
                                            color={row.review3.completed === row.review3.total && row.review3.total > 0 ? "success" : "warning"}
                                            size="small"
                                            onClick={() => handleReviewClick('Review 3', row.department)}
                                            sx={{ fontWeight: 700, borderRadius: 2 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" fontWeight={700}>{row.totalProjects}</Typography>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            projectStats.filter((row) => {
                                if (summaryFilter === 'all') return true;
                                // Determine which review field to check based on selected reviewType
                                let statusField;
                                if (reviewType === 'Review 1') statusField = row.review1;
                                else if (reviewType === 'Review 2') statusField = row.review2;
                                else if (reviewType === 'Review 3') statusField = row.review3;
                                else statusField = row.review1;

                                if (summaryFilter === 'completed') return statusField === 'COMPLETED';
                                if (summaryFilter === 'scheduled') return statusField === 'SCHEDULED';
                                if (summaryFilter === 'notScheduled') return statusField === 'NOT_SCHEDULED';
                                return true;
                            }).map((row) => (
                                <TableRow key={row.projectId} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell
                                        component="th"
                                        scope="row"
                                        onClick={() => {
                                            const proj = projects.find(p => p._id === row.projectId);
                                            if (proj) {
                                                setSelectedProject(proj);
                                                setScheduleOpen(true);
                                            }
                                        }}
                                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f1f5f9' } }}
                                    >
                                        <Typography variant="subtitle2" fontWeight={700} color="primary.main">{row.title}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={row.review1 === 'NOT_SCHEDULED' ? 'Not Scheduled' : row.review1.charAt(0) + row.review1.slice(1).toLowerCase()}
                                            color={row.review1 === 'COMPLETED' ? "success" : row.review1 === 'NOT_SCHEDULED' ? "default" : "warning"}
                                            variant={row.review1 === 'NOT_SCHEDULED' ? "outlined" : "filled"}
                                            size="small"
                                            onClick={() => row.review1 !== 'NOT_SCHEDULED' && handleReviewClick('Review 1', null, row.projectId)}
                                            sx={{ fontWeight: 700, borderRadius: 2, minWidth: 100 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={row.review2 === 'NOT_SCHEDULED' ? 'Not Scheduled' : row.review2.charAt(0) + row.review2.slice(1).toLowerCase()}
                                            color={row.review2 === 'COMPLETED' ? "success" : row.review2 === 'NOT_SCHEDULED' ? "default" : "warning"}
                                            variant={row.review2 === 'NOT_SCHEDULED' ? "outlined" : "filled"}
                                            size="small"
                                            onClick={() => row.review2 !== 'NOT_SCHEDULED' && handleReviewClick('Review 2', null, row.projectId)}
                                            sx={{ fontWeight: 700, borderRadius: 2, minWidth: 100 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={row.review3 === 'NOT_SCHEDULED' ? 'Not Scheduled' : row.review3.charAt(0) + row.review3.slice(1).toLowerCase()}
                                            color={row.review3 === 'COMPLETED' ? "success" : row.review3 === 'NOT_SCHEDULED' ? "default" : "warning"}
                                            variant={row.review3 === 'NOT_SCHEDULED' ? "outlined" : "filled"}
                                            size="small"
                                            onClick={() => row.review3 !== 'NOT_SCHEDULED' && handleReviewClick('Review 3', null, row.projectId)}
                                            sx={{ fontWeight: 700, borderRadius: 2, minWidth: 100 }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Detailed Student List Dialog */}
            <Dialog open={detailedOpen} onClose={() => setDetailedOpen(false)} fullWidth maxWidth="lg">
                <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                    Detailed Project Review List
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell><strong>S.No</strong></TableCell>
                                    <TableCell><strong>Project Title</strong></TableCell>
                                    <TableCell><strong>Reg. Number</strong></TableCell>
                                    <TableCell><strong>Student Name</strong></TableCell>
                                    <TableCell><strong>Implementation</strong></TableCell>
                                    <TableCell><strong>Output</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {detailedList.map((item, index) => (
                                    <TableRow key={index} hover>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{item.projectTitle}</TableCell>
                                        <TableCell>{item.registrationNumber}</TableCell>
                                        <TableCell>{item.studentName}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={item.implementationStatus}
                                                size="small"
                                                color={
                                                    item.implementationStatus === 'Completed' ? 'success' :
                                                        item.implementationStatus === 'In Progress' ? 'warning' : 'default'
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>{item.output || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                                {detailedList.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">No students found for this review.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
                    <Button onClick={() => setDetailedOpen(false)} variant="outlined">Close</Button>
                </DialogActions>
            </Dialog>

            {/* SCHEDULE REVIEW DIALOG */}
            <Dialog open={scheduleOpen} onClose={() => { setScheduleOpen(false); setSelectedProject(null); setProjectReviews([]); }} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 700 }}>Schedule Individual Project Review</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <Autocomplete
                            options={projects}
                            getOptionLabel={(option) => `${option.title} (${option.projectId})`}
                            value={selectedProject}
                            onChange={(event, newValue) => setSelectedProject(newValue)}
                            renderInput={(params) => <TextField {...params} label="Search Project" variant="outlined" size="small" />}
                            fullWidth
                        />

                        {selectedProject && (
                            <>
                                <TextField
                                    label="Review Title"
                                    fullWidth
                                    size="small"
                                    select
                                    value={newReview.title}
                                    onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                                >
                                    <MenuItem value="Review 1">Review 1</MenuItem>
                                    <MenuItem value="Review 2">Review 2</MenuItem>
                                    <MenuItem value="Review 3">Review 3</MenuItem>
                                </TextField>

                                <TextField
                                    label="Date and Time"
                                    type="datetime-local"
                                    fullWidth
                                    size="small"
                                    InputLabelProps={{ shrink: true }}
                                    value={newReview.scheduledAt}
                                    onChange={(e) => setNewReview({ ...newReview, scheduledAt: e.target.value })}
                                />

                                <TextField
                                    label="Description / Agenda"
                                    fullWidth
                                    multiline
                                    rows={2}
                                    size="small"
                                    value={newReview.description}
                                    onChange={(e) => setNewReview({ ...newReview, description: e.target.value })}
                                />

                                <Divider />
                                <Typography variant="subtitle2" fontWeight={600}>Evaluation Metrics Setup</Typography>

                                {newReview.evaluationCriteria.map((criteria, index) => (
                                    <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <TextField
                                            label="Criteria Label"
                                            size="small"
                                            sx={{ flex: 2 }}
                                            value={criteria.label}
                                            onChange={(e) => handleCriteriaChange(index, 'label', e.target.value)}
                                            placeholder="e.g. Presentation Skills"
                                        />
                                        <TextField
                                            label="Max. Marks"
                                            type="number"
                                            size="small"
                                            sx={{ width: 100 }}
                                            value={criteria.maxMarks}
                                            onChange={(e) => handleCriteriaChange(index, 'maxMarks', e.target.value)}
                                        />
                                        <IconButton color="error" onClick={() => handleRemoveCriteria(index)} disabled={newReview.evaluationCriteria.length === 1}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                ))}
                                <Button size="small" startIcon={<AddIcon />} alignSelf="flex-start" onClick={handleAddCriteria}>
                                    Add Another Metric
                                </Button>

                                <Divider />
                                <Typography variant="subtitle2" fontWeight={600}>Existing Reviews for this Project:</Typography>
                                {projectReviews.length > 0 ? (
                                    <Stack spacing={1}>
                                        {projectReviews.map(r => (
                                            <Paper key={r._id} variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 }}>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>{r.title}</Typography>
                                                    <Typography variant="caption" color="textSecondary">{new Date(r.scheduledAt).toLocaleString()} - {r.status}</Typography>
                                                </Box>
                                                <Box>
                                                    {r.status === 'SCHEDULED' && <Button size="small" color="success" onClick={() => openEvaluationPanel(r)}>Evaluate</Button>}
                                                    {r.status === 'COMPLETED' && <Button size="small" onClick={() => openEvaluationPanel(r)}>View</Button>}
                                                    {r.status === 'SCHEDULED' && (
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteReview(r._id)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </Paper>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        No existing reviews scheduled for this project.
                                    </Typography>
                                )}
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
                    <Button onClick={() => { setScheduleOpen(false); setSelectedProject(null); setProjectReviews([]); }}>Cancel</Button>
                    <Button variant="contained" onClick={handleScheduleSubmit} disabled={!selectedProject}>Schedule</Button>
                </DialogActions>
            </Dialog>

            {/* EVALUATION DIALOG */}
            <Dialog open={evalOpen} onClose={() => setEvalOpen(false)} fullWidth maxWidth="md">
                <DialogTitle sx={{ fontWeight: 700 }}>
                    {currentEvalReview?.status === 'COMPLETED' ? 'View Evaluation Results' : 'Conduct Student Evaluation'}
                </DialogTitle>
                <DialogContent dividers>
                    <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell><strong>Criteria</strong></TableCell>
                                    <TableCell align="right"><strong>Max Marks</strong></TableCell>
                                    <TableCell align="right"><strong>Awarded Marks</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {currentEvalReview?.evaluationCriteria.map((c, i) => {
                                    const sc = evalForm.scores.find(s => s.label === c.label) || { awardedMarks: 0 };
                                    const isCompleted = currentEvalReview?.status === 'COMPLETED';
                                    return (
                                        <TableRow key={c.label || i}>
                                            <TableCell>{c.label}</TableCell>
                                            <TableCell align="right">{c.maxMarks}</TableCell>
                                            <TableCell align="right">
                                                {isCompleted ? (
                                                    <Typography variant="body2" fontWeight="bold">{sc.awardedMarks}</Typography>
                                                ) : (
                                                    <TextField
                                                        type="number"
                                                        size="small"
                                                        inputProps={{ min: 0, max: c.maxMarks, step: 0.5 }}
                                                        sx={{ width: 80 }}
                                                        value={sc.awardedMarks}
                                                        onChange={(e) => handleScoreChange(c.label, e.target.value)}
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell colSpan={2} align="right"><strong>Total Score</strong></TableCell>
                                    <TableCell align="right">
                                        <Typography variant="subtitle1" color="primary.main" fontWeight="bold">
                                            {evalForm.scores.reduce((sum, s) => sum + (s.awardedMarks || 0), 0)}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Stack spacing={3}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    label="Project Completion %"
                                    type="number"
                                    fullWidth
                                    size="small"
                                    inputProps={{ min: 0, max: 100 }}
                                    value={evalForm.completionPercentage}
                                    onChange={(e) => handleFeedbackChange('completionPercentage', e.target.value)}
                                    disabled={currentEvalReview?.status === 'COMPLETED'}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl fullWidth size="small" disabled={currentEvalReview?.status === 'COMPLETED'}>
                                    <InputLabel>Implementation Status</InputLabel>
                                    <Select
                                        value={evalForm.implementationStatus}
                                        label="Implementation Status"
                                        onChange={(e) => handleFeedbackChange('implementationStatus', e.target.value)}
                                    >
                                        <MenuItem value="Pending">Pending</MenuItem>
                                        <MenuItem value="In Progress">In Progress</MenuItem>
                                        <MenuItem value="Completed">Completed</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label="Output (e.g. Prototype, Report)"
                                    fullWidth
                                    size="small"
                                    value={evalForm.output}
                                    onChange={(e) => handleFeedbackChange('output', e.target.value)}
                                    disabled={currentEvalReview?.status === 'COMPLETED'}
                                    placeholder="Prototype, Working Model, Report Submitted, etc."
                                />
                            </Grid>
                        </Grid>

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>Overall Feedback / Remarks</Typography>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                value={evalForm.feedback}
                                onChange={(e) => handleFeedbackChange('feedback', e.target.value)}
                                disabled={currentEvalReview?.status === 'COMPLETED'}
                            />
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
                    <Button onClick={() => setEvalOpen(false)}>Close</Button>
                    {currentEvalReview?.status === 'SCHEDULED' && (
                        <Button variant="contained" color="success" onClick={handleSubmitEvaluation}>
                            Submit Final Evaluation
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={deleteConfirmOpen}
                onCancel={() => { setDeleteConfirmOpen(false); setReviewToDelete(null); }}
                onConfirm={confirmDeleteReview}
                title="Confirm Review Deletion"
                content="Are you sure you want to delete this scheduled review?"
                confirmText="Delete"
                confirmColor="error"
            />

            <ProjectDetailsDialog
                open={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                project={selectedProject}
            />
        </Box>
    );
}
