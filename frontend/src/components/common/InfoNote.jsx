import React from 'react';
import { Alert, Typography, Box } from "@mui/material";


export default function InfoNote({ notes = [], sx = {} }) {
    if (!notes || notes.length === 0) return null;

    return (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2, ...sx }}>
            {notes.map((note, idx) => (
                <Box
                    key={idx}
                    sx={{
                        mt: idx > 0 ? 0.5 : 0,
                    }}
                >
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
