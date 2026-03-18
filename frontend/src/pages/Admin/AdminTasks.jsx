import React, { useState, useEffect } from 'react';
import {
    Box, Button, Typography, Card, CardContent, Grid, TextField,
    CircularProgress, Alert, Stack, Tabs, Tab, Table, TableBody,
    TableCell, TableHead, TableRow, TableContainer, Paper, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, Select, MenuItem,
    InputLabel, FormControl, Chip, Tooltip
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    UploadFile as UploadFileIcon,
    CheckBox as CheckBoxIcon,
    Close as CloseIcon,
    Assignment as AssignmentIcon,
    Assessment as AssessmentIcon,
    AssignmentTurnedIn as AssignmentTurnedInIcon,
    Timeline as TimelineIcon
} from "@mui/icons-material";

import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DataTable from '../../components/common/DataTable';
import ProjectDetailsDialog from '../../components/common/ProjectDetailsDialog';
import FacultyDetailsDialog from "../../components/common/FacultyDetailsDialog";
import SearchBar from '../../components/common/SearchBar';
import StatusChip from '../../components/common/StatusChip';
import { useMemo } from 'react';

export default function AdminTasks(props) {
    const navigate = useNavigate();
    const setSection = props.context?.setSection;
    const [searchParams] = useSearchParams();

    // Internal navigation helper
    const handleInternalNav = (path, section, state) => {
        if (setSection) {
            setSection(section, state);
        } else {
            navigate(path, { state });
        }
    };
    const projectIdParam = props.context?.navState?.projectId || searchParams.get('projectId');
    const [tabIndex, setTabIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [internshipSettings, setInternshipSettings] = useState(null);

    // Filters to replace the generic table
    const [filterBy, setFilterBy] = useState('Projects'); // 'Projects' or 'Departments'
    const [selectedDept, setSelectedDept] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);

    // Dialog state
    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [inputType, setInputType] = useState('Day'); // 'Date' or 'Day'
    const [rawStartDate, setRawStartDate] = useState('');
    const [rawEndDate, setRawEndDate] = useState('');
    const [editingTask, setEditingTask] = useState(null);
    const [taskForm, setTaskForm] = useState({
        title: "", startDate: "", deadline: "", project: ""
    });

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [projectForDetails, setProjectForDetails] = useState(null);

    const [submissionsDialogOpen, setSubmissionsDialogOpen] = useState(false);
    const [taskForSubmissions, setTaskForSubmissions] = useState(null);

    const [facultyDetailsOpen, setFacultyDetailsOpen] = useState(false);
    const [selectedFacultyName, setSelectedFacultyName] = useState("");

    const [searchQuery, setSearchQuery] = useState('');
    const [taskSearchQuery, setTaskSearchQuery] = useState('');

    const filteredProjects = useMemo(() => projects.filter(p => {
        const q = searchQuery.toLowerCase();
        return p.title.toLowerCase().includes(q) ||
            (p.projectId || "").toLowerCase().includes(q) ||
            (p.baseDept || "").toLowerCase().includes(q) ||
            (p.guide || "").toLowerCase().includes(q) ||
            (p.coGuide || "").toLowerCase().includes(q);
    }), [projects, searchQuery]);

    const displayedTasks = useMemo(() => {
        let list = selectedProject
            ? tasks.filter(t => {
                const pid = typeof t.project === 'object' ? String(t.project?._id) : String(t.project);
                return pid === String(selectedProject._id);
            })
            : [];
        if (taskSearchQuery) {
            const q = taskSearchQuery.toLowerCase();
            list = list.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.description || "").toLowerCase().includes(q) ||
                (t.startDate && String(t.startDate).toLowerCase().includes(q)) ||
                (t.deadline && String(t.deadline).toLowerCase().includes(q))
            );
        }
        return list;
    }, [tasks, selectedProject, taskSearchQuery]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (projects.length > 0 && projectIdParam && !selectedProject) {
            const project = projects.find(p => String(p._id) === projectIdParam);
            if (project) {
                setFilterBy('Projects');
                setSelectedProject(project);
                setTabIndex(0);
            }
        }
    }, [projects, projectIdParam]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const results = await Promise.all([
                apiFetch("/api/tasks/admin"),
                apiFetch("/api/projects"),
                apiFetch("/api/tasks/admin/analytics"),
                apiFetch("/api/admin/settings/internship")
            ]);

            const [tasksRes, projRes, analyticsRes, settingsRes] = results;

            if (tasksRes && tasksRes.ok) setTasks(await tasksRes.json());
            if (projRes && projRes.ok) {
                const p = await projRes.json();
                const extracted = p.data?.data || p.data || p;
                setProjects(Array.isArray(extracted) ? extracted : []);
            }
            if (analyticsRes && analyticsRes.ok) setAnalytics(await analyticsRes.json());
            if (settingsRes && settingsRes.ok) setInternshipSettings(await settingsRes.json());
        } catch (err) {
            setError("Failed to load task data.");
        } finally {
            setLoading(false);
        }
    };

    const getDayFromDate = (dateStr) => {
        if (!internshipSettings?.startDate || !dateStr) return '';
        const start = new Date(internshipSettings.startDate);
        const current = new Date(dateStr);
        const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
        return `Day ${diffDays + 1}`;
    };

    const getDateFromDay = (dayStr) => {
        if (!internshipSettings?.startDate || !dayStr) return '';
        const start = new Date(internshipSettings.startDate);
        const match = dayStr.match(/Day\s+(\d+)/i);
        if (match) {
            start.setDate(start.getDate() + parseInt(match[1], 10) - 1);
            return start.toISOString().split('T')[0];
        }
        return '';
    };

    const fetchTasks = async () => {
        try {
            const res = await apiFetch("/api/tasks/admin");
            if (res.ok) setTasks(await res.json());
        } catch (err) {
            console.error("Error fetching tasks");
        }
    };

    const fetchAnalytics = async () => {
        try {
            const res = await apiFetch("/api/tasks/admin/analytics");
            if (res.ok) setAnalytics(await res.json());
        } catch (err) { }
    };

    const handleFacultyClick = (name, e) => {
        if (e) e.stopPropagation();
        setSelectedFacultyName(name);
        setFacultyDetailsOpen(true);
    };

    const handleOpenCreate = (predefinedProjectId = null) => {
        setEditingTask(null);
        setRawStartDate('');
        setRawEndDate('');
        setTaskForm({ title: "", description: "", startDate: "", deadline: "", project: predefinedProjectId || "" });
        if (internshipSettings?.startDate) setInputType('Date');
        setTaskDialogOpen(true);
    };

    const handleOpenEdit = (task) => {
        setEditingTask(task);
        if (internshipSettings?.startDate) {
            setInputType('Date');
            // Try to set raw dates if they exist in Day X format
            setRawStartDate(task.startDate?.includes('-') ? task.startDate : getDateFromDay(task.startDate));
            setRawEndDate(task.deadline?.includes('-') ? task.deadline : getDateFromDay(task.deadline));
        } else {
            setInputType(task.startDate?.includes('-') ? 'Date' : 'Day');
            setRawStartDate(task.startDate?.includes('-') ? task.startDate : '');
            setRawEndDate(task.deadline?.includes('-') ? task.deadline : '');
        }

        setTaskForm({
            title: task.title || "",
            startDate: task.startDate || "",
            deadline: task.deadline || "",
            project: (task.project?._id || task.project || "").toString()
        });
        setTaskDialogOpen(true);
    };

    const handleSaveTask = async () => {
        if (!taskForm.title || !taskForm.project || !taskForm.startDate) {
            return alert("Please fill all required fields (Title, Project, Start Date).");
        }

        // Final mapping of day vs date for backend consistency if needed
        const payload = { ...taskForm };
        if (internshipSettings?.startDate && inputType === 'Date') {
            payload.order = parseInt(getDayFromDate(rawStartDate).replace('Day ', ''), 10);
            payload.startDate = rawStartDate;
            payload.deadline = rawEndDate;
        } else if (inputType === 'Day') {
            payload.order = parseInt(taskForm.startDate.replace('Day ', ''), 10);
        }

        try {
            const url = editingTask ? `/api/tasks/admin/${editingTask._id}` : `/api/tasks/admin/create`;
            const method = editingTask ? "PUT" : "POST";
            const res = await apiFetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert(`Task ${editingTask ? 'updated' : 'created'} successfully`);
                setTaskDialogOpen(false);
                fetchTasks();
                fetchAnalytics();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to save task");
            }
        } catch (err) {
            alert("Error saving task");
        }
    };

    const confirmDeleteTask = async () => {
        if (!taskToDelete) return;
        try {
            const res = await apiFetch(`/api/tasks/admin/${taskToDelete._id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                alert("Task deleted");
                fetchTasks();
                fetchAnalytics();
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

    const handleSelectAllTasks = (event) => {
        if (event.target.checked) {
            setSelectedTaskIds(displayedTasks.map(t => t._id));
        } else {
            setSelectedTaskIds([]);
        }
    };

    const handleSelectOneTask = (id) => {
        setSelectedTaskIds(prev =>
            prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
        );
    };

    const confirmBulkDeleteTasks = async () => {
        if (selectedTaskIds.length === 0) return;
        try {
            const res = await apiFetch(`/api/tasks/admin/bulk-delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskIds: selectedTaskIds })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || "Tasks deleted");
                setSelectedTaskIds([]);
                fetchTasks();
                fetchAnalytics();
            } else {
                alert(data.message || "Failed to delete tasks");
            }
        } catch (err) {
            alert("Error deleting tasks");
        } finally {
            setBulkDeleteConfirmOpen(false);
        }
    };

    // File Upload function removed

    // Derived states
    const deptOptions = Array.from(new Set(
        projects.map(p => p.baseDept).filter(Boolean)
    )).sort();

    const getTaskProjectId = (t) => {
        return typeof t.project === 'object' ? String(t.project?._id) : String(t.project);
    };

    if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;

    return (
        <Box>
            <PageHeader title="Daily Status" subtitle="Create, import, and monitor project tasks" />
            {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
                    <Tab label="Manage Tasks" />
                    <Tab label="Analytics" />
                </Tabs>
            </Box>

            {tabIndex === 0 && (
                <Box>
                    {!selectedProject && !selectedDept && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                <FormControl size="small" sx={{ minWidth: 200, bgcolor: 'background.paper' }}>
                                    <InputLabel>Filter by</InputLabel>
                                    <Select value={filterBy} label="Filter by" onChange={e => {
                                        setFilterBy(e.target.value);
                                        setSelectedDept(null);
                                        setSelectedProject(null);
                                    }}>
                                        <MenuItem value="Projects">Projects</MenuItem>
                                        <MenuItem value="Departments">Departments</MenuItem>
                                        <MenuItem value="" disabled sx={{ display: 'none' }}>Select</MenuItem>
                                    </Select>
                                </FormControl>
                                <SearchBar
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClear={() => setSearchQuery('')}
                                    placeholder="Search Data"
                                />
                            </Box>
                            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate} sx={{ borderRadius: 2 }}>Create Task</Button>
                        </Box>
                    )}

                    {filterBy === 'Projects' && !selectedProject && (
                        <DataTable
                            columns={[
                                {
                                    id: 'title', label: 'Title', minWidth: 200, render: p => (
                                        <Box>
                                            <Typography
                                                color="primary"
                                                noWrap
                                                sx={{
                                                    cursor: 'pointer',
                                                    '&:hover': { textDecoration: 'underline' },
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    maxWidth: { xs: 180, sm: 250, md: '25vw' }
                                                }}
                                                onClick={() => { setProjectForDetails(p); setDetailsDialogOpen(true); }}
                                                title={p.title}
                                            >
                                                {p.title || "-"}
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary">{p.projectId || "-"} • {p.baseDept || "-"}</Typography>
                                        </Box>
                                    )
                                },
                                {
                                    id: 'guide', label: 'Guide', minWidth: 150, render: p => p.guide ? (
                                        <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, '&:hover': { textDecoration: 'underline' }, textOverflow: 'ellipsis', overflow: 'hidden' }} onClick={(e) => handleFacultyClick(p.guide, e)} title={p.guide}>{p.guide}</Typography>
                                    ) : "-"
                                },
                                {
                                    id: 'coGuide', label: 'Co-Guide', minWidth: 150, render: p => p.coGuide ? (
                                        <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, '&:hover': { textDecoration: 'underline' }, textOverflow: 'ellipsis', overflow: 'hidden' }} onClick={(e) => handleFacultyClick(p.coGuide, e)} title={p.coGuide}>{p.coGuide}</Typography>
                                    ) : "-"
                                },
                                { id: 'tasks', label: 'Total Tasks', minWidth: 120, render: p => <Chip size="small" label={tasks.filter(t => getTaskProjectId(t) === String(p._id)).length} color="secondary" /> },
                                {
                                    id: 'completed', label: 'Completed', minWidth: 150, render: p => {
                                        const stats = analytics?.projectStats?.find(ps => String(ps._id) === String(p._id));
                                        return `${stats?.submissionCount || 0}`;
                                    }
                                },
                                {
                                    id: 'actions', label: 'Actions', minWidth: 120, align: 'right', render: p => (
                                        <Tooltip title="View Tasks" arrow placement="top">
                                            <IconButton color="primary" onClick={() => setSelectedProject(p)}>
                                                <AssignmentIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )
                                }
                            ]}
                            rows={filteredProjects}
                            loading={loading}
                        />
                    )}

                    {filterBy === 'Departments' && !selectedDept && (
                        <DataTable
                            columns={[
                                { id: 'name', label: 'Department Name', minWidth: 200 },
                                { id: 'projects', label: 'Total Projects', minWidth: 150, render: d => <Chip size="small" label={d.deptProjects.length} color="primary" variant="outlined" /> },
                                { id: 'tasks', label: 'Total Tasks', minWidth: 150, render: d => <Chip size="small" label={d.totalTasks} color="secondary" /> },
                                { id: 'completed', label: 'Completed', minWidth: 150, render: d => `${d.totalSubmissions} (${d.avgCompletion}%)` },
                                { id: 'actions', label: 'Actions', minWidth: 120, align: 'right', render: d => <Button variant="outlined" size="small" onClick={() => setSelectedDept(d.name)}>View Projects</Button> }
                            ]}
                            rows={deptOptions.map(d => {
                                const deptProjects = projects.filter(p => p.baseDept === d);
                                const totalTasks = deptProjects.reduce((sum, p) => sum + tasks.filter(t => getTaskProjectId(t) === String(p._id)).length, 0);
                                const totalRegistered = deptProjects.reduce((sum, p) => sum + (p.registeredCount || 0), 0);

                                let totalSubmissions = 0;
                                let totalCompletionSum = 0;
                                let projectCountWithSubmissions = 0;

                                deptProjects.forEach(p => {
                                    const pStats = analytics?.projectStats?.find(ps => String(ps._id) === String(p._id));
                                    if (pStats) {
                                        totalSubmissions += (pStats.submissionCount || 0);
                                        if (pStats.submissionCount > 0) {
                                            totalCompletionSum += (pStats.avgProjectCompletion || 0);
                                            projectCountWithSubmissions++;
                                        }
                                    }
                                });

                                const avgCompletion = projectCountWithSubmissions > 0
                                    ? (totalCompletionSum / projectCountWithSubmissions).toFixed(1)
                                    : "0.0";

                                return { name: d, deptProjects, totalTasks, totalRegistered, totalSubmissions, avgCompletion };
                            })}
                            loading={loading}
                        />
                    )}

                    {filterBy === 'Departments' && selectedDept && !selectedProject && (
                        <Box>
                            <Button onClick={() => setSelectedDept(null)} sx={{ mb: 2 }} color="inherit">← Back to Departments</Button>
                            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Projects in {selectedDept}</Typography>
                            <DataTable
                                columns={[
                                    {
                                        id: 'title', label: 'Title', minWidth: 200, render: p => (
                                            <Box>
                                                <Typography
                                                    color="primary"
                                                    noWrap
                                                    sx={{
                                                        cursor: 'pointer',
                                                        '&:hover': { textDecoration: 'underline' },
                                                        textOverflow: 'ellipsis',
                                                        overflow: 'hidden',
                                                        maxWidth: { xs: 180, sm: 250, md: '25vw' }
                                                    }}
                                                    onClick={() => { setProjectForDetails(p); setDetailsDialogOpen(true); }}
                                                    title={p.title}
                                                >
                                                    {p.title || "-"}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">{p.projectId || "-"} • {p.baseDept || "-"}</Typography>
                                            </Box>
                                        )
                                    },
                                    {
                                        id: 'guide', label: 'Guide', minWidth: 150, render: p => p.guide ? (
                                            <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, '&:hover': { textDecoration: 'underline' }, textOverflow: 'ellipsis', overflow: 'hidden' }} onClick={(e) => handleFacultyClick(p.guide, e)} title={p.guide}>{p.guide}</Typography>
                                        ) : "-"
                                    },
                                    {
                                        id: 'coGuide', label: 'Co-Guide', minWidth: 150, render: p => p.coGuide ? (
                                            <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, '&:hover': { textDecoration: 'underline' }, textOverflow: 'ellipsis', overflow: 'hidden' }} onClick={(e) => handleFacultyClick(p.coGuide, e)} title={p.coGuide}>{p.coGuide}</Typography>
                                        ) : "-"
                                    },
                                    { id: 'tasks', label: 'Total Tasks', minWidth: 120, render: p => <Chip size="small" label={tasks.filter(t => getTaskProjectId(t) === String(p._id)).length} color="secondary" /> },
                                    {
                                        id: 'completed', label: 'Completed', minWidth: 150, render: p => {
                                            const stats = analytics?.projectStats?.find(ps => String(ps._id) === String(p._id));
                                            return `${stats?.submissionCount || 0} (${(stats?.avgProjectCompletion || 0).toFixed(1)}%)`;
                                        }
                                    },
                                    {
                                        id: 'actions', label: 'Actions', minWidth: 120, align: 'right', render: p => (
                                            <Tooltip title="View Tasks" arrow placement="top">
                                                <IconButton color="primary" onClick={() => setSelectedProject(p)}>
                                                    <AssignmentIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )
                                    }
                                ]}
                                rows={projects.filter(p => p.baseDept === selectedDept)}
                                loading={loading}
                            />
                        </Box>
                    )}

                    {selectedProject && (
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                                <Button onClick={() => setSelectedProject(null)} color="inherit">
                                    ← Back to {filterBy === 'Projects' ? 'Projects' : 'Department Projects'}
                                </Button>
                                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <SearchBar
                                        value={taskSearchQuery}
                                        onChange={(e) => setTaskSearchQuery(e.target.value)}
                                        onClear={() => setTaskSearchQuery('')}
                                        placeholder="Search Data"
                                    />
                                    {selectedTaskIds.length > 0 && (
                                        <Button
                                            variant="contained"
                                            color="error"
                                            startIcon={<DeleteIcon />}
                                            onClick={() => setBulkDeleteConfirmOpen(true)}
                                        >
                                            Delete Selected ({selectedTaskIds.length})
                                        </Button>
                                    )}
                                    <Button
                                        variant={selectionMode ? "contained" : "outlined"}
                                        color={selectionMode ? "secondary" : "primary"}
                                        startIcon={selectionMode ? <CloseIcon /> : <CheckBoxIcon />}
                                        onClick={() => {
                                            setSelectionMode(!selectionMode);
                                            setSelectedTaskIds([]);
                                        }}
                                    >
                                        {selectionMode ? "Cancel Selection" : "Select"}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<UploadFileIcon />}
                                        onClick={() => handleInternalNav('/admin/import-export', 'import-export', { tab: 1, type: 'tasks', projectId: selectedProject._id })}
                                    >
                                        Import Tasks
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={() => handleOpenCreate(selectedProject._id)}
                                    >
                                        Create Task
                                    </Button>
                                </Box>
                            </Box>
                            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Tasks for {selectedProject.title}</Typography>
                            <DataTable
                                selectionMode={selectionMode}
                                selectedIds={selectedTaskIds}
                                onSelectAll={handleSelectAllTasks}
                                onSelectOne={handleSelectOneTask}
                                columns={[
                                    { id: 'day', label: 'Day', minWidth: 80, render: t => <Typography variant="body2" fontWeight="bold">Day {t.order || "-"}</Typography> },
                                    { id: 'title', label: 'Title', minWidth: 200, render: t => <Typography noWrap sx={{ fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: { xs: 180, sm: 250, md: '25vw' }, cursor: 'pointer', '&:hover': { color: 'primary.main', textDecoration: 'underline' } }} title={t.title} onClick={() => handleOpenEdit(t)}>{t.title}</Typography> },
                                    { id: 'startDate', label: 'Start Date', minWidth: 120, render: t => <Chip size="small" label={t.startDate || "Not Set"} variant="outlined" color="primary" /> },
                                    { id: 'deadline', label: 'End Date', minWidth: 120, render: t => <Chip size="small" label={t.deadline || "Not Set"} variant="tonal" color="warning" /> },
                                    { id: 'status', label: 'Status', minWidth: 150, render: t => <StatusChip status={t.status || "Not Submitted"} /> },
                                    { id: 'remarks', label: 'Faculty Remarks', minWidth: 200, render: t => <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }} noWrap title={t.remarks}>{t.remarks || "-"}</Typography> }
                                ]}
                                rows={displayedTasks}
                                loading={loading}
                                emptyMessage="No tasks found"
                            />
                        </Box>
                    )}
                </Box>
            )}

            {tabIndex === 1 && analytics && (
                <Box>
                    {/* Summary Hero Cards */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <AssignmentIcon sx={{ color: '#0369a1' }} />
                                            <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800 }}>Total Tasks</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#0c4a6e">{analytics.totalTasks || 0}</Typography>
                                    </Box>
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="#0369a1" fontWeight="bold">From {analytics.totalSubmissions || 0} total submissions</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <AssessmentIcon sx={{ color: '#b45309' }} />
                                            <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800 }}>Delay Rate</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#78350f">{analytics.delayRate || 0}%</Typography>
                                    </Box>
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="#b45309" fontWeight="bold">Late vs on-time tasks</Typography>
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
                                            <Typography variant="caption" sx={{ color: '#047857', fontWeight: 800 }}>Avg Completion</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#064e3b">{analytics.averageCompletion || 0}%</Typography>
                                    </Box>
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="#047857" fontWeight="bold">Across all projects</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <TimelineIcon sx={{ color: '#6d28d9' }} />
                                            <Typography variant="caption" sx={{ color: '#6d28d9', fontWeight: 800 }}>Pending Review</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight={900} color="#4c1d95">{analytics.statusBreakdown?.pending || 0}</Typography>
                                    </Box>
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="#6d28d9" fontWeight="bold">Requires faculty attention</Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    <Grid container spacing={3}>
                        {/* Project Performance Progress */}
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Paper sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0' }} elevation={0}>
                                <Typography variant="h6" fontWeight="800" gutterBottom>Project Performance</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Average completion status of current projects</Typography>
                                <Stack spacing={3}>
                                    {(analytics.projectStats || []).slice(0, 10).map((p, i) => (
                                        <Box key={i}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                                                <Typography variant="body2" fontWeight="600">{p.projectName}</Typography>
                                                <Typography variant="caption" fontWeight="bold" color="primary.main">
                                                    {(p.avgProjectCompletion || 0).toFixed(1)}%
                                                </Typography>
                                            </Box>
                                            <Box sx={{ width: '100%', height: 8, bgcolor: '#f1f5f9', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                                                <Box sx={{
                                                    width: `${Math.min(100, Math.max(0, p.avgProjectCompletion || 0))}%`,
                                                    height: '100%',
                                                    bgcolor: 'primary.main',
                                                    borderRadius: 4,
                                                    transition: 'width 0.5s ease-in-out'
                                                }} />
                                            </Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                {p.submissionCount} submissions from {p.taskCount} tasks
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </Paper>
                        </Grid>

                        {/* Submission Breakdown */}
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Stack spacing={3}>
                                <Paper sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0' }} elevation={0}>
                                    <Typography variant="h6" fontWeight="800" sx={{ mb: 2 }}>Submission Quality</Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #dcfce7' }}>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
                                                <Typography variant="body2" fontWeight="600">Approved</Typography>
                                            </Stack>
                                            <Typography variant="h6" fontWeight="bold">{analytics.statusBreakdown?.approved || 0}</Typography>
                                        </Box>
                                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#fef9c3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fef08a' }}>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'warning.main' }} />
                                                <Typography variant="body2" fontWeight="600">Pending Review</Typography>
                                            </Stack>
                                            <Typography variant="h6" fontWeight="bold">{analytics.statusBreakdown?.pending || 0}</Typography>
                                        </Box>
                                        <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#fef2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fee2e2' }}>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'error.main' }} />
                                                <Typography variant="body2" fontWeight="600">Rejected</Typography>
                                            </Stack>
                                            <Typography variant="h6" fontWeight="bold">{analytics.statusBreakdown?.rejected || 0}</Typography>
                                        </Box>
                                    </Box>
                                </Paper>

                                <Paper sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: 'primary.main', color: 'primary.contrastText' }} elevation={0}>
                                    <Typography variant="h6" fontWeight="800" sx={{ mb: 1 }}>Deep Insights</Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        Highest activity is recorded in <b>{(analytics.projectStats?.[0]?.projectName || "N/A")}</b>.
                                        {analytics.averageCompletion > 70 ? " Overall engagement is high." : " Focus on increasing submission rates for better progress."}
                                    </Typography>
                                </Paper>
                            </Stack>
                        </Grid>
                    </Grid>
                </Box>
            )}

            <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Task Title"
                            fullWidth
                            required
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        />
                        <FormControl fullWidth required>
                            <InputLabel>Project</InputLabel>
                            <Select
                                value={projects.some(p => p._id.toString() === taskForm.project?.toString()) ? taskForm.project.toString() : ""}
                                label="Project"
                                onChange={(e) => setTaskForm({ ...taskForm, project: e.target.value })}
                                disabled={!!selectedProject} // Disable when inside a specific project view
                            >
                                {projects.map(p => (
                                    <MenuItem key={p._id} value={p._id}>{p.title}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {!internshipSettings?.startDate ? (
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                                <Typography variant="body2" color="textSecondary">Task Schedule Format:</Typography>
                                <Select
                                    size="small"
                                    value={inputType}
                                    onChange={(e) => {
                                        setInputType(e.target.value);
                                        setRawStartDate('');
                                        setRawEndDate('');
                                        setTaskForm({ ...taskForm, startDate: "", deadline: "" });
                                    }}
                                >
                                    <MenuItem value="Day">Relative Day (e.g., Day 1)</MenuItem>
                                    <MenuItem value="Date">Exact Date</MenuItem>
                                </Select>
                            </Box>
                        ) : (
                            <Alert severity="info" sx={{ py: 0 }}>
                                Internship starts on {new Date(internshipSettings.startDate).toLocaleDateString()}. Dates automatically convert to tracking Days.
                            </Alert>
                        )}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            {inputType === 'Date' ? (
                                <>
                                    <TextField
                                        label={internshipSettings?.startDate ? "Start Date (Calculates Day)" : "Start Date"}
                                        type="date"
                                        InputLabelProps={{ shrink: true }}
                                        required
                                        value={rawStartDate}
                                        onChange={(e) => {
                                            setRawStartDate(e.target.value);
                                            const computedVal = internshipSettings?.startDate ? getDayFromDate(e.target.value) : e.target.value;
                                            setTaskForm({ ...taskForm, startDate: computedVal });
                                        }}
                                        helperText={internshipSettings?.startDate && rawStartDate ? `Maps to: ${getDayFromDate(rawStartDate)}` : ""}
                                    />
                                    <TextField
                                        label={internshipSettings?.startDate ? "Deadline Date (Calculates Day)" : "Deadline Date"}
                                        type="date"
                                        InputLabelProps={{ shrink: true }}
                                        value={rawEndDate}
                                        onChange={(e) => {
                                            setRawEndDate(e.target.value);
                                            const computedVal = (internshipSettings?.startDate && e.target.value) ? getDayFromDate(e.target.value) : e.target.value;
                                            setTaskForm({ ...taskForm, deadline: computedVal });
                                        }}
                                        helperText={internshipSettings?.startDate && rawEndDate ? `Maps to: ${getDayFromDate(rawEndDate)}` : ""}
                                    />
                                </>
                            ) : (
                                <>
                                    <TextField
                                        label="Start Day"
                                        placeholder="e.g. Day 1"
                                        required
                                        value={taskForm.startDate}
                                        onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                                        helperText="Prefix with 'Day', like: Day 1"
                                    />
                                    <TextField
                                        label="Deadline Day"
                                        placeholder="e.g. Day 5"
                                        value={taskForm.deadline}
                                        onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                                    />
                                </>
                            )}
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    {editingTask && (
                        <Button
                            color="error"
                            onClick={() => {
                                setTaskDialogOpen(false);
                                setTaskToDelete(editingTask);
                                setDeleteConfirmOpen(true);
                            }}
                            sx={{ mr: 'auto' }}
                        >
                            Delete
                        </Button>
                    )}
                    <Button onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveTask}>Save</Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={deleteConfirmOpen}
                title="Delete Task"
                content="Are you sure you want to delete this task? This cannot be undone if there are no submissions."
                onConfirm={confirmDeleteTask}
                onCancel={() => { setDeleteConfirmOpen(false); setTaskToDelete(null); }}
                confirmText="Delete"
                confirmColor="error"
            />

            <ConfirmDialog
                open={bulkDeleteConfirmOpen}
                title="Bulk Delete Tasks"
                content={`Are you sure you want to delete the ${selectedTaskIds.length} selected tasks? This cannot be undone if there are no submissions.`}
                onConfirm={confirmBulkDeleteTasks}
                onCancel={() => setBulkDeleteConfirmOpen(false)}
                confirmText="Delete Multiple"
                confirmColor="error"
            />

            <ProjectDetailsDialog
                open={detailsDialogOpen}
                onClose={() => { setDetailsDialogOpen(false); setProjectForDetails(null); }}
                project={projectForDetails}
            />

            <FacultyDetailsDialog
                open={facultyDetailsOpen}
                onClose={() => setFacultyDetailsOpen(false)}
                facultyName={selectedFacultyName}
            />

            {/* Submissions Dialog */}
            <Dialog open={submissionsDialogOpen} onClose={() => setSubmissionsDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Submissions for {taskForSubmissions?.title}</DialogTitle>
                <DialogContent dividers>
                    {(!taskForSubmissions?.submissions || taskForSubmissions.submissions.length === 0) ? (
                        <Typography color="textSecondary">No submissions found.</Typography>
                    ) : (
                        <Stack spacing={2}>
                            {taskForSubmissions.submissions.map((sub, i) => (
                                <Card key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {sub.student?.name || "Unknown Student"}
                                            </Typography>
                                            <Typography variant="body2" color="textSecondary">
                                                Regd: {sub.student?.studentId || "N/A"}
                                            </Typography>
                                        </Box>
                                        <StatusChip status={sub.status || "Not Submitted"} />
                                    </Box>

                                    <Grid container spacing={2} sx={{ mt: 1 }}>
                                        <Grid size={{ xs: 6, sm: 4 }}>
                                            <Typography variant="caption" color="textSecondary" display="block">Original %</Typography>
                                            <Typography variant="body2" fontWeight="bold">{sub.completionPercentage || 0}%</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 6, sm: 4 }}>
                                            <Typography variant="caption" color="textSecondary" display="block">Adjusted %</Typography>
                                            <Typography variant="body2" fontWeight="bold">{sub.facultyAdjustedPercentage ?? sub.completionPercentage ?? 0}%</Typography>
                                        </Grid>
                                    </Grid>

                                    {sub.remarks && (
                                        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                            <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 0.5 }}>Faculty Remarks</Typography>
                                            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"{sub.remarks}"</Typography>
                                        </Box>
                                    )}
                                </Card>
                            ))}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubmissionsDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
