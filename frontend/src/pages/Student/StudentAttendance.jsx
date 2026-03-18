import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Chip,
    Grid,
    Button
} from '@mui/material';
import attendanceService from '../../core/services/attendanceService';
import DataTable from '../../components/common/DataTable';

export default function StudentAttendance() {
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [data, setData] = useState(null);

    useEffect(() => {
        fetchAttendance();
    }, []);

    const fetchAttendance = async () => {
        try {
            const res = await attendanceService.getMyAttendance();
            const jsonData = await res.json();
            if (res.ok) {
                setData(jsonData);
            } else {
                setError(jsonData.message || 'Failed to fetch attendance');
            }
        } catch (err) {
            setError('Network error while fetching attendance');
        } finally {
            setLoading(false);
        }
    };

    // self-marking removed

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
    if (!data || !data.summary) return <Alert severity="info" sx={{ m: 2 }}>No attendance data found.</Alert>;

    const { attendance, summary } = data;

    return (
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 0 }}>
                    My Attendance
                </Typography>
            </Box>

            {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Total Days Logged</Typography>
                            <Typography variant="h4">{summary.totalDays}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Present Days</Typography>
                            <Typography variant="h4" color="success.main">{summary.presentDays}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>Overall Percentage</Typography>
                            <Typography variant="h4" color={summary.percentage >= 75 ? "primary.main" : "error.main"}>
                                {summary.percentage}%
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom>
                Attendance History
            </Typography>

            <DataTable
                columns={[
                    {
                        id: 'date',
                        label: 'Date',
                        minWidth: 150,
                        render: (s) => new Date(s.date).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })
                    },
                    {
                        id: 'status',
                        label: 'Status',
                        minWidth: 150,
                        render: (s) => (
                            <Chip
                                label={s.attendanceStatus.toUpperCase()}
                                color={
                                    s.attendanceStatus === 'Present' ? 'success' :
                                        s.attendanceStatus === 'Absent' ? 'error' : 'warning'
                                }
                                size="small"
                                variant="filled"
                            />
                        )
                    },
                    {
                        id: 'remarks',
                        label: 'Faculty Remarks',
                        minWidth: 250,
                        render: (s) => s.remarks || '-'
                    }
                ]}
                rows={attendance?.filter(a => a.attendanceStatus === 'Present')}
                emptyMessage="No present records found for your current project."
            />
        </Box >
    );
}
