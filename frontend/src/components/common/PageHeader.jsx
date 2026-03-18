import React from 'react';
import { Box, Typography } from '@mui/material';

export default function PageHeader({ title, subtitle, action, isWelcome = false }) {
    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: 4,
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2
        }}>
            <Box>
                {isWelcome ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body1" color="text.secondary" fontWeight={600} sx={{ mb: -0.5 }}>Welcome,</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.4px' }}>{title}</Typography>
                    </Box>
                ) : (
                    <>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{title}</Typography>
                        {subtitle && (
                            <Typography variant="subtitle1" sx={{ color: '#64748b', mt: 0.5 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </>
                )}
            </Box>
            {action && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {action}
                </Box>
            )}
        </Box>
    );
}
