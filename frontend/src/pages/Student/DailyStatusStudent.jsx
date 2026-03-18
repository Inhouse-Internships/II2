import React, { useState, useEffect } from 'react';
import {
  submitDailyStatus,
  getStudentDailyStatuses,
  editDailyStatus,
  deleteDailyStatus
} from '../../core/services/dailyStatusService';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  IconButton,
  Tooltip
} from "@mui/material";

import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from "@mui/icons-material";

import DataTable from '../../components/common/DataTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';



const DailyStatusStudent = ({ projectId }) => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState(null);

  const [currentStatus, setCurrentStatus] = useState({
    _id: null,
    date: new Date().toISOString().slice(0, 10),
    workDone: '',
    hoursSpent: '',
    blockers: '',
  });

  useEffect(() => {
    const finalProjectId = (typeof projectId === 'object' && projectId !== null) ? (projectId._id || projectId.toString()) : projectId;
    if (finalProjectId) fetchStatuses(finalProjectId);
  }, [projectId]);

  const fetchStatuses = async (idToUse) => {
    const id = idToUse || ((typeof projectId === 'object' && projectId !== null) ? (projectId._id || projectId.toString()) : projectId);

    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await getStudentDailyStatuses(id);
      setStatuses(payload?.data || payload || []);
    } catch (err) {
      console.error('Fetch statuses error:', err);
      setStatuses([]);
      setError(err.message || 'Failed to load statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentStatus({
      _id: null,
      date: new Date().toISOString().slice(0, 10),
      workDone: '',
      hoursSpent: '',
      blockers: '',
    });
    setOpen(true);
  };

  const handleOpenEdit = (status) => {
    setIsEditing(true);
    setCurrentStatus({
      _id: status._id,
      date: new Date(status.date).toISOString().slice(0, 10),
      workDone: status.workDone,
      hoursSpent: status.hoursSpent.toString(),
      blockers: status.blockers || '',
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentStatus.workDone || !currentStatus.hoursSpent) {
      setError('Please fill in required fields: Work Done and Hours Spent.');
      return;
    }

    const finalProjectId = typeof projectId === 'object' ? projectId?._id : projectId;

    setError('');
    try {
      if (isEditing) {
        await editDailyStatus(currentStatus._id, {
          workDone: currentStatus.workDone,
          blockers: currentStatus.blockers,
          hoursSpent: Number(currentStatus.hoursSpent)
        });
      } else {
        const payload = {
          project: finalProjectId,
          date: currentStatus.date,
          workDone: currentStatus.workDone,
          blockers: currentStatus.blockers,
          hoursSpent: Number(currentStatus.hoursSpent)
        };
        await submitDailyStatus(payload);
      }
      fetchStatuses();
      handleClose();
    } catch (err) {
      setError(err.message || 'Action failed');
    }
  };

  const handleDelete = async () => {
    if (!statusToDelete) return;

    try {
      await deleteDailyStatus(statusToDelete);
      setDeleteDialogOpen(false);
      setStatusToDelete(null);
      fetchStatuses();
    } catch (err) {
      setError(err.message || 'Delete failed');
      setDeleteDialogOpen(false);
    }
  };

  const handleOpenDelete = (statusId) => {
    setStatusToDelete(statusId);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ mt: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd} disableElevation>
          Submit Daily Status
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <DataTable
        columns={[
          {
            id: 'date',
            label: 'Date',
            minWidth: 100,
            render: (s) => new Date(s.date).toLocaleDateString()
          },
          {
            id: 'workDone',
            label: 'Work Done',
            minWidth: 250,
            render: (s) => (
              <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', maxWidth: 250 }}>
                {s.workDone}
              </Typography>
            )
          },
          {
            id: 'hoursSpent',
            label: 'Hours Spent',
            minWidth: 120,
            render: (s) => `${s.hoursSpent || 0} hrs`
          },
          {
            id: 'blockers',
            label: 'Blockers',
            minWidth: 150,
            render: (s) => (
              <Typography variant="body2" color="error.main" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', maxWidth: 150 }}>
                {s.blockers || '-'}
              </Typography>
            )
          },
          {
            id: 'reviewStatus',
            label: 'Review Status',
            minWidth: 120,
            render: (s) => (
              <Chip
                label={s.facultyReview?.status || 'Pending'}
                color={s.facultyReview?.status === 'Reviewed' ? 'success' : 'warning'}
                size="small"
                variant={s.facultyReview?.status === 'Reviewed' ? 'filled' : 'outlined'}
              />
            )
          },
          {
            id: 'facultyFeedback',
            label: 'Faculty Feedback',
            minWidth: 200,
            render: (s) => (
              <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', maxWidth: 200 }}>
                {s.facultyReview?.feedback || '-'}
              </Typography>
            )
          },
          {
            id: 'actions',
            label: 'Actions',
            minWidth: 100,
            render: (s) => s.facultyReview?.status !== 'Reviewed' ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Edit">
                  <IconButton size="small" color="primary" onClick={() => handleOpenEdit(s)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => handleOpenDelete(s._id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ) : null
          }
        ]}
        rows={statuses}
        emptyMessage="You haven't submitted any daily status reports yet."
        pagination={true}
      />

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>{isEditing ? 'Edit Daily Status' : 'Submit Daily Status'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  margin="dense"
                  label="Date"
                  type="date"
                  fullWidth
                  variant="outlined"
                  value={currentStatus.date}
                  onChange={(e) => setCurrentStatus({ ...currentStatus, date: e.target.value })}
                  disabled={isEditing}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  margin="dense"
                  label="Hours Spent"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={currentStatus.hoursSpent}
                  onChange={(e) => setCurrentStatus({ ...currentStatus, hoursSpent: e.target.value })}
                  inputProps={{ min: 0.1, step: 0.5, max: 24 }}
                  required
                />
              </Grid>
            </Grid>

            <TextField
              margin="normal"
              label="Work Done Today"
              type="text"
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              placeholder="Describe the tasks completed today..."
              value={currentStatus.workDone}
              onChange={(e) => setCurrentStatus({ ...currentStatus, workDone: e.target.value })}
              required
            />

            <TextField
              margin="normal"
              label="Blockers or Challenges (Optional)"
              type="text"
              fullWidth
              multiline
              rows={2}
              variant="outlined"
              placeholder="Any issues blocking your progress?"
              value={currentStatus.blockers}
              onChange={(e) => setCurrentStatus({ ...currentStatus, blockers: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={handleClose} color="inherit">Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disableElevation color="primary">
            {isEditing ? 'Save Changes' : 'Submit Status'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Daily Status"
        message="Are you sure you want to delete this daily status report? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
};

export default DailyStatusStudent;
