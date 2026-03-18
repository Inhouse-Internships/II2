import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Box, Button, Collapse, IconButton, Typography
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';

function getItemStyle(isActive) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    textDecoration: 'none',
    cursor: 'pointer',
    color: isActive ? '#ffffff' : '#475569',
    background: isActive ? 'linear-gradient(135deg, #0f172a 0%, #334155 100%)' : 'transparent',
    borderRadius: '10px',
    fontWeight: isActive ? 600 : 500,
    transition: 'all 0.2s ease-in-out',
    boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.1)' : 'none',
    '&:hover': {
      backgroundColor: isActive ? 'initial' : 'rgba(241, 245, 249, 0.8)',
      color: isActive ? '#ffffff' : '#0f172a',
      transform: isActive ? 'none' : 'translateX(4px)',
    }
  };
}

function SidebarItem({
  item,
  isActive,
  collapsed,
  mobile,
  onSelect,
  onMobileClose,
  nested = false
}) {
  if (!item || item.hidden) return null;

  const content = (
    <>
      {item.icon}
      {(!collapsed || mobile) && item.label}
    </>
  );

  const sxStyle = {
    ...getItemStyle(isActive),
    ...(nested ? { paddingLeft: (!collapsed || mobile) ? '32px' : '16px' } : {})
  };

  if (item.to) {
    return (
      <NavLink
        to={item.to}
        style={{ textDecoration: 'none', display: 'block', marginBottom: '4px' }}
        onClick={() => {
          onSelect?.(item.key);
          if (mobile) onMobileClose?.();
        }}
      >
        {({ isActive: routeActive }) => (
          <Box sx={{ ...getItemStyle(routeActive), ...(nested ? { paddingLeft: (!collapsed || mobile) ? '32px' : '16px' } : {}) }}>
            {content}
          </Box>
        )}
      </NavLink>
    );
  }

  return (
    <Box
      onClick={() => {
        onSelect?.(item.key);
        if (mobile) onMobileClose?.();
      }}
      sx={{ ...sxStyle, mb: 0.5 }}
    >
      {content}
    </Box>
  );
}

export default function RoleSidebar({
  title,
  collapsed,
  setCollapsed,
  mobile = false,
  onMobileClose,
  items = [],
  secondaryItems = [],
  selectedKey,
  onSelect,
  onLogout,
  secondaryLabel = 'More',
  secondaryOpen = false,
  setSecondaryOpen
}) {
  const hasSecondary = secondaryItems.some((item) => !item.hidden);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#ffffff' }}>
      <Box
        onClick={() => (mobile ? onMobileClose?.() : setCollapsed((value) => !value))}
        sx={{
          py: (!collapsed || mobile) ? 0.4 : 0.6,
          px: (!collapsed || mobile) ? 1 : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: (!collapsed || mobile) ? 'flex-start' : 'center',
          mb: 0.2,
          cursor: 'pointer',
          borderRadius: '12px',
          mx: (!collapsed || mobile) ? 0.8 : 0.5,
          mt: 0.5,
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: 'rgba(241, 245, 249, 0.8)',
            transform: 'scale(1.02)'
          }
        }}
      >
        <Box
          component="img"
          src="/au-logo.jpg"
          alt="AU Logo"
          sx={{
            height: (!collapsed || mobile) ? '40px' : '48px',
            width: (!collapsed || mobile) ? '40px' : '48px',
            objectFit: 'contain',
            borderRadius: '50%',
            transition: 'all 0.3s'
          }}
        />
        {(!collapsed || mobile) && (
          <Box sx={{ ml: 0.4, display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 0.2 }}>
            <Typography sx={{
              fontSize: { xs: '1.15rem', md: '1.3rem' },
              fontWeight: 900,
              color: '#f26522',
              letterSpacing: '0.38em',
              lineHeight: 1,
              fontFamily: '"Arial Black", Arial, sans-serif',
              ml: '0.38em'
            }}>
              ADITYA
            </Typography>
            <Typography sx={{
              fontSize: { xs: '0.6rem', md: '0.7rem' },
              fontWeight: 800,
              color: '#004b87',
              letterSpacing: '0.35em',
              mt: 0.2,
              lineHeight: 1,
              fontFamily: 'Arial, sans-serif',
              ml: '0.35em'
            }}>
              UNIVERSITY
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{
        flex: 1,
        px: 1,
        mt: 2,
        overflowY: 'auto',
        '&::-webkit-scrollbar': { display: 'none' }, // Hide scrollbar for Chrome, Safari and Opera
        msOverflowStyle: 'none', // IE and Edge
        scrollbarWidth: 'none' // Firefox
      }}>
        {items.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            isActive={selectedKey === item.key}
            collapsed={collapsed}
            mobile={mobile}
            onSelect={onSelect}
            onMobileClose={onMobileClose}
          />
        ))}
      </Box>

      {hasSecondary && (
        <Box sx={{ px: 1, mb: 1 }}>
          <Box
            onClick={() => setSecondaryOpen?.((prev) => !prev)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: '12px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              color: '#475569',
              fontWeight: 500,
              transition: 'all 0.2s',
              '&:hover': { backgroundColor: 'rgba(241, 245, 249, 0.8)', color: '#0f172a', transform: 'translateX(4px)' }
            }}
          >
            {(!collapsed || mobile) && (
              <>
                <Box sx={{ flex: 1 }}>{secondaryLabel}</Box>
                {secondaryOpen ? <ExpandLess /> : <ExpandMore />}
              </>
            )}
            {(collapsed && !mobile) && (secondaryOpen ? <ExpandLess /> : <ExpandMore />)}
          </Box>

          <Collapse in={secondaryOpen} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 0.5 }}>
              {secondaryItems.map((item) => (
                <SidebarItem
                  key={item.key}
                  item={item}
                  isActive={selectedKey === item.key}
                  collapsed={collapsed}
                  mobile={mobile}
                  onSelect={onSelect}
                  onMobileClose={onMobileClose}
                  nested
                />
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          color="error"
          variant="outlined"
          onClick={onLogout}
          sx={{
            justifyContent: (!collapsed || mobile) ? 'flex-start' : 'center',
            minWidth: 0,
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            py: 1,
            '&:hover': { backgroundColor: 'error.main', color: '#fff' },
            transition: 'all 0.2s'
          }}
        >
          {(!collapsed || mobile) && 'Logout'}
        </Button>
      </Box>
    </Box>
  );
}
