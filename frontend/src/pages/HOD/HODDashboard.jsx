import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
    Box, Typography, Card, CardContent, Grid,
    CircularProgress, Alert, Tooltip, IconButton,
    Stack, Chip
} from '@mui/material';

import { apiFetch, batchFetch } from '../../core/services/apiFetch';
import PageHeader from '../../components/common/PageHeader';
import BrandingBanner from '../../components/common/BrandingBanner';
import useRequireRole from '../../core/hooks/useRequireRole';
import { ROLES } from '../../core/constants/roles';
import {
    Edit as EditIcon,
    Groups as GroupsIcon,
    People as PeopleIcon,
    AssignmentTurnedIn as AssignmentTurnedInIcon,
    Assessment as AssessmentIcon,
    Assignment as AssignmentIcon,
    School as SchoolIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../../components/common/SearchBar';
import StatusChip from '../../components/common/StatusChip';
import DataTable from '../../components/common/DataTable';

const SectionLoader = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
    </Box>
);

export default function HODDashboard(props) {
    const navigate = useNavigate();
    const setSection = props.context?.setSection;

    // Internal navigation helper
    const handleNavigation = (path, sectionKey) => {
        if (setSection) {
            setSection(sectionKey);
        } else {
            navigate(path);
        }
    };
    const { user, authorized, authLoading } = useRequireRole(ROLES.HOD);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [analytics, setAnalytics] = useState({
        totalStudents: 0,
        totalSubmissions: 0,
        pendingApprovals: 0,
        averageCompletion: 0,
        totalGuides: 0
    });
    const [students, setStudents] = useState([]);
    const [projects, setProjects] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);

    useEffect(() => {
        if (authorized && user?.department) {
            fetchDashboardData();
        } else if (authorized && !user?.department) {
            setError("Your HOD account is not assigned to a department.");
            setLoading(false);
        }
    }, [authorized, user]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const results = await batchFetch([
                { id: 'analytics', method: 'GET', url: `/api/analytics/department/${encodeURIComponent(user.department)}` },
                { id: 'students', method: 'GET', url: `/api/admin/students?department=${encodeURIComponent(user.department)}` },
                { id: 'projects', method: 'GET', url: `/api/projects?baseDept=${encodeURIComponent(user.department)}` }
            ]);

            if (results?.analytics?.status === 200 && results.analytics.data) {
                setAnalytics(prev => ({ ...prev, ...results.analytics.data }));
            }

            if (results?.students?.status === 200) {
                const sData = results.students.data;
                const studentList = sData?.data || sData || [];
                setStudents(Array.isArray(studentList) ? studentList : []);
            }

            if (results?.projects?.status === 200) {
                const pData = results.projects.data;
                const projectList = pData?.data || pData || [];
                setProjects(Array.isArray(projectList) ? projectList : []);
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    if (authLoading || loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
    if (!authorized) return null;

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <PageHeader
                title={user.name}
                isWelcome
                action={<BrandingBanner onClick={() => props.context?.setSection?.('about')} />}
            />

            {/* DASHBOARD STATISTICS */}
            {analytics && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => handleNavigation('/hod', 'dashboard')} sx={{ cursor: 'pointer', display: 'flex' }}>
                        <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                            <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <PeopleIcon sx={{ color: '#0369a1' }} />
                                        <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800 }}>Total Students</Typography>
                                    </Box>
                                    <Typography variant="h3" fontWeight={900} color="#0c4a6e">{analytics.totalStudents}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                    <Chip label={`L1: ${analytics.totalL1Students || 0}`} size="small" sx={{ bgcolor: '#bae6fd', color: '#0369a1', fontWeight: 'bold' }} />
                                    <Chip label={`L2: ${analytics.totalL2Students || 0}`} size="small" sx={{ bgcolor: '#bae6fd', color: '#0369a1', fontWeight: 'bold' }} />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => handleNavigation('/hod/tasks', 'tasks')} sx={{ cursor: 'pointer', display: 'flex' }}>
                        <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #15803d', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                            <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <AssignmentTurnedInIcon sx={{ color: '#15803d' }} />
                                        <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 800 }}>Submissions</Typography>
                                    </Box>
                                    <Typography variant="h3" fontWeight={900} color="#14532d">{analytics.totalSubmissions}</Typography>
                                </Box>
                                <Box sx={{ height: 24, mt: 2 }} /> {/* Spacer to align with chips */}
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => handleNavigation('/hod/projects', 'projects')} sx={{ cursor: 'pointer', display: 'flex' }}>
                        <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                            <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <AssignmentIcon sx={{ color: '#b45309' }} />
                                        <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800 }}>Projects</Typography>
                                    </Box>
                                    <Typography variant="h3" fontWeight={900} color="#78350f">{analytics.totalProjects || projects.length}</Typography>
                                </Box>
                                <Box sx={{ height: 24, mt: 2 }} /> {/* Spacer to align with chips */}
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} onClick={() => handleNavigation('/hod/tasks', 'tasks')} sx={{ cursor: 'pointer', display: 'flex' }}>
                        <Card elevation={0} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', transition: 'transform 0.3s, box-shadow 0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } }}>
                            <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <AssessmentIcon sx={{ color: '#6d28d9' }} />
                                        <Typography variant="caption" sx={{ color: '#6d28d9', fontWeight: 800 }}>Completion</Typography>
                                    </Box>
                                    <Typography variant="h3" fontWeight={900} color="#4c1d95">{(Number(analytics.averageCompletion) || (analytics.overall?.averageCompletion) || 0).toFixed(1)}%</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                                    <Chip label={`Avg: ${(Number(analytics.averageCompletion) || (analytics.overall?.averageCompletion) || 0).toFixed(1)}%`} size="small" sx={{ bgcolor: '#ddd6fe', color: '#6d28d9', fontWeight: 'bold' }} />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
            <Grid container spacing={4}>
                <Grid size={{ xs: 12 }}>
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" fontWeight={800}>Department Students Participation</Typography>
                            <SearchBar
                                placeholder="Search Data"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onClear={() => setSearchQuery("")}
                                isFocused={searchFocused}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                            />
                        </Box>
                        <Suspense fallback={<SectionLoader />}>
                            <DataTable
                                columns={[
                                    {
                                        id: 'name', label: 'Student Name', minWidth: 150, render: (s) => (
                                            <Box>
                                                <Typography variant="body2" fontWeight={700}>{s.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{s.studentId}</Typography>
                                            </Box>
                                        )
                                    },
                                    {
                                        id: 'appliedProject', label: 'Project', minWidth: 200, render: (s) => (
                                            <Typography
                                                noWrap
                                                sx={{
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    maxWidth: { xs: 180, sm: 250, md: '25vw' }
                                                }}
                                                title={s.appliedProject?.title}
                                            >
                                                {s.appliedProject?.title || '-'}
                                            </Typography>
                                        )
                                    },
                                    { id: 'level', label: 'Level', minWidth: 80, render: (s) => <StatusChip status={`Level ${s.level}`} /> },
                                    {
                                        id: 'status', label: 'Engagement', minWidth: 100, render: (s) => (
                                            <Chip
                                                label={s.appliedProject ? "Allocated" : "Awaiting"}
                                                size="small"
                                                color={s.appliedProject ? "success" : "default"}
                                                sx={{ fontWeight: 700 }}
                                            />
                                        )
                                    }
                                ]}
                                rows={students.filter(s => {
                                    const q = searchQuery.toLowerCase();
                                    const name = (s.name || "").toLowerCase();
                                    const sId = (s.studentId || "").toLowerCase();
                                    return name.includes(q) || sId.includes(q);
                                })}
                                loading={false}
                                emptyMessage="No students found in your department."
                                fixedLayout={false}
                            />
                        </Suspense>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
