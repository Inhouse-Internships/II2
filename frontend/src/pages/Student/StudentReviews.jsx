import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Divider,
    Stack,
    Chip,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    Paper
} from '@mui/material';
import reviewService from '../../core/services/reviewService';
import DataTable from '../../components/common/DataTable';

export default function StudentReviews() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reviews, setReviews] = useState([]);

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        try {
            const res = await reviewService.getStudentHistory();
            const data = await res.json();
            if (res.ok) {
                setReviews(data.reviews || []);
            } else {
                setError(data.message || 'Failed to fetch reviews');
            }
        } catch (err) {
            setError('Network error while fetching reviews');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    const upcomingReviews = reviews.filter(r => r.status === 'SCHEDULED');
    const pastReviews = reviews.filter(r => r.status === 'COMPLETED');

    return (
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                My Reviews
            </Typography>

            {/* Upcoming Reviews */}
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Upcoming Scheduled Reviews
            </Typography>
            {upcomingReviews.length === 0 ? (
                <Alert severity="info" sx={{ mb: 4 }}>No upcoming reviews scheduled.</Alert>
            ) : (
                <Grid container spacing={2}>
                    {upcomingReviews.map((review, index) => (
                        <Grid size={{ xs: 12, md: 6 }} key={review._id || `upcoming-${index}`}>
                            <Card elevation={1} sx={{ borderLeft: '4px solid #1976d2' }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="h6" color="primary">{review.title}</Typography>
                                        <Chip size="small" label="Scheduled" color="info" />
                                    </Box>
                                    <Typography variant="body2" color="textSecondary" paragraph>
                                        {review.description}
                                    </Typography>
                                    <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                                        <Typography variant="body2"><strong>Date & Time:</strong> {new Date(review.scheduledAt).toLocaleString()}</Typography>
                                    </Stack>
                                    <Typography variant="body2"><strong>Scheduled By:</strong> {review.createdBy?.name || 'Faculty'}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Past Reviews / Results */}
            <Typography variant="h6" gutterBottom sx={{ mt: 5 }}>
                Past Review Results
            </Typography>
            {pastReviews.length === 0 ? (
                <Alert severity="info">No completed reviews yet.</Alert>
            ) : (
                <Stack spacing={4}>
                    {pastReviews.map((review, index) => {
                        const scores = review.scores || [];

                        return (
                            <Card key={review._id} elevation={2}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <Box>
                                            <Typography variant="h6" color="primary.main">{review.title}</Typography>
                                            <Typography variant="caption" color="textSecondary">
                                                Conducted on {new Date(review.scheduledAt).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                        <Chip label="Completed" color="success" size="small" />
                                    </Box>

                                    <Divider sx={{ mb: 2 }} />

                                    {/* Detailed Scores Table */}
                                    <Typography variant="subtitle2" gutterBottom>Detailed Score Breakdown</Typography>
                                    <DataTable
                                        columns={[
                                            { id: 'criteria', label: 'Criteria', minWidth: 200, render: (c) => c.label },
                                            { id: 'maxMarks', label: 'Max Marks', align: 'right', render: (c) => c.maxMarks },
                                            {
                                                id: 'awarded',
                                                label: 'Awarded Marks',
                                                align: 'right',
                                                render: (c) => {
                                                    const scoreRecord = scores.find(s => s.label === c.label);
                                                    return <Typography fontWeight="bold">{scoreRecord ? scoreRecord.awardedMarks : '-'}</Typography>;
                                                }
                                            }
                                        ]}
                                        rows={review.evaluationCriteria || []}
                                        pagination={false}
                                        emptyMessage="No evaluation criteria found."
                                        sx={{ mb: 2 }}
                                        children={
                                            <TableRow sx={{ bgcolor: '#fafafa' }}>
                                                <TableCell colSpan={2} align="right"><strong>Total Score</strong></TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="subtitle1" color="primary.main" fontWeight="bold">
                                                        {review.totalScore || '-'}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        }
                                    />

                                    {/* Feedback  */}
                                    {review.feedback && (
                                        <Box sx={{ mt: 2, p: 2, bgcolor: '#fffde7', borderRadius: 1 }}>
                                            <Typography variant="subtitle2" color="textSecondary">Feedback & Remarks</Typography>
                                            <Typography variant="body2">{review.feedback}</Typography>
                                        </Box>
                                    )}
                                    {review.completionPercentage != null && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="body2">
                                                <strong>Project Completion:</strong> {review.completionPercentage}%
                                            </Typography>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            )}

        </Box>
    );
}
