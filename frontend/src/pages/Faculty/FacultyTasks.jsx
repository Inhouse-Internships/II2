import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, CircularProgress, Alert, Paper, Stack, Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Divider, MenuItem, Select, InputLabel, FormControl, TextField, Tabs, Tab, Chip
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import {
    Assignment as AssignmentIcon,
    AssignmentTurnedIn as AssignmentTurnedInIcon,
    CheckCircle as CheckCircleIcon,
    HourglassEmpty as HourglassEmptyIcon,
    Close as CloseIcon,
    Settings as SettingsIcon,
    Preview as PreviewIcon,
    Refresh as RefreshIcon,
    Delete as DeleteIcon
} from "@mui/icons-material";

import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import SearchBar from '../../components/common/SearchBar';
import StatusChip from '../../components/common/StatusChip';
import useRequireRole from '../../core/hooks/useRequireRole';
import { ROLES, TASK_STATUS } from '../../core/constants/roles';

export default function FacultyTasks(props) {
    const { user, authorized, authLoading } = useRequireRole(ROLES.FACULTY);
    const [searchParams, setSearchParams] = useSearchParams();
    const context = props.context || {};
    const projectIdParam = context.navState?.projectId || searchParams.get('projectId');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [projects, setProjects] = useState([]);
    const [tabIndex, setTabIndex] = useState(0);
    const [analytics, setAnalytics] = useState(null);
    const [internshipSettings, setInternshipSettings] = useState(null);

    // Specific Project State
    const [tasks, setTasks] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [taskSearchQuery, setTaskSearchQuery] = useState("");

    // Weekly Submissions
    const [weeklySubmissions, setWeeklySubmissions] = useState([]);
    const [weeklyReviewOpen, setWeeklyReviewOpen] = useState(false);
    const [selectedWeeklySub, setSelectedWeeklySub] = useState(null);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [weeklyReviewForm, setWeeklyReviewForm] = useState({
        status: 'approved',
        remarks: ''
    });

    // Task Review State
    const [taskReviewOpen, setTaskReviewOpen] = useState(false);
    const [selectedReviewTask, setSelectedReviewTask] = useState(null);

    const handleOpenTaskReview = (task) => {
        setSelectedReviewTask(task);
        setTaskReviewOpen(true);
    };

    const handleUpdateSubmission = async (subId, field, value) => {
        try {
            const res = await apiFetch(`/api/tasks/faculty/submissions/${subId}/review`, {
                method: 'PUT',
                body: JSON.stringify({ [field]: value })
            });
            if (res.ok) {
                // Optimistically update
                setSelectedReviewTask(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        submissions: prev.submissions.map(s => s._id === subId ? { ...s, [field]: value } : s)
                    };
                });
                fetchProjectTasks(selectedProject._id);
            } else {
                alert("Failed to update submission");
            }
        } catch (err) {
            alert("Error updating submission");
        }
    };

    const [assignOpen, setAssignOpen] = useState(false);
    const [assignForm, setAssignForm] = useState({
        title: '',
        description: '',
        startDate: '',
        deadline: ''
    });


    useEffect(() => {
        if (authorized && user) {
            fetchInitialData();
        }
    }, [authorized, user]);

    useEffect(() => {
        if (projectIdParam && projects.length > 0) {
            const proj = projects.find(p => String(p._id) === String(projectIdParam));
            if (proj) setSelectedProject(proj);
        }
    }, [projectIdParam, projects]);

    useEffect(() => {
        if (selectedProject) {
            fetchProjectTasks(selectedProject._id);
            fetchWeeklySubmissions(selectedProject._id);
        }
    }, [selectedProject]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [projRes, analyticsRes, settingsRes] = await Promise.all([
                apiFetch(`/api/tasks/faculty/projects`),
                apiFetch("/api/analytics/guide"),
                apiFetch("/api/admin/settings/internship")
            ]);

            if (projRes.ok) {
                const pData = await projRes.json();
                setProjects(pData.data || []);
            }
            if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
            if (settingsRes.ok) setInternshipSettings(await settingsRes.json());
        } catch (err) {
            setError("Failed to load initial data.");
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectTasks = async (projId) => {
        setTasksLoading(true);
        try {
            const res = await apiFetch(`/api/tasks/admin?projectId=${projId}`);
            if (res.ok) setTasks(await res.json());
        } catch (err) { }
        finally { setTasksLoading(false); }
    };

    const fetchWeeklySubmissions = async (projId) => {
        try {
            const res = await apiFetch(`/api/tasks/weekly/project/${projId}`);
            if (res.ok) setWeeklySubmissions(await res.json());
        } catch (err) { }
    };

    const handleOpenWeeklyReview = (sub) => {
        setSelectedWeeklySub(sub);
        setWeeklyReviewForm({
            status: sub.status || 'approved',
            remarks: sub.remarks || ''
        });
        setWeeklyReviewOpen(true);
    };

    const handleWeeklyReviewSubmit = async () => {
        if (!selectedWeeklySub) return;
        try {
            const res = await apiFetch(`/api/tasks/weekly/review/${selectedWeeklySub._id}`, {
                method: 'PUT',
                body: JSON.stringify(weeklyReviewForm)
            });
            if (res.ok) {
                fetchWeeklySubmissions(selectedProject._id);
                setWeeklyReviewOpen(false);
                alert("Weekly report reviewed successfully.");
            }
        } catch (err) {
            alert("Failed to submit review.");
        }
    };

    const handleAssignTask = async () => {
        if (!assignForm.title || !selectedProject) return;
        try {
            const res = await apiFetch('/api/tasks/faculty/create', {
                method: 'POST',
                body: JSON.stringify({ ...assignForm, project: selectedProject._id })
            });
            if (res.ok) {
                fetchProjectTasks(selectedProject._id);
                setAssignOpen(false);
                setAssignForm({ title: '', description: '', startDate: '', deadline: '' });
                alert("Task assigned successfully.");
            } else {
                alert("Failed to assign task.");
            }
        } catch (err) {
            alert("An error occurred");
        }
    };

    const confirmDeleteTask = async () => {
        if (!taskToDelete) return;
        try {
            const res = await apiFetch(`/api/tasks/admin/${taskToDelete._id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                alert("Task deleted successfully");
                fetchProjectTasks(selectedProject._id);
            } else {
                alert(data.message || "Failed to delete task");
            }
        } catch (err) {
            alert("Error deleting task");
        } finally {
            setDeleteConfirmOpen(false);
            setTaskToDelete(null);
        }
    };

    const displayedTasks = useMemo(() => {
        if (!taskSearchQuery) return tasks;
        const q = taskSearchQuery.toLowerCase();
        return tasks.filter(t =>
            (t.title || "").toLowerCase().includes(q) ||
            (t.description || "").toLowerCase().includes(q)
        );
    }, [tasks, taskSearchQuery]);

    if (authLoading || (loading && !projects.length)) {
        return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
    }

    if (!authorized) return null;

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <PageHeader title="Daily Status" subtitle="Monitor project tasks and verify weekly progress reports" />

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
                    <Tab label="Manage Tasks" />
                    <Tab label="Weekly Submissions" />
                </Tabs>
            </Box>

            {tabIndex === 0 && (
                <Box>
                    <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 300 }}>
                            <InputLabel>Select Project Matrix</InputLabel>
                            <Select
                                value={selectedProject?._id || ""}
                                label="Select Project Matrix"
                                onChange={(e) => {
                                    const p = projects.find(proj => proj._id === e.target.value);
                                    setSelectedProject(p);
                                    setSearchParams({ projectId: p._id });
                                }}
                            >
                                {projects.map(p => (
                                    <MenuItem key={p._id} value={p._id}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                            <Typography variant="body2" fontWeight="bold">{p.title}</Typography>
                                            <Typography variant="caption" color="textSecondary">{p.projectId}</Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {selectedProject && (
                            <SearchBar
                                value={taskSearchQuery}
                                onChange={(e) => setTaskSearchQuery(e.target.value)}
                                onClear={() => setTaskSearchQuery("")}
                                placeholder="Search Data"
                            />
                        )}
                        {selectedProject && (
                            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => { fetchProjectTasks(selectedProject._id); fetchWeeklySubmissions(selectedProject._id); }}
                                    disabled={tasksLoading}
                                >
                                    {tasksLoading ? 'Refreshing…' : 'Refresh'}
                                </Button>
                                <Button variant="contained" onClick={() => setAssignOpen(true)} startIcon={<AssignmentIcon />}>
                                    Assign Task
                                </Button>
                            </Box>
                        )}
                    </Paper>

                    {selectedProject ? (
                        <>
                            <DataTable
                                columns={[
                                    { id: 'day', label: 'Day', minWidth: 80, render: t => <Typography variant="body2" fontWeight="bold">Day {t.order || "-"}</Typography> },
                                    {
                                        id: 'title', label: 'Title', minWidth: 250, render: t => (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight="bold">{t.title}</Typography>
                                                <Typography variant="caption" color="textSecondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 300 }}>{t.description}</Typography>
                                            </Box>
                                        )
                                    },
                                    { id: 'startDate', label: 'Start Date', minWidth: 120, render: t => <Chip size="small" label={t.startDate || "Not Set"} variant="outlined" color="primary" /> },
                                    { id: 'deadline', label: 'End Date', minWidth: 120, render: t => <Chip size="small" label={t.deadline || "Not Set"} variant="tonal" color="warning" /> },
                                    {
                                        id: 'status', label: 'Submissions', minWidth: 140, render: t => {
                                            const subCount = t.submissions?.length || 0;
                                            return (
                                                <Chip
                                                    size="small"
                                                    label={`${subCount} Submitted`}
                                                    color={subCount > 0 ? "success" : "default"}
                                                    variant="outlined"
                                                />
                                            );
                                        }
                                    },
                                    {
                                        id: 'actions', label: 'Review Solutions', minWidth: 150, align: 'center', render: t => (
                                            <Button
                                                size="small"
                                                variant={t.submissions?.length > 0 ? "contained" : "outlined"}
                                                onClick={() => handleOpenTaskReview(t)}
                                                disabled={!t.submissions || t.submissions.length === 0}
                                                startIcon={<PreviewIcon />}
                                            >
                                                Review
                                            </Button>
                                        )
                                    }
                                ]}
                                rows={displayedTasks}
                                loading={loading}
                            />
                        </>
                    ) : (
                        <Alert severity="info">Please select a project to view daily status.</Alert>
                    )}
                </Box>
            )}

            {tabIndex === 1 && (
                <Box>
                    {selectedProject ? (
                        <DataTable
                            columns={[
                                { id: 'week', label: 'Week', minWidth: 80, render: s => <Typography fontWeight="bold">Week {s.weekNumber}</Typography> },
                                { id: 'student', label: 'Team Leader', minWidth: 150, render: s => s.student?.name || "N/A" },
                                {
                                    id: 'percentage', label: 'Completion %', minWidth: 120, render: s => (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body2" fontWeight="bold">{s.completionPercentage}%</Typography>
                                            <Box sx={{ width: '100%', maxWidth: 60, height: 6, bgcolor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                                <Box sx={{ width: `${s.completionPercentage}%`, height: '100%', bgcolor: 'primary.main' }} />
                                            </Box>
                                        </Box>
                                    )
                                },
                                { id: 'status', label: 'Status', minWidth: 120, render: s => <StatusChip status={s.status} /> },
                                {
                                    id: 'actions', label: 'Actions', minWidth: 100, align: 'right', render: s => (
                                        <Button size="small" variant="contained" startIcon={<PreviewIcon />} onClick={() => handleOpenWeeklyReview(s)}>Review</Button>
                                    )
                                }
                            ]}
                            rows={weeklySubmissions}
                            emptyMessage="No weekly reports submitted yet."
                        />
                    ) : (
                        <Alert severity="info" sx={{ mt: 2 }}>Please select a project to view weekly submissions.</Alert>
                    )}
                </Box>
            )}

            {/* Weekly Review Dialog */}
            <Dialog open={weeklyReviewOpen} onClose={() => setWeeklyReviewOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Review Weekly Progress Report</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                            <Typography variant="caption" color="primary" fontWeight="bold">STUDENT DESCRIPTION</Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>{selectedWeeklySub?.description}</Typography>
                        </Box>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={weeklyReviewForm.status}
                                        label="Status"
                                        onChange={(e) => setWeeklyReviewForm({ ...weeklyReviewForm, status: e.target.value })}
                                    >
                                        <MenuItem value="approved">Approve</MenuItem>
                                        <MenuItem value="rejected">Reject / Revision Needed</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Remarks"
                            placeholder="Provide feedback to the student..."
                            value={weeklyReviewForm.remarks}
                            onChange={(e) => setWeeklyReviewForm({ ...weeklyReviewForm, remarks: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setWeeklyReviewOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleWeeklyReviewSubmit}>Submit Review</Button>
                </DialogActions>
            </Dialog>

            {/* Assign Task Dialog */}
            <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Assign Task to Student(s)</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            label="Title"
                            value={assignForm.title}
                            onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                        />
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Description"
                            value={assignForm.description}
                            onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
                        />
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Start Date"
                                    InputLabelProps={{ shrink: true }}
                                    value={assignForm.startDate}
                                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Last Date (Deadline)"
                                    InputLabelProps={{ shrink: true }}
                                    value={assignForm.deadline}
                                    onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAssignTask} disabled={!assignForm.title}>Assign</Button>
                </DialogActions>
            </Dialog>
            {/* Task Review Modal */}
            <Dialog open={taskReviewOpen} onClose={() => setTaskReviewOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Review Student Submissions: {selectedReviewTask?.title}</DialogTitle>
                <DialogContent dividers sx={{ bgcolor: '#f1f5f9' }}>
                    {selectedReviewTask?.submissions?.length === 0 && (
                        <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 3 }}>
                            No submissions yet for this task.
                        </Typography>
                    )}
                    {selectedReviewTask?.submissions?.map((sub) => (
                        <Paper key={sub._id} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="caption" color="textSecondary" display="block">Student</Typography>
                                    <Typography variant="body2" fontWeight="bold">{sub.student?.name} ({sub.student?.studentId})</Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="caption" color="textSecondary" display="block">Submission Time</Typography>
                                    <Typography variant="body2">{new Date(sub.submittedAt).toLocaleString()}</Typography>
                                </Grid>
                            </Grid>
                            <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 0.5 }}>My Solution (By Student)</Typography>
                                    <Typography variant="body2">{sub.descriptionOfWork || "No solution text provided."}</Typography>
                                    {sub.fileUrl && (
                                        <Box sx={{ mt: 1.5 }}>
                                            <Button size="small" variant="contained" color="secondary" href={`http://localhost:5000${sub.fileUrl}`} target="_blank" rel="noopener">
                                                Download Solution File
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        size="small"
                                        value={sub.status || 'pending'}
                                        label="Status"
                                        onChange={(e) => handleUpdateSubmission(sub._id, 'status', e.target.value)}
                                    >
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="rejected">Not Completed</MenuItem>
                                        <MenuItem value="approved">Completed</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small"
                                    fullWidth
                                    label="Faculty Remarks"
                                    defaultValue={sub.remarks || ''}
                                    onBlur={(e) => {
                                        if (e.target.value !== sub.remarks) {
                                            handleUpdateSubmission(sub._id, 'remarks', e.target.value);
                                        }
                                    }}
                                    placeholder="Enter remarks for this student's solution..."
                                />
                            </Box>
                        </Paper>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTaskReviewOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
