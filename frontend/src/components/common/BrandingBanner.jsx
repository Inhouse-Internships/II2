import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { WorkspacePremium as WorkspacePremiumIcon } from '@mui/icons-material';

const BrandingBanner = ({ onClick }) => {
    const theme = useTheme();

    return (
        <Box
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: '8px 20px',
                borderRadius: '100px',
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.info.dark} 100%)`,
                boxShadow: `0 4px 15px ${alpha(theme.palette.primary.main, 0.3)}, inset 0 2px 4px ${alpha('#fff', 0.2)}`,
                border: `1px solid ${alpha('#fff', 0.1)}`,
                position: 'relative',
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: onClick
                        ? `0 8px 25px ${alpha(theme.palette.primary.main, 0.5)}`
                        : `0 8px 25px ${alpha(theme.palette.primary.main, 0.4)}`,
                    filter: onClick ? 'brightness(1.1)' : 'none',
                    '& .brand-shimmer': {
                        left: '100%',
                    }
                },
                '&:active': {
                    transform: onClick ? 'translateY(0) scale(0.98)' : 'none',
                }
            }}
        >
            {/* Glossy Shimmer Effect */}
            <Box
                className="brand-shimmer"
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '50%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    transition: 'left 0.6s ease-in-out',
                }}
            />

            <WorkspacePremiumIcon sx={{ color: '#fff', fontSize: '1.4rem' }} />

            <Typography
                variant="subtitle2"
                sx={{
                    color: '#fff',
                    fontWeight: 900,
                    letterSpacing: 0.5,
                    fontSize: '0.95rem',
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    whiteSpace: 'nowrap'
                }}
            >
                Inhouse Internship 2.0
            </Typography>
        </Box>
    );
};

export default BrandingBanner;
