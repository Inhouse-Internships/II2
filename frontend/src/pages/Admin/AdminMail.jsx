import { apiFetch } from '../../core/services/apiFetch';
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Divider,
  Grid
} from "@mui/material";
import {
  Send as SendIcon,
  DeleteForever as DeleteForeverIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Email as EmailIcon,
  People as PeopleIcon,
  Add as AddIcon
} from "@mui/icons-material";

import PageHeader from '../../components/common/PageHeader';

export default function AdminMail() {
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [recipients, setRecipients] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("mailRecipients") || "[]");
    } catch {
      return [];
    }
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const newRecipients = location.state?.recipients || [];
    if (newRecipients.length > 0) {
      setRecipients((prev) => {
        const combined = [...prev];
        const existingIds = new Set(prev.map((r) => r._id));
        newRecipients.forEach((r) => {
          if (!existingIds.has(r._id)) combined.push(r);
        });
        return combined;
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    sessionStorage.setItem("mailRecipients", JSON.stringify(recipients));
  }, [recipients]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...files]);
    // Reset input so same file can be selected again if removed
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMail = async () => {
    if (recipients.length === 0) {
      setError("No recipients selected.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body cannot be empty.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("recipients", JSON.stringify(recipients.map(r => r.email)));
    formData.append("subject", subject);
    formData.append("body", body);
    attachments.forEach(file => {
      formData.append("attachments", file);
    });

    try {
      const res = await apiFetch("/api/admin/mail/send", {
        method: "POST",
        body: formData // apiFetch handles multipart if body is FormData
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message || "Mail sent successfully!");
        setSubject("");
        setBody("");
        setAttachments([]);
      } else {
        throw new Error(data.message || "Failed to send mail.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Broadcast Communications"
      />

      <Grid container spacing={3}>
        {/* Recipient List Side */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Recipients ({recipients.length})</Typography>
                </Box>
                {recipients.length > 0 && (
                  <Tooltip title="Clear all recipients">
                    <IconButton size="small" color="error" onClick={() => setRecipients([])}>
                      <DeleteForeverIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {recipients.length === 0 ? (
                <Alert severity="info">
                  No recipients selected. Use the Students or Faculty management pages to select and broadcast.
                </Alert>
              ) : (
                <Box sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <Stack spacing={1}>
                    {recipients.map((r) => (
                      <Chip
                        key={r._id}
                        label={r.name || r.email}
                        onDelete={() => setRecipients(prev => prev.filter(x => x._id !== r._id))}
                        variant="outlined"
                        size="small"
                        sx={{ justifyContent: 'space-between', width: '100%' }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Composer Main */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card elevation={4}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <EmailIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6">Compose Message</Typography>
              </Box>

              <Stack spacing={3}>
                <TextField
                  label="Email Subject"
                  variant="outlined"
                  fullWidth
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter a descriptive subject line"
                />

                <TextField
                  label="Message Body"
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Compose your message here..."
                />

                {/* Attachments Section */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachFileIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                    <Typography variant="subtitle2" color="text.secondary">Attachments</Typography>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => fileInputRef.current.click()}
                      sx={{ ml: 2 }}
                    >
                      Add Files
                    </Button>
                    <input
                      type="file"
                      multiple
                      hidden
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </Box>

                  {attachments.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
                      <List dense sx={{ py: 0 }}>
                        {attachments.map((file, index) => (
                          <ListItem
                            key={index}
                            divider={index !== attachments.length - 1}
                            secondaryAction={
                              <IconButton edge="end" size="small" onClick={() => removeAttachment(index)}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            }
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <InsertDriveFileIcon color="primary" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={file.name}
                              secondary={`${(file.size / 1024).toFixed(1)} KB`}
                              primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  )}
                </Box>

                {error && <Alert severity="error">{error}</Alert>}
                {success && <Alert severity="success">{success}</Alert>}

                <Divider />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => { setSubject(""); setBody(""); setAttachments([]); }}
                    disabled={loading}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    onClick={handleSendMail}
                    disabled={loading || recipients.length === 0}
                    sx={{ px: 4, py: 1.5, borderRadius: 2, boxShadow: 3 }}
                  >
                    {loading ? "Sending..." : "Send Broadcast"}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}


