import React, { useState } from 'react';
import {
    Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Typography,
    Box, CircularProgress, Checkbox, TablePagination
} from '@mui/material';

/**
 * A standardized data table for Admin pages.
 * @param {Array} columns - Array of objects { id, label, align, width, minWidth, maxWidth, render }
 * @param {Array} rows - Array of data objects
 * @param {Boolean} loading - Loading state
 * @param {String} emptyMessage - Message to show when no data
 * @param {Boolean} stickyHeader - Whether the header is sticky
 * @param {Object} sx - Custom styles for the container
 * @param {Boolean} hover - Enable hover effect on rows
 * @param {Boolean} fixedLayout - If true, uses table-layout: fixed
 * @param {Boolean} selectionMode - If true, shows checkboxes
 * @param {Array} selectedIds - Array of selected row IDs
 * @param {Function} onSelectAll - Handler for select all (event) => void
 * @param {Function} onSelectOne - Handler for select one (id) => void
 */
const DataTable = ({
    columns,
    rows = [],
    loading,
    emptyMessage = "No records found.",
    stickyHeader = true,
    sx = {},
    hover = true,
    fixedLayout = false,
    selectionMode = false,
    selectedIds = [],
    onSelectAll,
    onSelectOne,
    children,
    pagination = true,
    getRowSx,
    // Server-side pagination props
    serverSide = false,
    totalCount = 0,
    page: externalPage = 0,
    rowsPerPage: externalRowsPerPage = 25,
    onPageChange,
    onRowsPerPageChange
}) => {
    const [localPage, setLocalPage] = useState(0);
    const [localRowsPerPage, setLocalRowsPerPage] = useState(25);

    const safeRows = rows || [];
    const page = serverSide ? externalPage : localPage;
    const rowsPerPage = serverSide ? externalRowsPerPage : localRowsPerPage;

    const handleChangePage = (event, newPage) => {
        if (serverSide && onPageChange) {
            onPageChange(event, newPage);
        } else {
            setLocalPage(newPage);
        }
    };

    const handleChangeRowsPerPage = (event) => {
        const val = parseInt(event.target.value, 10);
        if (serverSide && onRowsPerPageChange) {
            onRowsPerPageChange(event);
        } else {
            setLocalRowsPerPage(val);
            setLocalPage(0);
        }
    };

    // Calculate current rows to display
    const displayRows = (pagination && !serverSide)
        ? safeRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
        : safeRows;

    const count = serverSide ? totalCount : safeRows.length;
    const shouldPaginate = pagination;

    return (
        <Paper
            elevation={0}
            sx={{
                width: "100%",
                mx: 'auto',
                maxWidth: "100%",
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                ...sx
            }}
        >
            <TableContainer sx={{ overflowX: "auto" }}>
                <Table
                    stickyHeader={stickyHeader}
                    size="small"
                    sx={{
                        tableLayout: fixedLayout ? 'fixed' : 'auto',
                        width: '100%',
                        "& .MuiTableCell-root": {
                            whiteSpace: "nowrap",
                        }
                    }}
                >
                    <TableHead>
                        <TableRow>
                            {selectionMode && (
                                <TableCell key="selection-header" padding="checkbox" sx={{ bgcolor: '#f8fafc', zIndex: 10 }}>
                                    <Checkbox
                                        indeterminate={selectedIds.length > 0 && (serverSide ? selectedIds.length < (safeRows.length || 0) : selectedIds.length < safeRows.length)}
                                        checked={(serverSide ? safeRows.length > 0 : safeRows.length > 0) && (serverSide ? selectedIds.length === (safeRows.length || 0) : selectedIds.length === safeRows.length)}
                                        onChange={onSelectAll}
                                    />
                                </TableCell>
                            )}
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    align={column.align || 'left'}
                                    style={{
                                        width: column.width,
                                        minWidth: column.minWidth,
                                        maxWidth: column.maxWidth,
                                        fontWeight: 700,
                                        backgroundColor: '#f8fafc',
                                        color: '#475569',
                                        textTransform: 'uppercase',
                                        fontSize: '0.75rem',
                                        letterSpacing: '0.5px',
                                        paddingTop: '12px',
                                        paddingBottom: '12px'
                                    }}
                                >
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + (selectionMode ? 1 : 0)} align="center" sx={{ py: 3 }}>
                                    <CircularProgress size={24} sx={{ mr: 1 }} />
                                    <Typography variant="body2" component="span">Loading data...</Typography>
                                </TableCell>
                            </TableRow>
                        ) : safeRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + (selectionMode ? 1 : 0)} align="center" sx={{ py: 8 }}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>
                                        <Box
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: '50%',
                                                bgcolor: '#f1f5f9',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mb: 1.5
                                            }}
                                        >
                                            <Typography variant="h6" sx={{ color: '#94a3b8', lineHeight: 1 }}>!</Typography>
                                        </Box>
                                        <Typography variant="body2" fontWeight={600} color="text.secondary">
                                            {emptyMessage}
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayRows.map((row, index) => (
                                <TableRow
                                    key={row._id || index}
                                    hover={hover}
                                    sx={{
                                        ...(hover && { '&:hover': { backgroundColor: '#f1f5f9' } }),
                                        transition: 'background-color 0.2s',
                                        ...(getRowSx ? getRowSx(row) : {})
                                    }}
                                >
                                    {selectionMode && (
                                        <TableCell key={`select-${row._id || index}`} padding="checkbox">
                                            <Checkbox
                                                checked={selectedIds.includes(row._id)}
                                                onChange={() => onSelectOne(row._id)}
                                            />
                                        </TableCell>
                                    )}
                                    {columns.map((column) => {
                                        const value = row[column.id];
                                        return (
                                            <TableCell
                                                key={column.id}
                                                align={column.align || 'left'}
                                                style={{
                                                    maxWidth: column.maxWidth,
                                                    overflow: column.maxWidth ? 'hidden' : 'visible',
                                                    textOverflow: column.maxWidth ? 'ellipsis' : 'clip',
                                                    paddingTop: '10px',
                                                    paddingBottom: '10px',
                                                    color: '#334155'
                                                }}
                                            >
                                                {column.render ? column.render(row, value, index) : (value || "-")}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        )}
                        {children}
                    </TableBody>
                </Table>
            </TableContainer>
            {shouldPaginate && (
                <TablePagination
                    component="div"
                    count={count}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={count > 25 ? [10, 25, 50, 100] : []}
                    sx={{
                        '& .MuiTablePagination-actions, & .MuiTablePagination-displayedRows': {
                            display: count <= rowsPerPage ? 'none' : 'flex'
                        },
                        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-select, & .MuiTablePagination-selectIcon': {
                            display: count <= 25 ? 'none' : 'flex'
                        }
                    }}
                />
            )}
        </Paper>
    );
};

export default DataTable;
