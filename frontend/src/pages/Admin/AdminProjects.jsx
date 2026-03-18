import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Collapse,
  Divider,
  Checkbox,
  FormControlLabel,
  Switch,
  Badge,
  Grid,
  Autocomplete,
  Tooltip
} from "@mui/material";
import { useNavigate, useOutletContext } from "react-router-dom";

import {
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  CheckBox as CheckBoxIcon,
  FilterList as FilterListIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  RateReview as RateReviewIcon
} from "@mui/icons-material";
import { apiFetch } from '../../core/services/apiFetch';
import DataTable from "../../components/common/DataTable";
import useRequireRole from "../../core/hooks/useRequireRole";
import { ROLES } from "../../core/constants/roles";
import SearchBar from "../../components/common/SearchBar";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StatusChip from "../../components/common/StatusChip";
import PageHeader from "../../components/common/PageHeader";
import ProjectDetailsDialog from "../../components/common/ProjectDetailsDialog";
import FacultyDetailsDialog from "../../components/common/FacultyDetailsDialog";

export default function AdminProjects(props) {
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const context = props.context || outletContext || {};

  const {
    programsData: programsList = [], setProgramsData: setProgramsList = () => { },
    allDepartmentsData: availableDepts = [], setAllDepartmentsData: setAvailableDepts = () => { }
  } = context;
  const [projects, setProjects] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const { authorized, authLoading } = useRequireRole(ROLES.ADMIN);

  const [facultyDetailsOpen, setFacultyDetailsOpen] = useState(false);
  const [selectedFacultyName, setSelectedFacultyName] = useState("");

  const [seatOpen, setSeatOpen] = useState(false);
  const [seatProject, setSeatProject] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [deptDeleteOpen, setDeptDeleteOpen] = useState(false);
  const [deptDeleteIndex, setDeptDeleteIndex] = useState(null);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [projectToToggle, setProjectToToggle] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedObjectsCache, setSelectedObjectsCache] = useState({});
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [form, setForm] = useState({
    _id: null,
    title: "",
    projectId: "",
    baseDept: "",
    description: "",
    skillsRequired: "",
    projectOutcome: "",
    guide: "",
    guideEmpId: "",
    guideDept: "",
    coGuide: "",
    coGuideEmpId: "",
    coGuideDept: "",
    allowWithdrawal: true
  });

  const [isEditingInDialog, setIsEditingInDialog] = useState(false);

  const sortedFaculty = useMemo(() => [...faculty].sort((a, b) => a.name.localeCompare(b.name)), [faculty]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [programFilter, setProgramFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [guideDeptFilter, setGuideDeptFilter] = useState("All");
  const [coGuideDeptFilter, setCoGuideDeptFilter] = useState("All");
  const [registrationFilter, setRegistrationFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Advanced Filters State
  const [seatType, setSeatType] = useState("Registered");
  const [regSeatsOp, setRegSeatsOp] = useState("range");
  const [regSeatsVal, setRegSeatsVal] = useState("");
  const [regSeatsMax, setRegSeatsMax] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    programFilter: "All",
    statusFilter: "All",
    deptFilter: "All",
    guideDeptFilter: "All",
    coGuideDeptFilter: "All",
    registrationFilter: "All",
    levelFilter: "All",
    seatType: "Registered",
    regSeatsOp: "range",
    regSeatsVal: "",
    regSeatsMax: ""
  });

  const [filteredDepartments, setFilteredDepartments] = useState([]);

  useEffect(() => {
    if (programFilter && programFilter !== "All") {
      const selectedProg = programsList.find(p => p.name === programFilter);
      setFilteredDepartments(selectedProg?.departments || []);
    } else {
      setFilteredDepartments(availableDepts);
    }
  }, [programFilter, programsList, availableDepts]);

  // Optimization: Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  /* ================= FETCH ================= */

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (programFilter !== "All") params.append("program", programFilter);
      if (deptFilter !== "All") params.append("baseDept", deptFilter);
      if (guideDeptFilter !== "All") params.append("guideDept", guideDeptFilter);
      if (coGuideDeptFilter !== "All") params.append("coGuideDept", coGuideDeptFilter);
      if (statusFilter !== "All") params.append("status", statusFilter);

      params.append("skip", page * rowsPerPage);
      params.append("limit", rowsPerPage);

      const res = await apiFetch(`/api/projects?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.pagination) {
        setProjects(json.data || []);
        setTotalCount(json.pagination.total || 0);
      } else {
        const data = json.data || json;
        setProjects(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    setPage(0);
  }, [debouncedSearchQuery, programFilter, deptFilter, guideDeptFilter, coGuideDeptFilter, statusFilter, authorized]);

  useEffect(() => {
    if (authorized) {
      fetchProjects();
    }
  }, [debouncedSearchQuery, programFilter, deptFilter, guideDeptFilter, coGuideDeptFilter, statusFilter, authorized, page, rowsPerPage]);

  const fetchPrograms = async () => {
    if (programsList.length > 0) return;
    try {
      const res = await apiFetch("/api/admin/programs");
      if (res.ok) {
        setProgramsList(await res.json());
      }
    } catch (err) { }
  };

  const fetchAvailableDepts = async () => {
    if (availableDepts.length > 0) return;
    try {
      const res = await apiFetch("/api/admin/all-db-departments");
      if (res.ok) {
        const data = await res.json();
        setAvailableDepts(data.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) { }
  };

  const fetchFaculty = async () => {
    try {
      const res = await apiFetch("/api/admin/faculty");
      if (res.ok) {
        const data = await res.json();
        setFaculty(data);
      }
    } catch (err) {
      console.error("Failed to fetch faculty", err);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    fetchPrograms();
    fetchAvailableDepts();
    fetchFaculty();
  }, [authorized]);

  /* ================= PROJECT FORM ================= */

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAddDialog = () => {
    setEditingProject(null);
    setForm({ title: "", projectId: "", baseDept: "", description: "", skillsRequired: "", projectOutcome: "", guide: "", guideEmpId: "", guideDept: "", coGuide: "", coGuideEmpId: "", coGuideDept: "", allowWithdrawal: true });
    setOpen(true);
  };

  const openProjectDialog = project => {
    setEditingProject(project);
    setForm({
      title: project.title,
      projectId: project.projectId || "",
      baseDept: project.baseDept || "",
      description: project.description,
      skillsRequired: project.skillsRequired || "",
      projectOutcome: project.projectOutcome || "",
      guide: project.guide || "",
      guideEmpId: project.guideEmpId || "",
      guideDept: project.guideDept || "",
      coGuide: project.coGuide || "",
      coGuideEmpId: project.coGuideEmpId || "",
      coGuideDept: project.coGuideDept || "",
      allowWithdrawal: project.allowWithdrawal !== undefined ? project.allowWithdrawal : true
    });
    setIsEditingInDialog(false);
    setOpen(true);
  };

  const handleSubmit = async () => {
    const url = editingProject
      ? `/api/projects/${editingProject._id}`
      : "/api/projects";

    const method = editingProject ? "PUT" : "POST";

    await apiFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        departments: editingProject ? editingProject.departments : []
      })
    });

    setOpen(false);
    setEditingProject(null);
    setIsEditingInDialog(false);
    fetchProjects();
    fetchAvailableDepts();
  };

  const handleDelete = id => {
    setProjectToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${projectToDelete}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete project");

      fetchProjects();
      setDeleteConfirmOpen(false);
      setProjectToDelete(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const promptToggleStatus = (project) => {
    setProjectToToggle(project);
    setStatusConfirmOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!projectToToggle) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/projects/${projectToToggle._id}/status`, {
        method: "PATCH"
      });
      fetchProjects();
      setStatusConfirmOpen(false);
      setProjectToToggle(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMakeLeader = async (projectId, studentId) => {
    try {
      const res = await apiFetch(`/api/admin/projects/${projectId}/team-leader/${studentId}`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to assign team leader");
      }

      // Update the local state to reflect the change immediately without a full refetch if possible,
      // but a full refetch ensures data consistency. We'll do a refetch for simplicity.
      fetchProjects();

      // Also update the currently editing project so the dialog updates
      setEditingProject(prev => {
        if (prev && prev._id === projectId) {
          return { ...prev, teamLeader: studentId };
        }
        return prev;
      });

    } catch (err) {
      alert(err.message);
    }
  };

  /* ================= DEPARTMENT SEATS ================= */

  const openSeatDialog = project => {
    setSeatProject(project);
    setDepartments(
      project.departments?.length
        ? project.departments
        : [{ name: "", seats: 0 }]
    );
    setSeatOpen(true);
  };

  const updateDepartment = (index, field, value) => {
    const updated = [...departments];
    updated[index][field] = value;
    setDepartments(updated);
  };

  const addDepartmentRow = () => {
    setDepartments([...departments, { name: "", seats: 0 }]);
  };

  const addDepartmentFromSuggestion = name => {
    if (departments.length === 1 && !departments[0].name) {
      setDepartments([{ name, seats: 0 }]);
    } else {
      setDepartments([...departments, { name, seats: 0 }]);
    }
  };

  const promptDeleteDepartment = index => {
    setDeptDeleteIndex(index);
    setDeptDeleteOpen(true);
  };

  const confirmDeleteDepartment = () => {
    const updated = [...departments];
    updated.splice(deptDeleteIndex, 1);
    setDepartments(updated);
    setDeptDeleteOpen(false);
    setDeptDeleteIndex(null);
  };

  const totalSeats = departments.reduce(
    (sum, d) => sum + Number(d.seats || 0),
    0
  );

  const saveDepartments = async () => {
    await apiFetch(`/api/projects/${seatProject._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        departments
      })
    });

    setSeatOpen(false);
    fetchProjects();
    fetchAvailableDepts();

    if (editingProject && editingProject._id === seatProject._id) {
      try {
        const res = await apiFetch(`/api/projects/${seatProject._id}`);
        if (res.ok) {
          const json = await res.json();
          setEditingProject(json.data || json);
        }
      } catch (err) {
        console.error("Failed to refresh project details after saving departments", err);
      }
    }
  };

  // Optimization: Memoize filtered projects
  const filteredProjects = useMemo(() => projects.filter(p => {
    const q = debouncedSearchQuery.toLowerCase();
    const matchesSearch =
      p.title.toLowerCase().includes(q) ||
      (p.projectId || "").toLowerCase().includes(q) ||
      (p.baseDept || "").toLowerCase().includes(q) ||
      (p.guide || "").toLowerCase().includes(q) ||
      (p.guideDept || "").toLowerCase().includes(q) ||
      (p.coGuide || "").toLowerCase().includes(q) ||
      (p.coGuideDept || "").toLowerCase().includes(q);
    const {
      programFilter,
      statusFilter,
      deptFilter,
      registrationFilter,
      levelFilter,
      seatType,
      regSeatsOp,
      regSeatsVal,
      regSeatsMax
    } = appliedFilters;

    let matchesProgram = true;
    if (programFilter !== "All") {
      const selectedProg = programsList.find(prog => prog.name === programFilter);
      if (selectedProg) {
        const programDeptNames = new Set(selectedProg.departments.map(d => d.name));
        matchesProgram = p.departments.some(d => programDeptNames.has(d.name));
      } else {
        matchesProgram = false;
      }
    }

    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    const matchesDept = deptFilter === "All" || (p.baseDept === deptFilter);
    const matchesGuideDept = guideDeptFilter === "All" || (p.guideDept === guideDeptFilter);
    const matchesCoGuideDept = coGuideDeptFilter === "All" || (p.coGuideDept === coGuideDeptFilter);

    let matchesRegistration = true;
    const reg = p.registeredCount || 0;
    const total = p.totalSeats || 0;

    if (registrationFilter === "None") matchesRegistration = reg === 0;
    else if (registrationFilter === "Partial") matchesRegistration = reg > 0 && reg < total;
    else if (registrationFilter === "Full") matchesRegistration = reg >= total;

    // Level Filter
    let matchesLevel = true;
    if (levelFilter === "L2") {
      matchesLevel = p.hasLevel2Student === true;
    } else if (levelFilter === "L1") {
      matchesLevel = p.hasLevel1Student === true;
    }

    // Seat Count Filter (Generic)
    let matchesSeats = true;

    // Determine source data: Project Total OR Specific Department
    let sourceTotal = p.totalSeats || 0;
    let sourceRegistered = p.registeredCount || 0;

    if (deptFilter !== "All") {
      const d = p.departments.find(dep => dep.name === deptFilter);
      // If project has the department, use its specific counts, otherwise 0
      sourceTotal = d ? (d.seats || 0) : 0;
      sourceRegistered = d ? (d.registered || 0) : 0;
    }

    let targetSeats = 0;
    if (seatType === "Registered") targetSeats = sourceRegistered;
    else if (seatType === "Available") targetSeats = sourceTotal - sourceRegistered;
    else if (seatType === "Total") targetSeats = sourceTotal;

    if (regSeatsOp === "range") {
      if (regSeatsVal !== "" && targetSeats < Number(regSeatsVal)) matchesSeats = false;
      if (regSeatsMax !== "" && targetSeats > Number(regSeatsMax)) matchesSeats = false;
    } else {
      if (regSeatsVal !== "") {
        const val = Number(regSeatsVal);
        if (regSeatsOp === "eq" && targetSeats !== val) matchesSeats = false;
      }
    }

    return matchesSearch && matchesProgram && matchesStatus && matchesDept && matchesGuideDept && matchesCoGuideDept && matchesRegistration && matchesSeats && matchesLevel;
  }), [projects, debouncedSearchQuery, appliedFilters, programsList]);

  /* ================= FILTER HANDLERS ================= */

  const handleFilterClick = () => {
    setProgramFilter(appliedFilters.programFilter);
    setStatusFilter(appliedFilters.statusFilter);
    setDeptFilter(appliedFilters.deptFilter);
    setGuideDeptFilter(appliedFilters.guideDeptFilter);
    setCoGuideDeptFilter(appliedFilters.coGuideDeptFilter);
    setRegistrationFilter(appliedFilters.registrationFilter);
    setLevelFilter(appliedFilters.levelFilter);
    setSeatType(appliedFilters.seatType);
    setRegSeatsOp(appliedFilters.regSeatsOp);
    setRegSeatsVal(appliedFilters.regSeatsVal);
    setRegSeatsMax(appliedFilters.regSeatsMax);
    setFilterOpen(true);
  };

  const handleFilterClose = () => {
    setFilterOpen(false);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      programFilter,
      statusFilter,
      deptFilter,
      guideDeptFilter,
      coGuideDeptFilter,
      registrationFilter,
      levelFilter,
      seatType,
      regSeatsOp,
      regSeatsVal,
      regSeatsMax
    });
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    // Reset draft state
    setProgramFilter("All");
    setStatusFilter("All");
    setDeptFilter("All");
    setGuideDeptFilter("All");
    setCoGuideDeptFilter("All");
    setRegistrationFilter("All");
    setLevelFilter("All");
    setSeatType("Registered");
    setRegSeatsOp("range");
    setRegSeatsVal("");
    setRegSeatsMax("");

    // Apply clear immediately
    setAppliedFilters({
      programFilter: "All",
      statusFilter: "All",
      deptFilter: "All",
      guideDeptFilter: "All",
      coGuideDeptFilter: "All",
      registrationFilter: "All",
      levelFilter: "All",
      seatType: "Registered",
      regSeatsOp: "range",
      regSeatsVal: "",
      regSeatsMax: ""
    });
    setFilterOpen(false);
  };

  const handleFacultyClick = (name, e) => {
    if (e) e.stopPropagation();
    setSelectedFacultyName(name);
    setFacultyDetailsOpen(true);
  };

  /* ================= SELECTION HANDLERS ================= */

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const pageIds = filteredProjects.map(p => p._id);
      setSelectedIds(pageIds);
      const newEntries = {};
      filteredProjects.forEach(p => { newEntries[p._id] = p; });
      setSelectedObjectsCache(prev => ({ ...prev, ...newEntries }));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        return prev.filter(sid => sid !== id);
      } else {
        const p = projects.find(it => it._id === id);
        if (p) {
          setSelectedObjectsCache(cache => ({ ...cache, [id]: p }));
        }
        return [...prev, id];
      }
    });
  };

  const handleExportSelected = () => {
    // Correctly export all selected items from cache, preserving cross-page selections
    const selectedData = selectedIds.map(id => selectedObjectsCache[id]).filter(Boolean);
    if (context.setSection) {
      context.setSection("import-export", { exportData: selectedData, type: "projects" });
    } else {
      // Fallback if context is missing
      navigate("/admin/import-export", { state: { exportData: selectedData, type: "projects" } });
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteConfirmOpen(true);
  };

  const handleSelectAllFiltered = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (programFilter !== "All") params.append("program", programFilter);
      if (deptFilter !== "All") params.append("baseDept", deptFilter);
      if (guideDeptFilter !== "All") params.append("guideDept", guideDeptFilter);
      if (coGuideDeptFilter !== "All") params.append("coGuideDept", coGuideDeptFilter);
      if (statusFilter !== "All") params.append("status", statusFilter);

      // Fetch all IDs by setting a very large limit
      params.append("limit", 100000);

      const res = await apiFetch(`/api/projects?${params.toString()}`);
      const json = await res.json();
      const allProjects = json.data?.data || json.data || json;

      if (Array.isArray(allProjects)) {
        setSelectedIds(allProjects.map(p => p._id));
        const newEntries = {};
        allProjects.forEach(p => { newEntries[p._id] = p; });
        setSelectedObjectsCache(prev => ({ ...prev, ...newEntries }));
      }
    } catch (err) {
      console.error("Failed to select all projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmBulkDelete = async () => {
    setActionLoading(true);
    try {
      await Promise.all(selectedIds.map(id =>
        apiFetch(`/api/projects/${id}`, {
          method: "DELETE"
        }).then(res => { if (!res.ok) throw new Error("Failed to delete one or more projects"); })
      ));
      setBulkDeleteConfirmOpen(false);
      setSelectedIds([]);
      fetchProjects();
      fetchAvailableDepts();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /* ================= UI ================= */

  const filtersChanged =
    appliedFilters.programFilter !== programFilter ||
    appliedFilters.statusFilter !== statusFilter ||
    appliedFilters.deptFilter !== deptFilter ||
    appliedFilters.guideDeptFilter !== guideDeptFilter ||
    appliedFilters.coGuideDeptFilter !== coGuideDeptFilter ||
    appliedFilters.registrationFilter !== registrationFilter ||
    appliedFilters.levelFilter !== levelFilter ||
    appliedFilters.seatType !== seatType ||
    appliedFilters.regSeatsOp !== regSeatsOp ||
    appliedFilters.regSeatsVal !== regSeatsVal ||
    appliedFilters.regSeatsMax !== regSeatsMax;

  const appliedFilterCount = [
    appliedFilters.programFilter !== "All",
    appliedFilters.statusFilter !== "All",
    appliedFilters.deptFilter !== "All",
    appliedFilters.guideDeptFilter !== "All",
    appliedFilters.coGuideDeptFilter !== "All",
    appliedFilters.registrationFilter !== "All",
    appliedFilters.levelFilter !== "All",
    appliedFilters.regSeatsVal !== "",
    (appliedFilters.regSeatsOp === "range" && appliedFilters.regSeatsMax !== "")
  ].filter(Boolean).length;

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
        title="Projects"
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
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={handleFilterClick}
            >
              <Badge color="error" badgeContent={appliedFilterCount} invisible={appliedFilterCount === 0}>
                Filters
              </Badge>
            </Button>

            <Button
              variant={selectionMode ? "contained" : "outlined"}
              color={selectionMode ? "secondary" : "primary"}
              startIcon={selectionMode ? <CloseIcon /> : <CheckBoxIcon />}
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds([]);
              }}
            >
              {selectionMode ? "Cancel Selection" : "Select"}
            </Button>

            <Button variant="contained" onClick={openAddDialog}>
              Add Project
            </Button>
          </Stack>
        }
      />

      {selectionMode && (
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, bgcolor: "#f5f5f5", p: 1, borderRadius: 1 }}>
          <Typography variant="body2" sx={{ ml: 1 }}>{selectedIds.length} projects selected</Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSelectAllFiltered}
            disabled={loading}
          >
            Select All Projects ({totalCount})
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Button variant="contained" size="small" onClick={handleExportSelected}>
                Export Selected
              </Button>
              <Button variant="contained" color="error" size="small" onClick={handleBulkDelete}>
                Delete Selected
              </Button>
            </>
          )}
        </Box>
      )}
      <DataTable
        columns={[
          {
            id: "title", label: "Title", minWidth: 200, render: (p) => (
              <Box>
                <Typography
                  onClick={() => openProjectDialog(p)}
                  noWrap
                  sx={{
                    cursor: "pointer",
                    color: "primary.main",
                    fontWeight: "bold",
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    maxWidth: { xs: 180, sm: 250, md: '25vw' }
                  }}
                  title={p.title}
                >
                  {p.title}
                </Typography>
                <Typography variant="caption" color="textSecondary">{p.projectId || "-"} • {p.baseDept || "-"}</Typography>
              </Box>
            )
          },
          {
            id: "guide", label: "Guide", minWidth: 150, render: (p) => (
              <Box>
                <Typography
                  noWrap
                  sx={{
                    cursor: p.guide ? 'pointer' : 'default',
                    maxWidth: { xs: 120, sm: 160, md: '12vw' },
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    fontWeight: p.guide ? 600 : 400,
                    color: p.guide ? 'text.primary' : 'text.disabled',
                    '&:hover': p.guide ? { textDecoration: 'underline' } : {}
                  }}
                  onClick={(e) => p.guide && handleFacultyClick(p.guide, e)}
                  title={p.guide || "Not Assigned"}
                >
                  {p.guide || "Available"}
                </Typography>
                {p.guideDept && (
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>{p.guideDept}</Typography>
                )}
              </Box>
            )
          },
          {
            id: "coGuide", label: "Co-Guide", minWidth: 150, render: (p) => (
              <Box>
                <Typography
                  noWrap
                  sx={{
                    cursor: p.coGuide ? 'pointer' : 'default',
                    maxWidth: { xs: 120, sm: 160, md: '12vw' },
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    fontWeight: p.coGuide ? 600 : 400,
                    color: p.coGuide ? 'text.primary' : 'text.disabled',
                    '&:hover': p.coGuide ? { textDecoration: 'underline' } : {}
                  }}
                  onClick={(e) => p.coGuide && handleFacultyClick(p.coGuide, e)}
                  title={p.coGuide || "Not Assigned"}
                >
                  {p.coGuide || "Available"}
                </Typography>
                {p.coGuideDept && (
                  <Typography variant="caption" color="secondary" sx={{ fontWeight: 700 }}>{p.coGuideDept}</Typography>
                )}
              </Box>
            )
          },
          {
            id: "seats", label: "Registered / Total Seats", minWidth: 150, render: (p) => (
              <Typography
                onDoubleClick={() => {
                  if (context.setSection) {
                    context.setSection("students", { projectId: p._id });
                  } else {
                    // Fallback to searching for the base route
                    const path = window.location.pathname.startsWith('/hod') ? '/hod' : '/admin';
                    navigate(path);
                    // We might need to set some global state or just rely on Sidebar setSection
                  }
                }}
                sx={{ cursor: "pointer", color: "primary.main", textDecoration: "underline" }}
                title="Double click to view assigned students"
              >
                {p.registeredCount || 0} / {p.totalSeats}
              </Typography>
            )
          },
          {
            id: "status", label: "Status", minWidth: 120, render: (p) => (
              <div onClick={() => promptToggleStatus(p)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                <StatusChip status={p.status} />
              </div>
            )
          },
          {
            id: "actions", label: "Manage", minWidth: 150, render: (p) => (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Daily status">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      context.setSection("tasks", { projectId: p._id });
                    }}
                  >
                    <AssignmentIcon fontSize="small" color="primary" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Attendance">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      context.setSection("attendance", { projectId: p._id });
                    }}
                  >
                    <CheckCircleIcon fontSize="small" color="success" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reviews">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      context.setSection("reviews", { projectId: p._id });
                    }}
                  >
                    <RateReviewIcon fontSize="small" color="secondary" />
                  </IconButton>
                </Tooltip>
              </Stack>
            )
          }
        ]}
        rows={projects}
        loading={loading}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectOne={handleSelectOne}
        emptyMessage="No projects found."
        serverSide={true}
        totalCount={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(e, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />

      {/* FILTER DIALOG */}
      <Dialog
        open={filterOpen}
        onClose={handleFilterClose}
        fullWidth
        maxWidth="sm"
        disableRestoreFocus
        disableEnforceFocus
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Filter Options
          <IconButton onClick={handleFilterClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Program</InputLabel>
                <Select
                  value={programFilter}
                  label="Program"
                  onChange={(e) => {
                    setProgramFilter(e.target.value);
                    setDeptFilter("All");
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
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="All">All Statuses</MenuItem>
                  <MenuItem value="Open">Open</MenuItem>
                  <MenuItem value="Closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Base Dept</InputLabel>
                <Select
                  value={deptFilter}
                  label="Base Dept"
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <MenuItem value="All">All</MenuItem>
                  {filteredDepartments.map((dept) => (
                    <MenuItem key={dept._id} value={dept.name}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Guide Dept</InputLabel>
                <Select
                  value={guideDeptFilter}
                  label="Guide Dept"
                  onChange={(e) => setGuideDeptFilter(e.target.value)}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Assigned">Assigned</MenuItem>
                  {availableDepts.map((dept) => (
                    <MenuItem key={dept._id} value={dept.name}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Co-Guide Dept</InputLabel>
                <Select
                  value={coGuideDeptFilter}
                  label="Co-Guide Dept"
                  onChange={(e) => setCoGuideDeptFilter(e.target.value)}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="Assigned">Assigned</MenuItem>
                  {availableDepts.map((dept) => (
                    <MenuItem key={dept._id} value={dept.name}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Registration Status</InputLabel>
                <Select
                  value={registrationFilter}
                  label="Registration Status"
                  onChange={(e) => setRegistrationFilter(e.target.value)}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="None">No Registrations</MenuItem>
                  <MenuItem value="Partial">Partially Filled</MenuItem>
                  <MenuItem value="Full">Fully Filled</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel>Student Level</InputLabel>
                <Select
                  value={levelFilter}
                  label="Student Level"
                  onChange={(e) => setLevelFilter(e.target.value)}
                >
                  <MenuItem value="All">All</MenuItem>
                  <MenuItem value="L2">Has Level 2 Students</MenuItem>
                  <MenuItem value="L1">Has Level 1 Students</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Seat Type</InputLabel>
                <Select
                  value={seatType}
                  label="Seat Type"
                  onChange={(e) => setSeatType(e.target.value)}
                >
                  <MenuItem value="Registered">Registered</MenuItem>
                  <MenuItem value="Available">Available</MenuItem>
                  <MenuItem value="Total">Total</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{seatType} Seats</InputLabel>
                <Select
                  value={regSeatsOp}
                  label={`${seatType} Seats`}
                  onChange={(e) => setRegSeatsOp(e.target.value)}
                >
                  <MenuItem value="range">Range</MenuItem>
                  <MenuItem value="eq">Exactly</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={regSeatsOp === "range" ? "Min / At least" : "Count"}
                type="number"
                size="small"
                value={regSeatsVal}
                onChange={(e) => setRegSeatsVal(e.target.value)}
                fullWidth
              />
              {regSeatsOp === "range" && (
                <TextField
                  label="Max / At most"
                  type="number"
                  size="small"
                  value={regSeatsMax}
                  onChange={(e) => setRegSeatsMax(e.target.value)}
                  fullWidth
                />
              )}
            </Box>

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearFilters} color="error">
            Clear Filters
          </Button>
          <Button onClick={handleApplyFilters} variant="contained" disabled={!filtersChanged}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* ADD / EDIT PROJECT */}
      {/* VIEW PROJECT */}
      <ProjectDetailsDialog
        open={open && !!editingProject && !isEditingInDialog}
        onClose={() => { setOpen(false); setIsEditingInDialog(false); }}
        project={editingProject}
        onMakeLeader={handleMakeLeader}
        renderStatus={(proj) => (
          <div onClick={() => { setOpen(false); promptToggleStatus(proj); }} style={{ cursor: 'pointer', display: 'inline-block' }}>
            <StatusChip status={proj.status} />
          </div>
        )}
        customActions={
          <>
            <Button color="error" onClick={() => { setOpen(false); handleDelete(editingProject._id); }}>
              Delete
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button onClick={() => {
              openSeatDialog(editingProject);
            }}>
              Settings
            </Button>
            <Button variant="contained" onClick={() => setIsEditingInDialog(true)}>Edit</Button>
            <Button onClick={() => { setOpen(false); setIsEditingInDialog(false); }}>
              Close
            </Button>
          </>
        }
      />

      {/* ADD / EDIT PROJECT */}
      <Dialog open={open && (!editingProject || isEditingInDialog)} onClose={() => { setOpen(false); setIsEditingInDialog(false); }} fullWidth disableRestoreFocus disableEnforceFocus>
        <DialogTitle>
          {editingProject ? "Edit Project" : "Add Project"}
        </DialogTitle>

        <DialogContent>
          {editingProject ? (
            <>
              <TextField autoFocus fullWidth sx={{ mt: 1, mb: 2 }} label="Title" name="title" value={form.title} onChange={handleChange} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <TextField fullWidth label="Project ID" name="projectId" value={form.projectId} onChange={handleChange} placeholder="Auto-generated if empty" />
                <Autocomplete
                  options={availableDepts.map(d => d.name)}
                  value={form.baseDept}
                  onChange={(e, val) => setForm({ ...form, baseDept: val || "" })}
                  freeSolo
                  renderInput={(params) => <TextField {...params} label="Base Dept" required />}
                />
              </Box>
              <Autocomplete
                options={sortedFaculty}
                getOptionLabel={(option) => option.name}
                value={sortedFaculty.find(f => f.name === form.guide) || null}
                onChange={(event, newValue) => {
                  handleChange({ target: { name: 'guide', value: newValue ? newValue.name : '' } });
                }}
                getOptionDisabled={(option) => option.name === form.coGuide && !!form.coGuide}
                renderInput={(params) => <TextField {...params} label="Guide" fullWidth sx={{ mb: 2 }} />}
              />
              <TextField fullWidth sx={{ mb: 2 }} label="Guide Employee ID" name="guideEmpId" value={form.guideEmpId} onChange={handleChange} />
              <Autocomplete
                options={availableDepts.map(d => d.name)}
                value={form.guideDept}
                onChange={(e, val) => setForm({ ...form, guideDept: val || "" })}
                freeSolo
                renderInput={(params) => <TextField {...params} label="Guide Dept" fullWidth sx={{ mb: 2 }} />}
              />
              <Autocomplete
                options={sortedFaculty}
                getOptionLabel={(option) => option.name}
                value={sortedFaculty.find(f => f.name === form.coGuide) || null}
                onChange={(event, newValue) => {
                  handleChange({ target: { name: 'coGuide', value: newValue ? newValue.name : '' } });
                }}
                getOptionDisabled={(option) => option.name === form.guide && !!form.guide}
                renderInput={(params) => <TextField {...params} label="Co-Guide" fullWidth sx={{ mb: 2 }} />}
              />
              <TextField fullWidth sx={{ mb: 2 }} label="Co-Guide Employee ID" name="coGuideEmpId" value={form.coGuideEmpId} onChange={handleChange} />
              <Autocomplete
                options={availableDepts.map(d => d.name)}
                value={form.coGuideDept}
                onChange={(e, val) => setForm({ ...form, coGuideDept: val || "" })}
                freeSolo
                renderInput={(params) => <TextField {...params} label="Co-Guide Dept" fullWidth sx={{ mb: 2 }} />}
              />
              <TextField fullWidth sx={{ mb: 2 }} label="Description" name="description" value={form.description} onChange={handleChange} multiline rows={3} />
              <TextField fullWidth sx={{ mb: 2 }} label="Skills Required" name="skillsRequired" value={form.skillsRequired} onChange={handleChange} multiline rows={2} />
              <TextField fullWidth sx={{ mb: 2 }} label="Project Outcome" name="projectOutcome" value={form.projectOutcome} onChange={handleChange} multiline rows={2} />
              <FormControlLabel
                control={<Switch checked={form.allowWithdrawal} onChange={(e) => setForm({ ...form, allowWithdrawal: e.target.checked })} />}
                label="Allow Student Withdrawal"
              />
            </>
          ) : (
            <>
              {/* This is for the "Add Project" case */}
              <TextField autoFocus fullWidth sx={{ mt: 1, mb: 2 }} label="Title" name="title" value={form.title} onChange={handleChange} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <TextField fullWidth label="Project ID" name="projectId" value={form.projectId} onChange={handleChange} placeholder="Auto-generated if empty" />
                <Autocomplete
                  options={availableDepts.map(d => d.name)}
                  value={form.baseDept}
                  onChange={(e, val) => setForm({ ...form, baseDept: val || "" })}
                  freeSolo
                  renderInput={(params) => <TextField {...params} label="Base Dept" required />}
                />
              </Box>
              <TextField fullWidth sx={{ mb: 2 }} label="Guide" name="guide" value={form.guide} onChange={handleChange} />
              <TextField fullWidth sx={{ mb: 2 }} label="Guide Employee ID" name="guideEmpId" value={form.guideEmpId} onChange={handleChange} />
              <Autocomplete
                options={availableDepts.map(d => d.name)}
                value={form.guideDept}
                onChange={(e, val) => setForm({ ...form, guideDept: val || "" })}
                freeSolo
                renderInput={(params) => <TextField {...params} label="Guide Dept" fullWidth sx={{ mb: 2 }} />}
              />
              <TextField fullWidth sx={{ mb: 2 }} label="Co-Guide" name="coGuide" value={form.coGuide} onChange={handleChange} />
              <TextField fullWidth sx={{ mb: 2 }} label="Co-Guide Employee ID" name="coGuideEmpId" value={form.coGuideEmpId} onChange={handleChange} />
              <Autocomplete
                options={availableDepts.map(d => d.name)}
                value={form.coGuideDept}
                onChange={(e, val) => setForm({ ...form, coGuideDept: val || "" })}
                freeSolo
                renderInput={(params) => <TextField {...params} label="Co-Guide Dept" fullWidth sx={{ mb: 2 }} />}
              />
              <TextField fullWidth sx={{ mb: 2 }} label="Description" name="description" value={form.description} onChange={handleChange} multiline rows={3} />
              <TextField fullWidth sx={{ mb: 2 }} label="Skills Required" name="skillsRequired" value={form.skillsRequired} onChange={handleChange} multiline rows={2} />
              <TextField fullWidth sx={{ mb: 2 }} label="Project Outcome" name="projectOutcome" value={form.projectOutcome} onChange={handleChange} multiline rows={2} />
              <FormControlLabel
                control={<Switch checked={form.allowWithdrawal} onChange={(e) => setForm({ ...form, allowWithdrawal: e.target.checked })} />}
                label="Allow Student Withdrawal"
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          {editingProject ? (
            <>
              <Button onClick={() => {
                setIsEditingInDialog(false);
                // Reset form to original project data
                setForm({
                  title: editingProject.title,
                  projectId: editingProject.projectId || "",
                  baseDept: editingProject.baseDept || "",
                  description: editingProject.description,
                  skillsRequired: editingProject.skillsRequired || "",
                  projectOutcome: editingProject.projectOutcome || "",
                  guide: editingProject.guide || "",
                  guideEmpId: editingProject.guideEmpId || "",
                  guideDept: editingProject.guideDept || "",
                  coGuide: editingProject.coGuide || "",
                  coGuideEmpId: editingProject.coGuideEmpId || "",
                  coGuideDept: editingProject.coGuideDept || "",
                  allowWithdrawal: editingProject.allowWithdrawal !== undefined ? editingProject.allowWithdrawal : true
                });
              }}>Cancel</Button>
              <Button variant="contained" onClick={handleSubmit}>Save</Button>
            </>
          ) : (
            // Actions for Add Project
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleSubmit}>Create</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* DEPARTMENT SEATS */}
      <Dialog open={seatOpen} onClose={() => setSeatOpen(false)} fullWidth>
        <DialogTitle>Department-wise Seats</DialogTitle>

        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Suggested Departments:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {availableDepts
                .filter(ad => !departments.some(d => d.name === ad.name))
                .map(ad => (
                  <Chip
                    key={ad._id}
                    label={ad.name}
                    onClick={() => addDepartmentFromSuggestion(ad.name)}
                    clickable
                    color="primary"
                    variant="outlined"
                  />
                ))}
            </Box>
          </Box>

          {departments.map((dep, index) => (
            <Box key={index} sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
              <TextField
                label="Department"
                value={dep.name}
                onChange={e =>
                  updateDepartment(index, "name", e.target.value)
                }
              />
              <TextField
                label="Seats"
                type="number"
                value={dep.seats}
                onChange={e =>
                  updateDepartment(index, "seats", Number(e.target.value))
                }
              />
              <IconButton onClick={() => promptDeleteDepartment(index)} color="error">
                <CloseIcon />
              </IconButton>
            </Box>
          ))}

          <Button onClick={addDepartmentRow}>Add Department</Button>

          <Typography sx={{ mt: 2 }}>
            Total Seats (auto): <strong>{totalSeats}</strong>
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setSeatOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveDepartments}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deptDeleteOpen}
        onCancel={() => setDeptDeleteOpen(false)}
        onConfirm={confirmDeleteDepartment}
        title="Confirm Deletion"
        content="Are you sure you want to remove this department?"
        confirmText="Delete"
        confirmColor="error"
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteProject}
        title="Confirm Deletion"
        content="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Confirm Bulk Deletion"
        content={`Are you sure you want to delete ${selectedIds.length} projects? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        loading={actionLoading}
      />

      {/* Faculty Details Dialog */}
      <FacultyDetailsDialog
        open={facultyDetailsOpen}
        onClose={() => setFacultyDetailsOpen(false)}
        facultyName={selectedFacultyName}
      />

      <ConfirmDialog
        open={statusConfirmOpen}
        onCancel={() => setStatusConfirmOpen(false)}
        onConfirm={confirmToggleStatus}
        title="Confirm Status Change"
        content={`Are you sure you want to ${projectToToggle?.status === "Open" ? "close" : "open"} this project?`}
        loading={actionLoading}
      />

    </Box>
  );
}


