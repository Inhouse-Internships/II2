import { apiFetch } from '../../core/services/apiFetch';
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Divider,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActionArea,
  Switch,
  Alert,
  Grid,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  School as SchoolIcon,
  Apartment as ApartmentIcon,
  CalendarToday as CalendarTodayIcon,
  VerifiedUser as VerifiedUserIcon,
  ArrowBack as ArrowBackIcon,
  Task as TaskIcon
} from "@mui/icons-material";

import { useNavigate } from "react-router-dom";
import useRequireRole from "../../core/hooks/useRequireRole";
import { ROLES } from "../../core/constants/roles";
import PageHeader from "../../components/common/PageHeader";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import ResolveDepartmentsDialog from "../../components/common/ResolveDepartmentsDialog";

export default function AdminSettings() {
  const navigate = useNavigate();
  const { authorized, authLoading } = useRequireRole(ROLES.ADMIN);

  // View State: 'home' | 'programs' | 'internship' | 'auto-approve' | 'departments-matrix'
  const [view, setView] = useState("home");

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);

  // Internship Settings
  const [internshipSettings, setInternshipSettings] = useState({
    startDate: "",
    endDate: "",
    globalTaskVisibility: false,
    globalHodTaskEditEnabled: false,
    studentRegistrationEnabled: true,
    facultyRegistrationEnabled: true,
    workingDays: "Mon-Sat",
    minRequiredAttendance: 75,
    campusLatitude: 17.088255,
    campusLongitude: 82.067528,
    campusRadius: 300,
    campusAccuracyThreshold: 500,
    attendanceWindowStart: '09:00',
    attendanceWindowEnd: '10:30',
    attendanceTimeCheckDisabled: false,
    studentFreeze: false
  });

  // Auto-Approve Settings
  const [autoApproveStudent, setAutoApproveStudent] = useState(false);
  const [autoApproveFaculty, setAutoApproveFaculty] = useState(false);



  // Matrix State (moved from AdminDepartments)
  const [matrixData, setMatrixData] = useState([]);
  const [unassignedDepartments, setUnassignedDepartments] = useState([]);
  const [unassignedDeptModalOpen, setUnassignedDeptModalOpen] = useState(false);

  // Dialog State
  const [open, setOpen] = useState(false);
  const [dialogType, setDialogType] = useState(""); // 'program' | 'department' | 'edit-dept' | 'edit-program'
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [inputDuration, setInputDuration] = useState(4);
  const [inputEligibleYears, setInputEligibleYears] = useState([]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteType, setDeleteType] = useState(""); // 'program' | 'department'
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    if (!authorized) return;
    fetchAllSettings();
  }, [authorized]);

  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        apiFetch("/api/admin/programs"),
        apiFetch("/api/admin/settings/internship"),
        apiFetch("/api/admin/settings/auto-approve"),
        apiFetch("/api/admin/settings/auto-approve-faculty"),
        apiFetch("/api/admin/all-db-departments")
      ]);

      const [progRes, intRes, autoSRes, autoFRes, allDeptsRes] = results;

      if (progRes && progRes.ok) setPrograms(await progRes.json());
      if (intRes && intRes.ok) {
        const d = await intRes.json();
        setInternshipSettings({
          startDate: d.startDate ? d.startDate.split('T')[0] : "",
          endDate: d.endDate ? d.endDate.split('T')[0] : "",
          globalTaskVisibility: d.globalTaskVisibility || false,
          globalHodTaskEditEnabled: d.globalHodTaskEditEnabled || false,
          studentRegistrationEnabled: d.studentRegistrationEnabled !== false,
          facultyRegistrationEnabled: d.facultyRegistrationEnabled !== false,
          workingDays: d.workingDays || "Mon-Sat",
          minRequiredAttendance: d.minRequiredAttendance || 75,
          campusLatitude: d.campusLatitude ?? 17.088255,
          campusLongitude: d.campusLongitude ?? 82.067528,
          campusRadius: d.campusRadius ?? 300,
          campusAccuracyThreshold: d.campusAccuracyThreshold ?? 500,
          attendanceWindowStart: d.attendanceWindowStart || '09:00',
          attendanceWindowEnd: d.attendanceWindowEnd || '10:30',
          attendanceTimeCheckDisabled: d.attendanceTimeCheckDisabled || false,
          studentFreeze: d.studentFreeze || false
        });
      }
      if (autoSRes && autoSRes.ok) {
        const d = await autoSRes.json();
        setAutoApproveStudent(d.autoApprove || false);
      }
      if (autoFRes && autoFRes.ok) {
        const d = await autoFRes.json();
        setAutoApproveFaculty(d.autoApproveFaculty || false);
      }
      if (allDeptsRes && allDeptsRes.ok) {
        const allDepts = await allDeptsRes.json();
        setUnassignedDepartments(allDepts.filter(d => !d.program));
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/departments");
      if (res.ok) {
        const data = await res.json();
        setMatrixData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch matrix", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await apiFetch("/api/admin/programs");
      const data = await res.json();
      if (Array.isArray(data)) setPrograms(data);

      const allDeptsRes = await apiFetch("/api/admin/all-db-departments");
      if (allDeptsRes.ok) {
        const allDepts = await allDeptsRes.json();
        setUnassignedDepartments(allDepts.filter(d => !d.program));
      }
    } catch (err) { }
  };

  // --- HANDLERS ---
  const handleSaveInternship = async () => {
    try {
      const res = await apiFetch("/api/admin/settings/internship", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(internshipSettings)
      });
      if (res.ok) alert("Internship settings updated");
    } catch (err) { alert("Error saving internship settings"); }
  };


  const handleToggleAutoApproveS = async () => {
    const newVal = !autoApproveStudent;
    setAutoApproveStudent(newVal);
    try {
      await apiFetch("/api/admin/settings/auto-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApprove: newVal })
      });
    } catch (err) { }
  };

  const handleToggleAutoApproveF = async () => {
    const newVal = !autoApproveFaculty;
    setAutoApproveFaculty(newVal);
    try {
      await apiFetch("/api/admin/settings/auto-approve-faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApproveFaculty: newVal })
      });
    } catch (err) { }
  };

  const handleToggleStudentRegistration = async () => {
    const newVal = !internshipSettings.studentRegistrationEnabled;
    const updated = { ...internshipSettings, studentRegistrationEnabled: newVal };
    setInternshipSettings(updated);
    try {
      await apiFetch("/api/admin/settings/internship", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
    } catch (err) { }
  };

  const handleToggleFacultyRegistration = async () => {
    const newVal = !internshipSettings.facultyRegistrationEnabled;
    const updated = { ...internshipSettings, facultyRegistrationEnabled: newVal };
    setInternshipSettings(updated);
    try {
      await apiFetch("/api/admin/settings/internship", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
    } catch (err) { }
  };

  const handleToggleStudentFreeze = async () => {
    const newVal = !internshipSettings.studentFreeze;
    const updated = { ...internshipSettings, studentFreeze: newVal };
    setInternshipSettings(updated);
    try {
      await apiFetch("/api/admin/settings/internship", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
    } catch (err) { }
  };



  const handleAddProgram = () => {
    setDialogType("program");
    setInputValue("");
    setInputDuration(4);
    setInputEligibleYears([]);
    setOpen(true);
  };

  const handleEditProgram = (program) => {
    setDialogType("edit-program");
    setSelectedProgram(program);
    setInputValue(program.name);
    setInputDuration(program.duration || 4);
    setInputEligibleYears(program.eligibleYears || []);
    setOpen(true);
  };

  const handleAddDepartment = (program) => {
    setDialogType("department");
    setSelectedProgram(program);
    setInputValue("");
    setOpen(true);
  };

  const handleEditDepartment = (dept) => {
    setDialogType("edit-dept");
    setSelectedDept(dept);
    setInputValue(dept.name);
    setOpen(true);
  };

  const handleDeleteProgram = (program) => {
    setDeleteType("program");
    setItemToDelete(program);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteDepartment = (program, dept) => {
    setDeleteType("department");
    setSelectedProgram(program);
    setItemToDelete(dept);
    setDeleteConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!inputValue.trim()) return;
    let url = ""; let method = "POST"; let body = {};

    if (dialogType === "program") {
      url = "/api/admin/programs";
      body = { name: inputValue, duration: inputDuration, eligibleYears: inputEligibleYears };
    } else if (dialogType === "edit-program") {
      url = `/api/admin/programs/${selectedProgram._id}`;
      method = "PUT";
      body = { name: inputValue, duration: inputDuration, eligibleYears: inputEligibleYears };
    } else if (dialogType === "department") {
      url = `/api/admin/programs/${selectedProgram._id}/departments`;
      body = { name: inputValue };
    } else if (dialogType === "edit-dept") {
      url = `/api/admin/departments/${selectedDept._id}`;
      method = "PUT";
      body = { name: inputValue };
    }

    try {
      const res = await apiFetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      if (res.ok) { fetchPrograms(); setOpen(false); }
      else alert("Operation failed");
    } catch (err) { alert("Server error"); }
  };

  const confirmDelete = async () => {
    let url = deleteType === "program" ? `/api/admin/programs/${itemToDelete._id}` : `/api/admin/programs/${selectedProgram._id}/departments/${itemToDelete._id}`;
    try {
      const res = await apiFetch(url, { method: "DELETE" });
      if (res.ok) { fetchPrograms(); setDeleteConfirmOpen(false); }
      else alert("Delete failed");
    } catch (err) { alert("Server error"); }
  };

  if (authLoading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}><CircularProgress /></Box>;
  if (!authorized) return null;

  return (
    <Box>
      <PageHeader title="Admin Settings" subtitle="Configure system behavior, master data, and internship rules" />

      {view === "home" && (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              height: '100%',
              borderRadius: 4,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
              '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)', borderColor: 'primary.main' }
            }}>
              <CardActionArea onClick={() => setView("programs")} sx={{ height: '100%', p: 1 }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: 4,
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    mb: 3
                  }}>
                    <ApartmentIcon sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>Programs & Departments</Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ px: 2 }}>Configure University Programs and official Departments</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              height: '100%',
              borderRadius: 4,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
              '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)', borderColor: 'secondary.main' }
            }}>
              <CardActionArea onClick={() => { setView("departments-matrix"); fetchMatrix(); }} sx={{ height: '100%', p: 1 }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: 4,
                    bgcolor: 'secondary.50',
                    color: 'secondary.main',
                    mb: 3
                  }}>
                    <TaskIcon sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>Department Matrix</Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ px: 2 }}>Monitor registration status against department capacity</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              height: '100%',
              borderRadius: 4,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
              '&:hover': { transform: 'translateY(-8px)', boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)', borderColor: 'success.main' }
            }}>
              <CardActionArea onClick={() => setView("internship")} sx={{ height: '100%', p: 1 }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: 4,
                    bgcolor: 'success.50',
                    color: 'success.main',
                    mb: 3
                  }}>
                    <CalendarTodayIcon sx={{ fontSize: 40 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>Internship Lifecycle</Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ px: 2 }}>Manage timelines and critical task access controls</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              height: '100%',
              borderRadius: 4,
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s ease',
              '&:hover': { boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)', borderColor: 'warning.main' }
            }}>
              <CardContent sx={{ p: 3, pt: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'center' }}>
                  <Box sx={{
                    display: 'inline-flex',
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: 'warning.50',
                    color: 'warning.main',
                    mr: 2
                  }}>
                    <VerifiedUserIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800}>Auto Approval</Typography>
                </Box>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '1px solid #f1f5f9' }}>
                    <Typography variant="body2" fontWeight={600}>Students</Typography>
                    <Switch checked={autoApproveStudent} onChange={handleToggleAutoApproveS} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '1px solid #f1f5f9' }}>
                    <Typography variant="body2" fontWeight={600}>Faculty</Typography>
                    <Switch checked={autoApproveFaculty} onChange={handleToggleAutoApproveF} size="small" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>



        </Grid>
      )}



      {view === "programs" && (
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 4 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton onClick={() => setView("home")} sx={{ mr: 1, bgcolor: 'action.hover' }}>
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography variant="h5" fontWeight="bold">University Programs</Typography>
                <Typography variant="body2" color="textSecondary">Manage curriculums and their specific departments</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={2}>
              {unassignedDepartments.length > 0 && (
                <Button
                  variant="soft"
                  color="warning"
                  startIcon={<VerifiedUserIcon />}
                  onClick={() => setUnassignedDeptModalOpen(true)}
                  sx={{ borderRadius: 2, px: 3 }}
                >
                  Resolve {unassignedDepartments.length} New Depts
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddProgram}
                sx={{ borderRadius: 2, px: 3 }}
              >
                New Program
              </Button>
            </Stack>
          </Stack>

          {unassignedDepartments.length > 0 && (
            <Alert severity="warning" sx={{ mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'warning.100' }}>
              Found <strong>{unassignedDepartments.length} departments</strong> that are not assigned to any program.
              <Button size="small" variant="text" color="warning" sx={{ ml: 2, fontWeight: 'bold' }} onClick={() => setUnassignedDeptModalOpen(true)}>Resolve Now</Button>
            </Alert>
          )}

          <Box sx={{ maxWidth: 900, mx: "auto" }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                <CircularProgress />
              </Box>
            ) : programs.length === 0 ? (
              <Paper sx={{ p: 10, textAlign: 'center', borderRadius: 4, border: '1px dashed grey' }}>
                <SchoolIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">No programs defined yet.</Typography>
                <Button onClick={handleAddProgram} sx={{ mt: 2 }}>Click here to add the first one</Button>
              </Paper>
            ) : (
              programs.map((program) => (
                <Accordion
                  key={program._id}
                  sx={{
                    mb: 2,
                    borderRadius: "12px !important",
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    '&:before': { display: 'none' },
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: '100%', pr: 2 }}>
                      <SchoolIcon color="primary" />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">{program.name}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          <Chip label={`${program.duration || 4} Years`} size="small" variant="tonal" color="primary" sx={{ height: 20, fontSize: 11 }} />
                          {program.eligibleYears && program.eligibleYears.length > 0 && (
                            <Typography variant="caption" color="textSecondary" sx={{ ml: 1, alignSelf: 'center' }}>
                              Eligible Years: {program.eligibleYears.join(", ")}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="overline" color="textSecondary" fontWeight="bold">Departments</Typography>
                      <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {program.departments.length > 0 ? (
                          program.departments.map((dept) => (
                            <Chip
                              key={dept._id}
                              label={dept.name}
                              onDelete={() => handleDeleteDepartment(program, dept)}
                              onClick={() => handleEditDepartment(dept)}
                              variant="outlined"
                              sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'primary.50' } }}
                            />
                          ))
                        ) : (
                          <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>Please add departments to this program</Typography>
                        )}
                      </Box>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <Stack direction="row" spacing={1} justifyContent="space-between">
                      <Button
                        size="small"
                        variant="soft"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddDepartment(program)}
                      >
                        Add Dept
                      </Button>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" color="primary" startIcon={<EditIcon />} onClick={() => handleEditProgram(program)}>Edit</Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteProgram(program)}>Delete</Button>
                      </Stack>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Box>
        </Box>
      )}

      {view === "internship" && (
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
            <IconButton onClick={() => setView("home")} sx={{ bgcolor: 'action.hover' }}><ArrowBackIcon /></IconButton>
            <Box>
              <Typography variant="h5" fontWeight="bold">Internship Rules & Lifecycle</Typography>
              <Typography variant="body2" color="textSecondary">Configure dates and behavior for the current internship batch</Typography>
            </Box>
          </Stack>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Card sx={{
              maxWidth: 700,
              width: '100%',
              p: { xs: 2, md: 4 },
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}>
              <CardContent>
                <Stack spacing={4}>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                        value={internshipSettings.startDate}
                        onChange={e => setInternshipSettings({ ...internshipSettings, startDate: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="End Date" type="date" fullWidth InputLabelProps={{ shrink: true }}
                        value={internshipSettings.endDate}
                        onChange={e => setInternshipSettings({ ...internshipSettings, endDate: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                      />
                    </Grid>
                  </Grid>
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 1, mb: 1, display: 'block', fontStyle: 'italic', textAlign: 'center' }}>
                    * The system automatically activates the internship lifecycle based on the start and end dates provided above.
                  </Typography>

                  <Divider />

                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 3 }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">Global Status Visibility</Typography>
                        <Typography variant="caption" color="textSecondary">Show or hide all Daily status across all projects</Typography>
                      </Box>
                      <Switch checked={internshipSettings.globalTaskVisibility} onChange={e => setInternshipSettings({ ...internshipSettings, globalTaskVisibility: e.target.checked })} />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 3 }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">Master HOD Status Edit</Typography>
                        <Typography variant="caption" color="textSecondary">Allow HODs to edit Daily status defined by faculty</Typography>
                      </Box>
                      <Switch checked={internshipSettings.globalHodTaskEditEnabled} onChange={e => setInternshipSettings({ ...internshipSettings, globalHodTaskEditEnabled: e.target.checked })} />
                    </Box>

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 3 }}>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Student Registration</Typography>
                            <Typography variant="caption" color="textSecondary">Allow students to register</Typography>
                          </Box>
                          <Switch
                            checked={internshipSettings.studentRegistrationEnabled}
                            onChange={handleToggleStudentRegistration}
                            color="primary"
                          />
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 3 }}>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">Faculty Registration</Typography>
                            <Typography variant="caption" color="textSecondary">Allow faculty to register</Typography>
                          </Box>
                          <Switch
                            checked={internshipSettings.facultyRegistrationEnabled}
                            onChange={handleToggleFacultyRegistration}
                            color="secondary"
                          />
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: internshipSettings.studentFreeze ? '#fef2f2' : '#f8fafc', borderRadius: 3, border: internshipSettings.studentFreeze ? '1px solid #f87171' : '1px solid #f1f5f9' }}>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold" color={internshipSettings.studentFreeze ? 'error.dark' : 'text.primary'}>
                              ❄️ Student Freeze
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              When enabled, students cannot apply, withdraw, or modify options. View only mode.
                            </Typography>
                          </Box>
                          <Switch
                            checked={internshipSettings.studentFreeze}
                            onChange={handleToggleStudentFreeze}
                            color="error"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Stack>

                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Working Days" fullWidth
                        placeholder="e.g. Mon-Sat"
                        value={internshipSettings.workingDays}
                        onChange={e => setInternshipSettings({ ...internshipSettings, workingDays: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Min Attendance (%)" type="number" fullWidth
                        value={internshipSettings.minRequiredAttendance}
                        onChange={e => setInternshipSettings({ ...internshipSettings, minRequiredAttendance: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        inputProps={{ min: 0, max: 100 }}
                      />
                    </Grid>
                  </Grid>

                  <Divider />

                  {/* Attendance Timing Window */}
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      ⏰ Self-Attendance Time Window
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Students can only mark their own attendance within this time range (IST). Outside these hours, the system will reject the request.
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Window Start Time" type="time" fullWidth
                          value={internshipSettings.attendanceWindowStart}
                          onChange={e => setInternshipSettings({ ...internshipSettings, attendanceWindowStart: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          InputLabelProps={{ shrink: true }}
                          helperText="Students can start marking from this time (default: 09:00 AM)"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Window End Time" type="time" fullWidth
                          value={internshipSettings.attendanceWindowEnd}
                          onChange={e => setInternshipSettings({ ...internshipSettings, attendanceWindowEnd: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          InputLabelProps={{ shrink: true }}
                          helperText="Students cannot mark after this time (default: 10:30 AM)"
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: internshipSettings.attendanceTimeCheckDisabled ? '#fff3e0' : '#f8fafc', borderRadius: 3, border: internshipSettings.attendanceTimeCheckDisabled ? '1px solid #f59e0b' : '1px solid #f1f5f9' }}>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={800} color={internshipSettings.attendanceTimeCheckDisabled ? 'warning.dark' : 'text.primary'}>
                              🧪 Disable Time Check (Testing Mode)
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              When ON, students can mark attendance at ANY time. Turn OFF in production.
                            </Typography>
                          </Box>
                          <Switch
                            checked={internshipSettings.attendanceTimeCheckDisabled}
                            onChange={e => setInternshipSettings({ ...internshipSettings, attendanceTimeCheckDisabled: e.target.checked })}
                            color="warning"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />

                  {/* Campus Geo-Fence Settings */}
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      📍 Campus Geo-Fence (Self-Attendance)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      Students can only mark attendance when physically within the campus radius. Adjust these coordinates and radius to match your campus boundary.
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Campus Latitude" type="number" fullWidth
                          value={internshipSettings.campusLatitude}
                          onChange={e => setInternshipSettings({ ...internshipSettings, campusLatitude: parseFloat(e.target.value) })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          inputProps={{ step: 0.000001 }}
                          helperText="e.g. 17.088255"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Campus Longitude" type="number" fullWidth
                          value={internshipSettings.campusLongitude}
                          onChange={e => setInternshipSettings({ ...internshipSettings, campusLongitude: parseFloat(e.target.value) })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          inputProps={{ step: 0.000001 }}
                          helperText="e.g. 82.067528"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Allowed Radius (meters)" type="number" fullWidth
                          value={internshipSettings.campusRadius}
                          onChange={e => setInternshipSettings({ ...internshipSettings, campusRadius: parseInt(e.target.value) })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          inputProps={{ min: 50, max: 5000 }}
                          helperText="Students within this radius are marked Present (default: 300m)"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          label="Max GPS Accuracy (meters)" type="number" fullWidth
                          value={internshipSettings.campusAccuracyThreshold}
                          onChange={e => setInternshipSettings({ ...internshipSettings, campusAccuracyThreshold: parseInt(e.target.value) })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                          inputProps={{ min: 10, max: 5000 }}
                          helperText="Max allowed device accuracy error (default: 500m — covers Wi-Fi/desktop)"
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
                    <Button variant="contained" onClick={handleSaveInternship} fullWidth sx={{ borderRadius: 3, py: 1.5, fontWeight: 'bold' }}>Save Internship Rules</Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Alert severity="info" sx={{ maxWidth: 700, width: '100%', borderRadius: 3 }}>
              <strong>Lifecycle Insight:</strong> When an internship starts, promotion logic is activated. Promote students to <strong>Level 2</strong> via the Students management page.
            </Alert>
          </Box>
        </Box>
      )}

      {view === "departments-matrix" && (
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
            <IconButton onClick={() => setView("home")} sx={{ bgcolor: 'action.hover' }}><ArrowBackIcon /></IconButton>
            <Box>
              <Typography variant="h5" fontWeight="bold">Department Seat Matrix</Typography>
              <Typography variant="body2" color="textSecondary">Real-time distribution of students across projects and departments</Typography>
            </Box>
          </Stack>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              border: '1px solid #e2e8f0',
              overflow: "hidden",
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              width: 'fit-content',
              mx: 'auto',
              maxWidth: '100%'
            }}
          >
            <Box sx={{ overflowX: "auto" }}>
              <Table sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 800, color: '#475569', py: 2.5 }}>Project Title</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#475569' }}>Total Utilization</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Departmental Breakdown</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matrixData.map((row, i) => (
                    <TableRow key={i} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 700, color: '#1e293b', maxWidth: 300 }}>
                        {row.projectTitle}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${row.projectTotalRegistered} / ${row.projectTotalSeats}`}
                          color={row.projectTotalRegistered >= row.projectTotalSeats ? "error" : "primary"}
                          variant="tonal"
                          sx={{ fontWeight: 800, px: 1 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {row.departments.map((d, di) => (
                            <Tooltip key={di} title={`${d.name} Enrollment`}>
                              <Chip
                                label={`${d.name}: ${d.registered}/${d.total}`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  bgcolor: d.registered >= d.total ? 'error.50' : 'background.paper',
                                  borderColor: d.registered >= d.total ? 'error.200' : 'divider',
                                  fontWeight: 600
                                }}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {matrixData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 10 }}>
                        <Typography color="textSecondary">No matrix data available.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" disableRestoreFocus disableEnforceFocus>
        <DialogTitle>
          {dialogType === "program" ? "Add Program" :
            dialogType === "edit-program" ? "Edit Program" :
              dialogType === "department" ? `Add Department to ${selectedProgram?.name}` :
                "Edit Department"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={dialogType.includes("program") ? "Program Name" : "Department Name"}
            fullWidth
            variant="outlined"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          {dialogType.includes("program") && (<>
            <TextField
              margin="dense"
              label="Duration (Years)"
              type="number"
              fullWidth
              variant="outlined"
              value={inputDuration}
              onChange={(e) => setInputDuration(Math.max(1, Number(e.target.value)))}
              InputProps={{ inputProps: { min: 1 } }}
            />
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Eligible Registration Years</Typography>
            <FormGroup row>
              {Array.from({ length: inputDuration > 0 ? inputDuration : 0 }, (_, i) => i + 1).map(year => (
                <FormControlLabel
                  key={year}
                  control={
                    <Checkbox
                      checked={inputEligibleYears.includes(String(year))}
                      onChange={() => {
                        const yearStr = String(year);
                        setInputEligibleYears(prev =>
                          prev.includes(yearStr)
                            ? prev.filter(y => y !== yearStr)
                            : [...prev, yearStr]
                        );
                      }}
                    />
                  }
                  label={`${year}`}
                />
              ))}
            </FormGroup>
          </>)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <ResolveDepartmentsDialog
        open={unassignedDeptModalOpen}
        onClose={() => setUnassignedDeptModalOpen(false)}
        unassignedDepartments={unassignedDepartments}
        programs={programs}
        onSuccess={() => fetchPrograms()}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        content={`Are you sure you want to delete this ${deleteType}? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />
    </Box >
  );
}
