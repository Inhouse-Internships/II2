import React from 'react';
import {
    Box,
    Typography,
    Button,
    Container,
    Grid,
    Card,
    CardContent,
    Stack,
    Paper,
    Skeleton
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";

import { useNavigate } from 'react-router-dom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import BusinessIcon from '@mui/icons-material/Business';
import HotelIcon from '@mui/icons-material/Hotel';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LoginIcon from '@mui/icons-material/Login';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import { Avatar, IconButton, Tooltip as MuiTooltip } from '@mui/material';
import { PROJECT_DETAILS, DEV_TEAM } from '../../core/constants/aboutData';


const LazyLandingImage = ({ src, alt, sx, className }) => {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [showImage, setShowImage] = React.useState(false);

    React.useEffect(() => {
        // Ensure image starts loading AFTER main content/animations
        const timer = setTimeout(() => setShowImage(true), 800);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 'inherit' }}>
            {!isLoaded && (
                <Skeleton
                    variant="rectangular"
                    animation="wave"
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(15, 23, 42, 0.05)',
                        borderRadius: 'inherit'
                    }}
                />
            )}
            {showImage && (
                <Box
                    component="img"
                    src={src}
                    alt={alt}
                    className={className}
                    onLoad={() => setIsLoaded(true)}
                    sx={{
                        ...sx,
                        opacity: isLoaded ? 1 : 0,
                        transition: 'opacity 1.2s ease-in-out, transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                />
            )}
        </Box>
    );
};

const FeatureCard = ({ icon: Icon, title, desc, highlight }) => {
    const theme = useTheme();
    return (
        <Card
            elevation={0}
            sx={{
                height: '100%',
                background: highlight
                    ? `linear-gradient(135deg, ${alpha(theme.palette.warning.light, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`
                    : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                border: highlight
                    ? `1px solid ${alpha(theme.palette.warning.main, 0.3)}`
                    : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '24px',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: highlight
                        ? `0 20px 40px ${alpha(theme.palette.warning.main, 0.15)}`
                        : '0 20px 40px rgba(0, 0, 0, 0.08)',
                    background: highlight
                        ? `linear-gradient(135deg, ${alpha(theme.palette.warning.light, 0.2)} 0%, ${alpha(theme.palette.warning.main, 0.1)} 100%)`
                        : 'rgba(255, 255, 255, 0.9)',
                },
                display: 'flex',
                flexDirection: 'column',
                p: { xs: 3, md: 4 }
            }}
        >
            <Box
                sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '16px',
                    background: highlight
                        ? `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`
                        : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: '#fff',
                    mb: 3,
                    width: 'fit-content',
                    boxShadow: highlight
                        ? `0 8px 16px ${alpha(theme.palette.warning.main, 0.3)}`
                        : `0 8px 16px ${alpha(theme.palette.primary.main, 0.3)}`
                }}
            >
                <Icon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} color="text.primary" gutterBottom sx={{ fontSize: '1.25rem' }}>
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {desc}
            </Typography>
        </Card>
    );
};

