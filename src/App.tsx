import { useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

// MUI Core
import { ThemeProvider } from "@mui/material/styles";
import {
  Box, CssBaseline, AppBar, Toolbar, Typography, TextField,
  IconButton, Divider, Drawer, InputAdornment, Tooltip,
  Chip, CircularProgress, Menu, MenuItem, ListItemIcon, ListItemText,
  List, ListItemButton, Avatar, Collapse
} from "@mui/material";
import {
  Search, FolderOpen, OpenInNew,
  DarkMode, LightMode, DriveFileMove,
  AttachFile, ArrowBack, Settings,
  Email, ViewStream, SortRounded,
  ChevronRight, ExpandMore,
  Folder, Refresh
} from "@mui/icons-material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

// Theme
import { getTheme } from "./theme";

const DRAWER_WIDTH = 280; // Slightly wider for explorer
const OUTLOOK_LIST_WIDTH = 380;
const APP_VERSION = "v1.0.0";

const formatFullDate = (isoString: string) => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
};

const formatDate = (dateValue: any) => {
  if (!dateValue) return "Unknown";
  const isoString = typeof dateValue === 'string' ? dateValue : dateValue.value;
  if (!isoString || typeof isoString !== 'string') return "Unknown";

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (isThisYear) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
    }
  } catch {
    return isoString;
  }
};

