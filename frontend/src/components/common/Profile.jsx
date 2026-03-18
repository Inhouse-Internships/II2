import React, { useState } from 'react';
import {
    Box, Typography, Paper, Grid, Avatar,
    Chip, Divider, Button, TextField, Alert,
    Stack, Dialog, DialogTitle, DialogContent, DialogActions,
    IconButton, InputAdornment
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Lock as LockIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { apiFetch } from '../../core/services/apiFetch';
import { ROLES } from '../../core/constants/roles';

export default function Profile({ user, role, onPasswordUpdate }) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passMessage, setPassMessage] = useState("");
    const [passError, setPassError] = useState("");
    const [changePassOpen, setChangePassOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleUpdatePassword = async () => {
        setPassError("");
        setPassMessage("");
        if (!password || !confirmPassword) {
            setPassError("Please fill in all fields");
            return;
        }
        if (password !== confirmPassword) {
            setPassError("Passwords do not match");
            return;
        }

        try {
            setSaving(true);
            // Determine endpoint based on role (using constants for case-insensitive matching)
            let endpoint = '';
            if (role === ROLES.ADMIN) endpoint = `/api/admin/profile/${user._id}`;
            else if (role === ROLES.HOD) endpoint = `/api/hod/profile/${user._id}`;
            else if (role === ROLES.FACULTY) endpoint = `/api/faculty/profile/${user._id}`;
            else if (role === ROLES.STUDENT) endpoint = `/api/student/profile/${user._id}`;

            const res = await apiFetch(endpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (res.ok) {
                setPassMessage("Password updated successfully");
                setPassword("");
                setConfirmPassword("");
                setTimeout(() => {
                    setChangePassOpen(false);
                    setPassMessage("");
                }, 1500);
            } else {
                setPassError(data.message || "Update failed");
            }
            setSaving(false);
        } catch (err) {
            setSaving(false);
            setPassError("Server error");
        }
    };

    return (
        <Box sx={{ py: 4 }}>
            <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 5, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                        <Avatar
                            sx={{
                                width: 120,
                                height: 120,
                                bgcolor: role === 'STUDENT' ? 'primary.main' : 'secondary.main',
                                fontSize: "3.5rem",
                                mx: 'auto',
                                mb: 3,
                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                            }}
                        >
                            {user.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="h5" fontWeight={800} gutterBottom>
                            {user.name}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                            {user.email}
                        </Typography>
                        <Chip
                            label={role === 'STUDENT' ? `Level ${user.level || 1}` : role.charAt(0) + role.slice(1).toLowerCase()}
                            color={role === 'STUDENT' ? 'primary' : 'secondary'}
                            sx={{ fontWeight: 700, px: 2, py: 0.5, height: 'auto', borderRadius: 2 }}
                        />
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper elevation={0} sx={{ p: 4, borderRadius: 5, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                        {role !== ROLES.ADMIN && (
                            <>
                                <Typography variant="h6" fontWeight={800} mb={4} sx={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    User Profile Details
                                </Typography>
                                <Grid container spacing={4}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Roll Number</Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#334155' }}>{user.studentId || user.employeeId || user._id}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Department</Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#334155' }}>{user.department || "-"}</Typography>
                                        </Box>
                                    </Grid>
                                    {role === 'STUDENT' && (
                                        <>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Program / Degree</Typography>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#334155' }}>{user.program || "-"}</Typography>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Year of Study</Typography>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#334155' }}>{user.year || "-"}</Typography>
                                                </Box>
                                            </Grid>
                                        </>
                                    )}
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Contact</Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#334155' }}>{user.phone || "-"}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Divider sx={{ my: 4 }} />
                            </>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="h6" fontWeight={800} sx={{ color: '#1e293b' }}>Account Security</Typography>
                                <Typography variant="body2" color="text.secondary">Manage your password and security settings</Typography>
                            </Box>
                            <Button
                                variant="outlined"
                                startIcon={<LockIcon />}
                                onClick={() => setChangePassOpen(true)}
                                sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
                            >
                                Change Password
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* CHANGE PASSWORD DIALOG */}
            <Dialog
                open={changePassOpen}
                onClose={() => !saving && setChangePassOpen(false)}
                PaperProps={{
                    sx: { borderRadius: 4, width: '100%', maxWidth: '400px', p: 1 }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Change Password
                    <IconButton onClick={() => setChangePassOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Update your account password. Use at least 8 characters for better security.
                    </Typography>

                    {passMessage && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{passMessage}</Alert>}
                    {passError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{passError}</Alert>}

                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            autoFocus
                            label="New Password"
                            type={showPassword ? "text" : "password"}
                            fullWidth
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            InputProps={{
                                borderRadius: 2,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                        <TextField
                            label="Confirm New Password"
                            type={showPassword ? "text" : "password"}
                            fullWidth
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleUpdatePassword}
                        disabled={saving}
                        sx={{ borderRadius: 2, py: 1.2, fontWeight: 700, textTransform: 'none' }}
                    >
                        {saving ? 'Updating...' : 'Update Password'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
