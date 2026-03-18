import React, { useState, useEffect } from 'react';
import {
  getFacultyDailyStatuses,
  reviewDailyStatus
} from '../../core/services/dailyStatusService';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Button,
  TextField,
  Grid
} from '@mui/material';

const DailyStatusFaculty = ({ projectId }) => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (projectId) fetchStatuses();
  }, [projectId]);

  const fetchStatuses = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getFacultyDailyStatuses(projectId);
      setStatuses(payload?.data || []);
    } catch (err) {
      setStatuses([]);
      setError(err.message || 'Failed to load statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (status) => {
    setCurrentStatus(status);
    setFeedback(status.facultyReview?.feedback || '');
    setReviewOpen(true);
  };

  const handleCloseReview = () => {
    setReviewOpen(false);
    setCurrentStatus(null);
    setFeedback('');
  };

  const handleReviewSubmit = async () => {
    if (!currentStatus) return;
    setError('');
    try {
      await reviewDailyStatus(currentStatus._id, {
        feedback
      });
      fetchStatuses();
      handleCloseReview();
    } catch (err) {
      setError(err.message || 'Action failed');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ mt: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Student Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Work Done</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Hours Spent</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Blockers</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Review Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statuses.map(status => (
              <TableRow key={status._id} hover>
                <TableCell>{status.student?.name || '-'}</TableCell>
                <TableCell>{new Date(status.date).toLocaleDateString()}</TableCell>
                <TableCell sx={{ maxWidth: 300, whiteSpace: 'normal', color: 'text.secondary', fontSize: '0.875rem' }}>
                  {status.workDone}
                </TableCell>
                <TableCell>{status.hoursSpent || 0} hrs</TableCell>
                <TableCell sx={{ maxWidth: 200, whiteSpace: 'normal', color: 'error.main', fontSize: '0.875rem' }}>
                  {status.blockers || 'None'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={status.facultyReview?.status || 'Pending'}
                    color={status.facultyReview?.status === 'Reviewed' ? 'success' : 'warning'}
                    size="small"
                    variant={status.facultyReview?.status === 'Reviewed' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="contained"
                    disableElevation
                    color={status.facultyReview?.status === 'Reviewed' ? 'inherit' : 'primary'}
                    onClick={() => handleOpenReview(status)}
                  >
                    {status.facultyReview?.status === 'Reviewed' ? 'View/Edit' : 'Review'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {statuses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No daily status reports found for this project yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={reviewOpen} onClose={handleCloseReview} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>Review Daily Status</DialogTitle>
        <DialogContent>
          {currentStatus && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Student</Typography>
                  <Typography variant="body1" fontWeight="bold">{currentStatus.student?.name}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Date Reported</Typography>
                  <Typography variant="body1" fontWeight="bold">{new Date(currentStatus.date).toLocaleDateString()}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Hours Spent</Typography>
                  <Typography variant="body1" fontWeight="bold">{currentStatus.hoursSpent} Hours</Typography>
                </Grid>
              </Grid>

              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Work Done</Typography>
                <Typography variant="body2">{currentStatus.workDone}</Typography>
              </Box>

              {currentStatus.blockers && (
                <Box sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2, mb: 3 }}>
                  <Typography variant="subtitle2" color="error.main" gutterBottom>Blockers</Typography>
                  <Typography variant="body2" color="error.dark">{currentStatus.blockers}</Typography>
                </Box>
              )}

              <Typography variant="subtitle2" gutterBottom>Faculty Feedback / Remarks</Typography>
              <TextField
                autoFocus
                margin="dense"
                placeholder="Enter feedback or review comments for the student..."
                type="text"
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={handleCloseReview} color="inherit">Cancel</Button>
          <Button onClick={handleReviewSubmit} variant="contained" color="primary">
            Submit Review
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DailyStatusFaculty;
