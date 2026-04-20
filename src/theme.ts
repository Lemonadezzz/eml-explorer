import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';
import '@fontsource/montserrat/300.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';

export const getTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#F05340' },
      background: {
        default: mode === 'dark' ? '#0f0f0f' : '#ffffff',
        paper:   mode === 'dark' ? '#1a1a1a' : '#ffffff',
      },
      text: {
        secondary: mode === 'dark' ? 'rgba(255,255,255,0.7)' : undefined,
      },
      divider: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },

    typography: {
      fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 12,
    },

    components: {
      /* ── DataGrid ── */
      MuiDataGrid: {
        defaultProps: { density: 'compact' },
        styleOverrides: {
          root: {
            fontSize: '0.75rem',
            backgroundColor: 'transparent',
            border: 'none',
          },
          row: {
            minHeight: '36px !important',
            maxHeight: '36px !important',
            cursor: 'pointer',
            borderBottom:
              mode === 'dark'
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(0,0,0,0.08)',
          },
          cell: { borderBottom: 'none' },
          columnHeaders: {
            borderBottom:
              mode === 'dark'
                ? '2px solid rgba(255,255,255,0.12)'
                : '2px solid rgba(0,0,0,0.12)',
          },
        },
      },

      /* ── Drawer ── */
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'dark' ? '#141414' : '#fafafa',
            borderRight: `1px solid ${
              mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
            }`,
          },
        },
      },

      /* ── AppBar ── */
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? '#0f0f0f' : '#ffffff',
            borderBottom: `1px solid ${
              mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
            }`,
            color: mode === 'dark' ? '#ffffff' : '#0f0f0f',
          },
        },
      },
    },
  });
