import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// MUI Core
import { ThemeProvider } from "@mui/material/styles";
import {
  Box, CssBaseline, AppBar, Toolbar, Typography, TextField,
  IconButton, Divider, Drawer, InputAdornment, Tooltip,
  Chip,
} from "@mui/material";
import {
  Search, FolderOpen, OpenInNew,
  DarkMode, LightMode, DriveFileMove,
} from "@mui/icons-material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

// Theme
import { getTheme } from "./theme";

const DRAWER_WIDTH = 240;
const APP_VERSION = "v0.8.0";

const columns: GridColDef[] = [
  {
    field: "sender",
    headerName: "From",
    flex: 1,
    minWidth: 200,
    valueGetter: (value: any) =>
      typeof value === "string" ? value.split("<")[0].trim() : "",
  },
  { field: "subject", headerName: "Subject", flex: 2, minWidth: 300 },
  { field: "date", headerName: "Received", width: 200 },
];

export default function App() {
  const [emails, setEmails] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  const theme = useMemo(() => getTheme(darkMode ? "dark" : "light"), [darkMode]);

  // Load saved archive on startup
  useEffect(() => {
    const init = async () => {
      const saved = await invoke<string | null>("get_registered_path");
      if (saved) {
        setFolderPath(saved);
        const data = await invoke<any[]>("search_emails", { query: "" });
        setEmails(data);
      }
    };
    init();
  }, []);

  const handleRegisterFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        await invoke("index_folder", { folderPath: selected });
        setFolderPath(selected);
        const data = await invoke<any[]>("search_emails", { query: searchQuery });
        setEmails(data);
      }
    } catch (e) {
      console.error("Failed to register folder:", e);
    }
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    const data = await invoke<any[]>("search_emails", { query: val });
    setEmails(data);
  };

  // Full path broken into segments
  const pathSegments = folderPath
    ? folderPath.replace(/\\/g, "/").split("/").filter(Boolean)
    : [];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
        <CssBaseline />

        {/* ─────────────── SIDEBAR ─────────────── */}
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          {/* Logo block */}
          <Box
            sx={{
              height: 52,
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: "0.95rem",
                lineHeight: 1,
                color: "primary.main",
                letterSpacing: "-0.5px",
              }}
            >
              eml-explorer
            </Typography>
            <Typography
              sx={{
                fontSize: "0.62rem",
                lineHeight: 1,
                color: "text.disabled",
              }}
            >
              {APP_VERSION}
            </Typography>
          </Box>

          {/* Content */}
          <Box sx={{ flexGrow: 1, overflow: "hidden", display: "flex", flexDirection: "column", p: 1.5 }}>

            {/* ── CURRENT ARCHIVE label + change icon ── */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 0.5, px: 0.5 }}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: 1, color: "text.disabled", flexGrow: 1, fontSize: "0.6rem" }}
              >
                CURRENT ARCHIVE
              </Typography>
              <Tooltip title="Change archive location" placement="right" arrow>
                <IconButton
                  size="small"
                  onClick={handleRegisterFolder}
                  sx={{ p: 0.4, color: "text.disabled", "&:hover": { color: "primary.main" } }}
                >
                  <DriveFileMove sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* ── Archive path card ── */}
            {folderPath ? (
              <Tooltip title={folderPath} placement="right" arrow>
                <Box
                  sx={{
                    bgcolor: "action.selected",
                    borderRadius: 1.5,
                    p: 1.25,
                    mb: 1,
                    cursor: "default",
                  }}
                >
                  {/* Folder name + badge */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                    <FolderOpen sx={{ fontSize: 14, color: "primary.main" }} />
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: "text.primary", flexGrow: 1, fontSize: "0.72rem" }}
                      noWrap
                    >
                      {pathSegments[pathSegments.length - 1]}
                    </Typography>
                    <Chip
                      label="Indexed"
                      size="small"
                      color="success"
                      sx={{ height: 16, fontSize: "0.55rem", fontWeight: 700, px: 0.25 }}
                    />
                  </Box>

                  {/* Full path as breadcrumb */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.1 }}>
                    {pathSegments.map((seg, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "center" }}>
                        <Box sx={{ width: i * 6, minWidth: i * 6 }} />
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: "0.6rem",
                            lineHeight: 1.5,
                            color:
                              i === pathSegments.length - 1
                                ? "text.primary"
                                : "text.disabled",
                            fontWeight: i === pathSegments.length - 1 ? 600 : 400,
                          }}
                          noWrap
                        >
                          {i > 0 ? "›  " : "/"}{seg}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Tooltip>
            ) : (
              <Box
                onClick={handleRegisterFolder}
                sx={{
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 1.5,
                  p: 1.5,
                  mb: 1,
                  cursor: "pointer",
                  textAlign: "center",
                  "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                  transition: "all 0.15s",
                }}
              >
                <FolderOpen sx={{ fontSize: 22, color: "text.disabled", mb: 0.5 }} />
                <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 500 }}>
                  Open Archive
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 1 }} />

            {/* Email count */}
            {emails.length > 0 && (
              <Typography
                variant="caption"
                sx={{ color: "text.disabled", px: 0.5, fontSize: "0.65rem" }}
              >
                {emails.length.toLocaleString()} emails indexed
              </Typography>
            )}

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* ── Dark mode toggle (bottom of sidebar) ── */}
            <Divider sx={{ mb: 1 }} />
            <Box sx={{ display: "flex", alignItems: "center", px: 0.5, pb: 0.5 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", flexGrow: 1, fontSize: "0.65rem" }}>
                {darkMode ? "Dark" : "Light"} mode
              </Typography>
              <Tooltip title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"} placement="right" arrow>
                <IconButton
                  size="small"
                  onClick={() => setDarkMode((d) => !d)}
                  sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                >
                  {darkMode ? <LightMode sx={{ fontSize: 16 }} /> : <DarkMode sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Drawer>

        {/* ─────────────── MAIN ─────────────── */}
        <Box
          component="main"
          sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          {/* Top Bar — search centred */}
          <AppBar position="static" elevation={0}>
            <Toolbar sx={{ justifyContent: "center" }}>
              {selectedEmail && (
                <Tooltip title="Back to list">
                  <IconButton
                    onClick={() => setSelectedEmail(null)}
                    sx={{ position: "absolute", left: 16, color: "inherit" }}
                  >
                    <Search sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
              <TextField
                size="small"
                variant="outlined"
                placeholder="Search current mailbox…"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ fontSize: 16, color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  width: 520,
                  "& .MuiOutlinedInput-root": {
                    bgcolor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    "& fieldset": { border: "none" },
                    borderRadius: 2,
                    fontSize: "0.8rem",
                  },
                }}
              />
            </Toolbar>
          </AppBar>

          {/* Content */}
          <Box sx={{ flexGrow: 1, p: 1.5, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selectedEmail ? (
              /* ── Email List ── */
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  overflow: "hidden",
                  boxShadow: darkMode
                    ? "0 0 0 1px rgba(255,255,255,0.06)"
                    : "0 0 0 1px rgba(0,0,0,0.07)",
                }}
              >
                {emails.length === 0 ? (
                  <Box
                    sx={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1.5,
                    }}
                  >
                    <FolderOpen sx={{ fontSize: 44, color: "text.disabled" }} />
                    <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                      No emails found. Open an archive folder to begin.
                    </Typography>
                  </Box>
                ) : (
                  <DataGrid
                    rows={emails}
                    getRowId={(row) => row.path}
                    columns={columns}
                    checkboxSelection
                    disableRowSelectionOnClick
                    onRowClick={(params, event) => {
                      const target = event.target as HTMLElement;
                      if (!target.closest(".MuiCheckbox-root")) {
                        setSelectedEmail(params.row);
                      }
                    }}
                    pagination
                    initialState={{
                      pagination: { paginationModel: { pageSize: 50 } },
                    }}
                    pageSizeOptions={[25, 50, 100]}
                    sx={{ border: "none" }}
                  />
                )}
              </Box>
            ) : (
              /* ── Email Detail ── */
              <Box
                sx={{
                  bgcolor: "background.paper",
                  height: "100%",
                  borderRadius: 2,
                  p: 4,
                  overflowY: "auto",
                  boxShadow: darkMode
                    ? "0 0 0 1px rgba(255,255,255,0.06)"
                    : "0 0 0 1px rgba(0,0,0,0.07)",
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>
                    {selectedEmail.subject}
                  </Typography>
                  <Tooltip title="Open in mail client">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => invoke("open_eml", { path: selectedEmail.path })}
                    >
                      <OpenInNew sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>From:</b>&nbsp;{selectedEmail.sender}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <b>Date:</b>&nbsp;{selectedEmail.date}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: "block", mb: 3, color: "text.secondary", wordBreak: "break-all" }}
                >
                  <b>Path:</b>&nbsp;{selectedEmail.path}
                </Typography>

                <Divider sx={{ mb: 3 }} />

                <Box sx={{ whiteSpace: "pre-wrap", color: "text.primary", fontSize: "0.82rem", lineHeight: 1.75 }}>
                  Email body rendering to be implemented…
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}