import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  Button,
  CircularProgress,
  Alert,
  Badge,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Close as CloseIcon
} from "@mui/icons-material";

import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { apiFetch } from '../../core/services/apiFetch';
import useRequireRole from "../../core/hooks/useRequireRole";
import { ROLES } from "../../core/constants/roles";
import DataTable from "../../components/common/DataTable";
import ProjectDetailsDialog from "../../components/common/ProjectDetailsDialog";
import PageHeader from "../../components/common/PageHeader";

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`level-tabpanel-${index}`}
      aria-labelledby={`level-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function AdminLevels(props) {
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const context = props.context || outletContext || {};

  const { authorized } = useRequireRole(ROLES.ADMIN);

  const [tab, setTab] = useState(0);
  const [students, setStudents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewProject, setViewProject] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    if (!authorized) return;
    fetchStudents();
    fetchProjects();
  }, [authorized, debouncedSearchQuery]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) {
        params.append("search", debouncedSearchQuery);
      }
      params.append("limit", "2000"); // Increase limit to fetch all students for level management
      const res = await apiFetch(`/api/admin/students?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      const json = await res.json();
      const extractedData = json.data?.data || json.data || json;
      const studentArray = Array.isArray(extractedData) ? extractedData : [];
      setStudents(studentArray.map(s => ({ ...s, level: s.level || 1 })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await apiFetch(`/api/projects`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      const extracted = data.data?.data || data.data || data;
      setProjects(Array.isArray(extracted) ? extracted : []);
    } catch (err) {
      if (!error) setError(err.message);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setSelected([]); // Clear selection when changing tabs
  };

  const handleSelectAll = (event, studentList) => {
    if (event.target.checked) {
      setSelected(studentList.map((s) => s._id));
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (id) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex > -1) {
      newSelected = selected.filter(studentId => studentId !== id);
    }
    setSelected(newSelected);
  };

  const handleMoveToLevel2 = async () => {
    if (selected.length === 0) {
      alert("Please select students to move.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/students/move-level", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentIds: selected, level: 2 })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to move students");
      }
      alert("Students moved to Level 2 successfully.");
      await fetchStudents(); // Refresh data
      setSelected([]);
    } catch (err) {
      setError(err.message);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openProjectDetailsDialog = (project) => {
    if (!project) return;
    // Find full project data from our pre-fetched local projects list to get seats/counts
    const fullProject = projects.find(p => p._id === (project._id || project));
    setViewProject(fullProject || project);
    setViewOpen(true);
  };

  const level1Students = students.filter(s => s.level === 1);
  const level2Students = students.filter(s => s.level === 2);

  const renderStudentTable = (studentList, level, showCheckbox = true) => (
    <DataTable
      columns={[
        { id: "name", label: "Name", minWidth: 150, maxWidth: 250 },
        { id: "studentId", label: "Student ID", minWidth: 120 },
        { id: "department", label: "Department", minWidth: 150, render: (s) => s.department?.name || s.department || "-" },
        {
          id: "project", label: "Project Details", minWidth: 220, maxWidth: 350, render: (s) => {
            const hasApplied = s.appliedProject;
            const appCount = (s.projectApplications || []).length;
            const totalApps = (hasApplied ? 1 : 0) + appCount;

            return (
              <Box onClick={() => hasApplied && openProjectDetailsDialog(s.appliedProject)} sx={{ cursor: hasApplied ? "pointer" : "default" }}>
                <Typography
                  noWrap
                  sx={{
                    color: hasApplied ? "primary.main" : "text.secondary",
                    fontWeight: hasApplied ? 600 : 400,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    fontSize: '0.875rem'
                  }}
                  title={hasApplied?.title || "No Primary Project"}
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
        {
          id: "status", label: "Status", minWidth: 150, render: (s) => (
            <Chip
              label={`${s.status || "Pending"}${s.status !== 'Rejected' ? ` L${s.level || 1}` : ''}`}
              color={s.status === "Approved" ? "success" : s.status === "Rejected" ? "error" : "warning"}
              size="small"
            />
          )
        }
      ]}
      rows={studentList}
      loading={loading}
      selectionMode={showCheckbox}
      selectedIds={selected}
      onSelectAll={(e) => handleSelectAll(e, studentList)}
      onSelectOne={handleSelectOne}
      emptyMessage="No students in this level."
    />
  );

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <style>{`
        *:not(input, textarea, [contenteditable]) {
          caret-color: transparent;
        }
      `}</style>
      <PageHeader
        title="Student Levels"
        action={
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TextField
              label="Search Students"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              sx={{ width: { xs: "100%", sm: searchFocused ? 350 : 250 }, transition: "width 0.3s ease-in-out", minWidth: 160 }}
              InputProps={{
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery("")}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />
            {tab === 0 && (
              <Button
                variant="contained"
                disabled={selected.length === 0 || loading}
                onClick={handleMoveToLevel2}
              >
                Move {selected.length > 0 ? selected.length : ''} to Level 2
              </Button>
            )}
          </Box>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={handleTabChange} aria-label="student levels tabs">
            <Tab
              id="level-tab-0"
              label={
                <Badge color="error" badgeContent={level1Students.length} max={999} invisible={level1Students.length === 0}>
                  <span style={{ paddingRight: level1Students.length > 0 ? 8 : 0 }}>Level 1</span>
                </Badge>
              }
            />
            <Tab
              id="level-tab-1"
              label={
                <Badge color="error" badgeContent={level2Students.length} max={999} invisible={level2Students.length === 0}>
                  <span style={{ paddingRight: level2Students.length > 0 ? 8 : 0 }}>Level 2</span>
                </Badge>
              }
            />
          </Tabs>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
        ) : (
          <>
            <TabPanel value={tab} index={0}>
              {renderStudentTable(level1Students, 1)}
            </TabPanel>
            <TabPanel value={tab} index={1}>
              {renderStudentTable(level2Students, 2, false)}
            </TabPanel>
          </>
        )}
      </Paper>

      <ProjectDetailsDialog open={viewOpen} onClose={() => setViewOpen(false)} project={viewProject} />
    </Box>
  );
}


