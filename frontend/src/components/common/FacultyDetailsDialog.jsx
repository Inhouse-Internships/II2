import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Chip,
    CircularProgress
} from '@mui/material';
import { apiFetch } from '../../core/services/apiFetch';

export default function FacultyDetailsDialog({ open, onClose, facultyName }) {
    const [faculty, setFaculty] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open && facultyName) {
            setLoading(true);
            setError(null);
            apiFetch('/api/admin/faculty')
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch faculty details");
                    return res.json();
                })
                .then(data => {
                    // Find faculty by name
                    const found = data.find(f => f.name === facultyName);
                    if (found) {
                        setFaculty(found);
                    } else {
                        setError(`Faculty details not found for ${facultyName}`);
                    }
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        } else {
            setFaculty(null);
        }
    }, [open, facultyName]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" disableRestoreFocus disableEnforceFocus>
            <DialogTitle>Faculty Details</DialogTitle>
            <DialogContent>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>
                ) : faculty ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                        <Typography variant="h5" color="primary">{faculty.name}</Typography>

                        <Box sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            gap: 2
                        }}>
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary">Employee ID</Typography>
                                <Typography variant="body1">{faculty.employeeId || "-"}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary">Email</Typography>
                                <Typography variant="body1">{faculty.email}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary">Phone</Typography>
                                <Typography variant="body1">{faculty.phone || "-"}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary">Department</Typography>
                                <Typography variant="body1">{faculty.department || "-"}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                                <Chip
                                    label={faculty.status || "Pending"}
                                    color={faculty.status === "Approved" ? "success" : faculty.status === "Rejected" ? "error" : "warning"}
                                    size="small"
                                />
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="textSecondary">Co-Guide Status</Typography>
                                <Chip
                                    label={faculty.coGuideStatus || "Pending"}
                                    color={faculty.coGuideStatus === "Approved" ? "success" : faculty.coGuideStatus === "Rejected" ? "error" : "warning"}
                                    size="small"
                                />
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" color="textSecondary">Current Assignments</Typography>
                            <Typography variant="body2" noWrap title={faculty.appliedProject ? (faculty.appliedProject.title || faculty.appliedProject) : "None"}>
                                Guide: {faculty.appliedProject ? (faculty.appliedProject.title || faculty.appliedProject) : "None"}
                            </Typography>
                            <Typography variant="body2" noWrap title={faculty.coGuidedProject ? (faculty.coGuidedProject.title || faculty.coGuidedProject) : "None"}>
                                Co-Guide: {faculty.coGuidedProject ? (faculty.coGuidedProject.title || faculty.coGuidedProject) : "None"}
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    <Typography sx={{ mt: 2, color: "text.secondary" }}>No faculty data available.</Typography>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} variant="contained">Close</Button>
            </DialogActions>
        </Dialog>
    );
}
