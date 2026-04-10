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
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";

import { useNavigate, Link } from 'react-router-dom';
import {
  Visibility,
  VisibilityOff,
  ArrowBack as ArrowBackIcon
} from "@mui/icons-material";

import { apiFetch } from '../../core/services/apiFetch';
import './Login.css';
import { UNIVERSITY_EMAIL_DOMAINS } from "../../core/constants/app";
import EmailSuffixToggle from "../../components/common/EmailSuffixToggle";
import InfoNote from '../../components/common/InfoNote';

export default function Register() {
  const navigate = useNavigate();
  const [roleIndex, setRoleIndex] = useState(0); // 0 for Student, 1 for Faculty
  const [loading, setLoading] = useState(false);
  const [authConfigLoading, setAuthConfigLoading] = useState(true);
  const [studentRegistrationEnabled, setStudentRegistrationEnabled] = useState(true);
  const [facultyRegistrationEnabled, setFacultyRegistrationEnabled] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [stage, setStage] = useState('details'); // 'details', 'next-phase'
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [programsData, setProgramsData] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    emailInput: '',
    phone: '',
    employeeId: '',
    program: '',
    department: '',
    year: ''
  });
  const [selectedDomain, setSelectedDomain] = useState(UNIVERSITY_EMAIL_DOMAINS[0]);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Effect to check clipboard on window focus
  useEffect(() => {
    const handleFocus = async () => {
      // Only check if we are in the OTP stage
      if (otpSent && stage === 'details' && !otp) {
        try {
          // Check if browser supports clipboard API and permission is granted/possible
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            const match = text.trim().match(/^\d{6}$/);
            if (match) {
              const detectedOtp = match[0];
              setOtp(detectedOtp);
              handleVerifyOtp(null, detectedOtp, true);
            }
          }
        } catch (err) {
          // Clipboard read failed (e.g. permission denied) - fail silently
          console.debug("Clipboard access denied or not available");
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [otpSent, stage, otp]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiFetch('/api/auth/config');
        if (res.ok) {
          const data = await res.json();
          setStudentRegistrationEnabled(data.studentRegistrationEnabled ?? true);
          setFacultyRegistrationEnabled(data.facultyRegistrationEnabled ?? true);
        }
        const progRes = await apiFetch('/api/admin/programs');
        if (progRes.ok) {
          const pData = await progRes.json();
          setProgramsData(Array.isArray(pData) ? pData : (pData.data || []));
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      } finally {
        setAuthConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Effect to parse URL parameters for auto-verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlOtp = params.get('otp');
    const urlEmail = params.get('email');

    if (urlEmail) {
      // Handle university email domain toggle logic
      let emailInput = urlEmail;
      let matchedDomain = selectedDomain;

      for (const domain of UNIVERSITY_EMAIL_DOMAINS) {
        if (urlEmail.toLowerCase().endsWith(domain.toLowerCase())) {
          emailInput = urlEmail.substring(0, urlEmail.length - domain.length);
          matchedDomain = domain;
          break;
        }
      }

      setFormData(prev => ({ ...prev, emailInput }));
      setSelectedDomain(matchedDomain);
    }

    if (urlOtp && urlOtp.length === 6) {
      setOtp(urlOtp);
      setOtpSent(true);
      // Logic to auto-verify after state updates
      setTimeout(() => {
        handleVerifyOtp(null, urlOtp);
      }, 500);
    }
  }, []);

  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === 'emailInput') {
      // Prevent entering @ or any domain, as it's already mentioned in the suffix toggle
      if (value.includes('@')) {
        value = value.split('@')[0];
      }
    }
    const updatedForm = { ...formData, [e.target.name]: value };
    // Reset dependant fields if program changes
    if (e.target.name === 'program') {
      updatedForm.department = '';
      updatedForm.year = '';
    }
    setFormData(updatedForm);
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      let finalEmail = formData.emailInput.trim();
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}${selectedDomain}`;
      }

      const res = await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail })
      });

      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setResendTimer(60);
      } else {
        setError(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError('An error occurred while sending OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e, currentOtp, isSilent = false) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const otpToVerify = currentOtp || otp;
    if (!otpToVerify) {
      if (!isSilent) setError('Please enter the OTP.');
      return;
    }
    if (!isSilent) setLoading(true);
    setError('');
    setMessage('');

    try {
      let finalEmail = formData.emailInput.trim();
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}${selectedDomain}`;
      }

      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, otp: otpToVerify })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Email verified successfully.');
        setStage('next-phase');
      } else {
        if (!isSilent) setError(data.message || 'Invalid OTP');
      }
    } catch (err) {
      if (!isSilent) setError('An error occurred while verifying OTP');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const actualRole = roleIndex === 0 ? 'STUDENT' : 'FACULTY';
      let finalEmail = formData.emailInput.trim();
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}${selectedDomain}`;
      }

      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: finalEmail,
        password: password,
        otp: otp,
        role: actualRole,
        ...(actualRole === 'STUDENT' && {
          studentId: formData.emailInput.split('@')[0].toUpperCase(),
          program: formData.program,
          department: formData.department,
          year: formData.year
        }),
        ...(actualRole === 'FACULTY' && {
          employeeId: formData.employeeId,
          department: formData.department
        })
      };

      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Registration successful! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="auth-page-wrapper">
      <Box className="bg-blob blob-1" />
      <Box className="bg-blob blob-2" />
      <Box className="bg-blob blob-3" />
      <Paper elevation={0} className="auth-card-modern" sx={{ maxWidth: '440px', width: '100%' }}>
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
              mb: stage === 'next-phase' ? 0 : 3,
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
          {stage !== 'next-phase' && (
            <>
              <Typography className="welcome-text">Join Us</Typography>
              <Typography className="subtitle-text">Apply for In-House Internships</Typography>
            </>
          )}
        </Box>

        {authConfigLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (!studentRegistrationEnabled && !facultyRegistrationEnabled) ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Registrations are currently disabled for all roles. This may be because the internship phase has already started or capacity has been reached.
            </Alert>
            <Button variant="outlined" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </Box>
        ) : (
          <>
            {stage !== 'next-phase' && (
              <Tabs
                value={roleIndex}
                onChange={(e, v) => {
                  setRoleIndex(v);
                  if (v === 1) setSelectedDomain(UNIVERSITY_EMAIL_DOMAINS[0]);
                }}
                centered
                sx={{ mb: 3 }}
              >
                <Tab label="Student" disabled={otpSent || !studentRegistrationEnabled} />
                <Tab label="Faculty" disabled={otpSent || !facultyRegistrationEnabled} />
              </Tabs>
            )}

            {roleIndex === 0 && !studentRegistrationEnabled && (
              <Alert severity="warning" className="auth-alert" sx={{ mb: 2 }}>
                Student registrations are currently closed.
              </Alert>
            )}
            {roleIndex === 1 && !facultyRegistrationEnabled && (
              <Alert severity="warning" className="auth-alert" sx={{ mb: 2 }}>
                Faculty registrations are currently closed.
              </Alert>
            )}

            {error && <Alert severity="error" className="auth-alert">{error}</Alert>}
            {message && <Alert severity="success" className="auth-alert">{message}</Alert>}

            {stage === 'details' && (
              <form onSubmit={handleSendOtp} className="auth-form-v2">
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Full Name"
                    name="name"
                    fullWidth
                    required
                    variant="filled"
                    className="modern-input stagger-item"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={otpSent}
                    InputProps={{ disableUnderline: true }}
                  />

                  <TextField
                    label="Email"
                    name="emailInput"
                    fullWidth
                    required
                    variant="filled"
                    className="modern-input stagger-item"
                    value={formData.emailInput}
                    onChange={handleChange}
                    disabled={otpSent}
                    InputProps={{
                      disableUnderline: true,
                      endAdornment: (
                        <InputAdornment position="end" sx={{ cursor: 'pointer' }}>
                          <EmailSuffixToggle
                            value={selectedDomain}
                            onChange={(val) => setSelectedDomain(val)}
                            disabled={otpSent || roleIndex === 1}
                          />
                        </InputAdornment>
                      ),
                    }}
                  />

                  {otpSent && (
                    <Box className="stagger-item" sx={{ animationDelay: '0s' }}>
                      <InfoNote
                        notes={[
                          "OTP sent to your email. Check your Outlook Inbox / Junk section."
                        ]}
                      />
                      <TextField
                        label="Verification OTP"
                        fullWidth
                        variant="filled"
                        className="modern-input"
                        value={otp}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOtp(val);
                          if (val.length === 6) {
                            handleVerifyOtp(null, val);
                          }
                        }}
                        required
                        disabled={loading}
                        InputProps={{
                          disableUnderline: true,
                          inputProps: {
                            maxLength: 6,
                            onPaste: (e) => {
                              const pastedData = e.clipboardData.getData('text').trim();
                              if (/^\d{6}$/.test(pastedData)) {
                                setOtp(pastedData);
                                handleVerifyOtp(null, pastedData, true);
                              }
                            }
                          }
                        }}
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                      />
                      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                        {resendTimer > 0 ? (
                          <Typography variant="caption" color="textSecondary">
                            Resend OTP in {resendTimer}s
                          </Typography>
                        ) : (
                          <Button onClick={handleSendOtp} disabled={loading} size="small" sx={{ textTransform: "none" }}>
                            Resend OTP
                          </Button>
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>

                {!otpSent && (
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    className="signin-btn-v2 stagger-item"
                    disabled={loading || (roleIndex === 0 && !studentRegistrationEnabled) || (roleIndex === 1 && !facultyRegistrationEnabled)}
                    sx={{ mt: 3 }}
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify'}
                  </Button>
                )}
                {otpSent && (
                  <Button
                    type="button"
                    onClick={(e) => handleVerifyOtp(e, otp)}
                    variant="contained"
                    fullWidth
                    className="signin-btn-v2 stagger-item"
                    disabled={loading || otp.length < 6}
                    sx={{ mt: 3, animationDelay: '0s' }}
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Confirm OTP'}
                  </Button>
                )}
              </form>
            )}

            {stage === 'next-phase' && (
              <form onSubmit={handleRegister} className="auth-form-v2" style={{ marginTop: '20px' }}>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Phone Number"
                    name="phone"
                    fullWidth
                    required
                    variant="filled"
                    className="modern-input stagger-item"
                    value={formData.phone}
                    onChange={handleChange}
                    InputProps={{ disableUnderline: true }}
                  />

                  {roleIndex === 0 ? (
                    <>
                      <FormControl variant="filled" fullWidth required className="modern-input stagger-item">
                        <InputLabel>Program</InputLabel>
                        <Select
                          name="program"
                          value={formData.program}
                          onChange={handleChange}
                          disableUnderline
                        >
                          {programsData.map(p => (
                            <MenuItem key={p._id} value={p.name}>{p.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <FormControl variant="filled" fullWidth required className="modern-input stagger-item">
                          <InputLabel>Department</InputLabel>
                          <Select
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            disableUnderline
                            disabled={!formData.program}
                          >
                            {programsData.find(p => p.name === formData.program)?.departments?.map(d => (
                              <MenuItem key={d._id} value={d.name}>{d.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl variant="filled" fullWidth required className="modern-input stagger-item">
                          <InputLabel>Year</InputLabel>
                          <Select
                            name="year"
                            value={formData.year}
                            onChange={handleChange}
                            disableUnderline
                            disabled={!formData.program}
                          >
                            {programsData.find(p => p.name === formData.program)?.eligibleYears?.map(y => (
                              <MenuItem key={y} value={y}>{y}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <FormControl variant="filled" fullWidth required className="modern-input stagger-item">
                          <InputLabel>Department</InputLabel>
                          <Select
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            disableUnderline
                          >
                            {Array.from(new Map(programsData.flatMap(p => p.departments).map(d => [d._id, d])).values()).map(d => (
                              <MenuItem key={d._id} value={d.name}>{d.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <TextField
                          label="Employee ID"
                          name="employeeId"
                          fullWidth
                          required
                          variant="filled"
                          className="modern-input stagger-item"
                          value={formData.employeeId}
                          onChange={handleChange}
                          InputProps={{ disableUnderline: true }}
                        />
                      </Box>
                    </>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      label="Password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      fullWidth
                      required
                      variant="filled"
                      className="modern-input stagger-item"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                    <TextField
                      label="Confirm Password"
                      type={showPassword ? 'text' : 'password'}
                      fullWidth
                      required
                      variant="filled"
                      className="modern-input stagger-item"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      InputProps={{ disableUnderline: true }}
                    />
                  </Box>
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  className="signin-btn-v2 stagger-item"
                  disabled={loading}
                  sx={{ mt: 3 }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Complete Registration'}
                </Button>
              </form>
            )}

            {stage !== 'next-phase' && (
              <Typography className="auth-footer-v2" sx={{ opacity: otpSent ? 0.5 : 1, pointerEvents: otpSent ? 'none' : 'auto' }}>
                Already have an account? <Link to="/login" className="register-link">Sign In</Link>
              </Typography>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}
