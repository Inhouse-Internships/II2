import React, { useEffect, useState, useMemo } from "react";
import {
    Box,
    Typography,
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
    Badge,
    Grid,
    Tooltip,
    Autocomplete,
    Switch,
    FormControlLabel,
    Divider
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import {
    Delete as DeleteIcon,
    Close as CloseIcon,
    CheckBox as CheckBoxIcon,
    FilterList as FilterListIcon,
    Assignment as AssignmentIcon,
    CheckCircle as CheckCircleIcon,
    RateReview as RateReviewIcon,
    Settings as SettingsIcon,
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

export default function HODProjects(props) {
    const navigate = useNavigate();
    const context = props.context || {};
    const { user, authorized, authLoading } = useRequireRole(ROLES.HOD);

    const [projects, setProjects] = useState([]);
    const [programsList, setProgramsList] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [loading, setLoading] = useState(true);

    const [open, setOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [isEditingInDialog, setIsEditingInDialog] = useState(false);

    const [facultyDetailsOpen, setFacultyDetailsOpen] = useState(false);
    const [selectedFacultyName, setSelectedFacultyName] = useState("");

    const [seatOpen, setSeatOpen] = useState(false);
    const [seatProject, setSeatProject] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [availableDepts, setAvailableDepts] = useState([]);
    const [deptDeleteOpen, setDeptDeleteOpen] = useState(false);
    const [deptDeleteIndex, setDeptDeleteIndex] = useState(null);
    const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
    const [projectToToggle, setProjectToToggle] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

    const [form, setForm] = useState({
        _id: null,
        title: "",
        projectId: "",
        baseDept: "",
        description: "",
        guide: "",
        guideEmpId: "",
        guideDept: "",
        coGuide: "",
        coGuideEmpId: "",
        coGuideDept: "",
        allowWithdrawal: true
    });

    const sortedFaculty = useMemo(() => [...(faculty || [])].sort((a, b) => (a?.name || "").localeCompare(b?.name || "")), [faculty]);

    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
    const [programFilter, setProgramFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [deptFilter, setDeptFilter] = useState("All");
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

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    /* ================= FETCH ================= */

    const fetchProjects = async () => {
        if (!user?.department) return;
        try {
            setLoading(true);
            const res = await apiFetch(`/api/projects`, { cache: "no-store" });
            const data = await res.json();
            const extracted = data?.data?.data || data?.data || data || [];
            setProjects(Array.isArray(extracted) ? extracted : []);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const fetchPrograms = async () => {
        try {
            const res = await apiFetch("/api/admin/programs");
            if (res.ok) {
                const data = await res.json();
                setProgramsList(Array.isArray(data) ? data : (data.data || []));
            }
        } catch (err) { }
    };

    const fetchAvailableDepts = async () => {
        try {
            const res = await apiFetch("/api/admin/all-db-departments");
            if (res.ok) {
                const data = await res.json();
                setAvailableDepts((Array.isArray(data) ? data : []).sort((a, b) => (a?.name || "").localeCompare(b?.name || "")));
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
        } catch (err) { }
    };

    useEffect(() => {
        if (!authorized) return;
        fetchProjects();
        fetchPrograms();
        fetchAvailableDepts();
        fetchFaculty();
    }, [authorized, user]);

    /* ================= PROJECT FORM ================= */

    const handleChange = e => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const openAddDialog = () => {
        setEditingProject(null);
        setForm({ title: "", projectId: "", baseDept: user.department, description: "", guide: "", guideEmpId: "", guideDept: "", coGuide: "", coGuideEmpId: "", coGuideDept: "", allowWithdrawal: true });
        setIsEditingInDialog(false);
        setOpen(true);
    };

    const openProjectDialog = project => {
        setEditingProject(project);
        setForm({
            title: project.title,
            projectId: project.projectId || "",
            baseDept: project.baseDept || "",
            description: project.description,
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
        const url = editingProject ? `/api/projects/${editingProject._id}` : "/api/projects";
        const method = editingProject ? "PUT" : "POST";

        await apiFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, departments: editingProject ? editingProject.departments : [] })
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
        try {
            const res = await apiFetch(`/api/projects/${projectToDelete}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete project");
            fetchProjects();
            setDeleteConfirmOpen(false);
            setProjectToDelete(null);
        } catch (err) { alert(err.message); }
    };

    const promptToggleStatus = (project) => {
        setProjectToToggle(project);
        setStatusConfirmOpen(true);
    };

    const confirmToggleStatus = async () => {
        if (!projectToToggle) return;
        await apiFetch(`/api/projects/${projectToToggle._id}/status`, { method: "PATCH" });
        fetchProjects();
        setStatusConfirmOpen(false);
        setProjectToToggle(null);
    };

    /* ================= DEPARTMENT SEATS ================= */

    const openSeatDialog = project => {
        setSeatProject(project);
        setDepartments(project.departments?.length ? project.departments : [{ name: "", seats: 0 }]);
        setSeatOpen(true);
    };

    const updateDepartment = (index, field, value) => {
        const updated = [...departments];
        updated[index][field] = value;
        setDepartments(updated);
    };

    const addDepartmentRow = () => setDepartments([...departments, { name: "", seats: 0 }]);

    const promptDeleteDepartment = index => {
        setDeptDeleteIndex(index);
        setDeptDeleteOpen(true);
    };

    const confirmDeleteDepartment = () => {
        const updated = [...departments];
        updated.splice(deptDeleteIndex, 1);
        setDepartments(updated);
        setDeptDeleteOpen(false);
    };

    const totalSeats = departments.reduce((sum, d) => sum + Number(d.seats || 0), 0);

    const saveDepartments = async () => {
        await apiFetch(`/api/projects/${seatProject._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ departments })
        });
        setSeatOpen(false);
        fetchProjects();
    };

    /* ================= FILTERS ================= */

    const filteredProjects = useMemo(() => projects.filter(p => {
        const title = (p.title || "").toLowerCase();
        const matchesSearch = title.includes(debouncedSearchQuery.toLowerCase()) ||
            (p.projectId || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (p.guide || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (p.guideDept || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (p.coGuide || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (p.coGuideDept || "").toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        const { programFilter, statusFilter, deptFilter, registrationFilter, levelFilter, seatType, regSeatsOp, regSeatsVal, regSeatsMax } = appliedFilters;

        let matchesProgram = true;
        if (programFilter !== "All") {
            const selectedProg = programsList.find(prog => prog.name === programFilter);
            if (selectedProg) {
                const programDeptNames = new Set(selectedProg.departments.map(d => d.name));
                matchesProgram = p.departments.some(d => programDeptNames.has(d.name));
            } else { matchesProgram = false; }
        }

        const matchesStatus = statusFilter === "All" || p.status === statusFilter;
        const matchesDept = deptFilter === "All" || p.departments.some(d => d.name === deptFilter);

        let matchesRegistration = true;
        const reg = p.registeredCount || 0;
        const total = p.totalSeats || 0;
        if (registrationFilter === "None") matchesRegistration = reg === 0;
        else if (registrationFilter === "Partial") matchesRegistration = reg > 0 && reg < total;
        else if (registrationFilter === "Full") matchesRegistration = reg >= total;

        let matchesLevel = levelFilter === "All" || (levelFilter === "L2" ? p.hasLevel2Student : (levelFilter === "L1" ? p.hasLevel1Student : true));

        let matchesSeats = true;
        let targetSeats = (seatType === "Registered" ? p.registeredCount : (seatType === "Available" ? p.totalSeats - p.registeredCount : p.totalSeats)) || 0;
        if (regSeatsOp === "range") {
            if (regSeatsVal !== "" && targetSeats < Number(regSeatsVal)) matchesSeats = false;
            if (regSeatsMax !== "" && targetSeats > Number(regSeatsMax)) matchesSeats = false;
        } else if (regSeatsVal !== "" && targetSeats !== Number(regSeatsVal)) matchesSeats = false;

        return matchesSearch && matchesProgram && matchesStatus && matchesDept && matchesRegistration && matchesSeats && matchesLevel;
    }), [projects, debouncedSearchQuery, appliedFilters, programsList]);

    const handleFilterClick = () => {
        setProgramFilter(appliedFilters.programFilter);
        setStatusFilter(appliedFilters.statusFilter);
        setDeptFilter(appliedFilters.deptFilter);
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
        setAppliedFilters({ programFilter, statusFilter, deptFilter, registrationFilter, levelFilter, seatType, regSeatsOp, regSeatsVal, regSeatsMax });
        setFilterOpen(false);
    };

    const handleFacultyClick = (name, e) => {
        if (e) e.stopPropagation();
        setSelectedFacultyName(name);
        setFacultyDetailsOpen(true);
    };

    const handleClearFilters = () => {
        const reset = { programFilter: "All", statusFilter: "All", deptFilter: "All", registrationFilter: "All", levelFilter: "All", seatType: "Registered", regSeatsOp: "range", regSeatsVal: "", regSeatsMax: "" };
        setProgramFilter("All"); setStatusFilter("All"); setDeptFilter("All"); setRegistrationFilter("All"); setLevelFilter("All"); setSeatType("Registered"); setRegSeatsOp("range"); setRegSeatsVal(""); setRegSeatsMax("");
        setAppliedFilters(reset); setFilterOpen(false);
    };

    /* ================= UI ================= */

    const filtersChanged =
        appliedFilters.programFilter !== programFilter ||
        appliedFilters.statusFilter !== statusFilter ||
        appliedFilters.deptFilter !== deptFilter ||
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
        appliedFilters.registrationFilter !== "All",
        appliedFilters.levelFilter !== "All",
        appliedFilters.regSeatsVal !== "",
        (appliedFilters.regSeatsOp === "range" && appliedFilters.regSeatsMax !== "")
    ].filter(Boolean).length;

    if (authLoading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
    if (!authorized) return null;

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <PageHeader
                title="Department Projects"
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
                        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={handleFilterClick}>
                            <Badge color="error" badgeContent={appliedFilterCount} invisible={appliedFilterCount === 0}>Filters</Badge>
                        </Button>

                        <Button variant="contained" onClick={openAddDialog}>Add Project</Button>
                    </Stack>
                }
            />

            {loading ? <CircularProgress /> : (
                <>

                    <DataTable
                        columns={[
                            {
                                id: "title", label: "Title", minWidth: 200, render: p => (
                                    <Typography
                                        onClick={() => openProjectDialog(p)}
                                        noWrap
                                        sx={{
                                            color: "primary.main",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            maxWidth: { xs: 180, sm: 250, md: '25vw' }
                                        }}
                                        title={p.title}
                                    >
                                        {p.title}
                                    </Typography>
                                )
                            },
                            { id: "projectId", label: "Project ID", minWidth: 100, render: p => p.projectId || "-" },
                            {
                                id: "guide", label: "Guide", minWidth: 150, render: p => p.guide ? (
                                    <Box>
                                        <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden', '&:hover': { textDecoration: 'underline' } }} onClick={(e) => handleFacultyClick(p.guide, e)} title={p.guide}>{p.guide}</Typography>
                                        <Typography variant="caption" color="textSecondary">{p.guideDept || "-"}</Typography>
                                    </Box>
                                ) : "-"
                            },
                            {
                                id: "coGuide", label: "Co-Guide", minWidth: 150, render: p => p.coGuide ? (
                                    <Box>
                                        <Typography noWrap sx={{ cursor: 'pointer', maxWidth: { xs: 120, sm: 160, md: '12vw' }, textOverflow: 'ellipsis', overflow: 'hidden', '&:hover': { textDecoration: 'underline' } }} onClick={(e) => handleFacultyClick(p.coGuide, e)} title={p.coGuide}>{p.coGuide}</Typography>
                                        <Typography variant="caption" color="textSecondary">{p.coGuideDept || "-"}</Typography>
                                    </Box>
                                ) : "-"
                            },
                            { id: "seats", label: "Reg / Total", minWidth: 100, render: p => <b>{p.registeredCount || 0} / {p.totalSeats}</b> },
                            { id: "status", label: "Status", minWidth: 120, render: p => <div onClick={() => promptToggleStatus(p)} style={{ cursor: 'pointer' }}><StatusChip status={p.status} /></div> },
                            {
                                id: "actions", label: "Manage", minWidth: 150, render: p => (
                                    <Stack direction="row" spacing={1}>
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
                        rows={filteredProjects}

                        emptyMessage="No projects found."
                    />
                </>
            )}

            {/* PROJECT DETAILS */}
            <ProjectDetailsDialog
                open={open && !!editingProject && !isEditingInDialog}
                onClose={() => setOpen(false)}
                project={editingProject}
                renderStatus={proj => <div onClick={() => { setOpen(false); promptToggleStatus(proj); }} style={{ cursor: 'pointer' }}><StatusChip status={proj.status} /></div>}
                customActions={<>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button onClick={() => openSeatDialog(editingProject)}>Settings</Button>
                    <Button variant="contained" onClick={() => setIsEditingInDialog(true)}>Edit</Button>
                    <Button onClick={() => setOpen(false)}>Close</Button>
                </>}
            />

            {/* ADD / EDIT DIALOG */}
            <Dialog open={open && (!editingProject || isEditingInDialog)} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editingProject ? "Edit Project" : "Add Project"}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Title" fullWidth value={form.title} name="title" onChange={handleChange} />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            <TextField label="Project ID" fullWidth value={form.projectId} name="projectId" onChange={handleChange} />
                            <TextField label="Base Dept" fullWidth value={form.baseDept} disabled />
                        </Box>
                        <Autocomplete options={sortedFaculty} getOptionLabel={f => f.name} value={sortedFaculty.find(f => f.name === form.guide) || null} onChange={(e, v) => setForm({ ...form, guide: v?.name || "" })} renderInput={params => <TextField {...params} label="Guide" />} />
                        <TextField label="Guide Employee ID" fullWidth value={form.guideEmpId} name="guideEmpId" onChange={handleChange} />
                        <Autocomplete options={availableDepts.map(d => d.name)} value={form.guideDept} onChange={(e, val) => setForm({ ...form, guideDept: val || "" })} freeSolo renderInput={(params) => <TextField {...params} label="Guide Dept" fullWidth />} />
                        <Autocomplete options={sortedFaculty} getOptionLabel={f => f.name} value={sortedFaculty.find(f => f.name === form.coGuide) || null} onChange={(e, v) => setForm({ ...form, coGuide: v?.name || "" })} renderInput={params => <TextField {...params} label="Co-Guide" />} />
                        <TextField label="Co-Guide Employee ID" fullWidth value={form.coGuideEmpId} name="coGuideEmpId" onChange={handleChange} />
                        <Autocomplete options={availableDepts.map(d => d.name)} value={form.coGuideDept} onChange={(e, val) => setForm({ ...form, coGuideDept: val || "" })} freeSolo renderInput={(params) => <TextField {...params} label="Co-Guide Dept" fullWidth />} />
                        <TextField label="Description" fullWidth multiline rows={3} value={form.description} name="description" onChange={handleChange} />
                        <FormControlLabel control={<Switch checked={form.allowWithdrawal} onChange={e => setForm({ ...form, allowWithdrawal: e.target.checked })} />} label="Allow Withdrawal" />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* SEATS DIALOG */}
            <Dialog open={seatOpen} onClose={() => setSeatOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Seat Management</DialogTitle>
                <DialogContent dividers>
                    {departments.map((d, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 2, mb: 2 }}>
                            <FormControl sx={{ flex: 2 }} size="small">
                                <InputLabel>Dept</InputLabel>
                                <Select value={d.name} label="Dept" onChange={e => updateDepartment(i, "name", e.target.value)}>
                                    {availableDepts.map(ad => <MenuItem key={ad._id} value={ad.name}>{ad.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <TextField label="Seats" type="number" size="small" sx={{ flex: 1 }} value={d.seats} onChange={e => updateDepartment(i, "seats", e.target.value)} />
                            <IconButton color="error" onClick={() => promptDeleteDepartment(i)}><DeleteIcon /></IconButton>
                        </Box>
                    ))}
                    <Button onClick={addDepartmentRow}>Add Row</Button>
                </DialogContent>
                <DialogActions>
                    <Typography variant="body2" sx={{ mr: 2 }}>Total: {totalSeats}</Typography>
                    <Button onClick={() => setSeatOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={saveDepartments}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* FILTER DIALOG */}
            <Dialog open={filterOpen} onClose={handleFilterClose} fullWidth maxWidth="sm" disableRestoreFocus disableEnforceFocus>
                <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    Filter Options
                    <IconButton onClick={handleFilterClose} size="small"><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
                        <FormControl size="small" fullWidth><InputLabel>Program</InputLabel><Select value={programFilter} label="Program" onChange={e => { setProgramFilter(e.target.value); setDeptFilter("All"); }}><MenuItem value="All">All Programs</MenuItem>{programsList.map(p => <MenuItem key={p._id} value={p.name}>{p.name}</MenuItem>)}</Select></FormControl>
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <FormControl size="small" fullWidth><InputLabel>Status</InputLabel><Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}><MenuItem value="All">All Statuses</MenuItem><MenuItem value="Open">Open</MenuItem><MenuItem value="Closed">Closed</MenuItem></Select></FormControl>
                            <FormControl size="small" fullWidth><InputLabel>Department</InputLabel><Select value={deptFilter} label="Department" onChange={e => setDeptFilter(e.target.value)}><MenuItem value="All">All Departments</MenuItem>{filteredDepartments.map(dept => <MenuItem key={dept._id} value={dept.name}>{dept.name}</MenuItem>)}</Select></FormControl>
                        </Box>
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <FormControl size="small" fullWidth><InputLabel>Registration Status</InputLabel><Select value={registrationFilter} label="Registration Status" onChange={e => setRegistrationFilter(e.target.value)}><MenuItem value="All">All</MenuItem><MenuItem value="None">No Registrations</MenuItem><MenuItem value="Partial">Partially Filled</MenuItem><MenuItem value="Full">Fully Filled</MenuItem></Select></FormControl>
                            <FormControl size="small" fullWidth><InputLabel>Student Level</InputLabel><Select value={levelFilter} label="Student Level" onChange={e => setLevelFilter(e.target.value)}><MenuItem value="All">All</MenuItem><MenuItem value="L2">Has Level 2 Students</MenuItem><MenuItem value="L1">Has Level 1 Students</MenuItem></Select></FormControl>
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <FormControl size="small" sx={{ minWidth: 120 }}><InputLabel>Seat Type</InputLabel><Select value={seatType} label="Seat Type" onChange={e => setSeatType(e.target.value)}><MenuItem value="Registered">Registered</MenuItem><MenuItem value="Available">Available</MenuItem><MenuItem value="Total">Total</MenuItem></Select></FormControl>
                            <FormControl size="small" sx={{ minWidth: 120 }}><InputLabel>{seatType} Seats</InputLabel><Select value={regSeatsOp} label={`${seatType} Seats`} onChange={e => setRegSeatsOp(e.target.value)}><MenuItem value="range">Range</MenuItem><MenuItem value="eq">Exactly</MenuItem></Select></FormControl>
                            <TextField label={regSeatsOp === "range" ? "Min / At least" : "Count"} type="number" size="small" value={regSeatsVal} onChange={e => setRegSeatsVal(e.target.value)} fullWidth />
                            {regSeatsOp === "range" && <TextField label="Max / At most" type="number" size="small" value={regSeatsMax} onChange={e => setRegSeatsMax(e.target.value)} fullWidth />}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions><Button onClick={handleClearFilters} color="error">Clear Filters</Button><Button onClick={handleApplyFilters} variant="contained" disabled={!filtersChanged}>Apply</Button></DialogActions>
            </Dialog>

            <ConfirmDialog open={deleteConfirmOpen} title="Delete Project" message="Delete this project?" onConfirm={confirmDeleteProject} onCancel={() => setDeleteConfirmOpen(false)} confirmColor="error" />
            <ConfirmDialog open={statusConfirmOpen} title="Toggle Status" message="Toggle project status?" onConfirm={confirmToggleStatus} onCancel={() => setStatusConfirmOpen(false)} />
            <ConfirmDialog open={bulkDeleteConfirmOpen} title="Bulk Delete" message={`Delete ${selectedIds.length} projects?`} onConfirm={() => console.log('bulk delete')} onCancel={() => setBulkDeleteConfirmOpen(false)} confirmColor="error" />
        </Box>
    );
}
