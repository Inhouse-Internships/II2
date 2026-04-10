import React from 'react';
import {
    Dialog, DialogTitle, DialogContent,
    DialogActions, Button, Box, Typography,
    Chip, Divider, Grid, Stack, IconButton,
    Tooltip, SvgIcon
} from '@mui/material';
import StatusChip from './StatusChip';

const CrownIcon = (props) => (
    <SvgIcon {...props}>
        <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.55 18.55 20 18 20H6C5.45 20 5 19.55 5 19V18H19V19Z" />
    </SvgIcon>
);

export default function ProjectDetailsDialog({ open, onClose, project, customActions, renderStatus, onMakeLeader }) {
    if (!project) return null;

    const eligibleStudents = (project.students || []).filter(s => {
        if (s.level !== 2) return false;
        const app = (s.applications || []).find(a => String(a.project?._id || a.project) === String(project._id));
        return app && app.status === 'Qualified';
    });
    const leader = eligibleStudents.find(s => String(s._id) === String(project.teamLeader));
    const leaderName = leader ? `${leader.name} (${leader.studentId || ''})` : "Not Assigned";

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Project Details</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 1 }}>
                    <Typography variant="h5" color="primary" gutterBottom>
                        {project.title}
                    </Typography>
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                        <Typography variant="body1" paragraph>{project.description || "No description provided."}</Typography>
                    </Box>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="subtitle2" color="text.secondary">Guide</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body1" sx={{ fontWeight: project.guide ? 600 : 400, color: project.guide ? 'text.primary' : 'text.disabled' }}>
                                    {project.guide ? (
                                        <>
                                            {project.guide}
                                            {project.guideEmpId && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({project.guideEmpId})</Typography>}
                                        </>
                                    ) : "Available"}
                                </Typography>
                                {project.guideDept && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="caption" color="primary" sx={{ fontWeight: 800 }}>Required Dept:</Typography>
                                        <Chip size="small" label={project.guideDept?.name || project.guideDept} variant="outlined" color="primary" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                                    </Box>
                                )}
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="subtitle2" color="text.secondary">Co-Guide</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body1" sx={{ fontWeight: project.coGuide ? 600 : 400, color: project.coGuide ? 'text.primary' : 'text.disabled' }}>
                                    {project.coGuide ? (
                                        <>
                                            {project.coGuide}
                                            {project.coGuideEmpId && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({project.coGuideEmpId})</Typography>}
                                        </>
                                    ) : "Available"}
                                </Typography>
                                {project.coGuideDept && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="caption" color="secondary" sx={{ fontWeight: 800 }}>Required Dept:</Typography>
                                        <Chip size="small" label={project.coGuideDept?.name || project.coGuideDept} variant="outlined" color="secondary" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                                    </Box>
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={12}>
                            <Typography variant="subtitle2" color="text.secondary">Team Leader</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body1">{leaderName}</Typography>
                                {leader && <CrownIcon sx={{ color: 'gold', fontSize: 18 }} />}
                            </Box>
                        </Grid>
                    </Grid>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">Skills Required</Typography>
                        <Typography variant="body1" paragraph>{project.skillsRequired || "N/A"}</Typography>
                    </Box>
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary">Project Outcome</Typography>
                        <Typography variant="body1" paragraph>{project.projectOutcome || "N/A"}</Typography>
                    </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, sm: 12 }}>
                        <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                        {renderStatus ? renderStatus(project) : <StatusChip status={project.status} />}
                    </Grid>
                </Grid>
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Departments</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {project.departments && project.departments.length > 0 ? (
                            project.departments.map((d, i) => {
                                const deptName = d.name || d.department?.name || "Unknown";
                                return (
                                    <Chip key={i} label={deptName} variant="outlined" />
                                );
                            })
                        ) : (
                            <Typography variant="body2" color="text.secondary">No departments assigned</Typography>
                        )}
                    </Box>
                </Box>
                {eligibleStudents.length > 0 && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Assigned Students</Typography>
                        <Stack spacing={1} sx={{ mt: 1 }}>
                            {eligibleStudents.map((student, i) => (
                                <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2">{student.name} ({student.studentId})</Typography>
                                        <Chip size="small" label={`Level ${student.level || 1}`} variant="outlined" />
                                        {String(project.teamLeader) === String(student._id) && (
                                            <Tooltip title="Team Leader">
                                                <CrownIcon sx={{ color: 'gold', fontSize: 20 }} />
                                            </Tooltip>
                                        )}
                                    </Box>
                                    {String(project.teamLeader) !== String(student._id) && student.level === 2 && onMakeLeader && (
                                        <Button size="small" variant="outlined" onClick={() => onMakeLeader(project._id, student._id)}>
                                            Make Leader
                                        </Button>
                                    )}
                                </Box>
                            ))}
                        </Stack>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                {customActions ? customActions : (
                    <Button onClick={onClose}>Close</Button>
                )}
            </DialogActions>
        </Dialog >
    );
}