// Recursive File Tree Component
const FileTreeNode = ({ node, level, onSelect, selectedPath, expandedPaths, toggleExpand }: any) => {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand(node.path);
  };

  const handleSelect = () => {
    onSelect(node.path);
  };

  return (
    <Box sx={{ userSelect: 'none' }}>
      <Box
        onClick={handleSelect}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.5,
          pl: level * 1.5 + 1.5,
          pr: 1,
          cursor: 'pointer',
          borderRadius: 1,
          bgcolor: isSelected ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          transition: 'background-color 0.1s',
          gap: 0.5
        }}
      >
        <Box onClick={handleToggle} sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled', mr: 0.25 }}>
          {isExpanded ? <ExpandMore sx={{ fontSize: 14 }} /> : <ChevronRight sx={{ fontSize: 14 }} />}
        </Box>

        <Folder sx={{ fontSize: 16, color: 'primary.main', opacity: 0.8 }} />

        <Typography
          variant="caption"
          sx={{
            fontSize: '0.72rem',
            fontWeight: isSelected ? 700 : 500,
            color: isSelected ? 'primary.main' : 'text.primary',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: '"Outfit", sans-serif'
          }}
        >
          {node.name}
        </Typography>
      </Box>

      {node.children.length > 0 && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          {node.children.map((child: any) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
};

export default function App() {
  const [emails, setEmails] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null);
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<any>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const [darkMode, setDarkMode] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewStyle, setViewStyle] = useState<'gmail' | 'outlook'>('outlook');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [userInfo, setUserInfo] = useState<any>(null);

  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  const theme = useMemo(() => getTheme(darkMode ? "dark" : "light"), [darkMode]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const fetchEmails = useCallback(async (query: string, pathFilter: string | null) => {
    try {
      const data = await invoke<any[]>("search_emails", {
        query,
        pathFilter: pathFilter || null
      });
      setEmails(data);
    } catch (e) {
      console.error("Search error:", e);
    }
  }, []);

  const fetchTree = useCallback(async (root: string) => {
    try {
      const tree = await invoke<any>("get_file_tree", { rootPath: root });
      setFileTree(tree);
      // Automatically expand root if new
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.add(root);
        return next;
      });
    } catch (e) {
      console.error("Tree error:", e);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedEmail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const saved = await invoke<string | null>("get_registered_path");
        if (saved) {
          setCurrentFolderPath(saved);
          fetchEmails("", null);
          fetchTree(saved);
        }
        const user = await invoke<any>("get_user_info");
        setUserInfo(user);
      } catch (e) {
        console.error("Initialization error:", e);
      }
    };
    init();
  }, [fetchEmails, fetchTree]);

  const handleRegisterFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setIsSyncing(true);
        await invoke("index_folder", { folderPath: selected });
        setCurrentFolderPath(selected);
        setSelectedTreePath(null);
        fetchEmails(searchQuery, null);
        fetchTree(selected);
        setIsSyncing(false);
      }
    } catch (e) {
      console.error("Failed to register folder:", e);
      setIsSyncing(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentFolderPath) return;
    try {
      setIsSyncing(true);
      await invoke("index_folder", { folderPath: currentFolderPath });
      fetchEmails(searchQuery, selectedTreePath);
      fetchTree(currentFolderPath);
      setIsSyncing(false);
    } catch (e) {
      console.error("Refresh error:", e);
      setIsSyncing(false);
    }
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    fetchEmails(val, selectedTreePath);
  };

  const handleTreeSelect = (path: string) => {
    setSelectedTreePath(path);
    fetchEmails(searchQuery, path);
  };

  const sortedEmails = useMemo(() => {
    const sorted = [...emails];
    sorted.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return sorted;
  }, [emails, sortOrder]);

  const gmailColumns = useMemo<GridColDef[]>(() => [
    {
      field: "sender",
      headerName: "From",
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
            {(typeof params.value === "string" && params.value) ? params.value.split("<")[0].trim() : "Unknown"}
          </Typography>
        </Box>
      )
    },
    {
      field: "subject",
      headerName: "Subject",
      flex: 1,
      minWidth: 400,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mr: 1, flexShrink: 0, fontSize: '0.75rem', fontFamily: '"Outfit", sans-serif' }}>
            {params.row.subject}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            — {params.row.body.replace(/\n/g, ' ').substring(0, 100)}
          </Typography>
        </Box>
      ),
    },
    {
      field: "has_attachments",
      headerName: "",
      width: 40,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {params.value ? (
            <Tooltip title="With Attachment">
              <AttachFile sx={{ fontSize: 14, color: 'text.disabled' }} />
            </Tooltip>
          ) : null}
        </Box>
      )
    },
    {
      field: "date",
      headerName: "Date",
      width: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '100%' }}>
          <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary' }}>
            {formatDate(params.value)}
          </Typography>
        </Box>
      )
    },
  ], []);

  const renderEmailDetail = (email: any) => (
    <Box
      sx={{
        bgcolor: "background.paper",
        height: "100%",
        borderRadius: viewStyle === 'outlook' ? 0 : 2,
        p: 4,
        overflowY: "auto",
        boxShadow: viewStyle === 'outlook' ? 'none' : (darkMode
          ? "0 0 0 1px rgba(255,255,255,0.06)"
          : "0 0 0 1px rgba(0,0,0,0.07)"),
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "1.15rem", fontFamily: '"Outfit", sans-serif' }}>
            {email.subject}
          </Typography>
          {email.has_attachments && (
            <Chip label="With Attachment" size="small" icon={<AttachFile sx={{ fontSize: '10px !important' }} />} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
        </Box>
        <Tooltip title="Open in mail client">
          <IconButton
            size="small"
            color="primary"
            onClick={() => invoke("open_eml", { path: email.path })}
          >
            <OpenInNew sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
        <b>From:</b>&nbsp;{email.sender}
      </Typography>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
        <b>To:</b>&nbsp;{email.recipient}
      </Typography>
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
        <b>Date:</b>&nbsp;{formatFullDate(email.date)}
      </Typography>
      <Typography
        variant="caption"
        sx={{ display: "block", mb: 3, color: "text.secondary", wordBreak: "break-all", opacity: 0.7 }}
      >
        <b>Path:</b>&nbsp;{email.path}
      </Typography>

      <Divider sx={{ mb: 3 }} />

      <Box
        sx={{
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          color: "text.primary",
          fontSize: "0.85rem",
          lineHeight: 1.8,
          width: '100%',
        }}
      >
        {email.body || "No content available."}
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
        <CssBaseline />

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
          <Box sx={{ height: 52, display: "flex", alignItems: "center", px: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "primary.main", letterSpacing: "-0.5px", fontFamily: '"Outfit", sans-serif', lineHeight: 1 }}>
                eml-explorer
              </Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", fontWeight: 500 }}>
                {APP_VERSION}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1, overflow: "hidden", display: "flex", flexDirection: "column", p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1, px: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, color: "text.disabled", flexGrow: 1, fontSize: "0.65rem", fontFamily: '"Outfit", sans-serif' }}>
                EXPLORER
              </Typography>

              <Box sx={{ display: 'flex', gap: 0.25 }}>
                <Tooltip title="Refresh Indexing" arrow>
                  <IconButton
                    size="small"
                    disabled={isSyncing || !currentFolderPath}
                    onClick={handleRefresh}
                    sx={{ p: 0.4, color: "text.disabled", "&:hover": { color: "primary.main" } }}
                  >
                    <Refresh sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Change archive root" arrow>
                  <IconButton size="small" disabled={isSyncing} onClick={handleRegisterFolder} sx={{ p: 0.4, color: "text.disabled", "&:hover": { color: "primary.main" } }}>
                    <DriveFileMove sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 1 }}>
              {isSyncing ? (
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption">Updating index...</Typography>
                </Box>
              ) : fileTree ? (
                <FileTreeNode
                  node={fileTree}
                  level={0}
                  onSelect={handleTreeSelect}
                  selectedPath={selectedTreePath}
                  expandedPaths={expandedPaths}
                  toggleExpand={toggleExpand}
                />
              ) : (
                <Box onClick={handleRegisterFolder} sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1.5, p: 2, textAlign: "center", cursor: "pointer", "&:hover": { borderColor: "primary.main", bgcolor: 'action.hover' } }}>
                  <FolderOpen sx={{ fontSize: 28, color: "text.disabled", mb: 1 }} />
                  <Typography variant="caption" sx={{ display: "block", color: "text.disabled", fontWeight: 600 }}>Open Archive Folder</Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 1 }} />
            {emails.length > 0 && (
              <Typography variant="caption" sx={{ color: "text.disabled", px: 0.5, fontSize: "0.65rem", display: 'flex', justifyContent: 'space-between' }}>
                <span>{emails.length.toLocaleString()} items found</span>
                {selectedTreePath && <Chip label="Filtered" size="small" sx={{ height: 16, fontSize: '0.55rem' }} />}
              </Typography>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Divider />

            <Box sx={{ p: 2 }}>
              {userInfo && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      bgcolor: 'primary.main',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {userInfo.full_name.charAt(0)}
                  </Avatar>
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }} noWrap>
                      {userInfo.full_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }} noWrap>
                      @{userInfo.username}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Box sx={{ display: "flex", gap: 0.5, ml: -0.5 }}>
                <IconButton size="small" onClick={(e) => setSettingsAnchor(e.currentTarget)} sx={{ color: "text.secondary" }}>
                  <Settings sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" onClick={() => setDarkMode((d) => !d)} sx={{ color: "text.secondary" }}>
                  {darkMode ? <LightMode sx={{ fontSize: 18 }} /> : <DarkMode sx={{ fontSize: 18 }} />}
                </IconButton>
              </Box>
            </Box>

            <Menu anchorEl={settingsAnchor} open={Boolean(settingsAnchor)} onClose={() => setSettingsAnchor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
              <MenuItem onClick={() => { setViewStyle('gmail'); setSettingsAnchor(null); }} selected={viewStyle === 'gmail'}>
                <ListItemIcon><Email sx={{ fontSize: 18 }} /></ListItemIcon>
                <ListItemText primary="Gmail View" />
              </MenuItem>
              <MenuItem onClick={() => { setViewStyle('outlook'); setSettingsAnchor(null); }} selected={viewStyle === 'outlook'}>
                <ListItemIcon><ViewStream sx={{ fontSize: 18 }} /></ListItemIcon>
                <ListItemText primary="Outlook View" />
              </MenuItem>
            </Menu>
          </Box>
        </Drawer>

        <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <AppBar position="static" elevation={0}>
            <Toolbar sx={{ justifyContent: "center" }}>
              {viewStyle === 'gmail' && selectedEmail && (
                <IconButton onClick={() => setSelectedEmail(null)} sx={{ position: "absolute", left: 16, color: "inherit" }}>
                  <ArrowBack sx={{ fontSize: 20 }} />
                </IconButton>
              )}
              <TextField
                size="small"
                variant="outlined"
                placeholder="Search Archive..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ fontSize: 16, color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                  }
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

          <Box sx={{ flexGrow: 1, p: viewStyle === 'outlook' ? 0 : 1.5, display: "flex", overflow: "hidden" }}>

            {viewStyle === 'gmail' ? (
              !selectedEmail ? (
                <Box sx={{ flex: 1, bgcolor: "background.paper", borderRadius: 2, overflow: "hidden", boxShadow: darkMode ? "0 0 0 1px rgba(255,255,255,0.06)" : "0 0 0 1px rgba(0,0,0,0.07)" }}>
                  <DataGrid rows={sortedEmails} getRowId={(row) => row.path} columns={gmailColumns} checkboxSelection disableRowSelectionOnClick onRowClick={(params, event) => { if (!(event.target as HTMLElement).closest(".MuiCheckbox-root")) setSelectedEmail(params.row); }} pagination initialState={{ pagination: { paginationModel: { pageSize: 50 } } }} pageSizeOptions={[25, 50, 100]} sx={{ border: "none" }} />
                </Box>
              ) : (
                renderEmailDetail(selectedEmail)
              )
            ) : (
              <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Box sx={{ width: OUTLOOK_LIST_WIDTH, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', bgcolor: darkMode ? '#141414' : '#fff', display: 'flex', flexDirection: 'column' }}>

                  <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled', letterSpacing: 0.5 }}>
                      {sortOrder === 'newest' ? 'NEWEST ON TOP' : 'OLDEST ON TOP'}
                    </Typography>
                    <Tooltip title={sortOrder === 'newest' ? "Switch to Oldest on Top" : "Switch to Newest on Top"}>
                      <IconButton
                        size="small"
                        onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                        sx={{ color: 'text.secondary' }}
                      >
                        <SortRounded sx={{ fontSize: 16, transform: sortOrder === 'oldest' ? 'scaleY(-1)' : 'none' }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
                    {sortedEmails.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
                        <Typography variant="body2">No emails in this folder.</Typography>
                      </Box>
                    ) : (
                      sortedEmails.map((email) => (
                        <ListItemButton
                          key={email.path}
                          onClick={() => setSelectedEmail(email)}
                          selected={selectedEmail?.path === email.path}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            py: 1.5,
                            px: 2,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            gap: 0.5,
                            '&.Mui-selected': {
                              bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.main' },
                              '& .MuiTypography-root': { color: 'inherit' },
                              '& .MuiSvgIcon-root': { color: 'inherit' }
                            }
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.85rem' }} noWrap>
                            {email.sender.split("<")[0].trim() || "Unknown"}
                          </Typography>
                          <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', flex: 1 }} noWrap>
                              {email.subject}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', ml: 1, opacity: 0.8 }}>
                              {formatDate(email.date)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7, flex: 1 }} noWrap>
                              {email.body.replace(/\n/g, ' ')}
                            </Typography>
                            {email.has_attachments && <AttachFile sx={{ fontSize: 12, opacity: 0.7 }} />}
                          </Box>
                        </ListItemButton>
                      ))
                    )}
                  </List>
                </Box>

                <Box sx={{ flex: 1, bgcolor: 'background.default', overflow: 'hidden' }}>
                  {selectedEmail ? (
                    renderEmailDetail(selectedEmail)
                  ) : (
                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                      <Email sx={{ fontSize: 64, mb: 2 }} />
                      <Typography variant="body1">No conversation selected</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}