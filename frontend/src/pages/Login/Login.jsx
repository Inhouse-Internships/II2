import { apiFetch } from '../../core/services/apiFetch';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from "@mui/material";

import { useNavigate, Link } from 'react-router-dom';
import {
  Visibility,
  VisibilityOff,
  ArrowBack as ArrowBackIcon,
  FiberManualRecord as FiberManualRecordIcon,
  Close as CloseIcon
} from "@mui/icons-material";

import { setAuthSession, getDefaultRouteForRole } from '../../core/utils/auth';
import './Login.css';
import { UNIVERSITY_EMAIL_DOMAINS } from "../../core/constants/app";
import EmailSuffixToggle from "../../components/common/EmailSuffixToggle";

export default function Login() {
  const [emailInput, setEmailInput] = useState('');
  const [selectedDomain, setSelectedDomain] = useState(UNIVERSITY_EMAIL_DOMAINS[0]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const navigate = useNavigate();

  // Preload dashboard chunks in the background so mobile transitions are instant
  useEffect(() => {
    const preloadDashboards = async () => {
      try {
        await Promise.all([
          import('../Admin/AdminDashboard'),
          import('../Student/StudentDashboard'),
          import('../Faculty/FacultyDashboard'),
          import('../HOD/HODDashboard'),
          import('../../layouts/AdminSidebar'),
          import('../../layouts/HODSidebar')
        ]);
      } catch (e) {
        // Ignore prefetch errors
      }
    };

    // Slight delay to ensure the Login page renders perfectly first
    const timer = setTimeout(preloadDashboards, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let finalEmail = emailInput.trim();
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}${selectedDomain}`;
      }

      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: finalEmail, password }),
      });

      const data = await res.json();

      if (res.ok) {
        sessionStorage.clear(); // Clear section states so user goes to Dashboard initially
        setAuthSession({ token: data.token, user: data.user });
        const role = data.role || (data.user && data.user.role);
        navigate(getDefaultRouteForRole(role));
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="auth-page-wrapper">
      <Box className="bg-blob blob-1" />
      <Box className="bg-blob blob-2" />
      <Box className="bg-blob blob-3" />
      <Paper elevation={0} className="auth-card-modern">
        <IconButton
          onClick={() => navigate('/')}
          className="back-to-home-btn"
          sx={{
            position: 'absolute',
            left: { xs: 12, sm: 20 },
            top: { xs: 12, sm: 20 },
            bgcolor: 'rgba(0,0,0,0.04)',
            transition: 'all 0.3s',
            '&:hover': {
              bgcolor: 'rgba(0,0,0,0.08)',
              transform: 'translateX(-4px)'
            }
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box className="auth-header-new">
          <Box
            onClick={() => navigate('/')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              mb: 3,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 0.85 }
            }}
          >
            <img src="/au-logo.webp" alt="Logo" style={{ height: '40px', objectFit: 'contain', borderRadius: '50%' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', display: 'flex', letterSpacing: -0.5 }}>
              <Box component="span" sx={{ color: '#f26522', mr: 0.5 }}>ADITYA</Box>
              <Box component="span" sx={{ color: '#004b87' }}>UNIVERSITY</Box>
            </Typography>
          </Box>
          <Typography variant="h4" className="welcome-text">Welcome</Typography>
          <Typography variant="body2" className="subtitle-text">IN-HOUSE INTERNSHIP 2.0</Typography>
        </Box>

        {error && <Alert severity="error" className="auth-alert">{error}</Alert>}

        <form onSubmit={handleLogin} className="auth-form-v2">
          <TextField
            label="Email"
            fullWidth
            className="modern-input"
            variant="filled"
            value={emailInput}
            onChange={(e) => {
              let val = e.target.value;
              if (val.includes('@')) {
                val = val.split('@')[0];
              }
              setEmailInput(val);
            }}
            required
            InputProps={{
              disableUnderline: true,
              endAdornment: (
                <InputAdornment position="end" sx={{ cursor: 'pointer' }}>
                  <EmailSuffixToggle
                    value={selectedDomain}
                    onChange={(val) => setSelectedDomain(val)}
                  />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            className="modern-input"
            variant="filled"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            InputProps={{
              disableUnderline: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#94a3b8' }}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography
              className="important-note-link blinking"
              onClick={() => setNoteOpen(true)}
              sx={{
                cursor: 'pointer',
                color: '#ef4444',
                fontWeight: '800',
                fontSize: '0.875rem',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              Important Note!
            </Typography>
            <Box className="forgot-password-link" sx={{ m: 0 }}>
              <Link to="/forgot-password">Forgot password?</Link>
            </Box>
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            className="signin-btn-v2"
            disabled={loading}
            autoFocus
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
        </form>

        <Typography className="auth-footer-v2">
          Don't have an account? <Link to="/register" className="register-link">Register</Link>
        </Typography>
      </Paper>

      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            padding: '8px'
          }
        }}
      >
        <DialogTitle sx={{
          textAlign: 'center',
          fontWeight: '800',
          fontSize: '1.5rem',
          color: '#0f172a',
          pb: 1,
          borderBottom: '2px solid #f1f5f9',
          position: 'relative'
        }}>
          Instructions to the Students: In-house Internships 2.0
          <IconButton
            onClick={() => setNoteOpen(false)}
            sx={{ position: 'absolute', right: 16, top: 16 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, color: '#334155', lineHeight: 1.7 }}>
            All the current second-year students (Admitted Batch: 2024–2028) are hereby informed that a provision has been enabled for registration for the <strong>In-house Internships 2.0</strong>, scheduled to commence from <strong>04 May 2026</strong>, for those who missed the opportunity earlier.
          </Typography>

          <Typography variant="body1" sx={{ mb: 1, fontWeight: '700', color: '#1e293b' }}>
            Registration will be enabled from 24-04-2026 to 26-04-2026
          </Typography>

          {/* <Typography variant="body1" sx={{ mb: 1, color: '#334155' }}>
            URL for Registration: <a href="https://internship.adityauniversity.in/" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontWeight: '600' }}>https://internship.adityauniversity.in/</a>
          </Typography> */}

          <Typography variant="body1" sx={{ mb: 1, color: '#334155' }}>
            The interviews will be conducted on <strong>25th April and 28th April (Afternoon Session)</strong>.
          </Typography>

          <Typography variant="body1" sx={{ mb: 1, color: '#334155' }}>
            The payment link will be enabled from <strong>25th April onwards</strong> and will be closed on <strong>29th April 10:30 AM.</strong> 
          </Typography>

          <Typography variant="body1" sx={{ mb: 3, color: '#ef4444', fontWeight: '600' }}>
            No extension will be provided beyond the mentioned deadline.
          </Typography>

          <Box sx={{
            bgcolor: '#fef2f2',
            p: 2.5,
            borderRadius: '16px',
            border: '1px solid #fee2e2'
          }}>
           

            
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setNoteOpen(false)}
            variant="contained"
            sx={{
              borderRadius: '12px',
              px: 4,
              bgcolor: '#0f172a',
              '&:hover': { bgcolor: '#1e293b' }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
