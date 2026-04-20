import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';

export const getTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#F05340' }, // Brand coral
      background: {
        default: mode === 'dark' ? '#0f0f0f' : '#ffffff',
        paper:   mode === 'dark' ? '#1a1a1a' : '#ffffff',
      },
      text: {
        secondary: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : undefined,
      },
      divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.08)',
    },

    typography: {
      // Body font like Gmail (Roboto)
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 12,
      // Heading font like Google Sans (Outfit as substitute)
      h1: { fontFamily: '"Outfit", sans-serif' },
      h2: { fontFamily: '"Outfit", sans-serif' },
      h3: { fontFamily: '"Outfit", sans-serif' },
      h4: { fontFamily: '"Outfit", sans-serif' },
      h5: { fontFamily: '"Outfit", sans-serif' },
      h6: { fontFamily: '"Outfit", sans-serif' },
      subtitle1: { fontFamily: '"Outfit", sans-serif' },
      subtitle2: { fontFamily: '"Outfit", sans-serif' },
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
                ? '1px solid rgba(255, 255, 255, 0.08)'
                : '1px solid rgba(0, 0, 0, 0.08)',
          },
          cell: { borderBottom: 'none' },
          columnHeaders: {
            borderBottom:
              mode === 'dark'
                ? '2px solid rgba(255, 255, 255, 0.12)'
                : '2px solid rgba(0, 0, 0, 0.12)',
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
              fontFamily: '"Outfit", sans-serif',
            }
          },
        },
      },

      /* ── Drawer ── */
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'dark' ? '#141414' : '#fafafa',
            borderRight: `1px solid ${
              mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)'
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
              mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)'
            }`,
            color: mode === 'dark' ? '#ffffff' : '#0f0f0f',
          },
        },
      },
    },
  });