export default function LandingPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const featuresRef = React.useRef(null);
    const aboutRef = React.useRef(null);
    const containerRef = React.useRef(null);

    // State for active section (Pagination/Reveals)
    // State for active section (Pagination/Reveals)
    const [activeSection, setActiveSection] = React.useState('');

    // --- SEQUENTIAL AUTO-SCROLL LOGIC ---
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let isJumping = false;
        let lastTouchY = 0;

        const getScrollPoints = () => {
            const hElem = document.getElementById('highlights');
            const aboutElem = document.getElementById('about-us');
            const devElem = document.getElementById('dev-team');
            const gridElem = featuresRef.current;
            if (!hElem || !aboutElem || !devElem) return [];

            const rect = (el) => el ? el.getBoundingClientRect().top + container.scrollTop : 0;

            return [
                { id: 'hero', top: 0 },
                { id: 'highlights', top: rect(hElem) - 80 },
                { id: 'grid', top: (rect(gridElem) || rect(hElem) + 600) - 100 },
                { id: 'about-us', top: rect(aboutElem) - 80 },
                { id: 'dev-team', top: rect(devElem) - 80 }
            ];
        };

        const handleScroll = () => {
            const points = getScrollPoints();
            const windowHeight = window.innerHeight;

            points.forEach((p) => {
                const el = document.getElementById(p.id);
                if (!el) return;
                const rect = el.getBoundingClientRect();
                if (rect.top < windowHeight / 2 && rect.bottom > windowHeight / 2) {
                    setActiveSection(p.id);
                }
            });
        };

        const performSequentialJump = (direction) => {
            if (isJumping) return;
            const points = getScrollPoints();
            if (points.length === 0) return;
            const currentScroll = Math.round(container.scrollTop);

            let targetIdx = -1;

            if (direction === 'down') {
                for (let i = 0; i < points.length; i++) {
                    if (points[i].top > currentScroll + 10) { // Tightened from 30
                        targetIdx = i;
                        break;
                    }
                }
            } else if (direction === 'up') {
                for (let i = points.length - 1; i >= 0; i--) {
                    if (points[i].top < currentScroll - 10) { // Tightened from 30
                        targetIdx = i;
                        break;
                    }
                }
            }

            if (targetIdx !== -1) {
                isJumping = true;
                container.scrollTo({ top: points[targetIdx].top, behavior: 'smooth' });
                // Lock slightly longer for deterministic feel
                setTimeout(() => { isJumping = false; }, 1200);
            }
        };

        const handleWheel = (e) => {
            if (Math.abs(e.deltaY) < 10) return; // Sensitivity doubled
            performSequentialJump(e.deltaY > 0 ? 'down' : 'up');
        };

        const handleTouchStart = (e) => {
            lastTouchY = e.touches[0].clientY;
        };

        const handleTouchMove = (e) => {
            const currentY = e.touches[0].clientY;
            const deltaY = lastTouchY - currentY;
            if (Math.abs(deltaY) < 15) return; // Sensitivity doubled

            performSequentialJump(deltaY > 0 ? 'down' : 'up');
            lastTouchY = currentY;
        };

        const entranceTimer = setTimeout(() => {
            setActiveSection('hero');
        }, 100);

        container.addEventListener('scroll', handleScroll, { passive: true });
        container.addEventListener('wheel', handleWheel, { passive: true });
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });

        return () => {
            clearTimeout(entranceTimer);
            container.removeEventListener('scroll', handleScroll);
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    const displayParagraphs = [PROJECT_DETAILS.description, ...PROJECT_DETAILS.highlights.map(h => `• ${h}`)];
    const devTeamMembers = DEV_TEAM;

    return (
        <Box
            ref={containerRef}
            id="page-container"
            sx={{
                height: '100vh',
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollBehavior: 'smooth',
                bgcolor: '#f8fafc',
                fontFamily: '"Inter", "Segoe UI", sans-serif',
                WebkitOverflowScrolling: 'touch',
                position: 'relative',
                '::-webkit-scrollbar': { width: '8px' },
                '::-webkit-scrollbar-track': { background: '#f8fafc' },
                '::-webkit-scrollbar-thumb': {
                    background: alpha(theme.palette.primary.main, 0.2),
                    borderRadius: '10px',
                    '&:hover': { background: alpha(theme.palette.primary.main, 0.4) }
                }
            }}
        >

            {/* Header / Navbar */}
            <Box
                component="header"
                sx={{
                    py: { xs: 1.5, md: 2 },
                    px: { xs: 2, md: 8 },
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(12px)',
                    position: 'fixed',
                    width: '100%',
                    top: 0,
                    zIndex: 1000,
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                    boxSizing: 'border-box'
                }}
            >
                <Box
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 1.5, md: 2 },
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        '&:hover': { opacity: 0.85 }
                    }}
                >
                    <img src="/au-logo.jpg" alt="Aditya University" style={{ height: '40px', width: 'auto', objectFit: 'contain', borderRadius: '50%' }} />
                    <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        gap: { md: 1 }
                    }}>
                        <Typography
                            sx={{
                                fontWeight: 900,
                                fontSize: { xs: '1rem', md: '1.7rem' },
                                letterSpacing: { xs: '0.38em', md: '0.1em' },
                                fontFamily: { xs: '"Arial Black", Arial, sans-serif', md: '"Arial Black", Arial, sans-serif' },
                                color: '#f26522',
                                lineHeight: 1,
                                ml: { xs: '0.38em', md: 0 }
                            }}
                        >
                            ADITYA
                        </Typography>
                        <Typography
                            sx={{
                                fontWeight: { xs: 800, md: 900 },
                                fontSize: { xs: '0.5rem', md: '1.70rem' },
                                letterSpacing: { xs: '0.35em', md: '0.1em' },
                                fontFamily: { xs: 'Arial, sans-serif', md: '"Arial Black", Arial, sans-serif' },
                                color: '#004b87',
                                mt: { xs: 0.5, md: 0 },
                                lineHeight: 1,
                                ml: { xs: '0.35em', md: 0 }
                            }}
                        >
                            UNIVERSITY
                        </Typography>
                    </Box>
                </Box>
                <Stack direction="row" spacing={{ xs: 0.5, sm: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Button
                        variant="text"
                        color="primary"
                        onClick={() => navigate('/login')}
                        startIcon={<LoginIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />}
                        sx={{
                            borderRadius: '12px',
                            px: { xs: 0.5, sm: 3 },
                            py: 1,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: { xs: '0.75rem', sm: '0.95rem' },
                            minWidth: { xs: '60px', sm: 'auto' }
                        }}
                    >
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Sign In</Box>
                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Login</Box>
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AppRegistrationIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />}
                        onClick={() => navigate('/register')}
                        sx={{
                            borderRadius: '12px',
                            px: { xs: 2, sm: 3 },
                            py: 1,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: { xs: '0.8rem', sm: '0.95rem' },
                            minWidth: 'auto',
                            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
                            '&:hover': {
                                boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.35)}`,
                                transform: 'translateY(-1px)'
                            },
                            transition: 'all 0.2s'
                        }}
                    >
                        Register
                    </Button>
                </Stack>
            </Box>

            {/* Hero Section */}
            <Box
                id="hero"
                sx={{
                    flexGrow: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    pt: { xs: 16, md: 24 },
                    pb: { xs: 12, md: 20 },
                    background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
                    scrollSnapAlign: 'start',
                    opacity: activeSection === 'hero' ? 1 : 0.8,
                    transform: activeSection === 'hero' ? 'scale(1)' : 'scale(0.98)',
                    transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                {/* Abstract Background Shapes */}
                <Box sx={{ position: 'absolute', top: '10%', right: '5%', width: '40vw', height: '40vw', borderRadius: '50%', background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.15)} 0%, transparent 70%)`, filter: 'blur(60px)', zIndex: 0 }} />
                <Box sx={{ position: 'absolute', bottom: '0%', left: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: `radial-gradient(circle, ${alpha(theme.palette.info.light, 0.15)} 0%, transparent 70%)`, filter: 'blur(60px)', zIndex: 0 }} />

                <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                    <Box sx={{ textAlign: 'center', mb: { xs: 8, md: 12 }, maxWidth: '900px', mx: 'auto' }}>
                        <Typography
                            variant="overline"
                            component="div"
                            sx={{
                                color: 'primary.main',
                                fontWeight: 800,
                                letterSpacing: 3,
                                mb: 3,
                                display: 'inline-block',
                                fontSize: '0.85rem',
                                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                px: 2,
                                py: 0.5,
                                borderRadius: '100px',
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                animation: activeSection === 'hero' ? 'titleEntrance 0.8s ease-out forwards' : 'none',
                                '@keyframes titleEntrance': {
                                    '0%': { opacity: 0, transform: 'scale(0.995) translateY(10px)' },
                                    '100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
                                }
                            }}
                        >
                            ADITYA UNIVERSITY INTRODUCES
                        </Typography>
                        <Typography
                            variant="h1"
                            component="h1"
                            sx={{
                                fontWeight: 900,
                                fontSize: { xs: '3.5rem', sm: '4.5rem', md: '6rem' },
                                lineHeight: 1.05,
                                mb: 4,
                                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.dark} 100%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                letterSpacing: '-0.03em',
                                pb: '10px',
                                animation: activeSection === 'hero' ? 'zoomInMain 1s ease-out forwards' : 'none',
                                '@keyframes zoomInMain': {
                                    '0%': { opacity: 0, transform: 'scale(0.995) translateY(15px)' },
                                    '100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
                                }
                            }}
                        >
                            In-House<br />
                            Internships 2.0
                        </Typography>
                        <Typography
                            variant="h5"
                            color="text.secondary"
                            sx={{ mb: 6, fontWeight: 400, lineHeight: 1.7, fontSize: { xs: '1.1rem', md: '1.35rem' }, maxWidth: '800px', mx: 'auto' }}
                        >
                            Accelerate your career with hands-on experience right here on campus.
                            Join our intensive 8-week program and build real-world projects.
                        </Typography>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="center" sx={{ mt: 4 }}>
                            <Button
                                variant="contained"
                                size="large"
                                endIcon={<RocketLaunchIcon />}
                                onClick={() => navigate('/register')}
                                sx={{
                                    py: 2,
                                    px: 8,
                                    borderRadius: '16px',
                                    fontSize: '1.25rem',
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                    boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.3)}`,
                                    '&:hover': {
                                        boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
                                        transform: 'translateY(-2px)'
                                    },
                                    transition: 'all 0.3s'
                                }}
                            >
                                Get Started Now
                            </Button>
                        </Stack>
                    </Box>

                </Container>
            </Box>

            {/* Program Highlights Section */}
            <Box
                id="highlights"
                sx={{
                    py: 18,
                    bgcolor: '#f8fafc',
                    scrollSnapAlign: 'start',
                    scrollMarginTop: '80px',
                    opacity: (activeSection === 'highlights' || activeSection === 'grid') ? 1 : 0.6,
                    transform: (activeSection === 'highlights' || activeSection === 'grid') ? 'translateY(0)' : 'translateY(40px)',
                    transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <Container maxWidth="lg">
                    {/* Grand Prize Banner */}
                    <Box sx={{ mb: { xs: 10, md: 16 }, px: { xs: 2, sm: 0 } }}>
                        <Card
                            elevation={0}
                            sx={{
                                maxWidth: 1000,
                                mx: 'auto',
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                borderRadius: '32px',
                                overflow: 'hidden',
                                position: 'relative',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            {/* Decorative background elements inside banner */}
                            <Box sx={{ position: 'absolute', top: -100, right: -50, opacity: 0.1, transform: 'rotate(15deg)' }}>
                                <EmojiEventsIcon sx={{ fontSize: 400, color: '#fbbf24' }} />
                            </Box>
                            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)' }} />

                            <CardContent sx={{ p: { xs: 4, sm: 6, md: 8 }, textAlign: 'center', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '24px', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', mb: 4 }}>
                                    <EmojiEventsIcon sx={{ fontSize: 48, color: '#fbbf24' }} />
                                </Box>
                                <Typography variant="h5" sx={{ fontWeight: 500, mb: 2, color: '#94a3b8', letterSpacing: 1 }}>
                                    COMPLETE YOUR INTERNSHIP SUCCESSFULLY
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Features Grid */}
                    <Box ref={featuresRef}>
                        <Typography variant="h3" component="h2" sx={{ textAlign: 'center', fontWeight: 900, mb: 2, color: '#0f172a' }}>
                            Program Highlights
                        </Typography>
                        <Typography variant="h6" sx={{ textAlign: 'center', fontWeight: 400, mb: 8, color: 'text.secondary' }}>
                            Everything you need to succeed, provided on campus.
                        </Typography>

                        <Grid container spacing={4} sx={{ justifyContent: 'center' }}>
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <FeatureCard
                                    icon={AccessTimeIcon}
                                    title="8 Weeks Duration"
                                    desc="Intensive, focused timeline designed to maximize learning and output."
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <FeatureCard
                                    icon={FactCheckIcon}
                                    title="75% Attendance"
                                    desc="Strict attendance policy to ensure dedication and consistent progress."
                                    highlight={true}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <FeatureCard
                                    icon={BusinessIcon}
                                    title="On-Campus Projects"
                                    desc="Work securely within the university infrastructure with dedicated resources."
                                />
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <FeatureCard
                                    icon={HotelIcon}
                                    title="Hostel Accommodation"
                                    desc="Comfortable stay arrangements for outstation and resident students."
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <FeatureCard
                                    icon={DirectionsBusIcon}
                                    title="Bus Facility"
                                    desc="Reliable daily transit provided for day scholars."
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <FeatureCard
                                    icon={CurrencyRupeeIcon}
                                    title="₹1000 Refundable Fee"
                                    desc="Fully refunded upon successful completion."
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <FeatureCard
                                    icon={MoneyOffIcon}
                                    title="No Stipend"
                                    desc="Focus entirely on learning and skill-building."
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </Container>
            </Box>

            {/* About Us Section */}
            <Box
                ref={aboutRef}
                id="about-us"
                sx={{
                    py: 18,
                    bgcolor: '#ffffff',
                    borderTop: '1px solid #f1f5f9',
                    scrollSnapAlign: 'start',
                    scrollMarginTop: '80px',
                    opacity: activeSection === 'about-us' ? 1 : 0.6,
                    transform: activeSection === 'about-us' ? 'translateY(0)' : 'translateY(40px)',
                    transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 12 }}>
                        <Box sx={{ flex: 1.2, textAlign: { xs: 'center', md: 'left' } }}>
                            <Typography
                                variant="h3"
                                fontWeight={900}
                                sx={{
                                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.dark} 100%)`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    mb: 4,
                                    mt: 1,
                                    fontSize: { xs: '2.8rem', md: '3.8rem' },
                                    lineHeight: 1.1,
                                    letterSpacing: '-0.04em'
                                }}
                            >
                                {PROJECT_DETAILS.title}
                            </Typography>
                            {displayParagraphs.map((paragraph, index) => (
                                <Typography key={index} variant="body1" sx={{ color: '#475569', mb: 3, fontSize: '1.25rem', lineHeight: 1.8, fontWeight: 500 }}>
                                    {paragraph}
                                </Typography>
                            ))}
                        </Box>
                        <Box sx={{ flex: 0.8, width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <Box sx={{
                                width: '100%',
                                maxWidth: '520px',
                                height: '480px',
                                borderRadius: '48px',
                                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 40px 80px -15px rgba(0,0,0,0.15)',
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <LazyLandingImage
                                    src="/about-image.png"
                                    alt="About Our Project"
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        '&:hover': {
                                            transform: 'scale(1.05)'
                                        }
                                    }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* Development Team Section */}
            <Box id="dev-team" sx={{ py: 18, bgcolor: '#f8fafc', borderTop: '1px solid #f1f5f9', scrollSnapAlign: 'start', scrollMarginTop: '80px' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row-reverse' }, alignItems: 'center', gap: 12 }}>
                        <Box sx={{ flex: 1.2, textAlign: { xs: 'center', md: 'left' } }}>
                            <Typography
                                variant="h3"
                                fontWeight={900}
                                sx={{
                                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.dark} 100%)`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    mb: 4,
                                    mt: 1,
                                    fontSize: { xs: '2.8rem', md: '3.8rem' },
                                    lineHeight: 1.1,
                                    letterSpacing: '-0.04em'
                                }}
                            >
                                Development Team
                            </Typography>
                            <Grid container spacing={4} sx={{ mt: 1 }}>
                                {DEV_TEAM.map((member, index) => (
                                    <Grid item xs={12} sm={6} key={index}>
                                        <Paper elevation={0} sx={{
                                            p: 5,
                                            borderRadius: 10,
                                            bgcolor: '#fff',
                                            border: '1px solid',
                                            borderColor: 'rgba(0,0,0,0.04)',
                                            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            textAlign: 'center',
                                            height: '100%',
                                            '&:hover': {
                                                transform: 'translateY(-20px)',
                                                boxShadow: '0 40px 80px -20px rgba(0,0,0,0.12)',
                                                borderColor: member.color,
                                            }
                                        }}>
                                            <Avatar
                                                sx={{
                                                    width: 100,
                                                    height: 100,
                                                    bgcolor: member.color,
                                                    mb: 4,
                                                    fontSize: '2.25rem',
                                                    fontWeight: 900,
                                                    boxShadow: `0 15px 30px ${alpha(member.color, 0.35)}`
                                                }}
                                            >
                                                {member.initials}
                                            </Avatar>
                                            <Typography variant="h5" fontWeight={900} color="#1e293b" sx={{ mb: 1, letterSpacing: '-0.02em', fontSize: '1.5rem' }}>
                                                {member.name}
                                            </Typography>
                                            <Typography variant="body2" fontWeight={800} color="#94a3b8" sx={{ letterSpacing: 2, mb: 5, textTransform: 'uppercase', fontSize: '0.8rem' }}>
                                                {member.id}
                                            </Typography>

                                            <Stack direction="row" spacing={2} sx={{ width: '100%', mt: 'auto' }}>
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    size="large"
                                                    startIcon={<GitHubIcon />}
                                                    href={member.github}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    sx={{
                                                        borderRadius: '20px',
                                                        textTransform: 'none',
                                                        fontWeight: 700,
                                                        borderColor: 'rgba(0,0,0,0.1)',
                                                        color: '#334155',
                                                        py: 1.8,
                                                        fontSize: '1rem',
                                                        '&:hover': {
                                                            borderColor: '#0f172a',
                                                            bgcolor: '#f8fafc',
                                                            transform: 'translateY(-4px)'
                                                        },
                                                        transition: 'all 0.3s'
                                                    }}
                                                >
                                                    GitHub
                                                </Button>
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    size="large"
                                                    startIcon={<LinkedInIcon />}
                                                    href={member.linkedin}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    sx={{
                                                        borderRadius: '20px',
                                                        textTransform: 'none',
                                                        fontWeight: 700,
                                                        borderColor: 'rgba(0,119,181,0.2)',
                                                        color: '#0077b5',
                                                        py: 1.8,
                                                        fontSize: '1rem',
                                                        '&:hover': {
                                                            borderColor: '#0077b5',
                                                            bgcolor: 'rgba(0,119,181,0.05)',
                                                            transform: 'translateY(-4px)'
                                                        },
                                                        transition: 'all 0.3s'
                                                    }}
                                                >
                                                    LinkedIn
                                                </Button>
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                        <Box sx={{ flex: 0.8, width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <Box sx={{
                                width: '100%',
                                maxWidth: '520px',
                                height: '480px',
                                borderRadius: '48px',
                                background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 40px 80px -15px rgba(0,0,0,0.15)',
                                border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                                overflow: 'hidden',
                                position: 'relative',
                                '&:hover .dev-image': {
                                    transform: 'scale(1.05)'
                                }
                            }}>
                                <LazyLandingImage
                                    src="/dev-image.png"
                                    alt="Development Team"
                                    className="dev-image"
                                    sx={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* CTA Section */}
            <Box sx={{ py: 12, bgcolor: '#ffffff', textAlign: 'center', borderTop: '1px solid #f1f5f9', scrollSnapAlign: 'start', scrollMarginTop: '80px' }}>
                <Container maxWidth="md">
                    <Typography variant="h3" fontWeight={900} color="#0f172a" mb={3}>
                        Ready to build the future?
                    </Typography>
                    <Typography variant="h6" color="text.secondary" mb={6} sx={{ fontWeight: 400 }}>
                        Join hundreds of students turning their ideas into reality. Registration is open for a limited time.
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => navigate('/register')}
                        sx={{
                            py: 2,
                            px: 8,
                            borderRadius: '16px',
                            fontSize: '1.25rem',
                            textTransform: 'none',
                            fontWeight: 700,
                            boxShadow: `0 10px 25px ${alpha(theme.palette.primary.main, 0.3)}`
                        }}
                    >
                        Create Your Account
                    </Button>
                </Container>
            </Box>

            {/* Footer */}
            <Box
                component="footer"
                sx={{
                    py: 4,
                    textAlign: 'center',
                    bgcolor: '#0f172a',
                    color: '#94a3b8',
                    mt: 'auto',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    scrollSnapAlign: 'start'
                }}
            >
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <img src="/au-logo.jpg" alt="AU Logo" style={{ height: '40px', filter: 'brightness(1.5)', borderRadius: '50%' }} />
                            <Box sx={{ textAlign: 'left' }}>
                                <Typography variant="h6" fontWeight={800} sx={{ display: 'flex' }}>
                                    <Box component="span" sx={{ color: '#f26522', mr: 0.5 }}>ADITYA</Box>
                                    <Box component="span" sx={{ color: '#004b87' }}>UNIVERSITY</Box>
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                                    ADB Road, Surampalem
                                </Typography>
                            </Box>
                        </Box>
                        <Stack direction="row" spacing={3}>
                            <Button variant="text" onClick={() => document.getElementById('about-us').scrollIntoView({ behavior: 'smooth' })} sx={{ color: '#fff', opacity: 0.7, '&:hover': { opacity: 1 } }}>About</Button>
                            <Button variant="text" onClick={() => document.getElementById('dev-team').scrollIntoView({ behavior: 'smooth' })} sx={{ color: '#fff', opacity: 0.7, '&:hover': { opacity: 1 } }}>Dev Team</Button>
                            <Button variant="text" sx={{ color: '#fff', opacity: 0.7, '&:hover': { opacity: 1 } }}>Terms of Service</Button>
                            <Button variant="text" sx={{ color: '#fff', opacity: 0.7, '&:hover': { opacity: 1 } }}>Contact Us</Button>
                        </Stack>
                    </Box>
                </Container>
            </Box>
        </Box>
    );
}
