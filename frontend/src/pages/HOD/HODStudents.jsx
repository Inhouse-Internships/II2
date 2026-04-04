import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Chip,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Switch,
  FormControlLabel,
  InputAdornment,
  Checkbox,
  CircularProgress,
  Badge,
  Autocomplete,
  Tooltip
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Edit as EditIcon,
  NotificationImportant as NotificationImportantIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  CheckBox as CheckBoxIcon,
  Warning as WarningIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  RateReview as RateReviewIcon
} from "@mui/icons-material";

import { apiFetch, batchFetch } from '../../core/services/apiFetch';
import DataTable from "../../components/common/DataTable";
import ProjectDetailsDialog from "../../components/common/ProjectDetailsDialog";
import useRequireRole from "../../core/hooks/useRequireRole";
import { ROLES } from "../../core/constants/roles";
import SearchBar from "../../components/common/SearchBar";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StatusChip from "../../components/common/StatusChip";
import PageHeader from "../../components/common/PageHeader";

export default function HODStudents(props) {
  const location = useLocation();
  const navigate = useNavigate();
  const context = props.context || {};
  const [students, setStudents] = useState([]);
  const [programsList, setProgramsList] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, authorized, authLoading } = useRequireRole(ROLES.HOD);
  const [backgroundLoading, setBackgroundLoading] = useState(false);

  // Load saved filters
  const savedFilters = (() => {
    try {
      return JSON.parse(localStorage.getItem("hodStudentFilters"));
    } catch (e) {
      return null;
    }
  })();

  const [searchQuery, setSearchQuery] = useState(savedFilters?.searchQuery || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Initialize filters from URL or LocalStorage or Default
  const [appliedFilters, setAppliedFilters] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      programFilter: savedFilters?.appliedFilters?.programFilter || "All",
      projectFilter: params.get("projectId") || savedFilters?.appliedFilters?.projectFilter || "All",
      statusFilter: savedFilters?.appliedFilters?.statusFilter || "All",
      yearFilter: savedFilters?.appliedFilters?.yearFilter || "All",
      levelFilter: savedFilters?.appliedFilters?.levelFilter || "All",
      missingDetails: savedFilters?.appliedFilters?.missingDetails || false
    };
  });

  // Draft filter state for dialog
  const [programFilter, setProgramFilter] = useState(appliedFilters.programFilter);
  const [projectFilter, setProjectFilter] = useState(appliedFilters.projectFilter);
  const [statusFilter, setStatusFilter] = useState(appliedFilters.statusFilter);
  const [yearFilter, setYearFilter] = useState(appliedFilters.yearFilter);
  const [levelFilter, setLevelFilter] = useState(appliedFilters.levelFilter);
  const [missingDetails, setMissingDetails] = useState(appliedFilters.missingDetails);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [yearOptions, setYearOptions] = useState([1, 2, 3, 4]);

  const projectOptions = useMemo(() => [
    { _id: "All", title: "All Projects" },
    { _id: "unassigned", title: "Not Selected" },
    ...[...(projects || [])].sort((a, b) => (a?.title || "").localeCompare(b?.title || ""))
  ], [projects]);

  const sortedProjects = useMemo(() => [... (projects || [])].sort((a, b) => (a?.title || "").localeCompare(b?.title || "")), [projects]);



  const [openAdd, setOpenAdd] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    year: "",
    studentId: "",
    department: "",
    appliedProject: "",
    program: "",
    guide: "",
    status: "Pending"
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [studentForm, setStudentForm] = useState({
    _id: "",
    name: "",
    email: "",
    phone: "",
    year: "",
    studentId: "",
    department: "",
    appliedProject: "",
    program: "",
    guide: "",
    status: ""
  });

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const [viewProject, setViewProject] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [addDialogDepartments, setAddDialogDepartments] = useState([]);
  const [addDialogProjects, setAddDialogProjects] = useState([]);
  const [editDialogDepartments, setEditDialogDepartments] = useState([]);
  const [autoApprove, setAutoApprove] = useState(false);

  /* ================= OPTIMIZED DATA LOADING ================= */

  const initialLoad = async () => {
    if (!authorized) return;
    setLoading(true);

    try {
      // Construct student query params for the first page
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (appliedFilters.programFilter !== "All") params.append("program", appliedFilters.programFilter);
      if (appliedFilters.projectFilter !== "All") params.append("projectId", appliedFilters.projectFilter);
      if (!user?.department) {
        console.warn("HOD user has no department assigned");
        setLoading(false);
        return;
      }
      params.append("department", user.department);
      if (appliedFilters.statusFilter !== "All") params.append("status", appliedFilters.statusFilter);
      if (appliedFilters.yearFilter !== "All") params.append("year", appliedFilters.yearFilter);
      if (appliedFilters.levelFilter !== "All") params.append("level", appliedFilters.levelFilter);
      if (appliedFilters.missingDetails) params.append("missingDetails", "true");
      params.set("limit", "25");

      // Batch fetch initial data: Projects, Programs, and first 25 Students
      const results = await batchFetch([
        { id: 'projects', url: '/api/projects' },
        { id: 'programs', url: '/api/admin/programs' },
        { id: 'students', url: `/api/admin/students?${params.toString()}` },
        { id: 'settings', url: '/api/admin/settings/auto-approve' }
      ]);

      // Process results
      if (results?.projects?.data) {
        const pData = results.projects.data;
        const extracted = pData?.data || pData || [];
        setProjects(Array.isArray(extracted) ? extracted : []);
      }

      if (results?.settings?.data) {
        setAutoApprove(results.settings.data.autoApprove || false);
      }

      const programsData = results?.programs?.data || results?.programs;
      const programsListArr = Array.isArray(programsData) ? programsData : (programsData?.data || []);

      if (Array.isArray(programsListArr) && programsListArr.length > 0) {
        setProgramsList(programsListArr);
        const depts = new Map();
        programsListArr.forEach(program => {
          program.departments?.forEach(dept => {
            if (dept?.name && !depts.has(dept.name)) depts.set(dept.name, dept);
          });
        });
        setAllDepartments(Array.from(depts.values()).sort((a, b) => (a?.name || "").localeCompare(b?.name || "")));
      }

      if (results?.students) {
        const bodyContent = results.students.data;
        const studentData = bodyContent?.data || bodyContent || [];
        setStudents(Array.isArray(studentData) ? studentData : []);

        if (bodyContent?.pagination) {
          setTotalCount(bodyContent.pagination.total || studentData.length);
        } else {
          setTotalCount(studentData.length);
        }
      }

      setLoading(false);


    } catch (err) {
      console.error("Initial load failed:", err);
      setLoading(false);
    } finally {
      setBackgroundLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await apiFetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const extracted = data?.data?.data || data?.data || data || [];
        setProjects(Array.isArray(extracted) ? extracted : []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  useEffect(() => {
    if (programFilter && programFilter !== "All") {
      const selectedProg = programsList.find(p => p.name === programFilter);
      setFilteredDepartments(selectedProg?.departments || []);
      setYearOptions(selectedProg?.eligibleYears?.sort((a, b) => Number(a) - Number(b)) || []);
    } else {
      setFilteredDepartments(allDepartments);
      setYearOptions([]);
    }
  }, [programFilter, programsList, allDepartments]);

  useEffect(() => {
    if (newStudent.program) {
      const selectedProg = programsList.find(p => p.name === newStudent.program);
      setAddDialogDepartments(selectedProg?.departments || []);
    } else {
      setAddDialogDepartments([]);
    }
  }, [newStudent.program, programsList]);

  useEffect(() => {
    if (newStudent.department) {
      const deptSpecificProjects = (projects || []).filter(p =>
        p.status === "Open" &&
        (p.departments || []).some(d => d.name === newStudent.department && d.seats > 0)
      );
      setAddDialogProjects(deptSpecificProjects);
    } else {
      setAddDialogProjects([]);
    }
  }, [newStudent.department, projects]);

  useEffect(() => {
    if (studentForm.program) {
      const selectedProg = programsList.find(p => p.name === studentForm.program);
      setEditDialogDepartments(selectedProg?.departments || []);
    } else {
      setEditDialogDepartments([]);
    }
  }, [studentForm.program, programsList]);

  const loadStudents = async () => {
    if (!authorized || loading) return;

    const params = new URLSearchParams();
    if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
    if (appliedFilters.programFilter !== "All") params.append("program", appliedFilters.programFilter);
    if (appliedFilters.projectFilter !== "All") params.append("projectId", appliedFilters.projectFilter);
    if (!user?.department) return;
    params.append("department", user.department);
    if (appliedFilters.statusFilter !== "All") params.append("status", appliedFilters.statusFilter);
    if (appliedFilters.yearFilter !== "All") params.append("year", appliedFilters.yearFilter);
    if (appliedFilters.levelFilter !== "All") params.append("level", appliedFilters.levelFilter);
    if (appliedFilters.missingDetails) params.append("missingDetails", "true");

    try {
      setBackgroundLoading(true);
      const res = await apiFetch(`/api/admin/students?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const sData = json.data || json;
        const data = sData?.data || sData;
        if (Array.isArray(data)) setStudents(data);
      }
    } catch (err) {
      console.error("Student sync failed:", err);
    } finally {
      setBackgroundLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    if (students.length === 0) {
      initialLoad();
    } else {
      loadStudents();
    }
  }, [authorized, debouncedSearchQuery, appliedFilters]);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("hodStudentFilters", JSON.stringify({ searchQuery, appliedFilters }));
  }, [searchQuery, appliedFilters]);

  // Optimization: Debounce search query to prevent excessive re-renders during typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);



  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pid = params.get("projectId");

    if (pid) {
      setAppliedFilters(prev => ({ ...prev, projectFilter: pid || "All" }));
    }
  }, [location.search]); // Keep this to react to navigation from other pages

  /* ================= ACTIONS ================= */

  const approve = async id => {
    const student = students.find(s => s._id === id);
    if (!student || !student.appliedProject) {
      alert("Cannot approve student. No project assigned.");
      return;
    }

    if (student && student.appliedProject) {
      const project = projects.find(p => p._id === student.appliedProject._id);
      if (project && project.status === "Closed") {
        alert(`Cannot approve student. The project '${project.title}' is Closed.`);
        return;
      }
    }
    const payload = {};
    if (appliedFilters.projectFilter !== "All" && appliedFilters.projectFilter !== "unassigned") {
      payload.projectId = appliedFilters.projectFilter;
    }

    const res = await apiFetch(
      `/api/admin/students/${id}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    if (res.ok) {
      loadStudents();
      fetchProjects();
    }
  };

  const reject = async id => {
    await apiFetch(
      `/api/admin/students/${id}/reject`,
      {
        method: "POST"
      }
    );
    loadStudents();
    fetchProjects();
  };

  const handleAddChange = (e) => {
    const { name, value } = e.target;
    setNewStudent(prev => {
      let updated = { ...prev, [name]: value };
      const projectId = name === "appliedProject" ? value : prev.appliedProject;
      const deptName = name === "department" ? value : prev.department;

      if (name === "appliedProject" || name === "department") {
        if (!validateSeats(projectId, deptName)) {
          updated = { ...prev, [name]: "" };
        }
      }

      // Auto-calculate status
      const isEligible = updated.name && updated.email && updated.phone && updated.studentId && updated.department && updated.year && updated.appliedProject;
      updated.status = isEligible ? "Approved" : "Pending";

      return updated;
    });
  };

  const handleAddSubmit = async () => {
    try {
      if (!newStudent.phone || !/^\d{10}$/.test(newStudent.phone)) {
        alert("Phone number must be 10 digits.");
        return;
      }

      const payload = { ...newStudent };
      const res = await apiFetch("/api/admin/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setOpenAdd(false);
        setNewStudent({ name: "", email: "", phone: "", password: "", year: "", studentId: "", department: "", appliedProject: "", guide: "", status: "Pending" });
        loadStudents();
        fetchProjects();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to create student");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating student");
    }
  };

  const openDetailsDialog = (student) => {
    setSelectedStudent(student);
    setStudentForm({
      _id: student._id,
      name: student.name,
      email: student.email,
      phone: student.phone || "",
      year: student.year || "",
      studentId: student.studentId,
      department: student.department,
      program: student.program || "",
      appliedProject: student.appliedProject ? student.appliedProject._id : "",
      guide: student.guide || "",
      status: student.status
    });
    setIsEditing(false);
    setDetailsOpen(true);
  };

  const openProjectDetailsDialog = (project) => {
    if (!project) return;
    // Find full project data from our pre-fetched local projects list to get seats/counts
    const fullProject = projects.find(p => p._id === (project._id || project));
    setViewProject(fullProject || project);
    setViewOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setStudentForm(prev => {
      let updated = { ...prev, [name]: value };
      const projectId = name === "appliedProject" ? value : prev.appliedProject;
      const deptName = name === "department" ? value : prev.department;

      if (name === "appliedProject" || name === "department") {
        if (!validateSeats(projectId, deptName)) {
          updated = { ...prev, [name]: "" };
        }
      }

      const isEligible = updated.name && updated.email && updated.phone && updated.studentId && updated.department && updated.year && updated.appliedProject;
      updated.status = isEligible ? "Approved" : "Pending";
      return updated;
    });
  };

  const handleFormSubmit = async () => {
    try {
      if (!studentForm.phone || !/^\d{10}$/.test(studentForm.phone)) {
        alert("Phone number must be 10 digits.");
        return;
      }

      const payload = { ...studentForm };
      const res = await apiFetch(`/api/admin/students/${studentForm._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setDetailsOpen(false);
        setIsEditing(false);
        loadStudents();
        fetchProjects();
      } else {
        alert("Failed to update student");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const validateSeats = (projectId, deptName) => {
    if (!projectId) return true;

    const project = (projects || []).find(p => p._id === projectId);
    if (!project) return true;

    if (project.status === "Closed") {
      setWarningMessage(`Project '${project.title}' is Closed. Cannot assign students.`);
      setWarningOpen(true);
      return false;
    }

    if (!deptName) return true;

    const deptEntry = project.departments?.find(d => d.name === deptName);
    if (!deptEntry) {
      setWarningMessage(`Department '${deptName}' is not assigned to project '${project.title}'.`);
      setWarningOpen(true);
      return false;
    } else if (deptEntry.seats <= 0) {
      setWarningMessage(`Project '${project.title}' has no seats available for department '${deptName}'.`);
      setWarningOpen(true);
      return false;
    }
    return true;
  };


  const handleClearRejected = async () => {
    if (!window.confirm("Are you sure you want to delete all rejected students?")) return;
    await apiFetch("/api/admin/students/rejected", {
      method: "DELETE"
    });

    loadStudents();
    fetchProjects();
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student? This action cannot be undone.")) return;

    try {
      const res = await apiFetch(`/api/admin/students/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setDetailsOpen(false);
        loadStudents();
        fetchProjects();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete student");
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  /* ================= SELECTION HANDLERS ================= */

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedIds((students || []).map(s => s._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  };

  const handleExportSelected = () => {
    const selectedData = (students || []).filter(s => selectedIds.includes(s._id));
    // Navigate to Import/Export page with data in state
    navigate("/admin/import-export", { state: { exportData: selectedData, type: "students" } });
  };

  const handleBulkDelete = () => {
    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map(id =>
        apiFetch(`/api/admin/students/${id}`, {
          method: "DELETE"
        })
      ));
      setBulkDeleteConfirmOpen(false);
      setSelectedIds([]);
      loadStudents();
      fetchProjects();
    } catch (err) {
      console.error(err);
      alert("Error deleting students");
    }
  };

  /* ================= UI ================= */

  const hasRejected = students.some(s => s.status === "Rejected");

  // Filter Handlers
  const handleFilterClick = () => {
    setProjectFilter(appliedFilters.projectFilter);
    setStatusFilter(appliedFilters.statusFilter);
    setYearFilter(appliedFilters.yearFilter);
    setMissingDetails(appliedFilters.missingDetails);
    setFilterOpen(true);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      programFilter,
      projectFilter,
      statusFilter,
      yearFilter,
      levelFilter,
      missingDetails
    });
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setProgramFilter("All");
    setProjectFilter("All");
    setStatusFilter("All");
    setYearFilter("All");
    setLevelFilter("All");
    setMissingDetails(false);
    setAppliedFilters({
      programFilter: "All",
      projectFilter: "All",
      statusFilter: "All",
      yearFilter: "All",
      levelFilter: "All",
      missingDetails: false
    });
    setFilterOpen(false);
  };

  const hasActiveFilters = appliedFilters.programFilter !== "All" ||
    appliedFilters.projectFilter !== "All" ||
    appliedFilters.statusFilter !== "All" ||
    appliedFilters.yearFilter !== "All" ||
    appliedFilters.levelFilter !== "All" ||
    appliedFilters.missingDetails;

  const appliedFilterCount = [
    appliedFilters.programFilter !== "All",
    appliedFilters.projectFilter !== "All",
    appliedFilters.statusFilter !== "All",
    appliedFilters.yearFilter !== "All",
    appliedFilters.levelFilter !== "All",
    appliedFilters.missingDetails
  ].filter(Boolean).length;

  const filtersChanged =
    appliedFilters.programFilter !== programFilter ||
    appliedFilters.projectFilter !== projectFilter ||
    appliedFilters.statusFilter !== statusFilter ||
    appliedFilters.yearFilter !== yearFilter ||
    appliedFilters.levelFilter !== levelFilter ||
    appliedFilters.missingDetails !== missingDetails;

  if (authLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authorized) return null;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <style>{`
        *:not(input, textarea, [contenteditable]) {
          caret-color: transparent;
        }
      `}</style>
      <PageHeader
        title="Students"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
            <SearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Search Data"
              isFocused={searchFocused}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={handleFilterClick}
            >
              <Badge color="error" badgeContent={appliedFilterCount} invisible={appliedFilterCount === 0}>
                Filters
              </Badge>
            </Button>



            <Button variant="contained" onClick={() => setOpenAdd(true)}>
              Add Student
            </Button>
          </Stack>
        }
      />



      {/* TABLE */}
      <DataTable
        columns={[
          {
            id: "name", label: "Name", minWidth: 200, render: (s) => (
              <Stack direction="row" alignItems="center" spacing={1} onClick={() => openDetailsDialog(s)} sx={{ cursor: "pointer" }}>
                <Typography sx={{ color: "primary.main", fontWeight: "bold" }}>{s.name}</Typography>

              </Stack>
            )
          },
          { id: "guide", label: "Guide", minWidth: 150, render: (s) => s.appliedProject?.guide || s.guide || "-" },
          { id: "coGuide", label: "Co-Guide", minWidth: 150, render: (s) => s.appliedProject?.coGuide || "-" },
          { id: "phone", label: "Phone", minWidth: 120, render: (s) => s.phone || "-" },
          {
            id: "project", label: "Project", minWidth: 200, render: (s) => {
              const hasApplied = s.appliedProject;
              const appCount = (s.projectApplications || []).length;
              const totalApps = (hasApplied ? 1 : 0) + appCount;

              return (
                <Box onClick={() => hasApplied && openProjectDetailsDialog(s.appliedProject)} sx={{ cursor: hasApplied ? "pointer" : "default" }}>
                  <Typography
                    noWrap
                    sx={{
                      cursor: hasApplied ? "pointer" : "default",
                      color: hasApplied ? "primary.main" : "inherit",
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      maxWidth: { xs: 180, sm: 250, md: '20vw' },
                      fontWeight: hasApplied ? 600 : 400
                    }}
                    title={hasApplied?.title || "Not Selected"}
                  >
                    {hasApplied?.title || (totalApps > 0 ? `${totalApps} Application(s)` : "Not Selected")}
                  </Typography>
                  {totalApps > 1 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5 }}>
                      {hasApplied ? `+ ${appCount} more choice(s)` : 'Multiple choices pending'}
                    </Typography>
                  )}
                </Box>
              );
            }
          },
          { id: "department", label: "Department", minWidth: 150 },
          { id: "year", label: "Year", minWidth: 80, render: (s) => s.year || "-" },
          {
            id: "status", label: "Status", minWidth: 150, render: (s) => (
              <StatusChip status={s.status} level={s.level} />
            )
          },
          {
            id: "actions", label: "Manage", minWidth: 150, render: (s) => (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title={s.appliedProject ? "Daily status" : "No project"}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!s.appliedProject}
                      onClick={(e) => {
                        e.stopPropagation();
                        context.setSection("tasks", { projectId: s.appliedProject?._id, studentId: s._id });
                      }}
                    >
                      <AssignmentIcon fontSize="small" color={s.appliedProject ? "primary" : "disabled"} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={s.appliedProject ? "Attendance" : "No project"}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!s.appliedProject}
                      onClick={(e) => {
                        e.stopPropagation();
                        context.setSection("attendance", { projectId: s.appliedProject?._id, studentId: s._id });
                      }}
                    >
                      <CheckCircleIcon fontSize="small" color={s.appliedProject ? "success" : "disabled"} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={s.appliedProject ? "Reviews" : "No project"}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!s.appliedProject}
                      onClick={(e) => {
                        e.stopPropagation();
                        context.setSection("reviews", { projectId: s.appliedProject?._id });
                      }}
                    >
                      <RateReviewIcon fontSize="small" color={s.appliedProject ? "secondary" : "disabled"} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            )
          }
        ]}
        rows={students}
        loading={loading}

        emptyMessage="No students found matching filters."
        sx={{ mb: backgroundLoading ? 0 : 3 }}
        fixedLayout={false}
      >
        {backgroundLoading && (
          <TableRow>
            <TableCell colSpan={selectionMode ? 10 : 9} align="center" sx={{ py: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="textSecondary">Loading more students...</Typography>
              </Box>
            </TableCell>
          </TableRow>
        )}
      </DataTable>

      {/* FILTER DIALOG */}
      <Dialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        fullWidth
        maxWidth="sm"
        disableRestoreFocus
        disableEnforceFocus
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Filter Options
          <IconButton onClick={() => setFilterOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Autocomplete
              options={projectOptions}
              getOptionLabel={(option) => option.title}
              value={projectOptions.find(p => p._id === projectFilter) || null}
              onChange={(event, newValue) => {
                setProjectFilter(newValue ? newValue._id : "All");
              }}
              renderInput={(params) => <TextField {...params} label="Project" size="small" />}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Program</InputLabel>
              <Select
                value={programFilter}
                label="Program"
                onChange={(e) => {
                  setProgramFilter(e.target.value);
                  setYearFilter("All"); // Reset year when program changes
                }}
              >
                <MenuItem value="All">All Programs</MenuItem>
                {programsList.map(p => (
                  <MenuItem key={p._id} value={p.name}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Year</InputLabel>
              <Select value={yearFilter} label="Year" onChange={(e) => setYearFilter(e.target.value)} disabled={!programFilter || programFilter === 'All'}>
                <MenuItem value="All">All Years</MenuItem>
                {yearOptions.length > 0 ? (
                  yearOptions.map(y => (
                    <MenuItem key={y} value={String(y)}>
                      {y}{Number(y) === 1 ? 'st' : Number(y) === 2 ? 'nd' : Number(y) === 3 ? 'rd' : 'th'} Year
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>Select a program first</MenuItem>
                )}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="All">All Statuses</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Level</InputLabel>
              <Select value={levelFilter} label="Level" onChange={(e) => setLevelFilter(e.target.value)}>
                <MenuItem value="All">All Levels</MenuItem>
                <MenuItem value="1">Level 1</MenuItem>
                <MenuItem value="2">Level 2</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch checked={missingDetails} onChange={(e) => setMissingDetails(e.target.checked)} />}
              label="Show Missing Details Only"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearFilters} color="error">Clear Filters</Button>
          <Button onClick={handleApplyFilters} variant="contained" disabled={!filtersChanged}>Apply</Button>
        </DialogActions>
      </Dialog>

      {/* ADD STUDENT DIALOG */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth disableRestoreFocus disableEnforceFocus>
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Full Name"
            name="name"
            value={newStudent.name}
            onChange={handleAddChange}
            fullWidth
          />
          <TextField
            label="Student ID"
            name="studentId"
            value={newStudent.studentId}
            onChange={handleAddChange}
            fullWidth
          />
          <TextField
            label="Phone Number"
            name="phone"
            value={newStudent.phone}
            onChange={handleAddChange}
            fullWidth
            required
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={newStudent.email}
            onChange={handleAddChange}
            fullWidth
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={newStudent.password}
            onChange={handleAddChange}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Program</InputLabel>
            <Select
              label="Program"
              name="program"
              value={newStudent.program}
              onChange={(e) => {
                setNewStudent(prev => ({ ...prev, program: e.target.value, department: "", year: "", appliedProject: "" }));
              }}
            >
              {programsList.map(p => (
                <MenuItem key={p._id} value={p.name}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Department</InputLabel>
            <Select
              name="department"
              value={newStudent.department}
              onChange={(e) => {
                setNewStudent(prev => ({ ...prev, department: e.target.value, appliedProject: "" }));
              }}
              label="Department"
              disabled={!newStudent.program}
            >
              {addDialogDepartments.map(d => (
                <MenuItem key={d._id} value={d.name}>
                  {d.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Year</InputLabel>
            <Select
              label="Year"
              name="year"
              value={newStudent.year}
              onChange={handleAddChange}
              disabled={!newStudent.program}
            >
              {(programsList.find(p => p.name === newStudent.program)?.eligibleYears || []).sort((a, b) => Number(a) - Number(b)).map(y => (
                <MenuItem key={y} value={String(y)}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              label="Project"
              name="appliedProject"
              value={newStudent.appliedProject}
              onChange={handleAddChange}
              disabled={!newStudent.department}
            >
              <MenuItem value=""><em>Not Selected</em></MenuItem>
              {addDialogProjects.map(p => (
                <MenuItem key={p._id} value={p._id}>
                  {p.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSubmit}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* EDIT STUDENT DIALOG */}
      <Dialog open={detailsOpen} onClose={() => { setDetailsOpen(false); setIsEditing(false); }} fullWidth disableRestoreFocus disableEnforceFocus>
        <DialogTitle>Student Details</DialogTitle>
        <DialogContent>
          {selectedStudent && (
            isEditing ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <TextField label="Full Name" name="name" value={studentForm.name} onChange={handleFormChange} fullWidth />
                <TextField label="Student ID" name="studentId" value={studentForm.studentId} onChange={handleFormChange} fullWidth />
                <TextField label="Guide" name="guide" value={studentForm.guide} onChange={handleFormChange} fullWidth />
                <TextField label="Phone Number" name="phone" value={studentForm.phone} onChange={handleFormChange} fullWidth required />
                <TextField label="Email" name="email" type="email" value={studentForm.email} onChange={handleFormChange} fullWidth />
                <TextField label="Status" value={studentForm.status} disabled fullWidth />
                <FormControl fullWidth>
                  <InputLabel>Program</InputLabel>
                  <Select label="Program" name="program" value={studentForm.program} onChange={(e) => { setStudentForm(prev => ({ ...prev, program: e.target.value, department: "", year: "" })); }}>
                    {programsList.map(p => (<MenuItem key={p._id} value={p.name}>{p.name}</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Year</InputLabel>
                  <Select label="Year" name="year" value={studentForm.year} onChange={handleFormChange} disabled={!studentForm.program}>
                    {(programsList.find(p => p.name === studentForm.program)?.eligibleYears || []).sort((a, b) => Number(a) - Number(b)).map(y => (<MenuItem key={y} value={String(y)}>{y}</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    label="Department"
                    name="department"
                    value={studentForm.department}
                    onChange={handleFormChange}
                    disabled={!studentForm.program}
                  >
                    {editDialogDepartments.map(d => (<MenuItem key={d._id} value={d.name}>{d.name}</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <Autocomplete
                    options={sortedProjects}
                    getOptionLabel={(option) => option.title}
                    value={sortedProjects.find(p => p._id === studentForm.appliedProject) || null}
                    onChange={(event, newValue) => {
                      const projectId = newValue ? newValue._id : "";
                      setStudentForm(prev => {
                        let updated = { ...prev, appliedProject: projectId };
                        const deptName = prev.department;
                        if (!validateSeats(projectId, deptName)) {
                          updated.appliedProject = "";
                        }
                        const isEligible = updated.name && updated.email && updated.phone && updated.studentId && updated.department && updated.year && updated.appliedProject;
                        updated.status = isEligible ? "Approved" : "Pending";
                        return updated;
                      });
                    }}
                    renderInput={(params) => <TextField {...params} label="Project" />}
                  />
                </FormControl>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                <Typography variant="h5" color="primary">{selectedStudent.name}</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  <Box><Typography variant="subtitle2" color="textSecondary">Student ID</Typography><Typography variant="body1">{selectedStudent.studentId}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Email</Typography><Typography variant="body1">{selectedStudent.email}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Phone</Typography><Typography variant="body1">{selectedStudent.phone || "-"}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Department</Typography><Typography variant="body1">{selectedStudent.department}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Guide</Typography><Typography variant="body1">{selectedStudent.appliedProject?.guide || selectedStudent.guide || "-"}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Co-Guide</Typography><Typography variant="body1">{selectedStudent.appliedProject?.coGuide || "-"}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Year</Typography><Typography variant="body1">{selectedStudent.year || "-"}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Status</Typography>
                    <StatusChip status={selectedStudent.status} level={selectedStudent.level} />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>Applied Projects ({(selectedStudent.appliedProject ? 1 : 0) + (selectedStudent.projectApplications?.length || 0)}/5)</Typography>
                  <Stack spacing={1}>
                    {[selectedStudent.appliedProject, ...(selectedStudent.projectApplications || [])].filter(Boolean).map((p, idx) => (
                      <Box
                        key={p._id || idx}
                        sx={{
                          p: 1.5,
                          border: '1px solid #edf2f7',
                          borderRadius: 1,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{p.title}</Typography>
                          <Typography variant="caption" color="text.secondary">Priority {idx + 1}</Typography>
                        </Box>
                        {selectedStudent.status === 'Approved' && idx === 0 ? (
                          <Chip label="Current" size="small" color="primary" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />
                        ) : (
                          <Chip label="Pending" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                    ))}
                    {(!selectedStudent.appliedProject && (!selectedStudent.projectApplications || selectedStudent.projectApplications.length === 0)) && (
                      <Typography variant="body2" color="textSecondary">No projects selected</Typography>
                    )}
                  </Stack>
                </Box>
              </Box>
            )
          )}
        </DialogContent>
        <DialogActions>
          {isEditing ? (
            <>
              <Button onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleFormSubmit}>Save Changes</Button>
            </>
          ) : (
            <>

              <Box sx={{ flex: '1 1 auto' }} />

              <Button variant="contained" onClick={() => setIsEditing(true)}>Edit</Button>
              <Button onClick={() => { setDetailsOpen(false); setIsEditing(false); }}>Close</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <ProjectDetailsDialog open={viewOpen} onClose={() => setViewOpen(false)} project={viewProject} />

      <ConfirmDialog
        open={warningOpen}
        onCancel={() => setWarningOpen(false)}
        onConfirm={() => setWarningOpen(false)}
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WarningIcon color="warning" /> Seat Availability Warning
          </Box>
        }
        content={warningMessage}
        confirmText="OK"
        cancelText="Cancel"
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Confirm Bulk Deletion"
        content={`Are you sure you want to delete ${selectedIds.length} students? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />
    </Box>
  );
}


