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
  Tooltip,
  Menu,
  Divider
} from "@mui/material";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";

import {
  Edit as EditIcon,
  NotificationImportant as NotificationImportantIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  CheckBox as CheckBoxIcon,
  Warning as WarningIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  RateReview as RateReviewIcon,
  Mail as MailIcon,
  MoreVert as MoreVertIcon
} from "@mui/icons-material";
import { useSnackbar } from 'notistack';
import { apiFetch } from '../../core/services/apiFetch';
import DataTable from "../../components/common/DataTable";
import ProjectDetailsDialog from "../../components/common/ProjectDetailsDialog";
import useRequireRole from "../../core/hooks/useRequireRole";
import { ROLES } from "../../core/constants/roles";
import SearchBar from "../../components/common/SearchBar";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StatusChip from "../../components/common/StatusChip";
import PageHeader from "../../components/common/PageHeader";
import EmailSuffixToggle from "../../components/common/EmailSuffixToggle";

export default function AdminStudents(props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const outletContext = useOutletContext();
  const context = props.context || outletContext || {};

  const {
    programsData: programsList = [], setProgramsData: setProgramsList = () => { },
    allDepartmentsData: allDepartments = [], setAllDepartmentsData: setAllDepartments = () => { }
  } = context;
  const [students, setStudents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { authorized, authLoading } = useRequireRole(ROLES.ADMIN);
  const [backgroundLoading, setBackgroundLoading] = useState(false);

  // Load saved filters
  const savedFilters = (() => {
    try {
      return JSON.parse(localStorage.getItem("adminStudentFilters"));
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
      projectFilter: context.navState?.projectId || params.get("projectId") || savedFilters?.appliedFilters?.projectFilter || "All",
      deptFilter: context.navState?.department || params.get("department") || savedFilters?.appliedFilters?.deptFilter || "All",
      statusFilter: savedFilters?.appliedFilters?.statusFilter || "All",
      yearFilter: savedFilters?.appliedFilters?.yearFilter || "All",
      levelFilter: savedFilters?.appliedFilters?.levelFilter || "All",
      isFeePaidFilter: savedFilters?.appliedFilters?.isFeePaidFilter || "All",
      missingDetails: savedFilters?.appliedFilters?.missingDetails || false
    };
  });

  // Draft filter state for dialog
  const [programFilter, setProgramFilter] = useState(appliedFilters.programFilter);
  const [projectFilter, setProjectFilter] = useState(appliedFilters.projectFilter);
  const [deptFilter, setDeptFilter] = useState(appliedFilters.deptFilter);
  const [statusFilter, setStatusFilter] = useState(appliedFilters.statusFilter);
  const [yearFilter, setYearFilter] = useState(appliedFilters.yearFilter);
  const [levelFilter, setLevelFilter] = useState(appliedFilters.levelFilter);
  const [isFeePaidFilter, setIsFeePaidFilter] = useState(appliedFilters.isFeePaidFilter || "All");
  const [missingDetails, setMissingDetails] = useState(appliedFilters.missingDetails);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [yearOptions, setYearOptions] = useState([1, 2, 3, 4]);

  const projectOptions = useMemo(() => [
    { _id: "All", title: "All Projects" },
    { _id: "assigned", title: "Selected" },
    { _id: "unassigned", title: "Not Selected" },
    ...[...projects].sort((a, b) => a.title.localeCompare(b.title))
  ], [projects]);

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.title.localeCompare(b.title)), [projects]);



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

  const [columnVisibility, setColumnVisibility] = useState({
    studentId: true,
    guide: true,
    coGuide: true,
    feePaid: true,
    phone: true,
    project: true,
    interviews: true,
    department: true,
    year: true,
    status: true,
    actions: true
  });
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);

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
    guideDept: "",
    coGuide: "",
    coGuideDept: "",
    status: ""
  });

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedObjectsCache, setSelectedObjectsCache] = useState({});
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const handleSelectAllFiltered = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (appliedFilters.programFilter !== "All") params.append("program", appliedFilters.programFilter);
      if (appliedFilters.projectFilter !== "All") params.append("projectId", appliedFilters.projectFilter);
      if (appliedFilters.deptFilter !== "All") params.append("department", appliedFilters.deptFilter);
      if (appliedFilters.statusFilter !== "All") params.append("status", appliedFilters.statusFilter);
      if (appliedFilters.yearFilter !== "All") params.append("year", appliedFilters.yearFilter);
      if (appliedFilters.levelFilter !== "All") params.append("level", appliedFilters.levelFilter);
      if (appliedFilters.isFeePaidFilter !== "All") params.append("isFeePaid", appliedFilters.isFeePaidFilter);
      if (appliedFilters.missingDetails) params.append("missingDetails", "true");

      params.append("limit", 100000);

      const res = await apiFetch(`/api/admin/students?${params.toString()}`);
      const json = await res.json();
      const allStudents = json.data?.data || json.data || json;

      if (Array.isArray(allStudents)) {
        setSelectedIds(allStudents.map(s => s._id));
        const newEntries = {};
        allStudents.forEach(s => { newEntries[s._id] = s; });
        setSelectedObjectsCache(prev => ({ ...prev, ...newEntries }));
      }
    } catch (err) {
      console.error("Failed to select all students:", err);
    } finally {
      setLoading(false);
    }
  };

  const [viewProject, setViewProject] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [addDialogDepartments, setAddDialogDepartments] = useState([]);
  const [addDialogProjects, setAddDialogProjects] = useState([]);
  const [editDialogDepartments, setEditDialogDepartments] = useState([]);
  const [autoApprove, setAutoApprove] = useState(false);

  /* ================= LOAD PROJECTS (for filters) ================= */

  const fetchProjects = () => {
    if (projects.length > 0) return;
    apiFetch("/api/projects")
      .then(res => res.json())
      .then(data => {
        const extracted = data.data?.data || data.data || data;
        setProjects(Array.isArray(extracted) ? extracted : []);
      })
      .catch(err => console.error("Failed to fetch projects:", err));
  };

  const fetchPrograms = () => {
    if (programsList.length > 0) return;
    apiFetch("/api/admin/programs").then(res => res.json()).then(data => {
      if (Array.isArray(data)) {
        setProgramsList(data);
        const depts = new Map();
        data.forEach(program => {
          program.departments?.forEach(dept => {
            if (!depts.has(dept.name)) {
              depts.set(dept.name, dept);
            }
          });
        });
        setAllDepartments(Array.from(depts.values()).sort((a, b) => a.name.localeCompare(b.name)));
      }
    }).catch(err => console.error("Failed to fetch programs:", err));
  };

  const fetchSettings = () => {
    apiFetch("/api/admin/settings/auto-approve")
      .then(res => res.json())
      .then(data => {
        setAutoApprove(data.autoApprove || false);
      })
      .catch(err => console.error("Failed to fetch auto-approve setting:", err));
  };

  useEffect(() => {
    if (authorized) {
      fetchProjects();
      fetchPrograms();
      fetchSettings();

      const fetchColumnSettings = async () => {
        try {
          const res = await apiFetch("/api/admin/settings");
          if (res.ok) {
            const body = await res.json();
            const settingsArray = Array.isArray(body) ? body : (body.data || []);
            const visibilitySetting = settingsArray.find(s => s.key === "studentColumnVisibility");
            if (visibilitySetting && visibilitySetting.value) {
              setColumnVisibility(prev => ({
                ...prev,
                ...visibilitySetting.value
              }));
            }
          }
        } catch (err) {
          console.error("Failed to load column settings:", err);
        }
      };
      fetchColumnSettings();
    }
  }, [authorized]);

  const handleToggleColumnVisibility = async (key) => {
    const updatedVisibility = {
      ...columnVisibility,
      [key]: !columnVisibility[key]
    };
    setColumnVisibility(updatedVisibility);

    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "studentColumnVisibility",
          value: updatedVisibility
        })
      });
    } catch (err) {
      console.error("Failed to save column settings:", err);
    }
  };

  // Handle incoming navState from dashboard navigation
  useEffect(() => {
    if (context.navState?.projectId) {
      setAppliedFilters(prev => ({ ...prev, projectFilter: context.navState.projectId }));
      setProjectFilter(context.navState.projectId);
      setPage(0);
    }
    if (context.navState?.department) {
      setAppliedFilters(prev => ({ ...prev, deptFilter: context.navState.department }));
      setDeptFilter(context.navState.department);
      setPage(0);
    }
  }, [context.navState]);
  useEffect(() => {
    if (programFilter && programFilter !== "All") {
      const selectedProg = programsList.find(p => p.name === programFilter);
      setFilteredDepartments(selectedProg?.departments || []);
      setYearOptions([...(selectedProg?.eligibleYears || [])].sort((a, b) => Number(a) - Number(b)));
    } else {
      setFilteredDepartments(allDepartments);
      setYearOptions([1, 2, 3, 4]);
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
      const deptSpecificProjects = projects.filter(p =>
        p.status === "Open" &&
        p.departments.some(d => d.name === newStudent.department && d.seats > 0)
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

  /* ================= LOAD STUDENTS ================= */

  const loadStudents = async () => {

    // Construct query params
    const params = new URLSearchParams();
    if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
    if (appliedFilters.programFilter !== "All") params.append("program", appliedFilters.programFilter);
    if (appliedFilters.projectFilter !== "All") params.append("projectId", appliedFilters.projectFilter);
    if (appliedFilters.deptFilter !== "All") params.append("department", appliedFilters.deptFilter);
    if (appliedFilters.statusFilter !== "All") params.append("status", appliedFilters.statusFilter);
    if (appliedFilters.yearFilter !== "All") params.append("year", appliedFilters.yearFilter);
    if (appliedFilters.levelFilter !== "All") params.append("level", appliedFilters.levelFilter);
    if (appliedFilters.isFeePaidFilter !== "All") params.append("isFeePaid", appliedFilters.isFeePaidFilter);
    if (appliedFilters.missingDetails) params.append("missingDetails", "true");

    // Add Pagination
    params.append("page", page + 1);
    params.append("limit", rowsPerPage);

    try {
      setLoading(true);
      const res = await apiFetch(`/api/admin/students?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API error loading students:", {
          status: res.status,
          statusText: res.statusText,
          message: errorData.message || 'No error message provided',
          error: errorData.error,
          details: errorData.details
        });
        throw new Error(errorData.message || res.statusText);
      }
      const json = await res.json();

      if (json.pagination) {
        setStudents(json.data || []);
        setTotalCount(json.pagination.total || 0);
      } else {
        const data = json.data || json;
        setStudents(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) {
      console.error("Caught error in loadStudents:", err);
      enqueueSnackbar(err.message || "Failed to load students", { variant: "error" });
      setStudents([]);
    } finally {
      setLoading(false);
      setBackgroundLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    setPage(0); // Reset page on filter changes before fetching
  }, [authorized, debouncedSearchQuery, appliedFilters]);

  // Use a separate effect that strictly fires on any fetch dependency change
  useEffect(() => {
    if (authorized) {
      loadStudents();
    }
  }, [authorized, debouncedSearchQuery, appliedFilters, page, rowsPerPage]);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("adminStudentFilters", JSON.stringify({ searchQuery, appliedFilters }));
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
    const dept = params.get("department");

    if (pid || dept) {
      setAppliedFilters(prev => ({ ...prev, projectFilter: pid || "All", deptFilter: dept || "All" }));
    }
  }, [location.search]); // Keep this to react to navigation from other pages

  /* ================= ACTIONS ================= */

  const approve = async (id, projectId) => {
    const student = students.find(s => s._id === id);
    if (!student) return;

    // Determine which project to approve
    const targetProjectId = projectId || (student.appliedProject ? student.appliedProject._id : null);

    if (!targetProjectId) {
      enqueueSnackbar("Cannot approve student. No project assigned.", { variant: "warning" });
      return;
    }

    const project = projects.find(p => p._id === (targetProjectId._id || targetProjectId));
    if (project && project.status === "Closed") {
      enqueueSnackbar(`Cannot approve student. The project '${project.title}' is Closed.`, { variant: "error" });
      return;
    }

    const payload = { projectId: (targetProjectId._id || targetProjectId) };

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
      enqueueSnackbar(student.status === 'Approved' ? "Project reassigned" : "Student approved", { variant: "success" });
      // If details dialog is open, we might need to refresh selectedStudent
      if (detailsOpen && selectedStudent?._id === id) {
        // We'll let the listing refresh handle it, or we could manually update selectedStudent
        setDetailsOpen(false);
      }
    } else {
      const data = await res.json();
      enqueueSnackbar(data.message || "Failed to approve student", { variant: "error" });
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
        enqueueSnackbar("Phone number must be 10 digits.", { variant: "warning" });
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
        setNewStudent({ name: "", email: "", phone: "", password: "", year: "", studentId: "", department: "", appliedProject: "", guide: "", guideDept: "", coGuide: "", coGuideDept: "", status: "Pending" });
        loadStudents();
        fetchProjects();
        enqueueSnackbar("Student created successfully", { variant: "success" });
      } else {
        const data = await res.json();
        enqueueSnackbar(data.message || "Failed to create student", { variant: "error" });
      }
    } catch (err) {
      console.error(err);
      enqueueSnackbar("Error creating student", { variant: "error" });
    }
  };

  const openDetailsDialog = (student) => {
    setSelectedStudent(student);
    setStudentForm({
      _id: student._id,
      name: student.name,
      email: student.email,
      phone: student.phone || "",
      year: student.year?.name || student.year || "",
      studentId: student.studentId,
      department: student.department?.name || student.department,
      program: student.program?.name || student.program || "",
      appliedProject: student.appliedProject ? student.appliedProject._id : "",
      guide: student.guide || "",
      guideDept: student.guideDept || "",
      coGuide: student.coGuide || "",
      coGuideDept: student.coGuideDept || "",
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
        enqueueSnackbar("Phone number must be 10 digits.", { variant: "warning" });
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
        enqueueSnackbar("Student updated successfully", { variant: "success" });
      } else {
        enqueueSnackbar("Failed to update student", { variant: "error" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const validateSeats = (projectId, deptName) => {
    if (!projectId) return true;

    const project = projects.find(p => p._id === projectId);
    if (!project) return true;

    if (project.status === "Closed") {
      setWarningMessage(`Project '${project.title}' is Closed. Cannot assign students.`);
      setWarningOpen(true);
      return false;
    }

    if (!deptName) return true;

    // Check if department is assigned to project
    const deptEntry = project.departments?.find(d => d.name === deptName);
    if (!deptEntry) {
      setWarningMessage(`Department '${deptName}' is not assigned to project '${project.title}'.`);
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
        enqueueSnackbar(data.message || "Failed to delete student", { variant: "error" });
      }
    } catch (err) {
      console.error(err);
      enqueueSnackbar("Server error", { variant: "error" });
    }
  };

  /* ================= SELECTION HANDLERS ================= */

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const pageIds = students.map(s => s._id);
      setSelectedIds(pageIds);
      const newEntries = {};
      students.forEach(s => { newEntries[s._id] = s; });
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
        const s = students.find(it => it._id === id);
        if (s) {
          setSelectedObjectsCache(cache => ({ ...cache, [id]: s }));
        }
        return [...prev, id];
      }
    });
  };

  const handleExportSelected = () => {
    const selectedData = selectedIds.map(id => selectedObjectsCache[id]).filter(Boolean);
    if (context.setSection) {
      context.setSection("import-export", { exportData: selectedData, type: "students" });
    } else {
      // Fallback if context is missing
      navigate("/admin/import-export", { state: { exportData: selectedData, type: "students" } });
    }
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
      enqueueSnackbar("Students deleted successfully", { variant: "info" });
    } catch (err) {
      console.error(err);
      enqueueSnackbar("Error deleting students", { variant: "error" });
    }
  };

  const handleSendMail = () => {
    const selectedStudents = selectedIds.map(id => selectedObjectsCache[id]).filter(Boolean);
    if (props.context?.setSection) {
      props.context.setSection('mail', { recipients: selectedStudents });
    } else {
      navigate('/admin/mail', { state: { recipients: selectedStudents } });
    }
  };

  const handleMoveLevel = async (level) => {
    if (selectedIds.length === 0) {
      alert("Please select students to move.");
      return;
    }
    const levelLabel = level === 1 ? "Level 1" : level === 2 ? "Level 2" : `Level ${level}`;

    if (level === 2) {
      const selectedStudentsData = students.filter(s => selectedIds.includes(s._id));
      const pendingStudents = selectedStudentsData.filter(s => s.status === "Pending");
      if (pendingStudents.length > 0) {
        alert(`Cannot move students with 'Pending' status to Level 2. Please approve them first.\n\nPending: ${pendingStudents.map(s => s.name).join(", ")}`);
        return;
      }
    }

    if (!window.confirm(`Are you sure you want to move ${selectedIds.length} students to ${levelLabel}?`)) return;

    setBackgroundLoading(true);
    try {
      const res = await apiFetch("/api/admin/students/move-level", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentIds: selectedIds, level })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to move students");
      }
      alert(`Students moved to ${levelLabel} successfully.`);
      await loadStudents(); // Refresh data
      setSelectedIds([]); // Clear selection
    } catch (err) {
      alert(err.message);
    } finally {
      setBackgroundLoading(false);
    }
  };

  const handleUpdateFeePaid = async (student) => {
    // Optimistic update
    setStudents(prev => prev.map(s => s._id === student._id ? { ...s, isFeePaid: !s.isFeePaid } : s));

    try {
      const res = await apiFetch(`/api/admin/students/${student._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeePaid: !student.isFeePaid })
      });

      if (!res.ok) {
        // Revert on failure
        setStudents(prev => prev.map(s => s._id === student._id ? { ...s, isFeePaid: student.isFeePaid } : s));
        enqueueSnackbar("Failed to update fee status", { variant: "error" });
      }
    } catch (err) {
      console.error(err);
      // Revert on failure
      setStudents(prev => prev.map(s => s._id === student._id ? { ...s, isFeePaid: student.isFeePaid } : s));
      enqueueSnackbar("Error updating fee status", { variant: "error" });
    }
  };

  /* ================= UI ================= */

  const hasRejected = students.some(s => s.status === "Rejected");

  // Filter Handlers
  const handleFilterClick = () => {
    setProjectFilter(appliedFilters.projectFilter);
    setDeptFilter(appliedFilters.deptFilter);
    setStatusFilter(appliedFilters.statusFilter);
    setYearFilter(appliedFilters.yearFilter);
    setLevelFilter(appliedFilters.levelFilter || "All");
    setIsFeePaidFilter(appliedFilters.isFeePaidFilter || "All");
    setMissingDetails(appliedFilters.missingDetails);
    setFilterOpen(true);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      programFilter,
      projectFilter,
      deptFilter,
      statusFilter,
      yearFilter,
      levelFilter,
      isFeePaidFilter,
      missingDetails
    });
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setProgramFilter("All");
    setProjectFilter("All");
    setDeptFilter("All");
    setStatusFilter("All");
    setYearFilter("All");
    setLevelFilter("All");
    setMissingDetails(false);
    setAppliedFilters({
      programFilter: "All",
      projectFilter: "All",
      deptFilter: "All",
      statusFilter: "All",
      yearFilter: "All",
      levelFilter: "All",
      isFeePaidFilter: "All",
      missingDetails: false
    });
    setFilterOpen(false);
  };

  const hasActiveFilters = appliedFilters.programFilter !== "All" ||
    appliedFilters.projectFilter !== "All" ||
    appliedFilters.deptFilter !== "All" ||
    appliedFilters.statusFilter !== "All" ||
    appliedFilters.yearFilter !== "All" ||
    appliedFilters.levelFilter !== "All" ||
    appliedFilters.missingDetails;

  const appliedFilterCount = [
    appliedFilters.programFilter !== "All",
    appliedFilters.projectFilter !== "All",
    appliedFilters.deptFilter !== "All",
    appliedFilters.statusFilter !== "All",
    appliedFilters.yearFilter !== "All",
    appliedFilters.levelFilter !== "All",
    appliedFilters.isFeePaidFilter !== "All",
    appliedFilters.missingDetails
  ].filter(Boolean).length;

  const filtersChanged =
    appliedFilters.programFilter !== programFilter ||
    appliedFilters.projectFilter !== projectFilter ||
    appliedFilters.deptFilter !== deptFilter ||
    appliedFilters.statusFilter !== statusFilter ||
    appliedFilters.yearFilter !== yearFilter ||
    appliedFilters.levelFilter !== levelFilter ||
    appliedFilters.isFeePaidFilter !== isFeePaidFilter ||
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
            <IconButton onClick={(e) => setMoreMenuAnchor(e.currentTarget)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={moreMenuAnchor}
              open={Boolean(moreMenuAnchor)}
              onClose={() => setMoreMenuAnchor(null)}
              PaperProps={{ sx: { minWidth: 200, mt: 1.5 } }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="overline" color="textSecondary" fontWeight="bold">
                  Column Visibility
                </Typography>
              </Box>
              <Divider />
              {[
                { key: 'studentId', label: 'Show ID in Name' },
                { key: 'guide', label: 'Guide Column' },
                { key: 'coGuide', label: 'Co-Guide Column' },
                { key: 'feePaid', label: 'Fee Paid Column' },
                { key: 'phone', label: 'Phone Column' },
                { key: 'project', label: 'Project Column' },
                { key: 'interviews', label: 'Interviews' },
                { key: 'department', label: 'Department' },
                { key: 'year', label: 'Year' },
                { key: 'status', label: 'Status' },
                { key: 'actions', label: 'Action Icons' }
              ].map((col) => (
                <MenuItem
                  key={col.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleColumnVisibility(col.key);
                  }}
                  sx={{ py: 0 }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={columnVisibility[col.key]}
                        onChange={() => handleToggleColumnVisibility(col.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                    label={<Typography variant="body2">{col.label}</Typography>}
                    sx={{ width: '100%', m: 0, py: 1 }}
                  />
                </MenuItem>
              ))}
            </Menu>

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

            {hasRejected && (
              <Button variant="outlined" color="error" onClick={handleClearRejected}>
                Clear Rejected
              </Button>
            )}
            <Button variant="contained" onClick={() => setOpenAdd(true)}>
              Add Student
            </Button>
          </Stack>
        }
      />

      {selectionMode && (
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, bgcolor: "#f5f5f5", p: 1, borderRadius: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ ml: 1 }}>{selectedIds.length} students selected</Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSelectAllFiltered}
            disabled={loading}
          >
            Select All Students ({totalCount})
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleMoveLevel(1)}
                disabled={loading || backgroundLoading}
                color="warning"
              >
                Move {selectedIds.length} to Level 1
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleMoveLevel(2)}
                disabled={loading || backgroundLoading}
              >
                Move {selectedIds.length} to Level 2
              </Button>
              <Button variant="contained" size="small" color="info" startIcon={<MailIcon />} onClick={handleSendMail}>
                Send Mail
              </Button>
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

      {/* TABLE */}
      <DataTable
        columns={[
          {
            id: "name", label: "Student Info", minWidth: 200, render: (s) => (
              <Box sx={{ cursor: "pointer" }} onClick={() => openDetailsDialog(s)}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ color: "primary.main", fontWeight: "bold" }}>{s.name}</Typography>
                  {s.status === 'Pending' && s.appliedProject && (
                    <Tooltip title="Approval Request Pending">
                      <NotificationImportantIcon color="warning" fontSize="small" />
                    </Tooltip>
                  )}
                </Stack>
                {columnVisibility.studentId && (
                  <Typography variant="caption" color="textSecondary">
                    {s.studentId || "-"}
                  </Typography>
                )}
              </Box>
            )
          },
          ...(columnVisibility.guide ? [{
            id: "guide", label: "Guide", minWidth: 150, render: (s) => {
              const name = s.appliedProject?.guide || s.guide || "-";
              const dept = s.appliedProject?.guideDept?.name || s.appliedProject?.guideDept || s.guideDept || "";
              return (
                <Box>
                  <Typography noWrap sx={{ maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden' }} title={name}>{name}</Typography>
                  {dept && <Typography variant="caption" color="textSecondary">{dept}</Typography>}
                </Box>
              );
            }
          }] : []),
          ...(columnVisibility.coGuide ? [{
            id: "coGuide", label: "Co-Guide", minWidth: 150, render: (s) => {
              const name = s.appliedProject?.coGuide || s.coGuide || "-";
              const dept = s.appliedProject?.coGuideDept?.name || s.appliedProject?.coGuideDept || s.coGuideDept || "";
              return (
                <Box>
                  <Typography noWrap sx={{ maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden' }} title={name}>{name}</Typography>
                  {dept && <Typography variant="caption" color="textSecondary">{dept}</Typography>}
                </Box>
              );
            }
          }] : []),
          ...(columnVisibility.feePaid ? [{
            id: "feePaid", label: "Fee Paid", minWidth: 80, render: (s) => (
              <Tooltip title={s.isFeePaid ? "Fee Paid" : "Fee Not Paid"}>
                <IconButton onClick={(e) => { e.stopPropagation(); handleUpdateFeePaid(s); }} size="small">
                  {s.isFeePaid ? <CheckCircleIcon color="success" /> : <CloseIcon color="error" />}
                </IconButton>
              </Tooltip>
            )
          }] : []),
          ...(columnVisibility.phone ? [{ id: "phone", label: "Phone", minWidth: 120, render: (s) => s.phone || "-" }] : []),
          ...(columnVisibility.project ? [{
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
                  {totalApps > 1 && s.level !== 2 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5 }}>
                      {hasApplied ? `+ ${appCount} more choice(s)` : 'Multiple choices pending'}
                    </Typography>
                  )}
                </Box>
              );
            }
          }] : []),
          ...(columnVisibility.interviews ? [{
            id: "interviews",
            label: "Interviews",
            minWidth: 150,
            render: (s) => {
              const appCount = (s.applications || []).length;
              const qualifiedCount = (s.applications || []).filter(a => a.status === 'Qualified').length;
              return (
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {appCount > 0 ? `${appCount} Projects` : "None"}
                  </Typography>
                  {qualifiedCount > 0 && (
                    <Chip
                      label={`${qualifiedCount} Qualified`}
                      size="small"
                      color="success"
                      sx={{ height: 16, fontSize: '0.65rem', mt: 0.5 }}
                    />
                  )}
                </Box>
              );
            }
          }] : []),
          ...(columnVisibility.department ? [{ id: "department", label: "Department", minWidth: 150, render: (s) => s.department?.name || s.department || "-" }] : []),
          ...(columnVisibility.year ? [{ id: "year", label: "Year", minWidth: 80, render: (s) => s.year?.name || s.year || "-" }] : []),
          ...(columnVisibility.status ? [{
            id: "status", label: "Status", minWidth: 150, render: (s) => (
              <StatusChip status={s.status} level={s.level} />
            )
          }] : []),

          ...(columnVisibility.actions ? [{
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
          }] : [])
        ]}
        rows={students}
        loading={loading}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectOne={handleSelectOne}
        emptyMessage="No students found matching filters."
        sx={{ mb: backgroundLoading ? 0 : 3 }}
        fixedLayout={false}
        serverSide={true}
        totalCount={totalCount}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(e, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      >
        {backgroundLoading && (
          <TableRow>
            <TableCell colSpan={selectionMode ? 9 : 8} align="center" sx={{ py: 2 }}>
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
                  setDeptFilter("All"); // Reset department when program changes
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
              <InputLabel>Department</InputLabel>
              <Select
                value={deptFilter}
                label="Department"
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <MenuItem value="All">All Departments</MenuItem>
                {filteredDepartments.map(d => (
                  <MenuItem key={d._id} value={d.name}>{d.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Year</InputLabel>
              <Select value={yearFilter} label="Year" onChange={(e) => setYearFilter(e.target.value)}>
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
            <FormControl size="small" fullWidth>
              <InputLabel>Fee Status</InputLabel>
              <Select value={isFeePaidFilter} label="Fee Status" onChange={(e) => setIsFeePaidFilter(e.target.value)}>
                <MenuItem value="All">All Students</MenuItem>
                <MenuItem value="true">Paid</MenuItem>
                <MenuItem value="false">Not Paid</MenuItem>
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
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <EmailSuffixToggle
                    value={newStudent.email}
                    onChange={(val) => setNewStudent(prev => ({ ...prev, email: val }))}
                  />
                </InputAdornment>
              )
            }}
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
              {[...(programsList.find(p => p.name === newStudent.program)?.eligibleYears || [])].sort((a, b) => Number(a) - Number(b)).map(y => (
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
          <TextField label="Guide" name="guide" value={newStudent.guide} onChange={handleAddChange} fullWidth />
          <Autocomplete options={allDepartments.map(d => d.name)} value={newStudent.guideDept} onChange={(e, val) => setNewStudent({ ...newStudent, guideDept: val || "" })} freeSolo renderInput={(params) => <TextField {...params} label="Guide Dept" fullWidth />} />
          <TextField label="Co-Guide" name="coGuide" value={newStudent.coGuide} onChange={handleAddChange} fullWidth />
          <Autocomplete options={allDepartments.map(d => d.name)} value={newStudent.coGuideDept} onChange={(e, val) => setNewStudent({ ...newStudent, coGuideDept: val || "" })} freeSolo renderInput={(params) => <TextField {...params} label="Co-Guide Dept" fullWidth />} />
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
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <TextField label="Guide" name="guide" value={studentForm.guide} onChange={handleFormChange} fullWidth />
                  <Autocomplete options={allDepartments.map(d => d.name)} value={studentForm.guideDept} onChange={(e, val) => setStudentForm({ ...studentForm, guideDept: val || "" })} freeSolo renderInput={(params) => <TextField {...params} label="Guide Dept" fullWidth />} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <TextField label="Co-Guide" name="coGuide" value={studentForm.coGuide} onChange={handleFormChange} fullWidth />
                  <Autocomplete options={allDepartments.map(d => d.name)} value={studentForm.coGuideDept} onChange={(e, val) => setStudentForm({ ...studentForm, coGuideDept: val || "" })} freeSolo renderInput={(params) => <TextField {...params} label="Co-Guide Dept" fullWidth />} />
                </Box>
                <TextField label="Phone Number" name="phone" value={studentForm.phone} onChange={handleFormChange} fullWidth required />
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={studentForm.email}
                  onChange={handleFormChange}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <EmailSuffixToggle
                          value={studentForm.email}
                          onChange={(val) => setStudentForm(prev => ({ ...prev, email: val }))}
                        />
                      </InputAdornment>
                    )
                  }}
                />
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
                    {[...(programsList.find(p => p.name === studentForm.program)?.eligibleYears || [])].sort((a, b) => Number(a) - Number(b)).map(y => (<MenuItem key={y} value={String(y)}>{y}</MenuItem>))}
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
                <Box sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2
                }}>
                  <Box><Typography variant="subtitle2" color="textSecondary">Student ID</Typography><Typography variant="body1">{selectedStudent.studentId}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Email</Typography><Typography variant="body1">{selectedStudent.email}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Phone</Typography><Typography variant="body1">{selectedStudent.phone || "-"}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Department</Typography><Typography variant="body1">{selectedStudent.department?.name || selectedStudent.department || "-"}</Typography></Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Guide</Typography>
                    <Typography variant="body1">{selectedStudent.appliedProject?.guide || selectedStudent.guide || "-"}</Typography>
                    {(selectedStudent.appliedProject?.guideDept || selectedStudent.guideDept) && (
                      <Typography variant="caption" color="textSecondary">Dept: {selectedStudent.appliedProject?.guideDept?.name || selectedStudent.appliedProject?.guideDept || selectedStudent.guideDept}</Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Co-Guide</Typography>
                    <Typography variant="body1">{selectedStudent.appliedProject?.coGuide || selectedStudent.coGuide || "-"}</Typography>
                    {(selectedStudent.appliedProject?.coGuideDept || selectedStudent.coGuideDept) && (
                      <Typography variant="caption" color="textSecondary">Dept: {selectedStudent.appliedProject?.coGuideDept?.name || selectedStudent.appliedProject?.coGuideDept || selectedStudent.coGuideDept}</Typography>
                    )}
                  </Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Year</Typography><Typography variant="body1">{selectedStudent.year || "-"}</Typography></Box>
                  <Box><Typography variant="subtitle2" color="textSecondary">Status</Typography>
                    <StatusChip status={selectedStudent.status} level={selectedStudent.level} />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>Applied Projects ({(selectedStudent.appliedProject ? 1 : 0) + (selectedStudent.projectApplications?.length || 0)}/5)</Typography>
                  <Stack spacing={1}>
                    {[selectedStudent.appliedProject, ...(selectedStudent.projectApplications || [])].filter(Boolean).map((p, idx) => {
                      const appInfo = (selectedStudent.applications || []).find(a => String(a.project?._id || a.project) === String(p._id));
                      const interviewStatus = appInfo?.status || "Pending";

                      return (
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
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="caption" color="text.secondary">Priority {idx + 1}</Typography>
                              <Chip
                                label={interviewStatus}
                                size="small"
                                sx={{ height: 16, fontSize: '0.6rem' }}
                                color={interviewStatus === 'Qualified' ? 'success' : (interviewStatus === 'Rejected' ? 'error' : 'default')}
                              />
                            </Stack>
                            {appInfo?.interviewNote && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                                Note: {appInfo.interviewNote}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {selectedStudent.status === 'Approved' && String(selectedStudent.appliedProject?._id || selectedStudent.appliedProject) === String(p._id) ? (
                              <Chip label="Current" size="small" color="primary" variant="filled" sx={{ height: 20, fontSize: '0.65rem' }} />
                            ) : (
                              <>
                                <Button
                                  size="tiny"
                                  variant="contained"
                                  color={interviewStatus === 'Qualified' ? 'success' : 'primary'}
                                  sx={{ height: 20, fontSize: '0.6rem', py: 0, minWidth: 60 }}
                                  onClick={() => approve(selectedStudent._id, p._id)}
                                >
                                  {selectedStudent.status === 'Approved' ? 'Assign' : 'Approve'}
                                </Button>
                              </>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
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
              {selectedStudent && (
                <Button variant="outlined" color="error" onClick={() => { setDetailsOpen(false); handleDeleteStudent(selectedStudent._id); }}>
                  Remove
                </Button>
              )}
              <Box sx={{ flex: '1 1 auto' }} />
              {selectedStudent?.status === "Pending" && autoApprove === false && (
                <>
                  <Button size="small" variant="contained" onClick={() => approve(selectedStudent._id)} sx={{ mr: 1 }}>Approve</Button>
                  <Button size="small" color="error" onClick={() => reject(selectedStudent._id)}>Reject</Button>
                </>
              )}
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
    </Box >
  );
}


