import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { WarningAmber as WarningAmberIcon } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';

// Detect production from Vite env
const IS_PRODUCTION = import.meta.env.MODE === 'production';

// ── Hoisted sx constants ────────────────────────────────────────────────────
const outerBoxSx = {
  display: 'flex',
  height: '100vh',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: '#f5f5f5',
  p: 3
};
const paperSx = {
  p: 4,
  maxWidth: 500,
  textAlign: 'center',
  borderRadius: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2
};
const iconSx = { fontSize: 64, color: '#f44336' };
const errorBoxSx = {
  mt: 2,
  p: 2,
  bgcolor: '#fff3e0',
  borderRadius: 1,
  textAlign: 'left',
  width: '100%',
  overflowX: 'auto',
  border: '1px solid #ffe0b2'
};
const errorLabelSx = { color: '#e65100', mb: 1, fontWeight: 'bold' };
const errorTextSx = { fontFamily: 'monospace', color: '#bf360c', whiteSpace: 'pre-wrap', wordBreak: 'break-all' };
const stackLabelSx = { display: 'block', mb: 1, color: '#e65100', fontWeight: 'bold' };
const stackTextSx = { fontFamily: 'monospace', color: '#5d4037', fontSize: '10px' };
const primaryBtnSx = { mt: 2, px: 4, borderRadius: 50 };
const reloadBtnSx = { mt: 1 };

// ── Inner class component (needs access to lifecycle methods) ───────────────

class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    // Reset on navigation (e.g., after logout redirect)
    if (this.state.hasError && prevProps.location !== this.props.location) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error, errorInfo) {
    // Log full details to console (temporarily allowing in production for debugging)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // In production: hook into your error monitoring service here, e.g.:
    // reportErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // return this.props.children; // This was wrong anyway, it should be below
    }

    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Box sx={outerBoxSx}>
        <Paper elevation={3} sx={paperSx}>
          <WarningAmberIcon sx={iconSx} />

          <Typography variant="h5" component="h1" gutterBottom fontWeight="bold">
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary">
            An unexpected error occurred. Please try reloading the page.
          </Typography>

          {/* Temporarily show technical error details in all environments */}
          <Box sx={errorBoxSx}>
            <Typography variant="subtitle2" sx={errorLabelSx}>
              Error Details:
            </Typography>
            <Typography variant="caption" sx={errorTextSx}>
              {this.state.error?.message || this.state.error?.toString() || 'Unknown error'}
            </Typography>
            {this.state.error?.stack && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={stackLabelSx}>
                  Stack Trace:
                </Typography>
                <Typography variant="caption" sx={stackTextSx}>
                  {this.state.error.stack.split('\n').slice(0, 10).join('\n')}
                </Typography>
              </Box>
            )}
          </Box>

          <Button
            variant="contained"
            color="primary"
            onClick={() => { window.location.href = '/'; }}
            sx={primaryBtnSx}
          >
            Back to Home
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => window.location.reload()}
            sx={reloadBtnSx}
          >
            Reload Page
          </Button>
        </Paper>
      </Box>
    );
  }
}

// Wrapper that injects router hooks into the class component
export default function ErrorBoundary({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundaryInner location={location}>
      {children}
    </ErrorBoundaryInner>
  );
}
