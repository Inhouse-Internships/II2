import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent,
  CircularProgress, Chip, Avatar, Paper, Skeleton
} from '@mui/material';
import {
  People as PeopleIcon,
  Category as CategoryIcon,
  Paid as PaidIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { apiFetch } from '../../core/services/apiFetch';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/common/PageHeader';
import BrandingBanner from '../../components/common/BrandingBanner';
import { getAuthUser } from '../../core/utils/auth';
import DataTable from '../../components/common/DataTable';

// ── Module-level sx constants (zero allocation per render) ──────────────────

const pageBoxSx = { p: { xs: 1, sm: 2 } };
const gridContainerSx = { mb: 4, width: '100%', ml: 0 };
const bottomGridSx = { width: '100%', ml: 0 };
const sectionLoaderSx = { display: 'flex', justifyContent: 'center', p: 4 };
const cardContentSx = { p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const cardHeaderRowSx = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 1 };
const chipRowSx = { display: 'flex', gap: 1, mt: 2 };
const tableRowCellSx = { display: 'flex', alignItems: 'center', gap: 1.5 };
const trendBoxSx = { mt: 4 };

const CARD_BASE_SX = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 4,
  transition: 'transform 0.25s, box-shadow 0.25s',
  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.09)' }
};

const STAT_CARDS = [
  {
    key: 'students',
    icon: PeopleIcon,
    label: 'Provisionally Selected Students', // Was L2 Students
    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    border: '1px solid #bae6fd',
    iconColor: '#0369a1',
    captionColor: '#0369a1',
    valueColor: '#0c4a6e',
    captionSx: { color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 },
    iconSx: { color: '#0369a1' },
    l1ChipSx: { bgcolor: '#bae6fd', color: '#0369a1', fontWeight: 'bold' }
  },
  {
    key: 'feePaid',
    icon: PaidIcon,
    label: 'Enrolled Students',
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    border: '1px solid #a7f3d0',
    iconColor: '#047857',
    captionColor: '#047857',
    valueColor: '#064e3b',
    captionSx: { color: '#047857', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 },
    iconSx: { color: '#047857' }
  },
  {
    key: 'submissions',
    icon: AssessmentIcon,
    label: 'Submissions',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '1px solid #fde68a',
    iconColor: '#b45309',
    captionColor: '#b45309',
    valueColor: '#78350f',
    captionSx: { color: '#b45309', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 },
    iconSx: { color: '#b45309' }
  },
  {
    key: 'completion',
    icon: TimelineIcon,
    label: 'Avg Completion',
    background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    border: '1px solid #ddd6fe',
    iconColor: '#6d28d9',
    captionColor: '#6d28d9',
    valueColor: '#4c1d95',
    captionSx: { color: '#6d28d9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 },
    iconSx: { color: '#6d28d9' }
  }
];

const paperSx = { p: 3, borderRadius: 4, border: '1px solid #e2e8f0' };

// Stable column definitions for DataTable (defined once, not on every render)
const TOP_PERFORMERS_COLS = [
  {
    id: 'name',
    label: 'Name',
    minWidth: 150,
    maxWidth: 200,
    render: (row) => (
      <Box sx={tableRowCellSx}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem' }}>
          {(row.name || '?').charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="body2" fontWeight={600}>{row.name || 'Unknown'}</Typography>
      </Box>
    )
  },
  {
    id: 'score',
    label: 'Avg Score',
    minWidth: 80,
    render: (row) => (
      <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
        {Math.round(row.score)}%
      </Typography>
    )
  }
];

const BOTTOM_PERFORMERS_COLS = [
  {
    id: 'name',
    label: 'Name',
    minWidth: 150,
    maxWidth: 200,
    render: (row) => (
      <Box sx={tableRowCellSx}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'error.main', fontSize: '0.9rem' }}>
          {(row.name || '?').charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="body2" fontWeight={600}>{row.name || 'Unknown'}</Typography>
      </Box>
    )
  },
  {
    id: 'score',
    label: 'Avg Score',
    minWidth: 80,
    render: (row) => (
      <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
        {Math.round(row.score)}%
      </Typography>
    )
  }
];

const TREND_COLS = [
  { id: '_id', label: 'Date', minWidth: 150, render: (row) => <Typography variant="body2" fontWeight={500}>{row._id}</Typography> },
  { id: 'count', label: 'Submissions', minWidth: 100, render: (row) => <Typography variant="body2" color="primary.main" fontWeight={700}>{row.count}</Typography> }
];

// ── Skeleton card shown while data loads ────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card elevation={0} sx={{ ...CARD_BASE_SX, border: '1px solid #e2e8f0' }}>
      <CardContent sx={cardContentSx}>
        <Box>
          <Box sx={cardHeaderRowSx}>
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="text" width={100} height={14} />
          </Box>
          <Skeleton variant="text" width={80} height={56} />
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Stat card values ─────────────────────────────────────────────────────────

function getStatValue(key, analytics) {
  if (!analytics) return null;
  switch (key) {
    case 'students': return analytics.totalStudents || 0;
    case 'feePaid': return analytics.totalFeePaid || 0;
    case 'submissions': return analytics.totalSubmissions || 0;
    case 'completion': return `${Math.round(analytics.averageCompletion || 0)}%`;
    default: return 0;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard(props) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { enqueueSnackbar } = useSnackbar();
  const user = getAuthUser();

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/analytics/university', {
        useCache: true,
        cacheMaxAge: 120_000  // Use 2-min cache — matches backend TTL
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      setAnalytics(await res.json());
    } catch {
      enqueueSnackbar('Failed to fetch dashboard data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <Box sx={pageBoxSx}>
      <PageHeader
        title={user?.name || 'Administrator'}
        isWelcome
        action={<BrandingBanner onClick={() => props.context?.setSection?.('about')} />}
      />

      {/* STAT CARDS — skeleton shown during loading, values filled in when ready */}
      <Grid container spacing={3} sx={gridContainerSx}>
        {STAT_CARDS.map((card) => {
          const IconComp = card.icon;
          const value = getStatValue(card.key, analytics);

          return (
            <Grid key={card.key} size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
              {loading ? (
                <StatCardSkeleton />
              ) : (
                <Card
                  elevation={0}
                  sx={{ ...CARD_BASE_SX, background: card.background, border: card.border }}
                >
                  <CardContent sx={cardContentSx}>
                    <Box>
                      <Box sx={cardHeaderRowSx}>
                        <IconComp sx={card.iconSx} />
                        <Typography variant="caption" sx={{ ...card.captionSx, textAlign: 'right', lineHeight: 1.2 }}>
                          {card.label}
                        </Typography>
                      </Box>
                      <Typography variant="h3" fontWeight={900} color={card.valueColor}>
                        {value}
                      </Typography>
                    </Box>
                    {card.key === 'students' && (
                      <Box sx={chipRowSx}>
                        <Chip
                          label={`L1: ${analytics?.totalL1Students || 0}`}
                          size="small"
                          sx={card.l1ChipSx}
                        />
                        <Chip
                          label={`Total: ${(analytics?.totalStudents || 0) + (analytics?.totalL1Students || 0)}`}
                          size="small"
                          sx={card.l1ChipSx}
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}
            </Grid>
          );
        })}
      </Grid>

      {/* TABLES */}
      <Grid container spacing={4} sx={bottomGridSx}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={paperSx}>
            <Typography variant="h6" fontWeight={700} mb={3} color="text.primary">
              Top 10 Performers
            </Typography>
            <DataTable
              columns={TOP_PERFORMERS_COLS}
              rows={analytics?.topStudents || []}
              loading={loading}
              emptyMessage="No top performers data available"
            />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={paperSx}>
            <Typography variant="h6" fontWeight={700} mb={3} color="error.main">
              Needs Attention (&lt; 40%)
            </Typography>
            <DataTable
              columns={BOTTOM_PERFORMERS_COLS}
              rows={analytics?.bottomStudents || []}
              loading={loading}
              emptyMessage="No critical performers identified yet"
            />
          </Paper>
        </Grid>
      </Grid>

      {/* SUBMISSION TREND (only if data exists) */}
      {!loading && analytics?.submissionTrend?.length > 0 && (
        <Box sx={trendBoxSx}>
          <Paper elevation={0} sx={paperSx}>
            <Typography variant="h6" fontWeight={700} mb={3} color="text.primary">
              Recent Submission Trend
            </Typography>
            <DataTable
              columns={TREND_COLS}
              rows={analytics.submissionTrend}
              loading={false}
              emptyMessage="No data available"
            />
          </Paper>
        </Box>
      )}
    </Box>
  );
}
