import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Card, CardContent, CircularProgress, Alert, Paper, Stack, Button, IconButton, Tooltip, Grid, TextField, MenuItem, Select, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Snackbar, Avatar,
    Tabs, Tab, Chip
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    PendingActions as PendingActionsIcon,
    Save as SaveIcon,
    People as PeopleIcon
} from "@mui/icons-material";

import attendanceService from '../../core/services/attendanceService';
import { apiFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import * as XLSX from 'xlsx';

export default function FacultyAttendance({ projects = [], context = {} }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState(context.navState?.projectId || (projects.length > 0 ? projects[0]._id : ''));
    const [students, setStudents] = useState([]);
    const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
    const [exportFromDate, setExportFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [exportToDate, setExportToDate] = useState(new Date().toISOString().split('T')[0]);
    const [exportTouched, setExportTouched] = useState(false);
    const [attendanceForm, setAttendanceForm] = useState({});
    const [attendanceRecords, setAttendanceRecords] = useState({}); // Stores full record objects
    const [internshipSettings, setInternshipSettings] = useState(null);
    const [tabIndex, setTabIndex] = useState(0);

    useEffect(() => {
        fetchInternshipSettings();
    }, []);

    const fetchInternshipSettings = async () => {
        try {
            const res = await apiFetch('/api/admin/settings/internship');
            if (res.ok) {
                const data = await res.json();
                setInternshipSettings(data.data || data);
            }
        } catch (err) { }
    };

    useEffect(() => {
        // Initialize export range to current operational date once (don't override user range picks)
        if (exportTouched) return;
        setExportFromDate(targetDate);
        setExportToDate(targetDate);
    }, [targetDate, exportTouched]);

    useEffect(() => {
        if (projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projects[0]._id);
        }
    }, [projects]);

    useEffect(() => {
        if (selectedProjectId && targetDate) {
            fetchData();
        }
    }, [selectedProjectId, targetDate]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        setAttendanceForm({});

        try {
            const projRes = await apiFetch(`/api/faculty/projects/${selectedProjectId}/students`);
            if (!projRes.ok) throw new Error('Failed to load project students');
            const projData = await projRes.json();
            const projStudents = projData.students || (Array.isArray(projData) ? projData : (projData.data || []));
            setStudents(projStudents);

            const attRes = await attendanceService.getProjectAttendance(selectedProjectId, targetDate, targetDate);
            if (!attRes.ok) throw new Error('Failed to sync existing attendance records');
            const attData = await attRes.json();

            const formState = {};
            const recordState = {};
            projStudents.forEach(student => {
                const existingRecord = (attData.attendance || []).find(r => r.studentId && r.studentId._id === student._id);
                formState[student._id] = existingRecord ? existingRecord.attendanceStatus : 'Absent';
                recordState[student._id] = existingRecord || null;
            });
            setAttendanceForm(formState);
            setAttendanceRecords(recordState);
        } catch (err) {
            setError(err.message || 'Synchronization failure with master register');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = (studentId, status) => {
        setAttendanceForm(prev => ({ ...prev, [studentId]: status }));
    };

    const markAll = (status) => {
        const newFormState = {};
        students.forEach(s => newFormState[s._id] = status);
        setAttendanceForm(newFormState);
    };

    const getSelectedProject = () => projects.find(p => String(p._id) === String(selectedProjectId));

    // Attendance dates in backend are normalized to IST start-of-day.
    // Using `toISOString()` (UTC) can shift the date and break exports (all "Absent").
    const IST_TZ = 'Asia/Kolkata';
    const isoDateFormatterIST = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parseISODateToUTCDate = (iso) => {
        // iso: "YYYY-MM-DD" -> Date at 00:00:00 UTC for stable day increments
        const [y, m, d] = String(iso || '').split('-').map(Number);
        if (!y || !m || !d) return null;
        return new Date(Date.UTC(y, m - 1, d));
    };

    const toISODateIST = (d) => {
        try {
            const dt = new Date(d);
            if (Number.isNaN(dt.getTime())) return '';
            return isoDateFormatterIST.format(dt); // "YYYY-MM-DD"
        } catch {
            return '';
        }
    };

    const eachDateInclusive = (startISO, endISO) => {
        const dates = [];
        const start = parseISODateToUTCDate(startISO);
        const end = parseISODateToUTCDate(endISO);
        if (!start || !end) return dates;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates;
        for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
            dates.push(toISODateIST(dt));
        }
        return dates;
    };

    const downloadExcel = (sheetName, rowsAoA, filename) => {
        const ws = XLSX.utils.aoa_to_sheet(rowsAoA);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, filename);
    };

    const buildAndDownloadAttendanceMatrix = async ({ mode }) => {
        // mode: 'day' | 'month'
        if (!selectedProjectId) return;

        const project = getSelectedProject();
        const baseDept = project?.baseDept || project?.department || '';
        const guideName = project?.guide || project?.guideName || '';
        const title = project?.title || '';

        const rawFrom = exportFromDate || targetDate;
        const rawTo = (mode === 'day') ? (exportFromDate || targetDate) : (exportToDate || exportFromDate || targetDate);

        let from = toISODateIST(rawFrom);
        let to = toISODateIST(rawTo);
        if (from && to && new Date(from) > new Date(to)) {
            [from, to] = [to, from];
        }

        setLoading(true);
        setError('');
        try {
            const projRes = await apiFetch(`/api/faculty/projects/${selectedProjectId}/students`);
            if (!projRes.ok) throw new Error('Failed to load project students');
            const projData = await projRes.json();
            const projStudents = projData.students || (Array.isArray(projData) ? projData : (projData.data || []));

            const attRes = await attendanceService.getProjectAttendance(selectedProjectId, from, to);
            if (!attRes.ok) throw new Error('Failed to load attendance history');
            const attData = await attRes.json();
            const attendance = attData.attendance || [];

            const studentCols = projStudents
                .slice()
                .sort((a, b) => String(a.studentId || '').localeCompare(String(b.studentId || '')))
                .map(s => String(s.studentId || s.regNo || s.rollNo || s._id));

            // date(IST) -> rollNo -> status
            const byDate = {};
            attendance.forEach(r => {
                const d = toISODateIST(r.date);
                const roll = String(r.studentId?.studentId || r.studentId?.rollNo || r.studentId?.studentIdNumber || r.studentId || '');
                if (!d || !roll) return;
                byDate[d] = byDate[d] || {};
                byDate[d][roll] = r.attendanceStatus || r.status || 'Absent';
            });

            const header = [
                'DAY',
                'DATE',
                'DAY',
                'Name of the Department',
                'Name of the Guide',
                'Title of the Project',
                ...studentCols
            ];

            const dates = eachDateInclusive(from, to);
            const aoa = [header];
            let dayCounter = 1;
            dates.forEach((d) => {
                const dayName = parseISODateToUTCDate(d)?.toLocaleDateString('en-US', { weekday: 'long', timeZone: IST_TZ }) || '';
                if (dayName.toUpperCase() === 'SUNDAY') {
                    // Add a visual separator row similar to screenshot
                    aoa.push(['', '', 'SUNDAY']);
                    return;
                }
                const row = [];
                row.push(`DAY-${dayCounter}`);
                row.push(parseISODateToUTCDate(d)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: IST_TZ }) || d);
                row.push(dayName);
                row.push(baseDept);
                row.push(guideName);
                row.push(title);
                studentCols.forEach((roll) => {
                    const status = byDate[d]?.[roll] || 'Absent';
                    row.push(status === 'Present' ? 'Present' : 'Absent');
                });
                aoa.push(row);
                dayCounter += 1;
            });

            const safeProjectId = (project?.projectId || 'Project').replace(/[^\w.-]+/g, '_');
            const filename = mode === 'day'
                ? `Attendance_Daywise_${safeProjectId}_${from}.xlsx`
                : `Attendance_Monthwise_${safeProjectId}_${from}_to_${to}.xlsx`;

            downloadExcel(mode === 'day' ? 'Daywise' : 'Monthwise', aoa, filename);
        } catch (err) {
            setError(err?.message || 'Failed to generate excel');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAttendance = async () => {
        if (loading || students.length === 0) return;
        setLoading(true);
        try {
            const records = Object.entries(attendanceForm).map(([studentId, status]) => ({
                studentId,
                attendanceStatus: status,
                remarks: ''
            }));
            const res = await attendanceService.markAttendance(selectedProjectId, targetDate, records);
            if (res.ok) {
                setSuccessMsg('Register securely synchronized');
                fetchData();
            } else {
                const data = await res.json();
                setError(data.message || 'Verification failure during save');
            }
        } catch (err) {
            setError('Upstream network disruption');
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const counts = { Present: 0, Absent: 0 };
        Object.values(attendanceForm).forEach(v => counts[v] = (counts[v] || 0) + 1);
        return counts;
    }, [attendanceForm]);

    const isToday = new Date(targetDate).toDateString() === new Date().toDateString();

    if (projects.length === 0) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="info" variant="outlined" sx={{ borderRadius: 3 }}>
                    Strategic monitoring disabled. No active projects assigned for mentorship.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
            <PageHeader
                title="Attendance Register"
                subtitle="Execute daily roll calls and monitor student presence"
            />

            <Snackbar open={!!successMsg} autoHideDuration={4000} onClose={() => setSuccessMsg('')} message={successMsg} />

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)}>
                    <Tab label="Mark Attendance" />
                    <Tab label="Detailed Log" />
                </Tabs>
            </Box>

            <Paper sx={{ p: 2, mb: 4, borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 7 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Operational Project Focus</InputLabel>
                            <Select
                                value={selectedProjectId}
                                label="Operational Project Focus"
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                sx={{ borderRadius: 2, bgcolor: '#f8fafc' }}
                            >
                                {projects.map((p) => (
                                    <MenuItem key={p._id} value={p._id}>{p.title} ({p.projectId})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <TextField
                            type="date"
                            label="Operational Date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            size="small"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            inputProps={{
                                borderRadius: 2,
                                bgcolor: '#f8fafc',
                                min: internshipSettings?.startDate || undefined,
                                max: internshipSettings?.endDate || undefined
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f8fafc' } }}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {tabIndex === 0 && (
                <>
                    {error && <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

                    {/* ANALYTICS BOXES */}
                    {!loading && students.length > 0 && (
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            {[
                                { label: 'Total Strength', value: students.length, color: '#64748b', icon: <PeopleIcon /> },
                                { label: 'Present Today', value: stats.Present, color: '#10b981', icon: <CheckCircleIcon /> },
                                { label: 'Absent Items', value: stats.Absent, color: '#ef4444', icon: <CancelIcon /> }
                            ].map((s, idx) => (
                                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
                                    <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                                        <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar sx={{ bgcolor: `${s.color}15`, color: s.color, width: 44, height: 44 }}>{s.icon}</Avatar>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" fontWeight={800}>{s.label}</Typography>
                                                <Typography variant="h5" fontWeight={900} color="#1e293b">{s.value}</Typography>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    )}

                    {loading ? (
                        <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress size={50} thickness={4} /></Box>
                    ) : students.length === 0 ? (
                        <Box sx={{ py: 10, textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: 5 }}>
                            <Typography color="text.secondary" fontWeight={600}>No students mapped to this operational entity.</Typography>
                        </Box>
                    ) : (
                        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden', bgcolor: 'white' }}>
                            <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                <Typography variant="subtitle2" fontWeight={800} color="#1e293b">
                                    Roll Call Matrix - {new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </Typography>
                                <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <TextField
                                            type="date"
                                            size="small"
                                            label="From"
                                            value={exportFromDate}
                                            onChange={(e) => { setExportTouched(true); setExportFromDate(e.target.value); }}
                                            InputLabelProps={{ shrink: true }}
                                            sx={{ width: 150, bgcolor: 'white', borderRadius: 2 }}
                                            inputProps={{
                                                min: internshipSettings?.startDate || undefined,
                                                max: internshipSettings?.endDate || undefined
                                            }}
                                        />
                                        <TextField
                                            type="date"
                                            size="small"
                                            label="To"
                                            value={exportToDate}
                                            onChange={(e) => { setExportTouched(true); setExportToDate(e.target.value); }}
                                            InputLabelProps={{ shrink: true }}
                                            sx={{ width: 150, bgcolor: 'white', borderRadius: 2 }}
                                            inputProps={{
                                                min: internshipSettings?.startDate || undefined,
                                                max: internshipSettings?.endDate || undefined
                                            }}
                                        />
                                        <Button
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', fontWeight: 900, textDecoration: 'underline' }}
                                            disabled={loading}
                                            onClick={() => buildAndDownloadAttendanceMatrix({ mode: 'day' })}
                                        >
                                            Download Day-wise Excel
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="text"
                                            sx={{ textTransform: 'none', fontWeight: 900, textDecoration: 'underline' }}
                                            disabled={loading}
                                            onClick={() => buildAndDownloadAttendanceMatrix({ mode: 'month' })}
                                        >
                                            Download Month-wise Excel
                                        </Button>
                                    </Stack>

                                    <Stack direction="row" spacing={1}>
                                        <Button size="small" variant="text" color="success" onClick={() => markAll('Present')} disabled={!isToday} sx={{ textTransform: 'none', fontWeight: 800 }}>Present All</Button>
                                        <Button size="small" variant="text" color="error" onClick={() => markAll('Absent')} disabled={!isToday} sx={{ textTransform: 'none', fontWeight: 800 }}>Absent All</Button>
                                    </Stack>
                                </Stack>
                            </Box>

                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                            <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>STUDENT NAME</TableCell>
                                            <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>REG. ID</TableCell>
                                            <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>GEO STATUS</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, color: '#64748b' }}>EXECUTION STATUS</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {students.map(student => {
                                            const status = attendanceForm[student._id] || 'Absent';
                                            const record = attendanceRecords[student._id];
                                            return (
                                                <TableRow
                                                    key={student._id}
                                                    sx={{
                                                        transition: 'background-color 0.15s',
                                                        bgcolor: status === 'Present' ? 'rgba(16, 185, 129, 0.08)' : status === 'Absent' ? 'rgba(239, 68, 68, 0.08)' : 'inherit'
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Stack direction="row" spacing={2} alignItems="center">
                                                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.light' }}>{student.name.charAt(0)}</Avatar>
                                                            <Typography variant="body2" fontWeight={700} color="#334155">{student.name}</Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell><Typography variant="body2" color="text.secondary">{student.studentId}</Typography></TableCell>
                                                    <TableCell>
                                                        {record?.locationStatus ? (
                                                            <Tooltip title={`Lat: ${record.latitude?.toFixed(4)}, Long: ${record.longitude?.toFixed(4)}, Acc: ${record.accuracy}m`}>
                                                                <Chip
                                                                    label={record.locationStatus}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    color={record.locationStatus === 'Inside Campus' ? 'success' : 'error'}
                                                                    sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                                                />
                                                            </Tooltip>
                                                        ) : <Typography variant="caption" color="text.disabled">Manual/N/A</Typography>}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Stack direction="row" spacing={1} justifyContent="center">
                                                            {[
                                                                { id: 'Present', color: 'success' },
                                                                { id: 'Absent', color: 'error' }
                                                            ].map((opt) => (
                                                                <Button
                                                                    key={opt.id}
                                                                    size="small"
                                                                    variant={status === opt.id ? "contained" : "outlined"}
                                                                    color={opt.color}
                                                                    disabled={!isToday}
                                                                    onClick={() => handleStatusChange(student._id, opt.id)}
                                                                    sx={{
                                                                        borderRadius: 2,
                                                                        textTransform: 'none',
                                                                        fontWeight: 700,
                                                                        minWidth: 90,
                                                                        boxShadow: status === opt.id ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                                                                    }}
                                                                >
                                                                    {opt.id}
                                                                </Button>
                                                            ))}
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    {isToday ? "Authorized to modify current record" : "Historical records locked for security"}
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    onClick={handleSaveAttendance}
                                    disabled={loading || !isToday}
                                    sx={{ borderRadius: 2, px: 5, py: 1.2, textTransform: 'none', fontWeight: 800, bgcolor: '#1e293b', '&:hover': { bgcolor: '#0f172a' } }}
                                >
                                    Finalize Attendance
                                </Button>
                            </Box>
                        </Card>
                    )}
                </>
            )}

            {tabIndex === 1 && (
                <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden', bgcolor: 'white' }}>
                    <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <Typography variant="subtitle2" fontWeight={800} color="#1e293b">Detailed Attendance History</Typography>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>STUDENT</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>STATUS</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>GEO STATUS</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>COORDINATES</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>TIMESTAMP</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {students.map(student => {
                                    const record = attendanceRecords[student._id];
                                    return (
                                        <TableRow key={student._id}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={700}>{student.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{student.studentId}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={record?.attendanceStatus || 'Absent'}
                                                    size="small"
                                                    color={record?.attendanceStatus === 'Present' ? 'success' : record?.attendanceStatus === 'Denied' ? 'error' : 'default'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {record?.locationStatus ? (
                                                    <Chip label={record.locationStatus} size="small" variant="outlined" color={record.locationStatus === 'Inside Campus' ? 'success' : 'error'} />
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {record?.latitude ? (
                                                    <Typography variant="caption">{record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}</Typography>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption">{record?.createdAt ? new Date(record.createdAt).toLocaleTimeString() : '-'}</Typography>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            )}
        </Box>
    );
}
