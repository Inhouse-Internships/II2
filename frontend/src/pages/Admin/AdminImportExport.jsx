import { apiFetch } from '../../core/services/apiFetch';
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  Tabs,
  Tab,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  ListItemText,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  IconButton,
  LinearProgress,
  CircularProgress,
  TextField
} from "@mui/material";
import {
  Download as DownloadIcon,
  UploadFile as UploadFileIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon
} from "@mui/icons-material";

// import * as XLSX from "xlsx"; // XLSX is now lazy-loaded in functions that use it
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import useRequireRole from "../../core/hooks/useRequireRole";
import { ROLES } from "../../core/constants/roles";
import { UNIVERSITY_EMAIL_DOMAIN } from "../../core/constants/app";
import PageHeader from "../../components/common/PageHeader";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import ResolveDepartmentsDialog from "../../components/common/ResolveDepartmentsDialog";

export default function AdminImportExport(props) {
  const location = useLocation();
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const context = props.context || outletContext || {};

  const {
    studentsData: students = [], setStudentsData: setStudents = () => { },
    projectsData: importProjectsList = [], setProjectsData: setImportProjectsList = () => { },
    programsData: programsList = [], setProgramsData: setProgramsList = () => { },
    allDepartmentsData: dbDepartmentsData = [], setAllDepartmentsData: setDbDepartmentsData = () => { }
  } = context;

  const dbDepartments = dbDepartmentsData.map(d => d.name);
  const { authorized, authLoading } = useRequireRole(ROLES.ADMIN);

  const [exportFormat, setExportFormat] = useState("excel");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Import Preview State
  const [importData, setImportData] = useState([]);
  const [importType, setImportType] = useState("");
  const [columnMapping, setColumnMapping] = useState({});
  const [fileHeaders, setFileHeaders] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [selectedMapDept, setSelectedMapDept] = useState("");
  const [projectIdForTasks, setProjectIdForTasks] = useState(context.navState?.projectId || location.state?.projectId || "");
  const [projectIdForExport, setProjectIdForExport] = useState("all");
  const [tabValue, setTabValue] = useState(() => {
    if (context.navState?.tab !== undefined) return context.navState.tab;
    if (location.state?.tab !== undefined) return location.state.tab;
    const saved = localStorage.getItem("adminImportExportTab");
    return saved ? parseInt(saved, 10) : 0;
  });

  // Progress State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Sheet Selection State
  const [workbook, setWorkbook] = useState(null);
  const [sheetSelectionOpen, setSheetSelectionOpen] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState([]);

  // Custom Export State (from Select & Export)
  const [customData, setCustomData] = useState(context.navState?.exportData || location.state?.exportData || null);
  const [customType, setCustomType] = useState(context.navState?.type || location.state?.type || "");
  const [availableCols, setAvailableCols] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [deptOptions, setDeptOptions] = useState([]);
  const [selectedDept, setSelectedDept] = useState(["All"]);

  const [deptMappingOpen, setDeptMappingOpen] = useState(false);
  const [unrecognizedDepts, setUnrecognizedDepts] = useState([]);
  const [pendingImportData, setPendingImportData] = useState(null);
  const [newProgramModalOpen, setNewProgramModalOpen] = useState(false);
  const [newProgramData, setNewProgramData] = useState({ name: "", duration: 4 });
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [splitByDept, setSplitByDept] = useState(false);

  // Task Date Validation State
  const [internshipSettings, setInternshipSettings] = useState(null);
  const [taskValidationOpen, setTaskValidationOpen] = useState(false);
  const [taskIssues, setTaskIssues] = useState([]); // { index: number, task: any, issue: string, suggested: string, field: string }
  const [validatingTasks, setValidatingTasks] = useState(false);

  const IMPORT_FIELDS = {
    students: ["Name", "Email", "Phone", "StudentID", "Department", "Program", "Password", "Project", "Year", "Status", "Guide", "Guide Dept", "Co-Guide", "Co-Guide Dept"],
    projects: ["Title", "Project ID", "Base Dept", "Description", "Skills Required", "Project Outcome", "Departments", "Status", "Specific Dept", "Guide", "Guide Emp ID", "Guide Dept", "Co-Guide", "Co-Guide Emp ID", "Co-Guide Dept"],
    tasks: ["Title", "Start Date", "Deadline"]
  };

  const REQUIRED_FIELDS = {
    students: ["Name", "Department", "Program", "Year", "Phone"],
    projects: ["Title", "Base Dept", "Description", "Departments"],
    tasks: ["Title", "Start Date"]
  };

  useEffect(() => {
    if (customData && customType === "projects") {
      const depts = new Set();
      customData.forEach(p => p.departments?.forEach(d => depts.add(d.name)));
      setDeptOptions(Array.from(depts).sort());

      const cols = [
        { key: "Title", label: "Title", accessor: p => p.title },
        { key: "ProjectID", label: "Project ID", accessor: p => p.projectId || "" },
        { key: "BaseDept", label: "Base Dept", accessor: p => p.baseDept || "" },
        { key: "Description", label: "Description", accessor: p => p.description },
        { key: "SkillsRequired", label: "Skills Required", accessor: p => p.skillsRequired || "" },
        { key: "ProjectOutcome", label: "Project Outcome", accessor: p => p.projectOutcome || "" },
        { key: "Guide", label: "Guide", accessor: p => p.guide || "" },
        { key: "GuideEmpID", label: "Guide Emp ID", accessor: p => p.guideEmpId || "" },
        { key: "GuideDept", label: "Guide Dept", accessor: p => p.guideDept || "" },
        { key: "CoGuide", label: "Co-Guide", accessor: p => p.coGuide || "" },
        { key: "CoGuideEmpID", label: "Co-Guide Emp ID", accessor: p => p.coGuideEmpId || "" },
        { key: "CoGuideDept", label: "Co-Guide Dept", accessor: p => p.coGuideDept || "" },
        { key: "Status", label: "Status", accessor: p => p.status },
        { key: "TotalSeats", label: "Total Seats", accessor: p => p.totalSeats },
        { key: "Registered", label: "Registered", accessor: p => p.registeredCount },
        { key: "AvailableSeats", label: "Available Seats", accessor: p => (p.totalSeats || 0) - (p.registeredCount || 0) },
        { key: "Departments", label: "Departments", accessor: p => p.departments.map(d => `${d.name} (${d.seats})`).join("; ") },
        { key: "StudentNames", label: "Student Names", accessor: p => p.studentNames || "" },
        { key: "StudentIDs", label: "Student IDs", accessor: p => p.studentIds || "" },
        { key: "StudentDepts", label: "Student Depts", accessor: p => p.studentDepts || "" },
        { key: "StudentPhones", label: "Student Phones", accessor: p => p.studentPhones || "" }
      ];
      setAvailableCols(cols);
      setSelectedCols(cols.map(c => c.key)); // Default select all
    } else if (customData && customType === "students") {
      const cols = [
        { key: "Name", label: "Name", accessor: s => s.name },
        { key: "Project", label: "Project", accessor: s => s.appliedProject?.title || "Not Selected" },
        { key: "StudentID", label: "Student ID", accessor: s => s.studentId },
        { key: "Department", label: "Department", accessor: s => s.department },
        { key: "Phone", label: "Phone", accessor: s => s.phone || "" },
        { key: "Email", label: "Email", accessor: s => s.email },
        { key: "Status", label: "Status", accessor: s => `${s.status || "Pending"}${s.status !== 'Rejected' ? ` L${s.level || 1}` : ''}` },
        { key: "Year", label: "Year", accessor: s => s.year || "" },
        { key: "Guide", label: "Guide", accessor: s => s.appliedProject?.guide || s.guide || "" },
        { key: "GuideEmpID", label: "Guide Emp ID", accessor: s => s.appliedProject?.guideEmpId || "" },
        { key: "GuideDept", label: "Guide Dept", accessor: s => s.appliedProject?.guideDept || s.guideDept || "" },
        { key: "CoGuide", label: "Co-Guide", accessor: s => s.appliedProject?.coGuide || s.coGuide || "" },
        { key: "CoGuideEmpID", label: "Co-Guide Emp ID", accessor: s => s.appliedProject?.coGuideEmpId || "" },
        { key: "CoGuideDept", label: "Co-Guide Dept", accessor: s => s.appliedProject?.coGuideDept || s.coGuideDept || "" }
      ];
      setAvailableCols(cols);
      setSelectedCols(cols.map(c => c.key));
    } else if (customData && customType === "departments-overview") {
      const depts = new Set();
      customData.forEach(p => p.departments?.forEach(d => depts.add(d.name)));
      setDeptOptions(Array.from(depts).sort());

      const cols = [
        { key: "Project", label: "Project", accessor: p => p.projectTitle },
        { key: "Status", label: "Status", accessor: p => p.status },
        { key: "TotalRegistered", label: "Total Registered", accessor: p => p.projectTotalRegistered },
        { key: "TotalSeats", label: "Total Seats", accessor: p => p.projectTotalSeats },
        { key: "Departments", label: "Departments", accessor: p => p.departments.map(d => `${d.name}: ${d.registered}/${d.total}`).join("; ") }
      ];
      setAvailableCols(cols);
      setSelectedCols(cols.map(c => c.key));
    }
  }, [customData, customType]);

  useEffect(() => {
    if (!authorized) return;
    const enrichProjects = async () => {
      if (customType === "projects" && customData && customData.length > 0 && customData[0].studentNames === undefined) {
        try {
          const res = await apiFetch("/api/admin/students");
          if (res.ok) {
            const json = await res.json();
            const students = json.data || json;
            setCustomData(prev => prev.map(p => {
              const projectStudents = students.filter(s =>
                s.appliedProject && (s.appliedProject._id === p._id || s.appliedProject === p._id)
              );
              return {
                ...p,
                studentNames: projectStudents.map(s => s.name).join(", "),
                studentIds: projectStudents.map(s => s.studentId).join(", "),
                studentDepts: projectStudents.map(s => s.department || "").join(", "),
                studentPhones: projectStudents.map(s => s.phone || "").join(", ")
              };
            }));
          }
        } catch (err) {
          // Silent catch for enrichment
        }
      }
    };
    enrichProjects();
  }, [authorized, customData, customType]);

  useEffect(() => {
    if (!authorized) return;
    if (dbDepartmentsData.length === 0) {
      fetchDepartments();
    }
    if (importProjectsList.length === 0) {
      apiFetch("/api/projects?limit=1000")
        .then(r => r.json())
        .then(data => {
          const extracted = data.data?.data || data.data || data;
          setImportProjectsList(Array.isArray(extracted) ? extracted : []);
        });
    }
    if (programsList.length === 0) {
      fetchPrograms();
    }
    fetchInternshipSettings();
  }, [authorized]);

  const fetchDepartments = async () => {
    try {
      const res = await apiFetch("/api/admin/all-db-departments");
      if (res.ok) {
        setDbDepartmentsData(await res.json());
      }
    } catch (err) {
      console.error("Failed to refresh departments:", err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await apiFetch("/api/admin/programs");
      if (res.ok) {
        setProgramsList(await res.json());
      }
    } catch (err) {
      console.error("Failed to refresh programs:", err);
    }
  };

  const fetchInternshipSettings = () => {
    apiFetch("/api/admin/settings/internship").then(async (r) => {
      if (r.ok) {
        setInternshipSettings(await r.json());
      }
    }).catch(() => { });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    localStorage.setItem("adminImportExportTab", newValue);
  };

  const downloadFile = (data, baseFilename) => {
    if (!data || (Array.isArray(data) && !data.length)) {
      alert("No data to export");
      return;
    }

    if (exportFormat === "excel") {
      import("xlsx").then((XLSX) => {
        const workbook = XLSX.utils.book_new();

        if (Array.isArray(data)) {
          const worksheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        } else {
          // data is { sheetName1: [rows], sheetName2: [rows] }
          Object.entries(data).forEach(([sheetName, rows]) => {
            if (rows && rows.length > 0) {
              const worksheet = XLSX.utils.json_to_sheet(rows);
              // Sheet names must be <= 31 chars and no special chars
              const safeName = sheetName.replace(/[\[\]\*\?\/\\]/g, "").substring(0, 31);
              XLSX.utils.book_append_sheet(workbook, worksheet, safeName || "Sheet");
            }
          });

          if (workbook.SheetNames.length === 0) {
            alert("No sheets to export");
            return;
          }
        }

        XLSX.writeFile(workbook, `${baseFilename}.xlsx`);
      });
    } else {
      // CSV Export
      let exportRows = data;
      if (!Array.isArray(data)) {
        // Flatten object into array with Sheet column for CSV
        exportRows = [];
        Object.entries(data).forEach(([sheetName, rows]) => {
          rows.forEach(row => exportRows.push({ Sheet: sheetName, ...row }));
        });
      }

      if (exportRows.length === 0) {
        alert("No data to export");
        return;
      }

      const headers = Object.keys(exportRows[0]);
      const csvContent = [
        headers.join(","),
        ...exportRows.map(row => headers.map(fieldName => {
          let value = row[fieldName];
          if (value === null || value === undefined) value = "";
          const stringValue = String(value).replace(/"/g, '""'); // Escape double quotes
          return `"${stringValue}"`; // Wrap in quotes to handle commas
        }).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${baseFilename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportStudents = async () => {
    try {
      const res = await apiFetch("/api/admin/students");
      if (!res.ok) throw new Error("Failed to fetch students");
      const json = await res.json();
      const data = json.data || json;

      setCustomData(data);
      setCustomType("students");
    } catch (err) {
      console.error(err);
      alert("Failed to export students");
    }
  };

  const exportProjects = async () => {
    try {
      const [projectsRes, studentsRes] = await Promise.all([
        apiFetch("/api/projects"),
        apiFetch("/api/admin/students")
      ]);

      const projectsJson = await projectsRes.json();
      const projects = projectsJson.data || projectsJson;
      const studentsJson = await studentsRes.json();
      const students = studentsJson.data || studentsJson;
      const projectsWithStudents = projects.map(p => {
        const projectStudents = students.filter(s =>
          s.appliedProject && (s.appliedProject._id === p._id || s.appliedProject === p._id)
        );
        return {
          ...p,
          studentNames: projectStudents.map(s => s.name).join(", "),
          studentIds: projectStudents.map(s => s.studentId).join(", "),
          studentDepts: projectStudents.map(s => s.department || "").join(", "),
          studentPhones: projectStudents.map(s => s.phone || "").join(", ")
        };
      });
      setCustomData(projectsWithStudents);
      setCustomType("projects");
    } catch (err) {
      alert("Failed to export projects");
    }
  };

  const exportTasks = async () => {
    try {
      const url = projectIdForExport === "all" ? "/api/tasks/admin/export-all" : `/api/tasks/admin/export-all?projectId=${projectIdForExport}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();

      const flattenedTasks = data.map(t => ({
        Title: t.title,
        Description: t.description || "",
        "Start/Day": t.startDate || "-",
        "Deadline/Day": t.deadline || "-",
        "Project Title": t.project?.title || "Unknown",
        "Editable By HOD": t.editableByHOD ? "True" : "False",
        "Assigned Days": t.assignedDays?.map(d => new Date(d).toLocaleDateString()).join(", ") || ""
      }));

      downloadFile(flattenedTasks, `all_tasks_export_${new Date().toISOString().split('T')[0]}`);
    } catch (err) {
      console.error(err);
      alert("Failed to export tasks");
    }
  };

  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(fileExtension)) {
      alert("Invalid file type. Please upload .xlsx, .xls, or .csv");
      event.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const XLSX = await import("xlsx");
        const wb = XLSX.read(data, { type: "array" });
        setWorkbook(wb);
        setImportType(type);

        if (wb.SheetNames.length > 1) {
          // Auto-exclude common irrelevant sheets
          const relevantSheets = wb.SheetNames.filter(name =>
            !["Sheet1", "Sheet2", "Sheet3", "STATUS", "BRANCH-COUNT", "METADATA", "LOGS"].includes(name.toUpperCase())
          );
          setSelectedSheets(relevantSheets.length > 0 ? relevantSheets : [wb.SheetNames[0]]);
          setSheetSelectionOpen(true);
        } else {
          processSheets(wb, [wb.SheetNames[0]], type);
        }
      } catch (err) {
        console.error("Error reading file:", err);
        alert("Failed to read file.");
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  };

  const processSheets = async (wb, sheetNames, type) => {
    const XLSX = await import("xlsx");
    let combinedData = [];
    let allHeaders = new Set();

    sheetNames.forEach(name => {
      const worksheet = wb.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Trim keys in jsonData to match the trimmed headers in allHeaders
      const rows = jsonData.map(row => {
        const newRow = {};
        Object.entries(row).forEach(([key, value]) => {
          newRow[String(key).trim()] = value;
        });
        return {
          ...newRow,
          __sheetName: name
        };
      });

      combinedData = [...combinedData, ...rows];

      // Get headers from this sheet
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (sheetRows.length > 0) {
        (sheetRows[0] || []).forEach(h => {
          if (h) allHeaders.add(String(h).trim());
        });
      }
    });

    if (combinedData.length > 0) {
      const headers = Array.from(allHeaders).filter(h => h !== "");
      setFileHeaders(headers);

      // Auto-map columns
      const initialMapping = {};
      IMPORT_FIELDS[type].forEach(field => {
        const match = headers.find(h => h.toLowerCase() === field.toLowerCase()) || "";
        initialMapping[field] = match;
      });
      setColumnMapping(initialMapping);

      setImportData(combinedData);
      setSheetSelectionOpen(false);
    } else {
      alert("No data found in selected sheets.");
    }
  };

  const handleHeaderClick = (header) => {
    if (activeField) {
      if (activeField === "Specific Dept") {
        if (!selectedMapDept) {
          alert("Please select a department from the dropdown above the file columns.");
          return;
        }
        setColumnMapping(prev => {
          const current = prev[activeField];
          const currentArray = Array.isArray(current) ? current : (current ? [current] : []);
          // Remove existing mapping for this specific department if it exists (overwrite)
          const filtered = currentArray.filter(item => typeof item === 'object' ? item.dept !== selectedMapDept : item !== header);

          return { ...prev, [activeField]: [...filtered, { dept: selectedMapDept, col: header }] };
        });
      } else {
        setColumnMapping(prev => ({ ...prev, [activeField]: header }));
        setActiveField(null);
      }
    } else {
      alert("Please select a System Field box first.");
    }
  };

  const clearImportMode = () => {
    setImportData([]);
    setImportType("");
    setColumnMapping({});
    setFileHeaders([]);
    setActiveField(null);
    setSelectedMapDept("");
  };

  const performImport = async () => {
    // Validate required fields
    const required = REQUIRED_FIELDS[importType] || [];
    const missing = required.filter(field => !columnMapping[field]);

    if (importType === "students") {
      if (!columnMapping["Email"] && !columnMapping["StudentID"]) {
        missing.push("Email OR StudentID");
      }
    }

    if (missing.length > 0) {
      alert(`Please map the following required columns before importing:\n- ${missing.join("\n- ")}`);
      return;
    }

    // Transform data based on mapping
    const mappedData = importData.map(row => {
      const newRow = {};
      Object.entries(columnMapping).forEach(([sysField, fileHeader]) => {
        if (sysField === "Specific Dept" && Array.isArray(fileHeader)) {
          const parts = [];
          fileHeader.forEach(mapping => {
            if (mapping && mapping.dept && mapping.col) {
              const val = row[mapping.col];
              if (val !== undefined && val !== null && val !== "") {
                parts.push(`${mapping.dept}:${val}`);
              }
            }
          });
          if (parts.length > 0) {
            const existing = newRow["Departments"] ? newRow["Departments"] + ";" : "";
            newRow["Departments"] = existing + parts.join(";");
          }
        } else if (fileHeader && !Array.isArray(fileHeader)) {
          newRow[sysField] = row[fileHeader];
        }
      });

      if (importType === "students") {
        // 1. Email / StudentID logic
        if (!newRow["Email"] && newRow["StudentID"]) {
          newRow["Email"] = `${newRow["StudentID"]}${UNIVERSITY_EMAIL_DOMAIN}`;
        } else if (!newRow["StudentID"] && newRow["Email"]) {
          const emailStr = String(newRow["Email"]);
          const parts = emailStr.split("@");
          newRow["StudentID"] = parts[0];
        }

        // 2. Project / Status
        if (!newRow["Project"] && !newRow["Status"]) {
          newRow["Status"] = "Pending";
        }

        return {
          name: newRow["Name"],
          email: newRow["Email"],
          phone: newRow["Phone"],
          studentId: newRow["StudentID"],
          program: newRow["Program"],
          department: newRow["Department"],
          password: newRow["Password"],
          project: newRow["Project"],
          year: newRow["Year"],
          status: newRow["Status"],
          guide: newRow["Guide"],
          guideDept: newRow["Guide Dept"],
          coGuide: newRow["Co-Guide"],
          coGuideDept: newRow["Co-Guide Dept"]
        };
      } else if (importType === "projects") {
        // Auto-fill Base Dept from sheet name if mapped field is empty
        if (!newRow["Base Dept"] && row.__sheetName) {
          // Only use if sheet name is not a generic "SheetX"
          if (!/^Sheet\d+$/i.test(row.__sheetName)) {
            newRow["Base Dept"] = row.__sheetName;
          }
        }

        // Auto-fill Departments from sheet name if empty
        if (!newRow["Departments"] && !newRow["Specific Dept"] && row.__sheetName) {
          if (!/^Sheet\d+$/i.test(row.__sheetName)) {
            // Basic format - might need seats, but 1 is a safe fallback or just name
            newRow["Departments"] = row.__sheetName;
          }
        }

        // Normalize keys for backend bulkImportProjects
        return {
          title: newRow["Title"],
          projectId: newRow["Project ID"],
          baseDept: newRow["Base Dept"],
          description: newRow["Description"],
          skillsRequired: newRow["Skills Required"],
          projectOutcome: newRow["Project Outcome"],
          departments: newRow["Departments"],
          status: newRow["Status"],
          guide: newRow["Guide"],
          guideEmpId: newRow["Guide Emp ID"],
          guideDept: newRow["Guide Dept"],
          coGuide: newRow["Co-Guide"],
          coGuideEmpId: newRow["Co-Guide Emp ID"],
          coGuideDept: newRow["Co-Guide Dept"],
          allowWithdrawal: true
        };
      }

      return newRow;
    });

    if (importType === "tasks") {
      const { validated, issues } = validateTaskDates(mappedData);
      if (issues.length > 0) {
        setTaskIssues(issues);
        setPendingImportData(validated);
        setTaskValidationOpen(true);
        return;
      }
      await finalizeImport(validated);
      return;
    }

    // Check for unrecognized departments in project import
    if (importType === "projects") {
      const foundDepts = new Set();
      mappedData.forEach(row => {
        const deptStr = row["Departments"] || "";
        // Parse format Name1:Seats1;Name2:Seats2
        deptStr.split(';').forEach(part => {
          const [name] = part.split(':');
          if (name && name.trim()) foundDepts.add(name.trim());
        });
      });

      const unrecognized = Array.from(foundDepts).filter(name => !dbDepartments.includes(name));

      if (unrecognized.length > 0) {
        setUnrecognizedDepts(unrecognized);
        setPendingImportData(mappedData);
        setDeptMappingOpen(true);
        return; // Wait for user to resolve departments
      }
    }

    await finalizeImport(mappedData);
  };

  const finalizeImport = async (mappedData, overrideDeptMap = null) => {
    setIsUploading(true);
    setUploadProgress(0);

    const CHUNK_SIZE = 50; // Number of records per request
    const totalRecords = mappedData.length;
    let successCount = 0;
    let allErrors = [];

    const url = importType === "students"
      ? "/api/admin/students/bulk-import"
      : importType === "projects" ? "/api/admin/projects/bulk-import" : "/api/tasks/admin/bulk-import";

    for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
      const chunk = mappedData.slice(i, i + CHUNK_SIZE);
      let payload;
      if (importType === "students") payload = { students: chunk };
      else if (importType === "projects") payload = { projects: chunk };
      else payload = { tasks: chunk, projectId: projectIdForTasks };

      try {
        const res = await apiFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
          successCount += chunk.length;
        } else {
          allErrors.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${data.message || "Unknown error"}`);
          if (data.errors) allErrors.push(...data.errors);
        }
      } catch (err) {
        allErrors.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1}: Network error - ${err.message}`);
      }

      // Update progress
      setUploadProgress(Math.round(Math.min(100, ((i + chunk.length) / totalRecords) * 100)));
    }

    setIsUploading(false);

    let finalMsg = `Import Processed.\nSuccess: ${successCount} / ${totalRecords}`;
    if (allErrors.length > 0) {
      finalMsg += `\n\nErrors:\n${allErrors.slice(0, 10).join("\n")}`;
      if (allErrors.length > 10) finalMsg += `\n...and ${allErrors.length - 10} more errors.`;
    }

    alert(finalMsg);

    if (successCount === totalRecords) {
      clearImportMode();
      fetchDepartments();
    }
  };

  const handleCreateProgram = async () => {
    if (!newProgramData.name.trim()) return;
    setIsCreatingProgram(true);
    try {
      const res = await apiFetch("/api/admin/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProgramData.name, duration: newProgramData.duration, eligibleYears: Array.from({ length: newProgramData.duration }, (_, i) => String(i + 1)) })
      });
      if (res.ok) {
        await fetchPrograms();
        setNewProgramModalOpen(false);
        setNewProgramData({ name: "", duration: 4 });
      } else {
        alert("Failed to create program");
      }
    } catch (err) {
      alert("Error creating program");
    } finally {
      setIsCreatingProgram(false);
    }
  };

  const isWorkingDay = (date) => {
    if (!internshipSettings || !internshipSettings.workingDays) return true;
    const day = date.getDay(); // 0 is Sunday, 1 is Monday...
    const workingDays = internshipSettings.workingDays;
    if (workingDays === "Mon-Fri") return day >= 1 && day <= 5;
    if (workingDays === "Mon-Sat") return day >= 1 && day <= 6;
    return true;
  };

  const getNextWorkingDay = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    let protection = 0;
    while (!isWorkingDay(d) && protection < 10) {
      d.setDate(d.getDate() + 1);
      protection++;
    }
    return d;
  };

  const getDateFromRelativeDay = (dayStr) => {
    if (!internshipSettings?.startDate) return dayStr;
    const match = dayStr.match(/Day\s+(\d+)/i);
    if (!match) return dayStr;

    const dayNum = parseInt(match[1], 10);
    if (isNaN(dayNum) || dayNum <= 0) return dayStr;

    let current = new Date(internshipSettings.startDate);

    // Find Day 1 (first working day from or after start date)
    if (!isWorkingDay(current)) {
      current = getNextWorkingDay(current);
    }

    let count = 1;
    while (count < dayNum) {
      current.setDate(current.getDate() + 1);
      if (isWorkingDay(current)) count++;
    }
    return current.toISOString().split('T')[0];
  };

  const validateTaskDates = (tasks) => {
    if (!internshipSettings) return { validated: tasks, issues: [] };

    const issues = [];
    const startLimit = internshipSettings?.startDate ? new Date(internshipSettings.startDate) : null;
    const endLimit = internshipSettings?.endDate ? new Date(internshipSettings.endDate) : null;

    const validated = tasks.map((task, idx) => {
      let newTask = { ...task };
      ['startDate', 'deadline'].forEach(field => {
        let val = newTask[field];
        if (!val) return;

        // 1. Handle "Day X"
        if (typeof val === 'string' && val.toLowerCase().includes('day')) {
          val = getDateFromRelativeDay(val);
          newTask[field] = val;
        }

        // 2. Check if absolute date
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          // Check range
          if (startLimit && d < startLimit) {
            issues.push({ index: idx, title: newTask.Title || "Untitled Task", field, issue: "Before internship period", current: val, suggested: startLimit.toISOString().split('T')[0] });
          } else if (endLimit && d > endLimit) {
            issues.push({ index: idx, title: newTask.Title || "Untitled Task", field, issue: "After internship period", current: val, suggested: endLimit.toISOString().split('T')[0] });
          } else if (!isWorkingDay(d)) {
            const next = getNextWorkingDay(d);
            issues.push({ index: idx, title: newTask.Title || "Untitled Task", field, issue: "Non-working day", current: val, suggested: next.toISOString().split('T')[0] });
          }
        }
      });
      return newTask;
    });

    return { validated, issues };
  };

  const handleTaskValidationApply = async () => {
    // Issues are already "suggested" in the pendingImportData for many cases, 
    // but the user might want to manually override. For now, we apply suggestions.
    const updatedData = [...pendingImportData];
    taskIssues.forEach(issue => {
      updatedData[issue.index][issue.field] = issue.suggested;
    });
    setTaskValidationOpen(false);
    await finalizeImport(updatedData);
  };

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }



  const handleCustomExport = () => {
    if (!customData || !availableCols.length) return;

    const colsToExport = availableCols.filter(c => selectedCols.includes(c.key));

    const transformItem = (item) => {
      const row = {};
      colsToExport.forEach(col => {
        if (col.key === "Departments") {
          const deptsToInclude = selectedDept.includes("All") ? deptOptions : selectedDept;
          deptsToInclude.forEach(dName => {
            const d = item.departments?.find(dep => dep.name === dName);
            if (customType === "departments-overview") {
              row[dName] = d ? `${d.registered} / ${d.total}` : "-";
            } else {
              row[dName] = d ? `${d.registered || 0} / ${d.seats}` : "-";
            }
          });
        } else {
          row[col.key] = col.accessor(item);
        }
      });
      return row;
    };

    let exportData;
    if (splitByDept && (customType === "projects" || customType === "students")) {
      const grouped = {};
      customData.forEach(item => {
        let dept = "Unassigned";
        if (customType === "projects") {
          dept = item.baseDept || (item.departments && item.departments.length > 0 ? item.departments[0].name : "General");
        } else {
          dept = item.department || "General";
        }

        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(transformItem(item));
      });
      exportData = grouped;
    } else {
      exportData = customData.map(transformItem);
    }

    downloadFile(exportData, `selected_${customType}_export_${new Date().toISOString().split('T')[0]}`);
  };

  const toggleColumn = (key) => {
    setSelectedCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const clearCustomMode = () => {
    setCustomData(null);
    setCustomType("");
    // Clear history state so refresh doesn't bring it back
    navigate(location.pathname, { replace: true, state: {} });
  };

  const handleDeptChange = (event) => {
    const { target: { value } } = event;

    if (value.includes("All")) {
      if (!selectedDept.includes("All")) {
        setSelectedDept(["All"]); // "All" was just selected
      } else if (value.length > 1) {
        setSelectedDept(value.filter(v => v !== "All")); // Specific dept selected, remove "All"
      } else {
        setSelectedDept(["All"]); // Only "All" remains
      }
    } else {
      setSelectedDept(value.length ? value : ["All"]); // If empty, revert to All
    }
  };

  const getPreviewData = (item, col) => {
    if (col.key === "Departments") {
      const depts = item.departments || [];
      const filtered = selectedDept.includes("All")
        ? depts
        : depts.filter(d => selectedDept.includes(d.name));
      if (customType === "departments-overview") {
        return filtered.map(d => `${d.name} (${d.registered}/${d.total})`).join("; ");
      }
      return filtered.map(d => `${d.name} (${d.seats})`).join("; ");
    }
    return col.accessor(item);
  };

  if (authLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authorized) return null;

  const renderDialogs = () => (
    <>
      {/* Sheet Selection Dialog */}
      <Dialog open={sheetSelectionOpen} onClose={() => setSheetSelectionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select Sheets to Import</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            This file contains multiple sheets. Select the ones you want to include in the import.
          </Typography>
          <FormGroup>
            <Grid container spacing={1}>
              {workbook?.SheetNames.map(name => (
                <Grid size={{ xs: 12, sm: 6 }} key={name}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedSheets.includes(name)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSheets(prev => [...prev, name]);
                          else setSelectedSheets(prev => prev.filter(s => s !== name));
                        }}
                      />
                    }
                    label={name}
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSheetSelectionOpen(false)}>Cancel</Button>
          <Button
            onClick={() => processSheets(workbook, selectedSheets, importType)}
            variant="contained"
            disabled={selectedSheets.length === 0}
          >
            Continue with {selectedSheets.length} Sheet(s)
          </Button>
        </DialogActions>
      </Dialog>

      <ResolveDepartmentsDialog
        open={deptMappingOpen}
        onClose={() => setDeptMappingOpen(false)}
        unassignedDepartments={unrecognizedDepts}
        programs={programsList}
        onSuccess={async (remaining) => {
          fetchDepartments();
          setUnrecognizedDepts(remaining);
          if (remaining.length === 0) {
            setDeptMappingOpen(false);
            await finalizeImport(pendingImportData);
          }
        }}
      />

      {/* Task Date Validation Dialog */}
      <Dialog open={taskValidationOpen} onClose={() => setTaskValidationOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Task Date Adjustments Required
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Some tasks fall outside the internship period or on non-working days (<strong>{internshipSettings?.workingDays}</strong>).
            We suggest adjusting them to the nearest valid date.
          </Alert>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: "#f5f5f5" }}>
                <TableRow>
                  <TableCell><strong>Task Title</strong></TableCell>
                  <TableCell><strong>Field</strong></TableCell>
                  <TableCell><strong>Issue</strong></TableCell>
                  <TableCell><strong>Current</strong></TableCell>
                  <TableCell><strong>Suggested Fix</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {taskIssues.map((issue, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{issue.title}</TableCell>
                    <TableCell><Chip label={issue.field} size="small" variant="outlined" /></TableCell>
                    <TableCell color="error.main">{issue.issue}</TableCell>
                    <TableCell sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>{issue.current}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="date"
                        value={issue.suggested}
                        onChange={(e) => {
                          const newIssues = [...taskIssues];
                          newIssues[idx].suggested = e.target.value;
                          setTaskIssues(newIssues);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskValidationOpen(false)}>Cancel Import</Button>
          <Button onClick={handleTaskValidationApply} variant="contained" color="primary">Apply & Import</Button>
        </DialogActions>
      </Dialog>

      {/* New Program Dialog */}
      <Dialog open={newProgramModalOpen} onClose={() => setNewProgramModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create New Program</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Program Name"
              fullWidth
              size="small"
              value={newProgramData.name}
              onChange={(e) => setNewProgramData({ ...newProgramData, name: e.target.value })}
            />
            <TextField
              label="Duration (Years)"
              type="number"
              fullWidth
              size="small"
              value={newProgramData.duration}
              onChange={(e) => setNewProgramData({ ...newProgramData, duration: Number(e.target.value) })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewProgramModalOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateProgram} variant="contained" disabled={isCreatingProgram || !newProgramData.name}>
            {isCreatingProgram ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  // RENDER CUSTOM EXPORT UI IF DATA EXISTS
  if (customData) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <style>{`
          *:not(input, textarea, [contenteditable]) {
            caret-color: transparent;
          }
        `}</style>
        <Button startIcon={<ArrowBackIcon />} onClick={clearCustomMode} sx={{ mb: 2 }}>
          Back to General Import/Export
        </Button>
        <PageHeader
          title="Confirm Export Data"
          subtitle={`You have selected ${customData.length} items. Please select the columns you wish to include.`}
        />

        <Paper elevation={3} sx={{ p: 3, width: "fit-content", maxWidth: "100%" }}>
          <Typography variant="h6" gutterBottom>Select Columns</Typography>
          <FormGroup>
            <Grid container spacing={2}>
              {availableCols.map((col) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={col.key}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {col.key === "Departments" && selectedCols.includes("Departments") ? (
                      <Checkbox
                        checked={selectedCols.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                      />
                    ) : (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedCols.includes(col.key)}
                            onChange={() => toggleColumn(col.key)}
                          />
                        }
                        label={col.label}
                      />
                    )}
                    {col.key === "Departments" && selectedCols.includes("Departments") && (
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                          <InputLabel>Select Dept</InputLabel>
                          <Select
                            multiple
                            value={selectedDept}
                            label="Select Dept"
                            onChange={handleDeptChange}
                            renderValue={(selected) => selected.join(", ")}
                          >
                            <MenuItem value="All">
                              <Checkbox checked={selectedDept.includes("All")} />
                              <ListItemText primary="All Departments" />
                            </MenuItem>
                            {deptOptions.map(d => (
                              <MenuItem key={d} value={d}>
                                <Checkbox checked={selectedDept.includes(d)} />
                                <ListItemText primary={d} />
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </FormGroup>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={exportFormat}
                label="Export Format"
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <MenuItem value="excel">Excel</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
              </Select>
            </FormControl>
            {(customType === "projects" || customType === "students") && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={splitByDept}
                    onChange={(e) => setSplitByDept(e.target.checked)}
                  />
                }
                label="Split into multiple sheets by department"
              />
            )}
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => setConfirmOpen(true)}>
              Export Selected Data
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>Data Preview</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, mb: 3, width: "fit-content", maxWidth: "100%", mx: "auto" }}>
            <Table stickyHeader size="small" sx={{ width: "max-content" }}>
              <TableHead>
                <TableRow>
                  {availableCols.filter(c => selectedCols.includes(c.key)).map((col) => {
                    if (col.key === "Departments") {
                      const deptsToInclude = selectedDept.includes("All") ? deptOptions : selectedDept;
                      return deptsToInclude.map(d => (
                        <TableCell key={d} sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>{d}</TableCell>
                      ));
                    }
                    return <TableCell key={col.key} sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>{col.label}</TableCell>;
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {customData.map((row, index) => (
                  <TableRow key={row._id || row.projectId || index} hover>
                    {availableCols.filter(c => selectedCols.includes(c.key)).map((col) => {
                      if (col.key === "Departments") {
                        const deptsToInclude = selectedDept.includes("All") ? deptOptions : selectedDept;
                        return deptsToInclude.map(dName => {
                          const d = row.departments?.find(dep => dep.name === dName);
                          return (
                            <TableCell key={`${row._id || row.projectId || index}-${dName}`}>
                              {d ? (customType === "departments-overview" ? `${d.registered} / ${d.total}` : `${d.registered || 0} / ${d.seats}`) : "-"}
                            </TableCell>
                          );
                        });
                      }
                      return (
                        <TableCell key={`${row._id || row.projectId || index}-${col.key}`}>
                          {getPreviewData(row, col)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* CONFIRMATION DIALOG */}
          <ConfirmDialog
            open={confirmOpen}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => { handleCustomExport(); setConfirmOpen(false); }}
            title="Confirm Export"
            content={`Are you sure you want to export ${customData.length} records?`}
          />
        </Paper>
        {renderDialogs()}
      </Box>
    );
  }

  // RENDER IMPORT PREVIEW UI IF DATA EXISTS
  if (importData.length > 0) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <style>{`
          *:not(input, textarea, [contenteditable]) {
            caret-color: transparent;
          }
        `}</style>
        <Button startIcon={<ArrowBackIcon />} onClick={clearImportMode} sx={{ mb: 2 }}>
          Back to Import/Export
        </Button>
        <PageHeader
          title={`Import Preview (${importType})`}
          subtitle="Map your file columns to the system fields below. Matched columns are shown in green."
        />

        <Paper elevation={3} sx={{ p: 3 }}>
          <Box sx={{ mb: 3, p: 2, bgcolor: "#f9f9f9", borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">Column Mapping</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              1. Click a <strong>System Field</strong> box below to select it.<br />
              2. Click a <strong>File Column</strong> chip to assign it to the selected field.
            </Typography>

            <Grid container spacing={2}>
              {IMPORT_FIELDS[importType]?.map(field => {
                const isMapped = Array.isArray(columnMapping[field]) ? columnMapping[field].length > 0 : !!columnMapping[field];
                const isActive = activeField === field;
                const isRequired = REQUIRED_FIELDS[importType]?.includes(field);

                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={field}>
                    <Paper
                      elevation={isActive ? 3 : 1}
                      onClick={() => setActiveField(field)}
                      sx={{
                        p: 2,
                        cursor: "pointer",
                        border: isActive ? "2px solid #1976d2" : "1px solid #e0e0e0",
                        bgcolor: isMapped ? "#e8f5e9" : "#fff",
                        transition: "all 0.2s",
                        "&:hover": { borderColor: "#1976d2" }
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography variant="caption" color="textSecondary" fontWeight="bold">
                          {field} {isRequired && <span style={{ color: "red" }}>*</span>}
                        </Typography>
                        {isMapped && isActive && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setColumnMapping(prev => ({ ...prev, [field]: Array.isArray(prev[field]) ? [] : "" }));
                            }}
                            sx={{ p: 0.5, mt: -0.5, mr: -0.5 }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                      {Array.isArray(columnMapping[field]) ? (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                          {columnMapping[field].length === 0 && <span style={{ color: "#bdbdbd", fontStyle: "italic" }}>Select...</span>}
                          {columnMapping[field].map((item, idx) => (
                            <Chip
                              key={idx}
                              label={typeof item === 'object' ? `${item.dept} → ${item.col}` : item}
                              size="small"
                              onDelete={(e) => {
                                e.stopPropagation();
                                setColumnMapping(prev => ({
                                  ...prev,
                                  [field]: prev[field].filter((_, i) => i !== idx)
                                }));
                              }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body1" noWrap title={columnMapping[field] || "Unmapped"}>
                          {columnMapping[field] || <span style={{ color: "#bdbdbd", fontStyle: "italic" }}>Select...</span>}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Divider sx={{ mb: 2 }} />

            {activeField === "Specific Dept" && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#e3f2fd", borderRadius: 1, border: "1px dashed #1976d2" }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Select Department to Map:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedMapDept}
                    label="Department"
                    onChange={(e) => setSelectedMapDept(e.target.value)}
                  >
                    {dbDepartments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            )}

            <Typography variant="subtitle2" gutterBottom>Available File Columns:</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {fileHeaders.map(header => {
                const isUsed = Object.values(columnMapping).includes(header);
                return (
                  <Chip
                    key={header}
                    label={header}
                    onClick={() => handleHeaderClick(header, activeField === "Specific Dept")}
                    color={isUsed ? "success" : "default"}
                    variant={isUsed ? "filled" : "outlined"}
                    clickable
                  />
                );
              })}
            </Box>
            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => setColumnMapping({})} color="error">Clear All Mappings</Button>
            </Box>
          </Box>

          <TableContainer component={Paper} sx={{ maxHeight: 400, mb: 2, width: 'fit-content', mx: 'auto', maxWidth: '100%' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {selectedSheets.length > 1 && (
                    <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>
                      Source Sheet
                    </TableCell>
                  )}
                  {fileHeaders.map((header) => {
                    const isMapped = Object.values(columnMapping).includes(header);
                    return (
                      <TableCell key={header} sx={{ color: isMapped ? "green" : "red", fontWeight: "bold" }}>
                        {header}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {importData.slice(0, 10).map((row, i) => (
                  <TableRow key={i}>
                    {selectedSheets.length > 1 && (
                      <TableCell>
                        <Chip size="small" label={row.__sheetName} variant="outlined" />
                      </TableCell>
                    )}
                    {fileHeaders.map((header) => (
                      <TableCell key={`${i}-${header}`}>{row[header]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {importData.length > 10 && <Typography sx={{ mt: 1, mb: 2, fontStyle: "italic" }}>Showing first 10 of {importData.length} rows</Typography>}

          {isUploading && (
            <Box sx={{ width: '100%', mb: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="caption" align="center" display="block" sx={{ mt: 0.5 }}>
                Importing... {uploadProgress}%
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button onClick={clearImportMode} disabled={isUploading}>Cancel</Button>
            <Button onClick={performImport} variant="contained" color="primary" disabled={isUploading}>
              {isUploading ? "Importing..." : "Confirm Import"}
            </Button>
          </Box>
        </Paper>

        {renderDialogs()}
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <style>{`
        *:not(input, textarea, [contenteditable]) {
          caret-color: transparent;
        }
      `}</style>
      <PageHeader
        title="Import / Export"
        subtitle="Manage bulk data operations for students, projects, and tasks"
      />

      <Box sx={{ width: "100%" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Export Data" />
            <Tab label="Import Data" />
          </Tabs>
        </Box>

        {/* EXPORT TAB */}
        {tabValue === 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Export Database Records
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Download current data as CSV or Excel files for backup or analysis.
            </Typography>

            <FormControl size="small" sx={{ minWidth: 150, mb: 2 }}>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={exportFormat}
                label="Export Format"
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <MenuItem value="excel">Excel</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: "center" }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportStudents}
              >
                Export Students
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportProjects}
              >
                Export Projects
              </Button>

              <Divider orientation="vertical" flexItem />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Project for Daily Status</InputLabel>
                  <Select
                    value={projectIdForExport}
                    label="Project for Daily Status"
                    onChange={(e) => setProjectIdForExport(e.target.value)}
                  >
                    <MenuItem value="all">All Projects</MenuItem>
                    {importProjectsList.map(p => (
                      <MenuItem key={p._id} value={p._id}>{p.title}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={exportTasks}
                >
                  Export Daily Status
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        {/* IMPORT TAB */}
        {tabValue === 1 && (
          <Box sx={{ mt: 3 }}>
            <Stack spacing={4}>
              {/* Import Students Section */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Bulk Import Students</Typography>
                <Alert severity="info" sx={{ mb: 2, ".MuiAlert-message": { width: "100%" } }}>
                  <Box><strong>Required:</strong> Name, Department, Program, Year, Phone, and (Email or StudentID).</Box>
                  <Box><strong>Optional:</strong> Password (Default: Aditya@123), Project, Status, Guide, Guide Dept, Co-Guide, Co-Guide Dept.</Box>
                </Alert>
                <Stack direction="row" spacing={2}>
                  <Button variant="contained" component="label" startIcon={<UploadFileIcon />}>
                    Upload File
                    <input type="file" hidden accept=".csv, .xlsx, .xls" onChange={(e) => handleFileUpload(e, "students")} />
                  </Button>
                </Stack>
              </Box>

              <Divider />

              {/* Import Projects Section */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Bulk Import Projects</Typography>
                <Alert severity="info" sx={{ mb: 2, ".MuiAlert-message": { width: "100%" } }}>
                  <Box><strong>Required:</strong> Title, Description, Base Dept, and Departments (Format: `Name1:Seats1;Name2:Seats2` or mapped to 'Specific Dept').</Box>
                  <Box><strong>Optional:</strong> Project ID, Status, Skills Required, Project Outcome, Guide, Guide Emp ID, Guide Dept, Co-Guide, Co-Guide Emp ID, Co-Guide Dept.</Box>
                </Alert>
                <Stack direction="row" spacing={2}>
                  <Button variant="contained" component="label" startIcon={<UploadFileIcon />}>
                    Upload File
                    <input type="file" hidden accept=".csv, .xlsx, .xls" onChange={(e) => handleFileUpload(e, "projects")} />
                  </Button>
                </Stack>
              </Box>

              <Divider />

              {/* Import Tasks Section */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Bulk Import Daily Status</Typography>
                <Alert severity="info" sx={{ mb: 2, ".MuiAlert-message": { width: "100%" } }}>
                  <Box><strong>Required:</strong> Title, Start Date (can be "Day 1", "Day 2", etc. or a date).</Box>
                  <Box><strong>Optional:</strong> Deadline.</Box>
                </Alert>
                <Stack direction="column" spacing={2} sx={{ maxWidth: 400 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Assign to Project</InputLabel>
                    <Select
                      value={projectIdForTasks}
                      label="Assign to Project"
                      onChange={(e) => setProjectIdForTasks(e.target.value)}
                    >
                      {importProjectsList.map(p => (
                        <MenuItem key={p._id} value={p._id}>{p.title}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    component="label"
                    startIcon={<UploadFileIcon />}
                    disabled={!projectIdForTasks}
                  >
                    Upload Daily Status File
                    <input type="file" hidden accept=".csv, .xlsx, .xls" onChange={(e) => handleFileUpload(e, "tasks")} />
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        )}
      </Box>

      {renderDialogs()}
    </Box>
  );
}
