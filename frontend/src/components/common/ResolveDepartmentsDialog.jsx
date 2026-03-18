import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Chip,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from "@mui/material";
import { apiFetch } from "../../core/services/apiFetch";

export default function ResolveDepartmentsDialog({
    open,
    onClose,
    unassignedDepartments,
    programs,
    onSuccess
}) {
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [assignProgramId, setAssignProgramId] = useState("");
    const [loading, setLoading] = useState(false);
    const [currentUnassigned, setCurrentUnassigned] = useState([]);

    // Track objects instead of just names to allow deleting by ID
    useEffect(() => {
        if (unassignedDepartments) {
            // Normalize to objects if strings are passed
            const normalized = unassignedDepartments.map(d =>
                typeof d === "string" ? { name: d } : d
            );
            setCurrentUnassigned(normalized);
            setSelectedDepts([]); // Still tracking selected names for bulk assign
            setAssignProgramId("");
        }
    }, [unassignedDepartments, open]);

    const handleBulkAssign = async () => {
        if (!assignProgramId || selectedDepts.length === 0) return;
        setLoading(true);
        try {
            await Promise.all(
                selectedDepts.map(async (deptName) => {
                    const res = await apiFetch(`/api/admin/programs/${assignProgramId}/departments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: deptName })
                    });
                    return res;
                })
            );

            const remaining = currentUnassigned.filter(d => !selectedDepts.includes(d.name));
            setCurrentUnassigned(remaining);
            setSelectedDepts([]);
            setAssignProgramId("");

            if (onSuccess) onSuccess(remaining);
        } catch (err) {
            alert("Error assigning departments");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDept = async (dept) => {
        if (!dept._id) {
            // If it's just a local unsaved string, just remove it from UI
            const remaining = currentUnassigned.filter(d => d.name !== dept.name);
            setCurrentUnassigned(remaining);
            if (onSuccess) onSuccess(remaining);
            return;
        }

        if (!window.confirm(`Are you sure you want to permanently delete the department "${dept.name}"? This can only be done if it has no associated projects or users.`)) return;

        setLoading(true);
        try {
            const res = await apiFetch(`/api/admin/departments/${dept._id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                const remaining = currentUnassigned.filter(d => d._id !== dept._id);
                setCurrentUnassigned(remaining);
                if (onSuccess) onSuccess(remaining);
            } else {
                const data = await res.json();
                alert(data.message || "Delete failed. The department might be in use.");
            }
        } catch (err) {
            alert("Network error while deleting department");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableEnforceFocus>
            <DialogTitle>Assign New Departments to Program</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" gutterBottom color="textSecondary">
                    These departments were found but haven't been assigned to a program yet.
                </Typography>
                <Box sx={{ mt: 2, mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                        1. Select Departments
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            p: 2,
                            bgcolor: "grey.50",
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "divider"
                        }}
                    >
                        {currentUnassigned.map((dept) => (
                            <Chip
                                key={dept._id || dept.name}
                                label={dept.name}
                                color={selectedDepts.includes(dept.name) ? "primary" : "default"}
                                onClick={() => {
                                    setSelectedDepts((prev) =>
                                        prev.includes(dept.name)
                                            ? prev.filter((n) => n !== dept.name)
                                            : [...prev, dept.name]
                                    );
                                }}
                                onDelete={() => handleDeleteDept(dept)}
                                variant={selectedDepts.includes(dept.name) ? "filled" : "outlined"}
                                sx={{ bgcolor: selectedDepts.includes(dept.name) ? "primary.50" : "white" }}
                            />
                        ))}
                        {currentUnassigned.length === 0 && (
                            <Typography variant="body2" color="textSecondary">
                                All departments resolved!
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Box>
                    <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                        2. Assign to Program
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <FormControl fullWidth size="small">
                            <InputLabel>Select Program</InputLabel>
                            <Select
                                value={assignProgramId}
                                label="Select Program"
                                onChange={(e) => setAssignProgramId(e.target.value)}
                            >
                                {programs.map((p) => (
                                    <MenuItem key={p._id} value={p._id}>
                                        {p.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={handleBulkAssign}
                            disabled={!assignProgramId || selectedDepts.length === 0 || loading || currentUnassigned.length === 0}
                        >
                            {loading ? "Assigning..." : "Assign"}
                        </Button>
                    </Stack>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
