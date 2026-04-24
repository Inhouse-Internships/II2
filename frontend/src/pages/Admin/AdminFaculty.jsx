import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  Chip,
  Button,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Switch,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputLabel,
  Autocomplete
} from "@mui/material";
import {
  Close as CloseIcon,
  CheckBox as CheckBoxIcon,
  Search as SearchIcon,
  Mail as MailIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { apiFetch } from '../../core/services/apiFetch';
import useRequireRole from "../../core/hooks/useRequireRole";
import { ROLES } from "../../core/constants/roles";
import DataTable from "../../components/common/DataTable";
import PageHeader from "../../components/common/PageHeader";
import SearchBar from "../../components/common/SearchBar";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EmailSuffixToggle from "../../components/common/EmailSuffixToggle";
import ProjectDetailsDialog from "../../components/common/ProjectDetailsDialog";

export default function AdminFaculty(props) {
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { authorized } = useRequireRole(ROLES.ADMIN);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [facultyToDelete, setFacultyToDelete] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewFaculty, setViewFaculty] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [facultyForm, setFacultyForm] = useState({
    _id: "",
    name: "",
    email: "",
    employeeId: "",
    department: "",
    phone: "",
    password: ""
  });
  const [openAdd, setOpenAdd] = useState(false);
  const [newFaculty, setNewFaculty] = useState({
    name: "",
    email: "",
    phone: "",
    employeeId: "",
    department: "",
    password: ""
  });
  const [allDepartments, setAllDepartments] = useState([]);

  // Assignment states
  const [selectedDepartmentObj, setSelectedDepartmentObj] = useState(null);
  const [selectedFacultyObj, setSelectedFacultyObj] = useState(null);
  const [selectedProjectObj, setSelectedProjectObj] = useState(null);
  const [taskMode, setTaskMode] = useState(true);

  const [assignForm, setAssignForm] = useState({
    title: "",
    description: "",
    startDate: "",
    status: "Pending" // "Pending", "Approved", "Rejected"
  });

  // Track assigned tasks state
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [assignedTasksLoading, setAssignedTasksLoading] = useState(false);
  const [taskDeleteConfirmOpen, setTaskDeleteConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);


  useEffect(() => {
    if (authorized) {
      fetchData();
    }
  }, [authorized]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [facultyRes, projectsRes, deptsRes] = await Promise.all([
        apiFetch("/api/admin/faculty"),
        apiFetch("/api/projects"),
        apiFetch("/api/admin/all-db-departments")
      ]);

      if (facultyRes.ok && projectsRes.ok && deptsRes.ok) {
        const facultyData = await facultyRes.json();
        const projectsData = await projectsRes.json();
        const extractedProjects = projectsData.data?.data || projectsData.data || projectsData;
        const deptsData = await deptsRes.json();
        setFaculty(facultyData);
        setProjects(Array.isArray(extractedProjects) ? extractedProjects : []);
        setAllDepartments(deptsData);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectAssign = async (facultyId, projectId, role = "guide") => {
    try {
      const res = await apiFetch(`/api/admin/faculty/${facultyId}/project`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId, role })
      });

      if (res.ok) {
        // Update local state
        const assignedProject = projectId ? projects.find(p => p._id === projectId) : null;

        setFaculty(prev => prev.map(f => {
          if (f._id === facultyId) {
            if (role === "co-guide") return {
              ...f,
              coGuidedProject: assignedProject || null,
              coGuideStatus: assignedProject ? "Approved" : "Pending"
            };
            else return {
              ...f,
              appliedProject: assignedProject || null,
              status: assignedProject ? "Approved" : "Pending"
            };
          }
          return f;
        }));

        if (viewFaculty && viewFaculty._id === facultyId) {
          setViewFaculty(prev => ({
            ...prev,
            appliedProject: role === "guide" ? (assignedProject || null) : prev.appliedProject,
            coGuidedProject: role === "co-guide" ? (assignedProject || null) : prev.coGuidedProject,
            status: role === "guide" ? (assignedProject ? "Approved" : "Pending") : prev.status,
            coGuideStatus: role === "co-guide" ? (assignedProject ? "Approved" : "Pending") : prev.coGuideStatus
          }));
        }
      } else {
        const data = await res.json();
        alert(data.message || "Failed to assign project");
        fetchData(); // Re-fetch to correct UI state on failure
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  const handleApprove = async (id, role = "guide") => {
    await apiFetch(`/api/admin/faculty/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ role })
    });
    fetchData();
  };

  const handleReject = async (id, role = "guide") => {
    await apiFetch(`/api/admin/faculty/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", },
      body: JSON.stringify({ role })
    });
    fetchData();
  };

  const handleDelete = (id) => {
    setFacultyToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!facultyToDelete) return;
    await apiFetch(`/api/admin/faculty/${facultyToDelete}`, {
      method: "DELETE"
    });
    setDeleteConfirmOpen(false);
    setFacultyToDelete(null);
    fetchData();
  };

  const handleAddChange = (e) => {
    setNewFaculty({ ...newFaculty, [e.target.name]: e.target.value });
  };

  const handleAddSubmit = async () => {
    if (!newFaculty.name || !newFaculty.email || !newFaculty.department || !newFaculty.password) {
      alert("Please fill all required fields");
      return;
    }

    try {
      const res = await apiFetch("/api/admin/faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFaculty)
      });

      if (res.ok) {
        setOpenAdd(false);
        setNewFaculty({ name: "", email: "", phone: "", employeeId: "", department: "", password: "" });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to create faculty");
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  const handleAdminAssignTask = async () => {
    if (!selectedProjectObj || !assignForm.startDate || !assignForm.description) {
      alert("Please fill out Project, Date, and Tasks/activities to be completed.");
      return;
    }
    try {
      const payload = {
        title: assignForm.title || `${selectedFacultyObj?.name} Update`, // Default if empty
        description: assignForm.description,
        startDate: assignForm.startDate,
        deadline: assignForm.startDate, // usually for daily tracking it's the same
        project: selectedProjectObj._id,
        status: assignForm.status
      };
      const res = await apiFetch("/api/tasks/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Task Assigned Successfully!");
        setAssignForm({ title: "", description: "", startDate: "", status: "Pending" });
        fetchAssignedTasks(selectedProjectObj._id);
      } else {
        const err = await res.json();
        alert(err.message || "Failed to assign task");
      }
    } catch (err) {
      console.error(err);
      alert("Server error assigning task.");
    }
  };


  const fetchAssignedTasks = async (projectId) => {
    if (!projectId) { setAssignedTasks([]); return; }
    setAssignedTasksLoading(true);
    try {
      const res = await apiFetch("/api/tasks/admin");
      if (res.ok) {
        const all = await res.json();
        const filtered = all.filter(t => {
          const pid = typeof t.project === 'object' ? String(t.project?._id) : String(t.project);
          return pid === String(projectId);
        });
        setAssignedTasks(filtered);
      }
    } catch (err) {
      console.error("Error fetching assigned tasks", err);
    } finally {
      setAssignedTasksLoading(false);
    }
  };

  const confirmDeleteAssignedTask = async () => {
    if (!taskToDelete) return;
    try {
      const res = await apiFetch(`/api/tasks/admin/${taskToDelete._id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setAssignedTasks(prev => prev.filter(t => t._id !== taskToDelete._id));
        alert("Task deleted successfully. It has been removed from Faculty and Student portals.");
      } else {
        alert(data.message || "Failed to delete task");
      }
    } catch (err) {
      alert("Error deleting task");
    } finally {
      setTaskDeleteConfirmOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredFaculty.map(f => f._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleExportSelected = () => {
    const selectedData = faculty.filter(f => selectedIds.includes(f._id));
    navigate("/admin/import-export", { state: { exportData: selectedData, type: "faculty" } });
  };

  const handleSendMail = () => {
    const selectedFaculty = faculty.filter(f => selectedIds.includes(f._id));
    if (props.context?.setSection) {
      props.context.setSection('mail', { recipients: selectedFaculty });
    } else {
      navigate('/admin/mail', { state: { recipients: selectedFaculty } });
    }
  };

  const confirmBulkDelete = async () => {
    await Promise.all(selectedIds.map(id =>
      apiFetch(`/api/admin/faculty/${id}`, {
        method: "DELETE"
      })
    ));
    setBulkDeleteConfirmOpen(false);
    setSelectedIds([]);
    fetchData();
  };

  const handleEditSubmit = async () => {
    if (!facultyForm.name || !facultyForm.email || !facultyForm.department) {
      alert("Required fields missing");
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/faculty/${facultyForm._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facultyForm)
      });

      if (res.ok) {
        setIsEditing(false);
        fetchData();
        const updated = await res.json();
        setViewFaculty(updated.data);
      } else {
        const data = await res.json();
        alert(data.message || "Failed to update faculty");
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  const openViewDialog = (f) => {
    setViewFaculty(f);
    setFacultyForm({
      _id: f._id,
      name: f.name,
      email: f.email,
      employeeId: f.employeeId || "",
      department: f.department || "",
      phone: f.phone || "",
      password: ""
    });
    setIsEditing(false);
    setViewOpen(true);
  };

  const openProjectDetails = (project) => {
    if (!project) return;
    setSelectedProject(project);
    setProjectDialogOpen(true);
  };

  const filteredFaculty = faculty.filter(f => {
    const q = debouncedSearchQuery.toLowerCase();
    const matchesSearch = f.name.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q) ||
      (f.employeeId || "").toLowerCase().includes(q) ||
      (f.phone || "").toLowerCase().includes(q) ||
      (f.department || "").toLowerCase().includes(q) ||
      (f.appliedProject?.title || "").toLowerCase().includes(q) ||
      (f.coGuidedProject?.title || "").toLowerCase().includes(q);
    const matchesStatus = (statusFilter === "All" || f.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  if (!authorized) return null;
  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <style>{`
        *:not(input, textarea, [contenteditable]) {
          caret-color: transparent;
        }
      `}</style>
      <PageHeader
        title="Faculty Management"
        action={
          <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
            <SearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Search Data"
              isFocused={searchFocused}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant={selectionMode ? "contained" : "outlined"} color={selectionMode ? "secondary" : "primary"}
              startIcon={selectionMode ? <CloseIcon /> : <CheckBoxIcon />}
              onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]); }}
            >
              {selectionMode ? "Cancel" : "Select"}
            </Button>
            <Button variant="contained" onClick={() => setOpenAdd(true)}>Add Faculty</Button>
          </Stack>
        }
      />

      {selectionMode && selectedIds.length > 0 && (
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, bgcolor: "#f5f5f5", p: 1, borderRadius: 1 }}>
          <Typography variant="body2" sx={{ ml: 1 }}>{selectedIds.length} selected</Typography>
          <Button variant="contained" size="small" color="info" startIcon={<MailIcon />} onClick={handleSendMail}>Send Mail</Button>
          <Button variant="contained" size="small" onClick={handleExportSelected}>Export</Button>
          <Button variant="contained" color="error" size="small" onClick={() => setBulkDeleteConfirmOpen(true)}>Delete</Button>
        </Box>
      )}

      {/* Faculty Management Table (hidden - replaced by task assignment flow below) */}
      {false && (
        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <DataTable
            fixedLayout={false}
            columns={[
              {
                id: "name", label: "Name", minWidth: 150, maxWidth: 250, render: (f) => (
                  <Typography
                    onClick={() => openViewDialog(f)}
                    noWrap
                    sx={{
                      cursor: "pointer",
                      color: "primary.main",
                      fontWeight: "bold",
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}
                  >
                    {f.name}
                  </Typography>
                )
              },
              { id: "employeeId", label: "Emp ID", minWidth: 120, render: (f) => f.employeeId || "-" },
              { id: "department", label: "Dept", minWidth: 150, render: (f) => f.department?.name || f.department || "-" },
              { id: "email", label: "Email", minWidth: 200 },
              { id: "phone", label: "Phone", minWidth: 120, render: (f) => f.phone || "-" },
            ]}
            rows={filteredFaculty}
            loading={false}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            emptyMessage="No faculty members found."
          />
        </Box>
      )}

      {/* ── Task Assignment Section ─────────────────────────────────────── */}
      <Box sx={{ mt: 2 }}>
        {/* Step 1-3: Cascading dropdowns */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Task Assignment</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Department Dropdown */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Department</InputLabel>
              <Select
                label="Department"
                value={selectedDepartmentObj?.name || ""}
                onChange={(e) => {
                  const dept = allDepartments.find(d => d.name === e.target.value);
                  setSelectedDepartmentObj(dept || null);
                  setSelectedFacultyObj(null);
                  setSelectedProjectObj(null);
                }}
              >
                <MenuItem value="" disabled>Select Department</MenuItem>
                {allDepartments.map(d => (
                  <MenuItem key={d._id} value={d.name}>{d.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Faculty Autocomplete filtered by dept */}
            {selectedDepartmentObj && (
              <Autocomplete
                sx={{ minWidth: 250 }}
                size="small"
                options={faculty.filter(f => {
                  const fDept = f.department?.name || f.department || "";
                  return fDept === selectedDepartmentObj.name;
                })}
                getOptionLabel={(f) => f.name}
                value={selectedFacultyObj}
                onChange={(e, val) => {
                  setSelectedFacultyObj(val);
                  setSelectedProjectObj(null);
                }}
                renderInput={(params) => <TextField {...params} label="Faculty / Guide Name" />}
              />
            )}

            {/* Project Autocomplete filtered by faculty */}
            {selectedFacultyObj && (
              <Autocomplete
                sx={{ minWidth: 280 }}
                size="small"
                options={[
                  ...(selectedFacultyObj.appliedProject ? [selectedFacultyObj.appliedProject] : []),
                  ...(selectedFacultyObj.coGuidedProject ? [selectedFacultyObj.coGuidedProject] : [])
                ].filter(Boolean)}
                getOptionLabel={(p) => p.title || ""}
                value={selectedProjectObj}
                onChange={(e, val) => {
                  setSelectedProjectObj(val);
                  fetchAssignedTasks(val?._id || null);
                }}
                renderInput={(params) => <TextField {...params} label="Project Title" />}
              />
            )}
          </Box>
        </Paper>

        {/* Task Form — revealed once project selected */}
        {selectedProjectObj && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>Assign Task</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Project: <strong>{selectedProjectObj.title}</strong> &nbsp;|&nbsp;
              Faculty: <strong>{selectedFacultyObj?.name}</strong>
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 600 }}>

              <TextField
                fullWidth
                size="small"
                type="date"
                label="Assigned Date"
                InputLabelProps={{ shrink: true }}
                value={assignForm.startDate}
                onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
              />

              <TextField
                fullWidth
                size="small"
                label="Tasks / Activities to be Completed"
                multiline
                rows={4}
                placeholder="Describe the tasks and activities expected to be completed..."
                value={assignForm.description}
                onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Completion Status</InputLabel>
                <Select
                  label="Completion Status"
                  value={assignForm.status}
                  onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value })}
                >
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Approved">Completed</MenuItem>
                  <MenuItem value="Rejected">Not Completed</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleAdminAssignTask}
                  disabled={!assignForm.startDate || !assignForm.description}
                >
                  Assign Task
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSelectedProjectObj(null);
                    setAssignForm({ title: "", description: "", startDate: "", status: "Pending" });
                  }}
                >
                  Clear
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Track Assigned Tasks */}
        {selectedProjectObj && (
          <Paper elevation={0} sx={{ p: 3, mt: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight="bold">Track Assigned Tasks</Typography>
                <Typography variant="body2" color="text.secondary">
                  All tasks assigned to <strong>{selectedProjectObj.title}</strong>
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => fetchAssignedTasks(selectedProjectObj._id)}
                disabled={assignedTasksLoading}
              >
                {assignedTasksLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </Box>

            {assignedTasksLoading ? (
              <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={28} /></Box>
            ) : assignedTasks.length === 0 ? (
              <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No tasks assigned to this project yet.</Typography>
              </Paper>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Title / Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Assigned Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Deadline</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Solutions Received</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="center">Delete</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignedTasks.map(t => (
                    <TableRow key={t._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">{t.title}</Typography>
                        {t.description && (
                          <Typography variant="caption" color="text.secondary" sx={{
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden'
                          }}>
                            {t.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={t.startDate || 'Not Set'} color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={t.deadline || 'Not Set'} color="warning" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            t.submissions?.length > 0
                              ? `${t.submissions.length} Student${t.submissions.length > 1 ? 's' : ''} Submitted`
                              : 'No Solutions Yet'
                          }
                          color={t.submissions?.length > 0 ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          title="Delete Task"
                          onClick={() => { setTaskToDelete(t); setTaskDeleteConfirmOpen(true); }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        )}

        {/* Placeholder when nothing selected yet */}
        {!selectedDepartmentObj && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Select a <strong>Department</strong> above to begin assigning a task.
            </Typography>
          </Paper>
        )}
        {selectedDepartmentObj && !selectedFacultyObj && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Now select a <strong>Faculty / Guide</strong> from the department.
            </Typography>
          </Paper>
        )}
        {selectedFacultyObj && !selectedProjectObj && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Now select a <strong>Project</strong> to assign the task to.
            </Typography>
          </Paper>
        )}
      </Box>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onCancel={() => { setDeleteConfirmOpen(false); setFacultyToDelete(null); }}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        content="Are you sure you want to delete this faculty member? This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Confirm Bulk Deletion"
        content={`Are you sure you want to delete ${selectedIds.length} faculty members? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />

      {/* Task Delete Confirmation */}
      <Dialog open={taskDeleteConfirmOpen} onClose={() => setTaskDeleteConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>Confirm Task Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the task <b>&#34;{taskToDelete?.title}&#34;</b>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will permanently remove the task and all student submissions from:
          </Typography>
          <Box component="ul" sx={{ mt: 0.5, pl: 3 }}>
            <Typography component="li" variant="body2">Faculty Login – Daily Status</Typography>
            <Typography component="li" variant="body2">Student Login – My Tasks</Typography>
          </Box>
          <Typography variant="body2" color="error.main" fontWeight="bold" sx={{ mt: 1 }}>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteAssignedTask}>Delete Task</Button>
        </DialogActions>
      </Dialog>

      {/* VIEW/EDIT FACULTY DETAILS */}
      <Dialog open={viewOpen} onClose={() => { setViewOpen(false); setIsEditing(false); }} fullWidth maxWidth="sm" disableRestoreFocus disableEnforceFocus>
        <DialogTitle>{isEditing ? "Edit Faculty Details" : "Faculty Details"}</DialogTitle>
        <DialogContent>
          {viewFaculty && (
            isEditing ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <TextField label="Full Name" name="name" value={facultyForm.name} onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })} fullWidth required margin="dense" />
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={facultyForm.email}
                  onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                  fullWidth
                  required
                  margin="dense"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <EmailSuffixToggle
                          value={facultyForm.email}
                          onChange={(val) => setFacultyForm(prev => ({ ...prev, email: val }))}
                        />
                      </InputAdornment>
                    )
                  }}
                />
                <TextField label="Employee ID" name="employeeId" value={facultyForm.employeeId} onChange={(e) => setFacultyForm({ ...facultyForm, employeeId: e.target.value })} fullWidth margin="dense" />
                <TextField label="Phone" name="phone" value={facultyForm.phone} onChange={(e) => setFacultyForm({ ...facultyForm, phone: e.target.value })} fullWidth margin="dense" />
                <FormControl fullWidth margin="dense">
                  <InputLabel>Department</InputLabel>
                  <Select
                    label="Department"
                    value={facultyForm.department}
                    onChange={(e) => setFacultyForm({ ...facultyForm, department: e.target.value })}
                  >
                    {allDepartments.map(d => (
                      <MenuItem key={d._id} value={d.name}>{d.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="Password" name="password" type="password" placeholder="Leave blank to keep current" value={facultyForm.password} onChange={(e) => setFacultyForm({ ...facultyForm, password: e.target.value })} fullWidth margin="dense" />
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <Typography variant="h5" color="primary">{viewFaculty.name}</Typography>

                <Box sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2
                }}>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Employee ID</Typography>
                    <Typography variant="body1">{viewFaculty.employeeId || "-"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Email</Typography>
                    <Typography variant="body1">{viewFaculty.email}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Phone</Typography>
                    <Typography variant="body1">{viewFaculty.phone || "-"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Department</Typography>
                    <Typography variant="body1">{viewFaculty.department}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                    <Chip
                      label={viewFaculty.status || "Pending"}
                      color={viewFaculty.status === "Approved" ? "success" : viewFaculty.status === "Rejected" ? "error" : "warning"}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Co-Guide Status</Typography>
                    <Chip
                      label={viewFaculty.coGuideStatus || "Pending"}
                      color={viewFaculty.coGuideStatus === "Approved" ? "success" : viewFaculty.coGuideStatus === "Rejected" ? "error" : "warning"}
                      size="small"
                    />
                  </Box>
                </Box>

                {viewFaculty.requestedProject && (
                  <Box sx={{ bgcolor: "#e3f2fd", p: 1, borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="primary">Requested Change</Typography>
                    <Typography variant="body1" noWrap>Wants to guide: <strong title={viewFaculty.requestedProject.title}>{viewFaculty.requestedProject.title}</strong></Typography>
                  </Box>
                )}

                {viewFaculty.requestedCoGuideProject && (
                  <Box sx={{ bgcolor: "#e3f2fd", p: 1, borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="primary">Requested Co-Guide Change</Typography>
                    <Typography variant="body1" noWrap>Wants to co-guide: <strong title={viewFaculty.requestedCoGuideProject.title}>{viewFaculty.requestedCoGuideProject.title}</strong></Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="subtitle2" color="textSecondary">Project Assignment</Typography>
                  <FormControl fullWidth size="small">
                    <Autocomplete
                      options={[...projects].sort((a, b) => a.title.localeCompare(b.title))}
                      getOptionLabel={(option) => option.title}
                      value={projects.find(p => p._id === (viewFaculty.appliedProject?._id || viewFaculty.appliedProject)) || null}
                      onChange={(event, newValue) => {
                        handleProjectAssign(viewFaculty._id, newValue ? newValue._id : "", "guide");
                      }}
                      getOptionDisabled={(option) => option._id === (viewFaculty.coGuidedProject?._id || viewFaculty.coGuidedProject)}
                      renderInput={(params) => <TextField {...params} label="Guide Project" size="small" />}
                    />
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <Autocomplete
                      options={[...projects].sort((a, b) => a.title.localeCompare(b.title))}
                      getOptionLabel={(option) => option.title}
                      value={projects.find(p => p._id === (viewFaculty.coGuidedProject?._id || viewFaculty.coGuidedProject)) || null}
                      onChange={(event, newValue) => {
                        handleProjectAssign(viewFaculty._id, newValue ? newValue._id : "", "co-guide");
                      }}
                      getOptionDisabled={(option) => option._id === (viewFaculty.appliedProject?._id || viewFaculty.appliedProject)}
                      renderInput={(params) => <TextField {...params} label="Co-Guide Project" size="small" />}
                    />
                  </FormControl>
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Current Assignments</Typography>
                  <Typography variant="body2" noWrap title={viewFaculty.appliedProject ? viewFaculty.appliedProject.title : "None"}>
                    Guide: {viewFaculty.appliedProject ? viewFaculty.appliedProject.title : "None"}
                  </Typography>
                  <Typography variant="body2" noWrap title={viewFaculty.coGuidedProject ? viewFaculty.coGuidedProject.title : "None"}>
                    Co-Guide: {viewFaculty.coGuidedProject ? viewFaculty.coGuidedProject.title : "None"}
                  </Typography>
                </Box>
              </Box>
            )
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", gap: 1, p: 2 }}>
          {isEditing ? (
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleEditSubmit}>Save Changes</Button>
            </Box>
          ) : (
            <>
              {viewFaculty && viewFaculty.requestedProject && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", bgcolor: "#e3f2fd", p: 1, borderRadius: 1 }}>
                  <Typography variant="subtitle2">Guide Request:</Typography>
                  <Box>
                    <Button variant="contained" color="success" size="small" onClick={() => { handleApprove(viewFaculty._id); setViewOpen(false); }} sx={{ mr: 1 }}>Approve</Button>
                    <Button variant="outlined" color="error" size="small" onClick={() => { handleReject(viewFaculty._id); setViewOpen(false); }}>Reject</Button>
                  </Box>
                </Box>
              )}
              {viewFaculty && viewFaculty.requestedCoGuideProject && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", bgcolor: "#f3e5f5", p: 1, borderRadius: 1 }}>
                  <Typography variant="subtitle2">Co-Guide Request:</Typography>
                  <Box>
                    <Button variant="contained" color="success" size="small" onClick={() => { handleApprove(viewFaculty._id, "co-guide"); setViewOpen(false); }} sx={{ mr: 1 }}>Approve</Button>
                    <Button variant="outlined" color="error" size="small" onClick={() => { handleReject(viewFaculty._id, "co-guide"); setViewOpen(false); }}>Reject</Button>
                  </Box>
                </Box>
              )}
              <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", mt: 1 }}>
                <Button color="error" onClick={() => { handleDelete(viewFaculty._id); setViewOpen(false); }}>Delete</Button>
                <Box>
                  <Button variant="contained" onClick={() => setIsEditing(true)} sx={{ mr: 1 }}>Edit</Button>
                  <Button onClick={() => setViewOpen(false)}>Close</Button>
                </Box>
              </Box>
            </>
          )}
        </DialogActions>
      </Dialog>
      {/* ADD FACULTY DIALOG */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth maxWidth="sm" disableRestoreFocus disableEnforceFocus>
        <DialogTitle>Add New Faculty</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField label="Full Name" name="name" value={newFaculty.name} onChange={handleAddChange} fullWidth required margin="dense" />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={newFaculty.email}
            onChange={handleAddChange}
            fullWidth
            required
            margin="dense"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <EmailSuffixToggle
                    value={newFaculty.email}
                    onChange={(val) => setNewFaculty(prev => ({ ...prev, email: val }))}
                  />
                </InputAdornment>
              )
            }}
          />
          <TextField label="Employee ID" name="employeeId" value={newFaculty.employeeId} onChange={handleAddChange} fullWidth margin="dense" />
          <TextField label="Phone" name="phone" value={newFaculty.phone} onChange={handleAddChange} fullWidth margin="dense" />
          <FormControl fullWidth margin="dense">
            <InputLabel>Department</InputLabel>
            <Select
              label="Department"
              name="department"
              value={newFaculty.department}
              onChange={handleAddChange}
              required
            >
              <MenuItem value="" disabled>Select Department</MenuItem>
              {allDepartments.map(d => (
                <MenuItem key={d._id} value={d.name}>{d.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Password" name="password" type="password" value={newFaculty.password} onChange={handleAddChange} fullWidth required margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSubmit}>Create Faculty</Button>
        </DialogActions>
      </Dialog>

      <ProjectDetailsDialog
        open={projectDialogOpen}
        onClose={() => { setProjectDialogOpen(false); setSelectedProject(null); }}
        project={selectedProject}
      />
    </Box>
  );
}
