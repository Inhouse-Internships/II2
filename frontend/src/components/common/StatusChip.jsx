import React from 'react';
import { Chip } from '@mui/material';
import {
    CheckCircleOutline as CheckCircleOutlineIcon,
    HourglassEmpty as HourglassEmptyIcon,
    Cancel as CancelIcon
} from '@mui/icons-material';

export default function StatusChip({ status, label: customLabel, level = null, size = 'small' }) {
    let color = 'default';
    let icon = null;

    // Normalize status for switching
    const normalizedStatus = (status || '').toLowerCase();

    switch (normalizedStatus) {
        case 'approved':
        case 'open':
        case 'active':
        case 'qualified':
            color = 'success';
            icon = <CheckCircleOutlineIcon />;
            break;
        case 'pending':
        case 'on hold':
            color = 'warning';
            icon = <HourglassEmptyIcon />;
            break;
        case 'rejected':
        case 'closed':
        case 'denied':
        case 'missed deadline':
            color = 'error';
            icon = <CancelIcon />;
            break;
        case 'submitted':
            color = 'primary';
            icon = <CheckCircleOutlineIcon />;
            break;
        default:
            color = 'default';
    }

    // Determine label: custom -> level-formatted -> capitalized status
    let displayLabel = customLabel || status;
    if (level && normalizedStatus !== 'rejected') {
        displayLabel = `${status} L${level}`;
    } else if (!customLabel && status) {
        // Capitalize first letter for default label
        displayLabel = status.charAt(0).toUpperCase() + status.slice(1);
    }

    return (
        <Chip
            icon={icon}
            label={displayLabel}
            color={color}
            size={size}
            sx={{ fontSize: "0.9rem", px: 1, fontWeight: "bold" }}
        />
    );
}
