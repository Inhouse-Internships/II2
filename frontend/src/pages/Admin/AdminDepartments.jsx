import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    IconButton,
    Stack,
    Chip,
    Paper,
    CircularProgress,
    Tooltip,
    alpha,
    useTheme,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from "@mui/material";
import {
    Apartment as ApartmentIcon,
    ArrowBack as ArrowBackIcon
} from "@mui/icons-material";
import { apiFetch } from "../../core/services/apiFetch";
import PageHeader from "../../components/common/PageHeader";
import ProjectDetailsDialog from "../../components/common/ProjectDetailsDialog";
import DataTable from "../../components/common/DataTable";
import StatusChip from "../../components/common/StatusChip";
import FacultyDetailsDialog from "../../components/common/FacultyDetailsDialog";
import {
    Assignment as AssignmentIcon,
    CheckCircle as CheckCircleIcon,
    RateReview as RateReviewIcon,
    CheckBox as CheckBoxIcon,
    Close as CloseIcon
} from "@mui/icons-material";
import SearchBar from "../../components/common/SearchBar";
import ConfirmDialog from "../../components/common/ConfirmDialog";


export default function AdminDepartments(props) {
    const theme = useTheme();
    const context = props.context || {};

    const [loading, setLoading] = useState(true);
    const [matrixData, setMatrixData] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectLoading, setProjectLoading] = useState(false);
    const [localAvailableDepts, setLocalAvailableDepts] = useState([]);
    const [facultyDetailsOpen, setFacultyDetailsOpen] = useState(false);
    const [selectedFacultyName, setSelectedFacultyName] = useState("");
    const [viewMode, setViewMode] = useState("baseDept");

    // Local states for department-specific project view
    const [localSearchQuery, setLocalSearchQuery] = useState("");
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

    // Reset local states when changing departments
    useEffect(() => {
        setLocalSearchQuery("");
        setSelectionMode(false);
        setSelectedIds([]);
    }, [selectedDept?.name]);

    const filteredDeptProjects = useMemo(() => {
        if (!selectedDept || !selectedDept.projects) return [];
        let list = selectedDept.projects;
        if (localSearchQuery) {
            const q = localSearchQuery.toLowerCase();
            list = list.filter(p =>
                (p.title || "").toLowerCase().includes(q) ||
                (p.projectId || "").toLowerCase().includes(q) ||
                (p.guide || "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [selectedDept, localSearchQuery]);

    const handleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectAll = (event) => {
        if (event.target.checked) {
            setSelectedIds(filteredDeptProjects.map(p => p._id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleExportSelected = () => {
        const selectedProjects = selectedDept.projects.filter(p => selectedIds.includes(p._id));
        if (context.setSection) {
            context.setSection("import-export", { exportData: selectedProjects, type: "projects" });
        }
    };

    const handleBulkDelete = () => setBulkDeleteOpen(true);

    const confirmBulkDelete = async () => {
        try {
            await Promise.all(selectedIds.map(id => apiFetch(`/api/projects/${id}`, { method: 'DELETE' })));
            fetchMatrix();
            setSelectedIds([]);
            setSelectionMode(false);
            setBulkDeleteOpen(false);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchDepartments = useCallback(async () => {
        if (context.allDepartmentsData?.length > 0) return;
        try {
            const res = await apiFetch("/api/admin/all-db-departments");
            if (res.ok) {
                const data = await res.json();
                setLocalAvailableDepts(data.sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (err) {
            console.error("Failed to fetch departments from settings", err);
        }
    }, [context.allDepartmentsData]);

    const fetchMatrix = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiFetch("/api/admin/departments");
            if (res.ok) {
                const data = await res.json();
                setMatrixData(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch department matrix", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchProjectDetails = useCallback(async (projectId) => {
        try {
            const res = await apiFetch(`/api/projects/${projectId}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            console.error("Failed to fetch project details", err);
        }
        return null;
    }, []);

    useEffect(() => {
        fetchMatrix();
        fetchDepartments();
    }, [fetchMatrix, fetchDepartments]);

    const { allDepartmentsData: contextDepts = [] } = context;
    const availableDepts = contextDepts.length > 0 ? contextDepts : localAvailableDepts;

    // Group data by Department
    const departmentStats = useMemo(() => {
        const stats = {}; // { [deptName]: { projectCount, totalSeats, registeredCount, projects: [] } }

        // Initialize with all system departments
        availableDepts.forEach(dept => {
            if (!stats[dept.name]) {
                stats[dept.name] = {
                    name: dept.name,
                    projectCount: 0,
                    totalSeats: 0,
                    registeredCount: 0,
                    projects: []
                };
            }
        });

        matrixData.forEach(project => {
            // Determine which departments this project belongs to based on viewMode
            const deptsToAssign = new Set();

            if (viewMode === "baseDept") {
                let bDept = project.baseDept;
                if (!bDept && project.departments && project.departments.length > 0) {
                    bDept = project.departments[0].name || project.departments[0].department?.name;
                }
                if (!bDept) bDept = 'General';
                deptsToAssign.add(bDept);
            } else if (viewMode === "studentsView") {
                (project.departments || []).forEach(d => {
                    const dName = d.name || d.department?.name;
                    if (dName) deptsToAssign.add(dName);
                });
            } else if (viewMode === "guideView") {
                if (project.guideDept) deptsToAssign.add(project.guideDept);
            } else if (viewMode === "coGuideView") {
                if (project.coGuideDept) deptsToAssign.add(project.coGuideDept);
            } else if (viewMode === "hodView") {
                if (project.baseDept) deptsToAssign.add(project.baseDept);
                if (project.guideDept) deptsToAssign.add(project.guideDept);
                if (project.coGuideDept) deptsToAssign.add(project.coGuideDept);
            }

            deptsToAssign.forEach(deptName => {
                if (!stats[deptName]) {
                    stats[deptName] = {
                        name: deptName,
                        projectCount: 0,
                        totalSeats: 0,
                        registeredCount: 0,
                        projects: []
                    };
                }

                let seats = project.projectTotalSeats || 0;
                let registered = project.projectTotalRegistered || 0;

                // For studentsView, we use the specific department's capacity
                if (viewMode === "studentsView") {
                    const deptEntry = project.departments?.find(d => (d.name || d.department?.name) === deptName);
                    if (deptEntry) {
                        seats = deptEntry.seats || 0;
                        registered = deptEntry.registered || 0;
                    }
                }

                stats[deptName].projectCount += 1;
                stats[deptName].totalSeats += seats;
                stats[deptName].registeredCount += registered;
                stats[deptName].projects.push({
                    ...project,
                    deptSeats: seats,
                    deptRegistered: registered
                });
            });
        });

        return Object.values(stats).sort((a, b) => a.name.localeCompare(b.name));
    }, [matrixData, availableDepts, viewMode]);


    const handleOpenProject = async (projectSummary) => {
        setProjectLoading(true);
        const resObj = await fetchProjectDetails(projectSummary._id || projectSummary.projectId);
        if (resObj && (resObj.data || resObj.title)) {
            // Backend successResponse wraps data in .data, but some older endpoints might not
            setSelectedProject(resObj.data || resObj);
            setProjectDialogOpen(true);
        }
        setProjectLoading(false);
    };

    const handleFacultyClick = (name, event) => {
        if (event) event.stopPropagation();
        setSelectedFacultyName(name);
        setFacultyDetailsOpen(true);
    };

    const handleToggleStatus = async (project) => {
        try {
            const newStatus = project.status === 'Open' ? 'Closed' : 'Open';
            const res = await apiFetch(`/api/projects/${project._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                fetchMatrix();
                // If we have a selected dept, we need to update its local projects list too
                if (selectedDept) {
                    setSelectedDept(prev => ({
                        ...prev,
                        projects: prev.projects.map(p => p._id === project._id ? { ...p, status: newStatus } : p)
                    }));
                }
            }
        } catch (err) {
            console.error("Failed to toggle status", err);
        }
    };

    const columns = [
        {
            id: "title", label: "Title", minWidth: 200, render: (p) => (
                <Box>
                    <Typography
                        onClick={() => handleOpenProject(p)}
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
            id: "seats", label: "Registered / Seats", minWidth: 150, render: (p) => {
                const reg = p.deptRegistered || 0;
                const total = p.deptSeats || 0;
                return (
                    <Typography
                        onDoubleClick={() => {
                            if (context.setSection) {
                                context.setSection("students", { projectId: p._id });
                            }
                        }}
                        sx={{ cursor: context.setSection ? "pointer" : "default", color: "primary.main", textDecoration: context.setSection ? "underline" : "none" }}
                        title={context.setSection ? "Double click to view assigned students" : ""}
                    >
                        {reg} / {total}
                    </Typography>
                );
            }
        },
        {
            id: "status", label: "Status", minWidth: 120, render: (p) => (
                <div onClick={() => handleToggleStatus(p)} style={{ cursor: 'pointer', display: 'inline-block' }}>
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
                                if (context.setSection) context.setSection("tasks", { projectId: p._id });
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
                                if (context.setSection) context.setSection("attendance", { projectId: p._id });
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
                                if (context.setSection) context.setSection("reviews", { projectId: p._id });
                            }}
                        >
                            <RateReviewIcon fontSize="small" color="secondary" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            )
        }
    ];

    if (loading && matrixData.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
            {!selectedDept ? (
                <>
                    <PageHeader
                        title="Departments"
                        subtitle="Detailed overview of project distribution and student registrations across departments."
                        action={
                            <FormControl variant="outlined" size="small" sx={{ minWidth: 180 }}>
                                <InputLabel id="view-mode-label">Select View</InputLabel>
                                <Select
                                    labelId="view-mode-label"
                                    value={viewMode}
                                    onChange={(e) => setViewMode(e.target.value)}
                                    label="Select View"
                                    sx={{
                                        borderRadius: '12px',
                                        bgcolor: '#fff',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#e2e8f0'
                                        }
                                    }}
                                >
                                    <MenuItem value="baseDept">Base Dept</MenuItem>
                                    <MenuItem value="studentsView">Students View</MenuItem>
                                    <MenuItem value="guideView">Guide View</MenuItem>
                                    <MenuItem value="coGuideView">Co-Guide View</MenuItem>
                                    <MenuItem value="hodView">HOD View</MenuItem>
                                </Select>
                            </FormControl>
                        }
                    />

                    <Grid container spacing={{ xs: 2, md: 3 }}>
                        {departmentStats.map((dept) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={dept.name}>
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: '20px',
                                        border: '1px solid #f1f5f9',
                                        bgcolor: '#ffffff',
                                        height: '100%',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)',
                                            borderColor: alpha(theme.palette.primary.main, 0.3),
                                        }
                                    }}
                                >
                                    <CardActionArea onClick={() => setSelectedDept(dept)} sx={{ height: '100%' }}>
                                        <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: 44,
                                                        height: 44,
                                                        borderRadius: '12px',
                                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                        color: theme.palette.primary.main
                                                    }}
                                                >
                                                    <ApartmentIcon fontSize="medium" />
                                                </Box>
                                                <Chip
                                                    label={`${dept.projectCount} Projects`}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 700,
                                                        bgcolor: '#f8fafc',
                                                        color: '#64748b',
                                                        border: '1px solid #e2e8f0',
                                                        fontSize: '0.75rem'
                                                    }}
                                                />
                                            </Box>

                                            <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#1e293b', lineHeight: 1.2, flexGrow: 1 }}>
                                                {dept.name}
                                            </Typography>

                                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Registered:</Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>{dept.registeredCount}</Typography>
                                            </Box>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            </Grid>
                        ))}
                        {departmentStats.length === 0 && (
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ p: 5, borderRadius: 6, textAlign: 'center', border: '1px dashed #cbd5e1', bgcolor: alpha('#f1f5f9', 0.5) }}>
                                    <Typography variant="h6" fontWeight={700} color="text.secondary">No departments available.</Typography>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                </>
            ) : (
                <>
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        spacing={2}
                        sx={{ mb: 4 }}
                    >
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <IconButton
                                onClick={() => setSelectedDept(null)}
                                sx={{
                                    bgcolor: '#fff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    '&:hover': { bgcolor: '#f8fafc' },
                                    width: 40,
                                    height: 40
                                }}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                                    {selectedDept.name} Projects
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.2 }}>
                                    {selectedDept.projectCount} projects found • {
                                        viewMode === 'baseDept' ? 'Base Dept View' :
                                            viewMode === 'studentsView' ? 'Students View' :
                                                viewMode === 'guideView' ? 'Guide View' :
                                                    viewMode === 'coGuideView' ? 'Co-Guide View' : 'HOD View'
                                    }
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
                            <SearchBar
                                value={localSearchQuery}
                                onChange={(e) => setLocalSearchQuery(e.target.value)}
                                onClear={() => setLocalSearchQuery("")}
                                placeholder="Search Data"
                            />

                            <Button
                                variant={selectionMode ? "contained" : "outlined"}
                                color={selectionMode ? "secondary" : "primary"}
                                startIcon={selectionMode ? <CloseIcon /> : <CheckBoxIcon />}
                                onClick={() => {
                                    setSelectionMode(!selectionMode);
                                    setSelectedIds([]);
                                }}
                                size="small"
                                sx={{ borderRadius: '10px', height: 40 }}
                            >
                                {selectionMode ? "Cancel Selection" : "Select"}
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                onClick={() => context.setSection && context.setSection("projects", { openAdd: true, defaultDept: selectedDept.name })}
                                sx={{ borderRadius: '10px', height: 40 }}
                            >
                                Add Project
                            </Button>
                        </Stack>
                    </Stack>

                    {selectionMode && (
                        <Paper
                            elevation={0}
                            sx={{
                                p: 2,
                                mb: 3,
                                bgcolor: alpha(theme.palette.secondary.main, 0.04),
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                                animation: 'fadeIn 0.3s ease'
                            }}
                        >
                            <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.secondary.dark }}>
                                {selectedIds.length} projects selected
                            </Typography>
                            <Button
                                variant="outlined"
                                color="secondary"
                                size="small"
                                onClick={() => setSelectedIds(filteredDeptProjects.map(p => p._id))}
                                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                            >
                                Select All ({filteredDeptProjects.length})
                            </Button>
                            {selectedIds.length > 0 && (
                                <>
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        size="small"
                                        onClick={handleExportSelected}
                                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                        Export Selected
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        size="small"
                                        onClick={handleBulkDelete}
                                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                        Delete Selected
                                    </Button>
                                </>
                            )}
                        </Paper>
                    )}

                    <DataTable
                        columns={columns}
                        rows={filteredDeptProjects}
                        loading={false}
                        emptyMessage="No projects found matching your search."
                        stickyHeader={false}
                        selectionMode={selectionMode}
                        selectedIds={selectedIds}
                        onSelectOne={handleSelectOne}
                        onSelectAll={handleSelectAll}
                    />

                    <ConfirmDialog
                        open={bulkDeleteOpen}
                        onCancel={() => setBulkDeleteOpen(false)}
                        onConfirm={confirmBulkDelete}
                        title="Bulk Delete Projects"
                        content={`Are you sure you want to delete ${selectedIds.length} projects? This action cannot be undone.`}
                        confirmText="Delete All"
                        confirmColor="error"
                    />
                </>
            )}

            {selectedProject && (
                <ProjectDetailsDialog
                    open={projectDialogOpen}
                    onClose={() => {
                        setProjectDialogOpen(false);
                        setSelectedProject(null);
                    }}
                    project={selectedProject}
                />
            )}

            <FacultyDetailsDialog
                open={facultyDetailsOpen}
                onClose={() => setFacultyDetailsOpen(false)}
                facultyName={selectedFacultyName}
            />

            {(projectLoading) && (
                <Box sx={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    bgcolor: 'rgba(255,255,255,0.7)', zIndex: 9999,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <CircularProgress />
                </Box>
            )}
        </Box>
    );
}
