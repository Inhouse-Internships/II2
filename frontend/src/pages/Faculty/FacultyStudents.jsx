import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Card, CardContent, CircularProgress, Alert, Paper, Stack, Grid,
    TextField, MenuItem, Select, FormControl, InputLabel, Avatar, Tooltip, IconButton,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider
} from '@mui/material';
import {
    People as PeopleIcon,
    CheckCircleOutline as CheckCircleOutlineIcon,
    HourglassEmpty as HourglassEmptyIcon,
    School as SchoolIcon,
    Assignment as AssignmentIcon,
    EventAvailable as EventAvailableIcon,
    Close as CloseIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    Badge as BadgeIcon,
    AccountTree as AccountTreeIcon,
    RateReview as RateReviewIcon
} from "@mui/icons-material";

import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusChip from '../../components/common/StatusChip';
import SearchBar from '../../components/common/SearchBar';

const AVATAR_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#f97316', '#6366f1'
];

function getAvatarColor(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function FacultyStudents(props) {
    const navigate = useNavigate();
    const context = props.context || {};
    const { projects = [] } = props; // Destructure projects from props
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState(projects.length > 0 ? projects[0]._id : 'All');
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    useEffect(() => {
        if (projects.length > 0) {
            fetchStudents();
        }
    }, [projects, selectedProjectId]);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            let allStudents = [];

            if (selectedProjectId === 'All') {
                const results = await Promise.all(projects.map(p =>
                    apiFetch(`/api/faculty/projects/${p._id}/students`).then(res => res.json())
                ));
                results.forEach((data, index) => {
                    const projStudents = data.students || (Array.isArray(data) ? data : (data.data || []));
                    const enriched = projStudents.map(s => ({
                        ...s,
                        projectTitle: projects[index].title,
                        projectId: projects[index].projectId,
                        projectObjId: projects[index]._id
                    }));
                    allStudents = [...allStudents, ...enriched];
                });
            } else {
                const res = await apiFetch(`/api/faculty/projects/${selectedProjectId}/students`);
                if (!res.ok) throw new Error('Failed to load students');
                const data = await res.json();
                const projStudents = data.students || (Array.isArray(data) ? data : (data.data || []));
                const project = projects.find(p => p._id === selectedProjectId);
                allStudents = projStudents.map(s => ({
                    ...s,
                    projectTitle: project?.title,
                    projectId: project?.projectId,
                    projectObjId: selectedProjectId
                }));
            }

            setStudents(allStudents);
        } catch (err) {
            setError(err.message || 'Failed to fetch students data');
        } finally {
            setLoading(false);
        }
    }, [projects, selectedProjectId]);

    const filteredStudents = useMemo(() => {
        const q = searchQuery.toLowerCase();
        if (!q) return students;
        return students.filter(s =>
            (s.name || '').toLowerCase().includes(q) ||
            (s.studentId || '').toLowerCase().includes(q) ||
            (s.department || '').toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q)
        );
    }, [students, searchQuery]);

    const stats = useMemo(() => {
        const total = students.length;
        const approved = students.filter(s => s.status === 'Approved').length;
        const pending = students.filter(s => s.status === 'Pending').length;
        const depts = new Set(students.map(s => s.department)).size;
        return { total, approved, pending, depts };
    }, [students]);

    const openDetails = (s) => {
        setSelectedStudent(s);
        setDetailsOpen(true);
    };

    const approve = async (id) => {
        try {
            const res = await apiFetch(`/api/faculty/students/${id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId: selectedStudent.projectObjId })
            });
            if (res.ok) {
                fetchStudents();
                setDetailsOpen(false);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to approve student");
            }
        } catch (err) {
            alert("Error approving student");
        }
    };

    const reject = async (id) => {
        try {
            const res = await apiFetch(`/api/faculty/students/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId: selectedStudent.projectObjId })
            });
            if (res.ok) {
                fetchStudents();
                setDetailsOpen(false);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to reject student");
            }
        } catch (err) {
            alert("Error rejecting student");
        }
    };

    const updateInterview = async (projectId, status, note) => {
        if (!selectedStudent) return;
        try {
            const res = await apiFetch(`/api/faculty/interview-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent._id,
                    projectId,
                    status,
                    note
                })
            });
            if (res.ok) {
                fetchStudents();
                setDetailsOpen(false);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to update interview status");
            }
        } catch (err) {
            alert("Error updating interview status");
        }
    };

    const columns = [
        {
            id: 'name',
            label: 'Student',
            minWidth: 220,
            render: (s) => (
                <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    onClick={() => openDetails(s)}
                    sx={{ cursor: 'pointer', '&:hover .student-name': { color: 'primary.main' } }}
                >
                    <Avatar
                        sx={{
                            width: 36,
                            height: 36,
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            bgcolor: getAvatarColor(s.name),
                            flexShrink: 0
                        }}
                    >
                        {(s.name || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography
                            className="student-name"
                            variant="body2"
                            fontWeight={700}
                            color="#1e293b"
                            sx={{ transition: 'color 0.15s', lineHeight: 1.2 }}
                        >
                            {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{s.email}</Typography>
                    </Box>
                </Stack>
            )
        },
        {
            id: 'studentId',
            label: 'Reg. ID',
            minWidth: 130,
            render: (s) => (
                <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ px: 1.5, py: 0.4, borderRadius: 1.5, bgcolor: '#f1f5f9', color: '#475569', display: 'inline-block', fontFamily: 'monospace', fontSize: '0.8rem' }}
                >
                    {s.studentId}
                </Typography>
            )
        },
        {
            id: 'department',
            label: 'Department',
            minWidth: 150,
            render: (s) => (
                <Typography variant="body2" color="#64748b">{s.department || '—'}</Typography>
            )
        },
        {
            id: 'project',
            label: 'Project',
            render: (s) => (
                <Box>
                    <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ lineHeight: 1.3 }}>
                        {s.projectTitle || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{s.projectId}</Typography>
                </Box>
            )
        },
        {
            id: 'level',
            label: 'Level',
            minWidth: 90,
            render: (s) => (
                <Chip
                    label={`Level ${s.level || 1}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 800, borderRadius: 1.5, color: 'primary.main', borderColor: 'primary.light', fontSize: '0.75rem' }}
                />
            )
        },
        {
            id: 'interviewStatus',
            label: 'Interview',
            minWidth: 120,
            render: (s) => (
                <Stack spacing={0.5}>
                    <StatusChip
                        status={s.interviewStatus === 'Qualified' ? 'approved' : (s.interviewStatus === 'Rejected' ? 'rejected' : 'pending')}
                        label={s.interviewStatus}
                    />
                    {!s.isPrimary && <Typography variant="caption" color="text.secondary">Choice</Typography>}
                </Stack>
            )
        },
        {
            id: 'status',
            label: 'Final Selected',
            minWidth: 120,
            render: (s) => <StatusChip status={(s.status || 'Pending').toLowerCase()} />
        },
        {
            id: 'actions',
            label: 'Manage',
            minWidth: 150,
            render: (s) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title={s.projectObjId ? "Daily status" : "No project"}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={!s.projectObjId}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    context.setSection("tasks", { projectId: s.projectObjId, studentId: s._id });
                                }}
                            >
                                <AssignmentIcon fontSize="small" color={s.projectObjId ? "primary" : "disabled"} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={s.projectObjId ? "Attendance" : "No project"}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={!s.projectObjId}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    context.setSection("attendance", { projectId: s.projectObjId, studentId: s._id });
                                }}
                            >
                                <CheckCircleOutlineIcon fontSize="small" color={s.projectObjId ? "success" : "disabled"} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={s.projectObjId ? "Reviews" : "No project"}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={!s.projectObjId}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    context.setSection("reviews", { projectId: s.projectObjId, studentId: s._id });
                                }}
                            >
                                <RateReviewIcon fontSize="small" color={s.projectObjId ? "secondary" : "disabled"} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            )
        }
    ];

    if (projects.length === 0) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 3 }}>
                    No active projects assigned for mentorship. You cannot view student data yet.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
            <PageHeader
                title="Student Directory"
                subtitle="Comprehensive roster of students under your mentorship"
            />

            {/* STATS CARDS */}
            {!loading && students.length > 0 && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {[
                        {
                            label: 'Total Students',
                            value: stats.total,
                            icon: <PeopleIcon />,
                            color: '#0ea5e9',
                            bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'
                        },
                        {
                            label: 'Approved',
                            value: stats.approved,
                            icon: <CheckCircleOutlineIcon />,
                            color: '#10b981',
                            bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                        },
                        {
                            label: 'Pending',
                            value: stats.pending,
                            icon: <HourglassEmptyIcon />,
                            color: '#f59e0b',
                            bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                        },
                        {
                            label: 'Departments',
                            value: stats.depts,
                            icon: <SchoolIcon />,
                            color: '#8b5cf6',
                            bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                        }
                    ].map((stat, idx) => (
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
                            <Card
                                elevation={0}
                                sx={{
                                    height: '100%',
                                    borderRadius: 4,
                                    background: stat.bg,
                                    border: '1px solid rgba(0,0,0,0.05)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 12px 20px -10px rgba(0,0,0,0.1)' }
                                }}
                            >
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.5)', color: stat.color, display: 'flex' }}>
                                            {stat.icon}
                                        </Box>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: 1 }}>
                                            {stat.label.toUpperCase()}
                                        </Typography>
                                    </Box>
                                    <Typography variant="h3" fontWeight={900} color="#1e293b">{stat.value}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* FILTER BAR */}
            <Paper sx={{ p: 2, mb: 4, borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Filter by Project</InputLabel>
                            <Select
                                value={selectedProjectId}
                                label="Filter by Project"
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                sx={{ borderRadius: 2, bgcolor: '#f8fafc' }}
                            >
                                <MenuItem value="All">All Guided Projects</MenuItem>
                                {projects.map((p) => (
                                    <MenuItem key={p._id} value={p._id}>{p.title}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <SearchBar
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClear={() => setSearchQuery('')}
                            placeholder="Search Data"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ py: 10, textAlign: 'center' }}>
                    <CircularProgress size={50} thickness={4} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading students...</Typography>
                </Box>
            ) : (
                <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <Box sx={{ p: 2, borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" fontWeight={700} color="#1e293b">
                            Student Roster
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found
                        </Typography>
                    </Box>
                    <DataTable
                        columns={columns}
                        rows={filteredStudents}
                        emptyMessage="No students found matching your criteria."
                    />
                </Card>
            )}

            {/* STUDENT DETAILS DIALOG */}
            <Dialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}
            >
                {selectedStudent && (
                    <>
                        {/* Dialog Header with gradient */}
                        <Box
                            sx={{
                                p: 3,
                                background: `linear-gradient(135deg, ${getAvatarColor(selectedStudent.name)}22 0%, ${getAvatarColor(selectedStudent.name)}11 100%)`,
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar
                                    sx={{
                                        width: 56,
                                        height: 56,
                                        fontSize: '1.4rem',
                                        fontWeight: 900,
                                        bgcolor: getAvatarColor(selectedStudent.name),
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }}
                                >
                                    {(selectedStudent.name || '?').charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                    <Typography variant="h6" fontWeight={800} color="#1e293b">
                                        {selectedStudent.name}
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                                        <StatusChip status={(selectedStudent.status || 'pending').toLowerCase()} />
                                        <Chip
                                            label={`Level ${selectedStudent.level || 1}`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontWeight: 800, borderRadius: 1.5, color: 'primary.main', borderColor: 'primary.light', fontSize: '0.72rem' }}
                                        />
                                    </Stack>
                                </Box>
                            </Stack>
                            <IconButton onClick={() => setDetailsOpen(false)} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Box>

                        <DialogContent sx={{ p: 3 }}>
                            <Stack spacing={2.5}>
                                {/* Contact Info */}
                                <Box>
                                    <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 1.2, fontSize: '0.7rem' }}>
                                        Contact Information
                                    </Typography>
                                    <Stack spacing={1.5} mt={1}>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#f1f5f9', color: '#64748b', display: 'flex' }}>
                                                <EmailIcon fontSize="small" />
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">Email</Typography>
                                                <Typography variant="body2" fontWeight={600}>{selectedStudent.email || '—'}</Typography>
                                            </Box>
                                        </Stack>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#f1f5f9', color: '#64748b', display: 'flex' }}>
                                                <PhoneIcon fontSize="small" />
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">Phone</Typography>
                                                <Typography variant="body2" fontWeight={600}>{selectedStudent.phone || '—'}</Typography>
                                            </Box>
                                        </Stack>
                                    </Stack>
                                </Box>

                                <Divider />

                                {/* Academic Info */}
                                <Box>
                                    <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 1.2, fontSize: '0.7rem' }}>
                                        Academic Details
                                    </Typography>
                                    <Grid container spacing={2} mt={0.5}>
                                        <Grid size={6}>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#e0f2fe', color: '#0ea5e9', display: 'flex' }}>
                                                    <BadgeIcon fontSize="small" />
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">Reg. ID</Typography>
                                                    <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                                                        {selectedStudent.studentId || '—'}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Grid>
                                        <Grid size={6}>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#ede9fe', color: '#8b5cf6', display: 'flex' }}>
                                                    <SchoolIcon fontSize="small" />
                                                </Box>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">Department</Typography>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {selectedStudent.department || '—'}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Grid>
                                    </Grid>
                                </Box>

                                <Divider />

                                {/* Project Info */}
                                <Box>
                                    <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 1.2, fontSize: '0.7rem' }}>
                                        Project Assignment
                                    </Typography>
                                    <Stack direction="row" spacing={1.5} alignItems="flex-start" mt={1}>
                                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#dcfce7', color: '#10b981', display: 'flex', mt: 0.3 }}>
                                            <AccountTreeIcon fontSize="small" />
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ lineHeight: 1.3 }}>
                                                {selectedStudent.projectTitle || '—'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">{selectedStudent.projectId}</Typography>
                                        </Box>
                                    </Stack>
                                </Box>

                                <Divider />

                                {/* Interview Evaluation Stage */}
                                <Box>
                                    <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 1.2, fontSize: '0.7rem' }}>
                                        Interview Evaluation
                                    </Typography>
                                    <Box sx={{ mt: 1 }}>
                                        <Grid container spacing={1} direction="column">
                                            <Grid item>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    size="small"
                                                    label="Evaluation Result"
                                                    value={selectedStudent.interviewStatus || 'Pending'}
                                                    onChange={(e) => updateInterview(selectedStudent.projectObjId, e.target.value, selectedStudent.interviewNote)}
                                                >
                                                    <MenuItem value="Pending">Pending</MenuItem>
                                                    <MenuItem value="Qualified">Qualified</MenuItem>
                                                    <MenuItem value="Rejected">Rejected</MenuItem>
                                                </TextField>
                                            </Grid>
                                            <Grid item>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    multiline
                                                    rows={2}
                                                    label="Interview Note"
                                                    value={selectedStudent.interviewNote || ''}
                                                    placeholder="Add interview feedback..."
                                                    onBlur={(e) => updateInterview(selectedStudent.projectObjId, selectedStudent.interviewStatus, e.target.value)}
                                                    onChange={(e) => setSelectedStudent({ ...selectedStudent, interviewNote: e.target.value })}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Box>
                            </Stack>
                        </DialogContent>

                        <DialogActions sx={{ p: 3, pt: 0, borderTop: '1px solid #f1f5f9', gap: 1 }}>
                            {selectedStudent.status === "Pending" && (
                                <>
                                    <Button size="small" variant="contained" onClick={() => approve(selectedStudent._id)} sx={{ mr: 1, textTransform: 'none', fontWeight: 600 }}>Approve</Button>
                                    <Button size="small" color="error" onClick={() => reject(selectedStudent._id)} sx={{ textTransform: 'none', fontWeight: 600 }}>Reject</Button>
                                    <Box sx={{ flexGrow: 1 }} />
                                </>
                            )}
                            <Button
                                onClick={() => setDetailsOpen(false)}
                                sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
                            >
                                Close
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </Box>
    );
}
