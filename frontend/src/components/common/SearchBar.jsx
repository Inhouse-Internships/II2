import React from 'react';
import {
    TextField,
    InputAdornment,
    IconButton,
} from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';

export default function SearchBar({
    value,
    onChange,
    onClear,
    placeholder = 'Search...',
    sx = {},
    size = 'small',
    isFocused = false,
    onFocus,
    onBlur,
    focusedWidth = 350,
    defaultWidth = 250,
}) {
    return (
        <TextField
            label={placeholder}
            variant="outlined"
            size={size}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            sx={{
                width: { xs: '100%', sm: isFocused ? focusedWidth : defaultWidth },
                transition: 'width 0.3s ease-in-out',
                minWidth: 160,
                ...sx,
            }}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end">
                        {value ? (
                            <IconButton
                                size="small"
                                onClick={onClear}
                                onMouseDown={(e) => e.preventDefault()}
                                edge="end"
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        ) : (
                            <SearchIcon color="action" />
                        )}
                    </InputAdornment>
                ),
            }}
        />
    );
}
