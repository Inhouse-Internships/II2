import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, CircularProgress, Alert, Grid,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    Chip, Pagination, Paper, Stack, Tabs, Tab, FormControlLabel, Radio, RadioGroup, Divider
} from '@mui/material';
import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import useRequireRole from '../../core/hooks/useRequireRole';
import { ROLES, TASK_STATUS } from '../../core/constants/roles';
import StatusChip from '../../components/common/StatusChip';

export default function StudentTasks() {
    const { user, authorized, authLoading } = useRequireRole(ROLES.STUDENT);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tabIndex, setTabIndex] = useState(0);

    // Project Data
    const [projectData, setProjectData] = useState(null);
    const [internshipSettings, setInternshipSettings] = useState(null);

    // Task Data
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [weeklySubmissions, setWeeklySubmissions] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const isTeamLeader = projectData?.teamLeader === user?._id || projectData?.teamLeader?._id === user?._id;

    // Submit Dialog State
    const [submitOpen, setSubmitOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [submitForm, setSubmitForm] = useState({
        descriptionOfWork: "",
        status: "Completed" // "Completed" or "Not Completed"
    });

    // Weekly Submit Dialog State
    const [weeklyOpen, setWeeklyOpen] = useState(false);
    const [weeklyForm, setWeeklyForm] = useState({
        weekNumber: 1,
        description: "",
        completionPercentage: 0
    });

    useEffect(() => {
        if (authorized) {
            fetchInitialData();
        }
    }, [authorized]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [projRes, settingsRes] = await Promise.all([
                apiFetch('/api/tasks/student/project'),
                apiFetch('/api/admin/settings/internship')
            ]);
            const projData = await projRes.json();
            const settingsData = await settingsRes.json();

            if (projRes.ok) setProjectData(projData.data);
            if (settingsRes.ok) setInternshipSettings(settingsData);

            if (projData.data?._id) {
                fetchTasks(1, projData.data._id);
                fetchWeeklySubmissions(projData.data._id);
            }
        } catch (err) {
            setError("Failed to load project data");
        } finally {
            setLoading(false);
        }
    };

    const fetchTasks = async (pageNumber = 1, projId = projectData?._id) => {
        if (!projId) return;
        try {
            const [tasksRes, subsRes] = await Promise.all([
                apiFetch(`/api/tasks/project/${projId}?page=${pageNumber}&limit=10`),
                apiFetch(`/api/tasks/student/submissions`)
            ]);
            if (tasksRes.ok) {
                const data = await tasksRes.json();
                setTasks(data.data || []);
                setTotalPages(data.totalPages || 1);
                setPage(data.page || 1);
            }
            if (subsRes.ok) {
                const data = await subsRes.json();
                setSubmissions(data.data || []);
            }
        } catch (err) { }
    };

    const fetchWeeklySubmissions = async (projId) => {
        try {
            const res = await apiFetch(`/api/tasks/weekly/project/${projId}`);
            if (res.ok) setWeeklySubmissions(await res.json());
        } catch (err) { }
    };

    const handleOpenSubmit = (task) => {
        const existingSub = submissions.find(s => s.task === task._id || s.task?._id === task._id);
        setSelectedTask(task);
        setSubmitForm({
            descriptionOfWork: existingSub?.descriptionOfWork || "",
            status: existingSub?.completionPercentage === 100 ? "Completed" : (existingSub ? "Not Completed" : "Completed")
        });
        setSubmitOpen(true);
    };

    const handleSubmitTask = async () => {
        try {
            const payload = {
                descriptionOfWork: submitForm.descriptionOfWork,
                completionPercentage: submitForm.status === "Completed" ? 100 : 0,
                project: projectData._id
            };
            const res = await apiFetch(`/api/tasks/student/submit/${selectedTask._id}`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setSubmitOpen(false);
                fetchTasks(page);
            } else {
                const data = await res.json();
                alert(data.message || "Submission failed");
            }
        } catch (err) {
            alert("An error occurred");
        }
    };

    const handleOpenWeekly = () => {
        const nextWeek = weeklySubmissions.length > 0 ? Math.max(...weeklySubmissions.map(s => s.weekNumber)) + 1 : 1;
        setWeeklyForm({
            weekNumber: nextWeek,
            description: "",
            completionPercentage: 0
        });
        setWeeklyOpen(true);
    };

    const handleWeeklySubmit = async () => {
        try {
            const res = await apiFetch(`/api/tasks/student/weekly`, {
                method: 'POST',
                body: JSON.stringify({ ...weeklyForm, project: projectData._id })
            });
            if (res.ok) {
                setWeeklyOpen(false);
                fetchWeeklySubmissions(projectData._id);
                alert("Weekly report submitted successfully.");
            } else {
                const data = await res.json();
                alert(data.message || "Submission failed");
            }
        } catch (err) {
            alert("Error submitting weekly report");
        }
    };

    const calculateDate = (order) => {
        if (!internshipSettings?.startDate || !order) return 'Not Set';
        const date = new Date(internshipSettings.startDate);
        date.setDate(date.getDate() + order - 1);
        return date.toLocaleDateString();
    };

    if (authLoading || loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
    if (!authorized) return null;

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <PageHeader
                title="My Tasks & Progress"
                subtitle="Manage your daily technical work and submit weekly completion reports."
            />

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
                    <Tab label="Daily Timeline" />
                    <Tab label="Weekly Reports" />
                </Tabs>
            </Box>

            {tabIndex === 0 && (
                <Box>
                    <DataTable
                        columns={[
                            { id: 'day', label: 'Day', minWidth: 80, render: t => <Typography variant="body2" fontWeight="bold">Day {t.order}</Typography> },
                            {
                                id: 'title', label: 'Task Details', minWidth: 250, render: t => (
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight="bold">{t.title}</Typography>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</Typography>
                                    </Box>
                                )
                            },
                            {
                                id: 'dates', label: 'Timeline', minWidth: 150, render: t => (
                                    <Box>
                                        <Typography variant="caption" display="block">Start: {calculateDate(t.order)}</Typography>
                                        <Typography variant="caption" color="error">End: {calculateDate(t.order)}</Typography>
                                    </Box>
                                )
                            },
                            {
                                id: 'status', label: 'Status', minWidth: 120, render: t => {
                                    const sub = submissions.find(s => s.task === t._id || s.task?._id === t._id);
                                    return sub ? <StatusChip status={sub.status} /> : <StatusChip status="pending" label="Not Submitted" />;
                                }
                            },
                            {
                                id: 'action', label: 'Action', minWidth: 100, align: 'right', render: t => {
                                    const sub = submissions.find(s => s.task === t._id || s.task?._id === t._id);
                                    const isLocked = sub?.status === TASK_STATUS.APPROVED;
                                    if (!isTeamLeader) return <Typography variant="caption">Read Only</Typography>;
                                    return (
                                        <Button
                                            variant={sub ? "outlined" : "contained"}
                                            size="small"
                                            onClick={() => handleOpenSubmit(t)}
                                            disabled={isLocked}
                                        >
                                            {isLocked ? "Verified" : (sub ? "Edit" : "Submit")}
                                        </Button>
                                    );
                                }
                            }
                        ]}
                        rows={tasks}
                        emptyMessage="No tasks assigned yet."
                    />
                    {totalPages > 1 && (
                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                            <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)} />
                        </Box>
                    )}
                </Box>
            )}

            {tabIndex === 1 && (
                <Box>
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" fontWeight="bold">Weekly Progress Reports</Typography>
                        {isTeamLeader && (
                            <Button variant="contained" onClick={handleOpenWeekly}>Submit Weekly Report</Button>
                        )}
                    </Box>
                    <DataTable
                        columns={[
                            { id: 'week', label: 'Week', minWidth: 100, render: s => `Week ${s.weekNumber}` },
                            {
                                id: 'percentage', label: 'Completion %', minWidth: 150, render: s => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" fontWeight="bold">{s.completionPercentage}%</Typography>
                                        <Box sx={{ flexGrow: 1, maxWidth: 100, height: 6, bgcolor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                            <Box sx={{ width: `${s.completionPercentage}%`, height: '100%', bgcolor: 'primary.main' }} />
                                        </Box>
                                    </Box>
                                )
                            },
                            { id: 'status', label: 'Status', minWidth: 120, render: s => <StatusChip status={s.status} /> },
                            { id: 'remarks', label: 'Feedback', minWidth: 200, render: s => <Typography variant="caption">{s.remarks || "-"}</Typography> }
                        ]}
                        rows={weeklySubmissions}
                        emptyMessage="No weekly reports submitted."
                    />
                </Box>
            )}

            {/* Daily Submit Dialog */}
            <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Daily Status Submission</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" color="primary">{selectedTask?.title}</Typography>

                        <Typography variant="body2" fontWeight="bold">Task Completion Status</Typography>
                        <RadioGroup
                            row
                            value={submitForm.status}
                            onChange={(e) => setSubmitForm({ ...submitForm, status: e.target.value })}
                        >
                            <FormControlLabel value="Completed" control={<Radio />} label="Fully Completed" />
                            <FormControlLabel value="Not Completed" control={<Radio />} label="Not Completed" />
                        </RadioGroup>

                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Technical Work Description"
                            placeholder="Describe what was achieved, hurdles faced, and current status..."
                            value={submitForm.descriptionOfWork}
                            onChange={(e) => setSubmitForm({ ...submitForm, descriptionOfWork: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubmitOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmitTask} disabled={!submitForm.descriptionOfWork}>Submit Status</Button>
                </DialogActions>
            </Dialog>

            {/* Weekly Submit Dialog */}
            <Dialog open={weeklyOpen} onClose={() => setWeeklyOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Submit Weekly Progress Report</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            fullWidth
                            type="number"
                            label={`Week ${weeklyForm.weekNumber} Completion %`}
                            inputProps={{ min: 0, max: 100 }}
                            value={weeklyForm.completionPercentage}
                            onChange={(e) => setWeeklyForm({ ...weeklyForm, completionPercentage: e.target.value })}
                            helperText="Overall project completion percentage as of this week."
                        />
                        <TextField
                            fullWidth
                            multiline
                            rows={5}
                            label="Weekly Technical Summary"
                            placeholder="Summarize the week's progress, major milestones reached, and plan for next week..."
                            value={weeklyForm.description}
                            onChange={(e) => setWeeklyForm({ ...weeklyForm, description: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setWeeklyOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleWeeklySubmit} disabled={!weeklyForm.description}>Submit Report</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
