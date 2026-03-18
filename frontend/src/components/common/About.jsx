import React from "react";
import {
  Box,
  Typography,
  Paper,
  Divider,
  Card,
  Avatar,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  Grid,
  Button,
  alpha
} from "@mui/material";

import {
  Info as InfoIcon,
  Groups as GroupsIcon,
  GitHub as GitHubIcon,
  LinkedIn as LinkedInIcon
} from "@mui/icons-material";

import { PROJECT_DETAILS, DEV_TEAM } from "../../core/constants/aboutData";

export default function About() {
  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={4} sx={{ maxWidth: 1000, mx: "auto" }}>
        {/* Project Information */}
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 6, border: '1px solid', borderColor: 'divider', background: '#fff' }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'primary.50', color: 'primary.main', display: 'flex' }}>
              <InfoIcon fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={900} color="text.primary" sx={{ letterSpacing: '-0.02em' }}>{PROJECT_DETAILS.title}</Typography>
              <Typography variant="subtitle1" fontWeight={600} color="primary.main">{PROJECT_DETAILS.tagline}</Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            {PROJECT_DETAILS.description}
          </Typography>

          <List sx={{ mt: 2 }}>
            {PROJECT_DETAILS.highlights.map((highlight, index) => (
              <ListItem key={index} disableGutters sx={{ py: 0.5 }}>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mr: 2, flexShrink: 0 }} />
                <ListItemText
                  primary={highlight}
                  primaryTypographyProps={{ variant: 'body1', fontWeight: 500, color: 'text.primary' }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Development Team */}
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 6, border: '1px solid', borderColor: 'divider', background: '#f8fafc' }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
            <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'secondary.50', color: 'secondary.main', display: 'flex' }}>
              <GroupsIcon fontSize="large" />
            </Box>
            <Typography variant="h4" fontWeight={900} color="text.primary" sx={{ letterSpacing: '-0.02em' }}>Development Team</Typography>
          </Box>

          <Grid container spacing={3}>
            {DEV_TEAM.map((member, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card elevation={0} sx={{
                  p: 3,
                  borderRadius: 5,
                  border: '1px solid',
                  borderColor: 'rgba(0,0,0,0.06)',
                  bgcolor: '#fff',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.05)',
                    borderColor: member.color
                  }
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar sx={{
                      width: 70,
                      height: 70,
                      bgcolor: member.color,
                      mr: 2.5,
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      boxShadow: `0 8px 16px ${alpha(member.color, 0.2)}`
                    }}>
                      {member.initials}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={800} color="text.primary" sx={{ mb: 0.5 }}>{member.name}</Typography>
                      <Chip
                        label={member.id}
                        size="small"
                        sx={{
                          bgcolor: index % 2 === 0 ? 'primary.50' : 'secondary.50',
                          color: index % 2 === 0 ? 'primary.main' : 'secondary.main',
                          fontWeight: 700,
                          borderRadius: '8px'
                        }}
                      />
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={2} sx={{ mt: 'auto' }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<GitHubIcon />}
                      href={member.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: 'rgba(0,0,0,0.1)',
                        color: '#24292e',
                        py: 1,
                        '&:hover': {
                          borderColor: '#24292e',
                          bgcolor: 'rgba(0,0,0,0.04)',
                        }
                      }}
                    >
                      GitHub
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<LinkedInIcon />}
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: 'rgba(0,119,181,0.2)',
                        color: '#0077b5',
                        py: 1,
                        '&:hover': {
                          borderColor: '#0077b5',
                          bgcolor: 'rgba(0,119,181,0.04)',
                        }
                      }}
                    >
                      LinkedIn
                    </Button>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Stack>
    </Box>
  );
}
