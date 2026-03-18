import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Typography,
  Paper,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton
} from "@mui/material";

import {
  Visibility,
  VisibilityOff,
  ArrowBack as ArrowBackIcon
} from "@mui/icons-material";

import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from '../../core/services/apiFetch';
import "./Login.css";
import { UNIVERSITY_EMAIL_DOMAINS } from "../../core/constants/app";
import EmailSuffixToggle from "../../components/common/EmailSuffixToggle";
import InfoNote from '../../components/common/InfoNote';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [selectedDomain, setSelectedDomain] = useState(UNIVERSITY_EMAIL_DOMAINS[0]);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [stage, setStage] = useState("send-otp"); // 'send-otp', 'reset-password', 'success'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Effect to parse URL parameters for auto-fill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlOtp = params.get('otp');
    const urlEmail = params.get('email');

    if (urlEmail) {
      let inputVal = urlEmail;
      let matchedDomain = selectedDomain;

      for (const domain of UNIVERSITY_EMAIL_DOMAINS) {
        if (urlEmail.toLowerCase().endsWith(domain.toLowerCase())) {
          inputVal = urlEmail.substring(0, urlEmail.length - domain.length);
          matchedDomain = domain;
          break;
        }
      }

      setEmailInput(inputVal);
      setSelectedDomain(matchedDomain);
      setEmail(urlEmail);
    }

    if (urlOtp && urlOtp.length === 6) {
      setOtp(urlOtp);
      setStage("reset-password");
    }
  }, []);

  // Effect to check clipboard on window focus
  useEffect(() => {
    const handleFocus = async () => {
      // Only check if we are in the OTP stage
      if (stage === 'reset-password' && !otp) {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            const match = text.trim().match(/^\d{6}$/);
            if (match) {
              const detectedOtp = match[0];
              setOtp(detectedOtp);
              // For password reset, we don't auto-submit since user needs to enter password
            }
          }
        } catch (err) {
          console.debug("Clipboard access denied or not available");
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [stage, otp]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!emailInput) {
      setError("Please enter your email address.");
      return;
    }

    let finalEmail = emailInput.trim();
    if (!finalEmail.includes("@")) {
      finalEmail = `${finalEmail}${selectedDomain}`;
    }
    setEmail(finalEmail);

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: finalEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setStage("reset-password");
        setResendTimer(60);
      } else {
        setError(data.message || "Failed to send OTP.");
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e, isSilent = false) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!otp || !newPassword || !confirmPassword) {
      if (!isSilent) setError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      if (!isSilent) setError("Passwords do not match.");
      return;
    }
    if (!isSilent) setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setStage("success");
      } else {
        if (!isSilent) setError(data.message || "Failed to reset password.");
      }
    } catch (err) {
      if (!isSilent) setError("Server error. Please try again later.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  return (
    <Box className="auth-page-wrapper">
      <Paper elevation={0} className="auth-card-modern">
        <IconButton
          onClick={() => navigate('/login')}
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
            <img src="/au-logo.jpg" alt="Logo" style={{ height: '40px', objectFit: 'contain', borderRadius: '50%' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', display: 'flex', letterSpacing: -0.5 }}>
              <Box component="span" sx={{ color: '#f26522', mr: 0.5 }}>ADITYA</Box>
              <Box component="span" sx={{ color: '#004b87' }}>UNIVERSITY</Box>
            </Typography>
          </Box>
          <Typography className="welcome-text">Recovery</Typography>
          <Typography className="subtitle-text">Verify your identity to reset password</Typography>
        </Box>

        {error && <Alert severity="error" className="auth-alert" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}
        {message && stage !== 'success' && <Alert severity="info" className="auth-alert" sx={{ mb: 3, borderRadius: '12px' }}>{message}</Alert>}

        {stage === "send-otp" && (
          <form onSubmit={handleSendOtp} className="auth-form-v2">
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3, textAlign: 'center' }}>
              Enter your email to receive a 6-digit verification code.
            </Typography>
            <TextField
              label="Email"
              fullWidth
              variant="filled"
              className="modern-input"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
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
            <Button
              type="submit"
              variant="contained"
              fullWidth
              className="signin-btn-v2"
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Send OTP"}
            </Button>
          </form>
        )}

        {stage === "reset-password" && (
          <form onSubmit={handleResetPassword} className="auth-form-v2">
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
              onChange={(e) => setOtp(e.target.value)}
              required
              InputProps={{
                disableUnderline: true,
                inputProps: {
                  maxLength: 6,
                  onPaste: (e) => {
                    const pastedData = e.clipboardData.getData('text').trim();
                    if (/^\d{6}$/.test(pastedData)) {
                      setOtp(pastedData);
                    }
                  }
                }
              }}
              autoComplete="one-time-code"
              placeholder="6-digit code"
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
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

            <TextField
              label="New Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              variant="filled"
              className="modern-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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

            <TextField
              label="Confirm New Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              variant="filled"
              className="modern-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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

            <Button
              type="submit"
              variant="contained"
              fullWidth
              className="signin-btn-v2"
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Reset Password"}
            </Button>
          </form>
        )}

        {stage === "success" && (
          <Box sx={{ textAlign: 'center' }}>
            <Alert severity="success" className="auth-alert" sx={{ mb: 3, borderRadius: '12px' }}>{message}</Alert>
            <Button
              variant="contained"
              fullWidth
              className="signin-btn-v2"
              onClick={() => navigate("/login")}
            >
              Back to Login
            </Button>
          </Box>
        )}

        <Typography className="auth-footer-v2">
          Suddenly remembered? <Link to="/login" className="register-link">Sign In</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
