import React from 'react';
import { Alert, Typography, Box } from "@mui/material";


export default function InfoNote({ notes = [], ordered = false, sx = {} }) {
    if (!notes || notes.length === 0) return null;

    return (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2, ...sx }}>
            {notes.map((note, idx) => (
                <Box
                    key={idx}
                    sx={{
                        mt: idx > 0 ? 0.5 : 0,
                        display: 'flex',
                        gap: 1
                    }}
                >
                    {ordered && (
                        <Typography
                            variant="body2"
                            sx={{ fontWeight: 800, color: 'primary.main', minWidth: '15px' }}
                        >
                            {idx + 1}.
                        </Typography>
                    )}
                    <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, lineHeight: 1.5 }}
                    >
                        {note}
                    </Typography>
                </Box>
            ))}
        </Alert>
    );
}
