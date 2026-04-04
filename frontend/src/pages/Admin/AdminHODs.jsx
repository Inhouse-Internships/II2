import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Paper,
    CircularProgress,
    IconButton,
    MenuItem,
    InputAdornment
} from "@mui/material";
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    CheckBox as CheckBoxIcon,
    Search as SearchIcon
} from "@mui/icons-material";
import { apiFetch } from '../../core/services/apiFetch';
import { useSnackbar } from "notistack";
import DataTable from "../../components/common/DataTable";
import PageHeader from "../../components/common/PageHeader";
import SearchBar from "../../components/common/SearchBar";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StatusChip from "../../components/common/StatusChip";
import EmailSuffixToggle from "../../components/common/EmailSuffixToggle";
import { UNIVERSITY_EMAIL_DOMAINS } from "../../core/constants/app";

export default function AdminHODs() {
    const [hods, setHods] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedHOD, setSelectedHOD] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [hodToDelete, setHodToDelete] = useState(null);
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        program: "",
        department: "",
        phone: "",
        password: ""
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [hodRes, progRes] = await Promise.all([
                apiFetch("/api/admin/hod"),
                apiFetch("/api/admin/programs")
            ]);

            const hodData = await hodRes.json();
            const progData = await progRes.json();

            setHods(Array.isArray(hodData) ? hodData : (hodData.data || []));
            setPrograms(Array.isArray(progData) ? progData : (progData.data || []));
        } catch (error) {
            enqueueSnackbar("Failed to fetch HOD", { variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenDialog = () => {
        setFormData({ name: "", email: "", program: "", department: "", phone: "", password: "" });
        setSelectedProgram(null);
        setOpenAddDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenAddDialog(false);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.department || (!isEditing && !formData.password)) {
            enqueueSnackbar("Please fill all required fields", { variant: "warning" });
            return;
        }

        try {
            const payload = { ...formData };
            if (payload.email && !payload.email.includes('@')) {
                const defaultDomain = (UNIVERSITY_EMAIL_DOMAINS && UNIVERSITY_EMAIL_DOMAINS.length > 0) ? UNIVERSITY_EMAIL_DOMAINS[0] : '@adityauniversity.in';
                payload.email = `${payload.email}${defaultDomain}`;
            }

            const url = isEditing ? `/api/admin/hod/${selectedHOD._id}` : "/api/admin/hod";
            const method = isEditing ? "PUT" : "POST";
            const res = await apiFetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || `Failed to ${isEditing ? "update" : "create"} HOD`);
            }

            enqueueSnackbar(`HOD ${isEditing ? "updated" : "created"} successfully`, { variant: "success" });
            setOpenAddDialog(false);
            setDetailsOpen(false);
            setIsEditing(false);
            fetchData();
        } catch (error) {
            enqueueSnackbar(error.message || `Failed to ${isEditing ? "update" : "create"} HOD`, { variant: "error" });
        }
    };

    const handleDelete = (id) => {
        setHodToDelete(id);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!hodToDelete) return;
        try {
            const res = await apiFetch(`/api/admin/hod/${hodToDelete}`, { method: "DELETE" });
            if (res.ok) {
                enqueueSnackbar("HOD deleted successfully", { variant: "success" });
                setDetailsOpen(false);
                fetchData();
            } else {
                enqueueSnackbar("Failed to delete HOD", { variant: "error" });
            }
        } catch (err) {
            enqueueSnackbar("Server error", { variant: "error" });
        } finally {
            setDeleteConfirmOpen(false);
            setHodToDelete(null);
        }
    };

    const handleBulkDelete = async () => {
        setBulkDeleteConfirmOpen(true);
    };

    const confirmBulkDelete = async () => {
        try {
            await Promise.all(selectedIds.map(id => apiFetch(`/api/admin/hod/${id}`, { method: "DELETE" })));
            enqueueSnackbar(`${selectedIds.length} HODs deleted successfully`, { variant: "success" });
            setBulkDeleteConfirmOpen(false);
            setSelectedIds([]);
            fetchData();
        } catch (err) {
            enqueueSnackbar("Error during bulk delete", { variant: "error" });
        }
    };

    const openDetailsDialog = (hod) => {
        setSelectedHOD(hod);
        let emailPrefix = hod.email || "";
        if (UNIVERSITY_EMAIL_DOMAINS && UNIVERSITY_EMAIL_DOMAINS.length > 0) {
            for (const domain of UNIVERSITY_EMAIL_DOMAINS) {
                if (emailPrefix.toLowerCase().endsWith(domain.toLowerCase())) {
                    emailPrefix = emailPrefix.substring(0, emailPrefix.length - domain.length);
                    break;
                }
            }
        }
        setFormData({
            name: hod.name,
            email: emailPrefix,
            program: hod.program || "",
            department: hod.department,
            phone: hod.phone || "",
            password: ""
        });
        const prog = programs.find(p => p.name === hod.program);
        setSelectedProgram(prog || null);
        setIsEditing(false);
        setDetailsOpen(true);
    };

    const handleSelectAll = (event) => {
        if (event.target.checked) {
            setSelectedIds(hods.map(h => h._id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <PageHeader
                title="HOD Management"
                action={
                    <Box sx={{ display: "flex", gap: 2 }}>
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
                            variant={selectionMode ? "contained" : "outlined"}
                            color={selectionMode ? "secondary" : "primary"}
                            startIcon={selectionMode ? <CloseIcon /> : <CheckBoxIcon />}
                            onClick={() => {
                                setSelectionMode(!selectionMode);
                                setSelectedIds([]);
                            }}
                        >
                            {selectionMode ? "Cancel" : "Select"}
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleOpenDialog}
                        >
                            Add HOD
                        </Button>
                    </Box>
                }
            />

            {selectionMode && selectedIds.length > 0 && (
                <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, bgcolor: "#f5f5f5", p: 1, borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ ml: 1 }}>{selectedIds.length} HODs selected</Typography>
                    <Button variant="contained" color="error" size="small" onClick={handleBulkDelete}>
                        Delete Selected
                    </Button>
                </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <DataTable
                    columns={[
                        {
                            id: "name", label: "Name", minWidth: 150, maxWidth: 250, render: (row) => (
                                <Typography
                                    onClick={() => openDetailsDialog(row)}
                                    sx={{ cursor: "pointer", color: "primary.main", fontWeight: "bold" }}
                                >
                                    {row.name}
                                </Typography>
                            )
                        },
                        { id: "email", label: "Email", minWidth: 200, maxWidth: 300 },
                        { id: "program", label: "Program", minWidth: 150, render: (row) => row.program?.name || row.program || "-" },
                        { id: "department", label: "Department", minWidth: 150, render: (row) => row.department?.name || row.department || "-" },
                        { id: "projectsHandling", label: "Projects Handling", minWidth: 150 },
                        { id: "phone", label: "Phone", minWidth: 100, render: (row) => row.phone || "N/A" },
                        {
                            id: "actions", label: "Actions", minWidth: 100, align: "center", render: (row) => (
                                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(row._id); }}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            )
                        }
                    ]}
                    rows={hods.filter(h =>
                        (h.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (h.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (h.department || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (h.program || "").toLowerCase().includes(searchQuery.toLowerCase())
                    )}
                    loading={loading}
                    emptyMessage="No HOD found. Create one to get started."
                    fixedLayout={false}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onSelectAll={handleSelectAll}
                    onSelectOne={handleSelectOne}
                />
            </Box>

            <Dialog
                open={openAddDialog}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
                disableRestoreFocus
                disableEnforceFocus
            >
                <DialogTitle>Add New HOD</DialogTitle>
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <TextField select margin="dense" label="Program" name="program" fullWidth required autoFocus value={formData.program} onChange={(e) => {
                            const prog = (programs || []).find(p => p.name === e.target.value);
                            setSelectedProgram(prog);
                            setFormData({ ...formData, program: e.target.value, department: "" });
                        }}>
                            {(programs || []).map((prog) => (
                                <MenuItem key={prog._id} value={prog.name}>{prog.name}</MenuItem>
                            ))}
                        </TextField>
                        <TextField select margin="dense" label="Department" name="department" fullWidth required disabled={!selectedProgram} value={formData.department} onChange={handleChange} helperText={!selectedProgram ? "Select a program first" : ""}>
                            {(selectedProgram?.departments || []).map((dept) => (
                                <MenuItem key={dept._id} value={dept.name}>{dept.name}</MenuItem>
                            ))}
                        </TextField>
                        <TextField margin="dense" label="Name" name="name" fullWidth required value={formData.name} onChange={handleChange} />
                        <TextField
                            margin="dense"
                            label="Email"
                            name="email"
                            fullWidth
                            required
                            value={formData.email}
                            onChange={handleChange}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <EmailSuffixToggle
                                            value={(UNIVERSITY_EMAIL_DOMAINS && UNIVERSITY_EMAIL_DOMAINS.length > 0) ? UNIVERSITY_EMAIL_DOMAINS[0] : '@adityauniversity.in'}
                                            onChange={() => { }}
                                            disabled={true}
                                        />
                                    </InputAdornment>
                                )
                            }}
                        />
                        <TextField margin="dense" label="Phone" name="phone" fullWidth value={formData.phone} onChange={handleChange} />
                        <TextField margin="dense" label="Password" name="password" type="password" fullWidth required value={formData.password} onChange={handleChange} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Cancel</Button>
                        <Button type="submit" variant="contained">Create HOD</Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog
                open={detailsOpen}
                onClose={() => { setDetailsOpen(false); setIsEditing(false); }}
                maxWidth="sm"
                fullWidth
                disableRestoreFocus
                disableEnforceFocus
            >
                <DialogTitle>HOD Details</DialogTitle>
                <DialogContent>
                    {selectedHOD && (
                        isEditing ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                                <TextField select margin="dense" label="Program" name="program" fullWidth required value={formData.program} onChange={(e) => {
                                    const prog = (programs || []).find(p => p.name === e.target.value);
                                    setSelectedProgram(prog);
                                    setFormData({ ...formData, program: e.target.value, department: "" });
                                }}>
                                    {(programs || []).map((prog) => (
                                        <MenuItem key={prog._id} value={prog.name}>{prog.name}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField select margin="dense" label="Department" name="department" fullWidth required disabled={!selectedProgram} value={formData.department} onChange={handleChange}>
                                    {(selectedProgram?.departments || []).map((dept) => (
                                        <MenuItem key={dept._id} value={dept.name}>{dept.name}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField margin="dense" label="Name" name="name" fullWidth required value={formData.name} onChange={handleChange} />
                                <TextField
                                    margin="dense"
                                    label="Email"
                                    name="email"
                                    fullWidth
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <EmailSuffixToggle
                                                    value={(UNIVERSITY_EMAIL_DOMAINS && UNIVERSITY_EMAIL_DOMAINS.length > 0) ? UNIVERSITY_EMAIL_DOMAINS[0] : '@adityauniversity.in'}
                                                    onChange={() => { }}
                                                    disabled={true}
                                                />
                                            </InputAdornment>
                                        )
                                    }}
                                />
                                <TextField margin="dense" label="Phone" name="phone" fullWidth value={formData.phone} onChange={handleChange} />
                                <TextField margin="dense" label="Password" name="password" type="password" fullWidth placeholder="Leave empty to keep current" value={formData.password} onChange={handleChange} />
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                                    <Box><Typography variant="subtitle2" color="textSecondary">Name</Typography><Typography variant="body1">{selectedHOD.name}</Typography></Box>
                                    <Box><Typography variant="subtitle2" color="textSecondary">Email</Typography><Typography variant="body1">{selectedHOD.email}</Typography></Box>
                                    <Box><Typography variant="subtitle2" color="textSecondary">Phone</Typography><Typography variant="body1">{selectedHOD.phone || "-"}</Typography></Box>
                                    <Box><Typography variant="subtitle2" color="textSecondary">Department</Typography><Typography variant="body1">{selectedHOD.department}</Typography></Box>
                                    <Box><Typography variant="subtitle2" color="textSecondary">Program</Typography><Typography variant="body1">{selectedHOD.program || "-"}</Typography></Box>
                                    <Box><Typography variant="subtitle2" color="textSecondary">Projects Handling</Typography><Typography variant="body1">{selectedHOD.projectsHandling}</Typography></Box>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                                    <StatusChip status={selectedHOD.status} />
                                </Box>
                            </Box>
                        )
                    )}
                </DialogContent>
                <DialogActions>
                    {isEditing ? (
                        <>
                            <Button onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button variant="contained" onClick={handleSubmit}>Save Changes</Button>
                        </>
                    ) : (
                        <>
                            <Button color="error" onClick={() => handleDelete(selectedHOD._id)}>Delete</Button>
                            <Box sx={{ flexGrow: 1 }} />
                            <Button variant="contained" onClick={() => setIsEditing(true)}>Edit</Button>
                            <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={deleteConfirmOpen}
                onCancel={() => { setDeleteConfirmOpen(false); setHodToDelete(null); }}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                content="Are you sure you want to delete this HOD? This action cannot be undone."
                confirmText="Delete"
                confirmColor="error"
            />

            <ConfirmDialog
                open={bulkDeleteConfirmOpen}
                onCancel={() => setBulkDeleteConfirmOpen(false)}
                onConfirm={confirmBulkDelete}
                title="Confirm Bulk Deletion"
                content={`Are you sure you want to delete ${selectedIds.length} HODs? This action cannot be undone.`}
                confirmText="Delete"
                confirmColor="error"
            />
        </Box>
    );
}
