import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { SwapHoriz as SwapIcon } from '@mui/icons-material';
import { UNIVERSITY_EMAIL_DOMAINS } from '../../core/constants/app';

const EmailSuffixToggle = ({ value, onChange, disabled }) => {
    const currentDomain = UNIVERSITY_EMAIL_DOMAINS.find(d => value.endsWith(d)) || UNIVERSITY_EMAIL_DOMAINS[0];

    const handleToggle = () => {
        if (disabled) return;
        const currentIndex = UNIVERSITY_EMAIL_DOMAINS.indexOf(currentDomain);
        const nextIndex = (currentIndex + 1) % UNIVERSITY_EMAIL_DOMAINS.length;
        const nextDomain = UNIVERSITY_EMAIL_DOMAINS[nextIndex];

        // If the value already contains a domain, replace it
        let prefix = value;
        UNIVERSITY_EMAIL_DOMAINS.forEach(d => {
            if (prefix.endsWith(d)) {
                prefix = prefix.substring(0, prefix.length - d.length);
            }
        });

        onChange(prefix + nextDomain);
    };

    return (
        <Tooltip title="Click to switch domain" arrow>
            <Box
                onClick={handleToggle}
                sx={{
                    cursor: disabled ? 'default' : 'pointer',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    letterSpacing: '0.01em',
                    userSelect: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    '&:hover': {
                        backgroundColor: disabled ? '#f8fafc' : '#f1f5f9',
                        borderColor: disabled ? '#e2e8f0' : '#cbd5e1',
                        color: disabled ? '#475569' : '#004b87',
                        transform: disabled ? 'none' : 'translateY(-1px)',
                        boxShadow: disabled ? '0 1px 2px rgba(0,0,0,0.05)' : '0 2px 4px rgba(0,0,0,0.1)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    },
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    maxWidth: '180px', // Prevent extreme stretching
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}
            >
                <Box
                    component="span"
                    sx={{
                        fontSize: currentDomain.length > 15 ? '0.75rem' : '0.8rem',
                        opacity: 0.9
                    }}
                >
                    {currentDomain}
                </Box>
                {!disabled && (
                    <SwapIcon
                        sx={{
                            fontSize: '1rem',
                            color: '#94a3b8',
                            transition: 'color 0.2s'
                        }}
                    />
                )}
            </Box>
        </Tooltip>
    );
};

export default EmailSuffixToggle;
