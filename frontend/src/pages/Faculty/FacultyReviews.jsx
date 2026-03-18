import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, CircularProgress, Alert, Paper, Stack, Button, IconButton, Tooltip, Grid, TextField, MenuItem, Select, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Avatar
} from '@mui/material';
import {
    EventAvailable as EventAvailableIcon,
    Assessment as AssessmentIcon,
    RateReview as RateReviewIcon,
    Close as CloseIcon,
    Description as DescriptionIcon
} from "@mui/icons-material";

import reviewService from '../../core/services/reviewService';
import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import StatusChip from '../../components/common/StatusChip';

export default function FacultyReviews({ projects = [], context = {} }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState(context.navState?.projectId || (projects.length > 0 ? projects[0]._id : ''));
    const [reviews, setReviews] = useState([]);
    const [students, setStudents] = useState([]);

    // Dialog states
    const [evalOpen, setEvalOpen] = useState(false);
    const [currentEvalReview, setCurrentEvalReview] = useState(null);

    // Summary filter
    const [summaryFilter, setSummaryFilter] = useState('all');
    const [selectedReviewType, setSelectedReviewType] = useState('Review 1');

    // Evaluation form
    const [evalForm, setEvalForm] = useState({
        scores: [],
        feedback: '',
        completionPercentage: '',
        implementationStatus: '',
        output: ''
    });

    useEffect(() => {
        if (projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projects[0]._id);
        }
    }, [projects]);

    useEffect(() => {
        if (selectedProjectId) {
            fetchData();
        }
    }, [selectedProjectId]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [projRes, revRes] = await Promise.all([
                apiFetch(`/api/faculty/projects/${selectedProjectId}/students`),
                reviewService.getProjectReviews(selectedProjectId)
            ]);

            if (projRes.ok) {
                const projData = await projRes.json();
                setStudents(projData.students || []);
            }

            if (revRes.ok) {
                const revData = await revRes.json();
                setReviews(revData.reviews || []);
            } else {
                setError('Failed to load review data');
            }
        } catch (err) {
            setError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    // Build student-wise review status table data
    const studentReviewData = useMemo(() => {
        return students.map(student => {
            const r1 = reviews.find(r => r.title === 'Review 1');
            const r2 = reviews.find(r => r.title === 'Review 2');
            const r3 = reviews.find(r => r.title === 'Review 3');
            return {
                _id: student._id,
                name: student.name,
                regNo: student.studentId || student.registrationNumber || '-',
                review1: r1 ? r1.status : 'NOT_SCHEDULED',
                review1Data: r1 || null,
                review2: r2 ? r2.status : 'NOT_SCHEDULED',
                review2Data: r2 || null,
                review3: r3 ? r3.status : 'NOT_SCHEDULED',
                review3Data: r3 || null
            };
        });
    }, [students, reviews]);

    // Summary stats
    const projectStats = useMemo(() => {
        const r1 = reviews.find(r => r.title === selectedReviewType);
        return {
            total: students.length,
            completed: r1?.status === 'COMPLETED' ? students.length : 0,
            scheduled: r1?.status === 'SCHEDULED' ? students.length : 0,
            notScheduled: !r1 ? students.length : 0
        };
    }, [reviews, students, selectedReviewType]);

    // Available review titles
    const reviewTitles = useMemo(() => {
        const titles = [...new Set(reviews.map(r => r.title))];
        if (!titles.includes('Review 1')) titles.unshift('Review 1');
        if (!titles.includes('Review 2') && !titles.includes('Review 2')) titles.push('Review 2');
        if (!titles.includes('Review 3') && !titles.includes('Review 3')) titles.push('Review 3');
        return [...new Set(titles)];
    }, [reviews]);

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

    const handleSubmitEvaluation = async () => {
        if (!window.confirm("Are you sure? This will finalize the evaluation.")) return;
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
                fetchData();
            }
        } catch (err) {
            alert("Evaluation submit error");
        }
    };

    const getStatusLabel = (status) => {
        if (status === 'NOT_SCHEDULED') return 'Not Scheduled';
        if (status === 'COMPLETED') return 'Completed';
        if (status === 'SCHEDULED') return 'Scheduled';
        return status.charAt(0) + status.slice(1).toLowerCase();
    };

    const getStatusColor = (status) => {
        if (status === 'COMPLETED') return 'success';
        if (status === 'SCHEDULED') return 'warning';
        return 'default';
    };

    // Filter students based on summary card click
    const filteredStudentData = useMemo(() => {
        if (summaryFilter === 'all') return studentReviewData;
        return studentReviewData.filter(row => {
            let status;
            if (selectedReviewType === 'Review 1') status = row.review1;
            else if (selectedReviewType === 'Review 2') status = row.review2;
            else if (selectedReviewType === 'Review 3') status = row.review3;
            else status = row.review1;

            if (summaryFilter === 'completed') return status === 'COMPLETED';
            if (summaryFilter === 'scheduled') return status === 'SCHEDULED';
            if (summaryFilter === 'notScheduled') return status === 'NOT_SCHEDULED';
            return true;
        });
    }, [studentReviewData, summaryFilter, selectedReviewType]);

    if (projects.length === 0) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 3 }}>
                    No projects assigned. Review section will be available once you are assigned to a project.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
            <PageHeader
                title="Review Management"
                subtitle="Track and evaluate student review progress"
            />

            {/* Project Selector */}
            <Paper sx={{ p: 2, mb: 4, borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Select Project</InputLabel>
                            <Select
                                value={selectedProjectId}
                                label="Select Project"
                                onChange={(e) => { setSelectedProjectId(e.target.value); setSummaryFilter('all'); }}
                                sx={{ borderRadius: 2, bgcolor: '#f8fafc' }}
                            >
                                {projects.map((p) => (
                                    <MenuItem key={p._id} value={p._id}>{p.title} ({p.projectId})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress size={50} thickness={4} /></Box>
            ) : (
                <>
                    {/* Review Type Selector & Summary */}
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <Select
                                value={selectedReviewType}
                                onChange={(e) => { setSelectedReviewType(e.target.value); setSummaryFilter('all'); }}
                                sx={{ fontWeight: 700, fontSize: '1.1rem', borderRadius: 3, bgcolor: 'white' }}
                            >
                                {reviewTitles.map((t) => (
                                    <MenuItem key={t} value={t} sx={{ fontWeight: 600 }}>{t}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Typography variant="h6" fontWeight={700}>
                            Summary
                        </Typography>
                    </Stack>

                    {/* Summary Cards */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <Card
                                onClick={() => setSummaryFilter('all')}
                                sx={{
                                    bgcolor: summaryFilter === 'all' ? '#e0e7ff' : '#f8fafc',
                                    border: summaryFilter === 'all' ? '2px solid #6366f1' : '1px solid #e2e8f0',
                                    borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                                }}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography variant="overline" color="textSecondary" fontWeight={600}>Total Students</Typography>
                                    <Typography variant="h3" fontWeight={800} color="primary.main">{projectStats.total}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <Card
                                onClick={() => setSummaryFilter('completed')}
                                sx={{
                                    bgcolor: summaryFilter === 'completed' ? '#dcfce7' : '#f0fdf4',
                                    border: summaryFilter === 'completed' ? '2px solid #22c55e' : '1px solid #dcfce7',
                                    borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                                }}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography variant="overline" color="textSecondary" fontWeight={600}>Completed</Typography>
                                    <Typography variant="h3" fontWeight={800} color="success.main">{projectStats.completed}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <Card
                                onClick={() => setSummaryFilter('scheduled')}
                                sx={{
                                    bgcolor: summaryFilter === 'scheduled' ? '#dbeafe' : '#eff6ff',
                                    border: summaryFilter === 'scheduled' ? '2px solid #3b82f6' : '1px solid #dbeafe',
                                    borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                                }}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography variant="overline" color="textSecondary" fontWeight={600}>Scheduled</Typography>
                                    <Typography variant="h3" fontWeight={800} color="info.main">{projectStats.scheduled}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <Card
                                onClick={() => setSummaryFilter('notScheduled')}
                                sx={{
                                    bgcolor: summaryFilter === 'notScheduled' ? '#ffedd5' : '#fff7ed',
                                    border: summaryFilter === 'notScheduled' ? '2px solid #f97316' : '1px solid #ffedd5',
                                    borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
                                }}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography variant="overline" color="textSecondary" fontWeight={600}>Not Scheduled</Typography>
                                    <Typography variant="h3" fontWeight={800} color="warning.main">{projectStats.notScheduled}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Student-wise Review Status Table */}
                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 2, mb: 2 }}>
                        Student-wise Review Status
                    </Typography>

                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0', mb: 4, overflow: 'hidden' }}>
                        <Table>
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800, color: '#475569', py: 2.5 }}>Student Name</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Reg. No</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 1</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 2</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Review 3</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredStudentData.length > 0 ? (
                                    filteredStudentData.map((row) => (
                                        <TableRow key={row._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                            <TableCell component="th" scope="row">
                                                <Typography variant="subtitle2" fontWeight={700} color="#1e293b">{row.name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">{row.regNo}</Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={getStatusLabel(row.review1)}
                                                    color={getStatusColor(row.review1)}
                                                    variant={row.review1 === 'NOT_SCHEDULED' ? 'outlined' : 'filled'}
                                                    size="small"
                                                    onClick={() => row.review1Data && openEvaluationPanel(row.review1Data)}
                                                    sx={{ fontWeight: 700, borderRadius: 2, minWidth: 100, cursor: row.review1Data ? 'pointer' : 'default' }}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={getStatusLabel(row.review2)}
                                                    color={getStatusColor(row.review2)}
                                                    variant={row.review2 === 'NOT_SCHEDULED' ? 'outlined' : 'filled'}
                                                    size="small"
                                                    onClick={() => row.review2Data && openEvaluationPanel(row.review2Data)}
                                                    sx={{ fontWeight: 700, borderRadius: 2, minWidth: 100, cursor: row.review2Data ? 'pointer' : 'default' }}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={getStatusLabel(row.review3)}
                                                    color={getStatusColor(row.review3)}
                                                    variant={row.review3 === 'NOT_SCHEDULED' ? 'outlined' : 'filled'}
                                                    size="small"
                                                    onClick={() => row.review3Data && openEvaluationPanel(row.review3Data)}
                                                    sx={{ fontWeight: 700, borderRadius: 2, minWidth: 100, cursor: row.review3Data ? 'pointer' : 'default' }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                            <DescriptionIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
                                            <Typography color="text.secondary" fontWeight={600}>
                                                {students.length === 0 ? 'No students found for this project.' : 'No students match the selected filter.'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}

            {/* EVALUATION DIALOG */}
            <Dialog open={evalOpen} onClose={() => setEvalOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 5 } }}>
                <DialogTitle sx={{ bgcolor: '#f8fafc', p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h5" fontWeight={900} color="#1e293b">{currentEvalReview?.title}</Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Review Evaluation</Typography>
                        </Box>
                        <IconButton onClick={() => setEvalOpen(false)} size="small"><CloseIcon /></IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 3 }}>
                    <Box sx={{ mb: 4, p: 2, bgcolor: '#f1f5f9', borderRadius: 3 }}>
                        <Typography variant="caption" fontWeight={800} color="primary" sx={{ display: 'block', mb: 1 }}>STUDENTS</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {students.map(s => (
                                <Chip key={s._id} label={s.name} avatar={<Avatar>{s.name.charAt(0)}</Avatar>} size="small" sx={{ bgcolor: 'white', fontWeight: 700 }} />
                            ))}
                        </Box>
                    </Box>

                    <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 3, mb: 4 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800 }}>Evaluation Metric</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800 }}>Max Marks</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800 }}>Awarded Marks</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {currentEvalReview?.evaluationCriteria.map((c, i) => {
                                    const sc = evalForm.scores.find(s => s.label === c.label) || { awardedMarks: 0 };
                                    const isCompleted = currentEvalReview?.status === 'COMPLETED';
                                    return (
                                        <TableRow key={i}>
                                            <TableCell sx={{ fontWeight: 600 }}>{c.label}</TableCell>
                                            <TableCell align="center"><Chip label={c.maxMarks} size="small" variant="outlined" /></TableCell>
                                            <TableCell align="center">
                                                {isCompleted ? (
                                                    <Typography variant="h6" fontWeight={900} color="primary.main">{sc.awardedMarks}</Typography>
                                                ) : (
                                                    <TextField
                                                        type="number"
                                                        size="small"
                                                        sx={{ width: 80, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                                        value={sc.awardedMarks}
                                                        inputProps={{ min: 0, max: c.maxMarks }}
                                                        onChange={(e) => {
                                                            let val = Number(e.target.value);
                                                            if (val < 0) val = 0;
                                                            if (val > Number(c.maxMarks)) val = Number(c.maxMarks);
                                                            const updated = evalForm.scores.map(s => s.label === c.label ? { ...s, awardedMarks: val } : s);
                                                            setEvalForm({ ...evalForm, scores: updated });
                                                        }}
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                                    <TableCell colSpan={2} align="right"><Typography fontWeight={900}>TOTAL SCORE</Typography></TableCell>
                                    <TableCell align="center">
                                        <Typography variant="h5" fontWeight={1000} color="primary.dark">
                                            {evalForm.scores.reduce((sum, s) => sum + (s.awardedMarks || 0), 0)}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Stack spacing={3}>
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Typography variant="caption" fontWeight={800} color="text.secondary" gutterBottom>COMPLETION (%)</Typography>
                                {currentEvalReview?.status === 'COMPLETED' ? (
                                    <Typography variant="h6" fontWeight={800}>{evalForm.completionPercentage}%</Typography>
                                ) : (
                                    <TextField
                                        fullWidth size="small" type="number" placeholder="0-100"
                                        value={evalForm.completionPercentage}
                                        onChange={(e) => setEvalForm({ ...evalForm, completionPercentage: e.target.value })}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                )}
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Typography variant="caption" fontWeight={800} color="text.secondary" gutterBottom>IMPLEMENTATION STATUS</Typography>
                                {currentEvalReview?.status === 'COMPLETED' ? (
                                    <Box sx={{ mt: 1 }}><StatusChip status={evalForm.implementationStatus?.toLowerCase() || 'pending'} /></Box>
                                ) : (
                                    <FormControl fullWidth size="small">
                                        <Select
                                            value={evalForm.implementationStatus}
                                            onChange={(e) => setEvalForm({ ...evalForm, implementationStatus: e.target.value })}
                                            sx={{ borderRadius: 2 }}
                                        >
                                            <MenuItem value="Pending">Pending</MenuItem>
                                            <MenuItem value="In Progress">In Progress</MenuItem>
                                            <MenuItem value="Completed">Completed</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Typography variant="caption" fontWeight={800} color="text.secondary" gutterBottom>OUTPUT / DELIVERABLE</Typography>
                                {currentEvalReview?.status === 'COMPLETED' ? (
                                    <Typography variant="h6" fontWeight={800}>{evalForm.output || 'N/A'}</Typography>
                                ) : (
                                    <FormControl fullWidth size="small">
                                        <Select
                                            value={evalForm.output}
                                            onChange={(e) => setEvalForm({ ...evalForm, output: e.target.value })}
                                            sx={{ borderRadius: 2 }}
                                            displayEmpty
                                        >
                                            <MenuItem value="" disabled>Select Output</MenuItem>
                                            <MenuItem value="Prototype">Prototype</MenuItem>
                                            <MenuItem value="Working Model">Working Model</MenuItem>
                                            <MenuItem value="Report Submitted">Report Submitted</MenuItem>
                                            <MenuItem value="Code Base">Code Base</MenuItem>
                                            <MenuItem value="Presentation">Presentation</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}
                            </Grid>
                        </Grid>
                        <Box>
                            <Typography variant="caption" fontWeight={800} color="text.secondary" gutterBottom>FEEDBACK</Typography>
                            {currentEvalReview?.status === 'COMPLETED' ? (
                                <Paper sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                    <Typography variant="body2">{evalForm.feedback || 'No feedback recorded.'}</Typography>
                                </Paper>
                            ) : (
                                <TextField
                                    fullWidth multiline rows={3}
                                    placeholder="Enter feedback for the student team..."
                                    value={evalForm.feedback}
                                    onChange={(e) => setEvalForm({ ...evalForm, feedback: e.target.value })}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                />
                            )}
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, bgcolor: '#f8fafc' }}>
                    <Button onClick={() => setEvalOpen(false)} sx={{ fontWeight: 700 }}>Close</Button>
                    {currentEvalReview?.status === 'SCHEDULED' && (
                        <Button
                            variant="contained"
                            color="success"
                            onClick={handleSubmitEvaluation}
                            sx={{ borderRadius: 2, px: 5, py: 1, fontWeight: 800, textTransform: 'none' }}
                        >
                            Submit Evaluation
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
