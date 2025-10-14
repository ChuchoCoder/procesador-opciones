import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0d47a1',
      light: '#5472d3',
      dark: '#002171',
    },
    secondary: {
      main: '#673ab7',
      light: '#9a67ea',
      dark: '#320b86',
    },
    success: {
      main: '#2e7d32',
      light: '#60ad5e',
      dark: '#005005',
    },
    warning: {
      main: '#f9a825',
      light: '#ffd95a',
      dark: '#c17900',
    },
    error: {
      main: '#d32f2f',
      light: '#ff6659',
      dark: '#9a0007',
    },
    info: {
      main: '#1976d2',
      light: '#63a4ff',
      dark: '#004ba0',
    },
    background: {
      default: '#f7f9fc',
      paper: '#ffffff',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
    action: {
      hover: 'rgba(0, 0, 0, 0.04)',
    },
    // Custom domain colors
    calls: {
      main: '#2e7d32',
      light: '#60ad5e',
      dark: '#005005',
      contrastText: '#fff',
    },
    puts: {
      main: '#d32f2f',
      light: '#ff6659',
      dark: '#9a0007',
      contrastText: '#fff',
    },
    arbitrajes: {
      main: '#00897b',
      light: '#4ebaaa',
      dark: '#005b4f',
      contrastText: '#fff',
    },
    buy: {
      main: '#2e7d32',
      light: '#60ad5e',
      dark: '#005005',
      contrastText: '#fff',
    },
    sell: {
      main: '#d32f2f',
      light: '#ff6659',
      dark: '#9a0007',
      contrastText: '#fff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    subtitle2: {
      fontWeight: 600,
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: '#455a64',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.3px',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #0d47a1, #1976d2)',
          boxShadow: '0 2px 8px rgba(13, 71, 161, 0.15)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          letterSpacing: '0.3px',
          padding: '8px 20px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #673ab7, #512da8)',
          '&:hover': {
            background: 'linear-gradient(135deg, #7e57c2, #673ab7)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          letterSpacing: '0.3px',
        },
        colorSuccess: {
          backgroundColor: '#2e7d32',
          color: '#fff',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 4,
          borderRadius: 4,
          background: 'linear-gradient(90deg, #673ab7, #0d47a1)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.95rem',
          minHeight: 48,
          '&.Mui-selected': {
            fontWeight: 600,
          },
          '&:focus-visible': {
            outline: 'none',
          },
          '&:focus': {
            outline: 'none',
          },
          '&::before': {
            display: 'none',
          },
          '&::after': {
            display: 'none',
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        dense: {
          minHeight: 48,
          '@media (min-width: 600px)': {
            minHeight: 48,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            color: '#455a64',
            backgroundColor: '#f0f3f9',
            textTransform: 'uppercase',
            borderBottom: '2px solid #e0e7ed',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(13, 71, 161, 0.03)',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 4,
          transition: 'all 0.15s ease-in-out',
          '&.Mui-selected': {
            background: 'linear-gradient(90deg, rgba(13,71,161,0.12), rgba(103,58,183,0.12))',
            borderLeft: '4px solid #0d47a1',
            paddingLeft: 12,
            '&:hover': {
              background: 'linear-gradient(90deg, rgba(13,71,161,0.18), rgba(103,58,183,0.18))',
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 40,
          color: 'inherit',
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: '#0d47a1',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.16s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            transform: 'scale(1.08)',
          },
        },
      },
    },
  },
  mixins: {
    toolbar: {
      minHeight: 56,
      '@media (min-width: 0px) and (orientation: landscape)': {
        minHeight: 48,
      },
      '@media (min-width: 600px)': {
        minHeight: 64,
      },
    },
    toolbarSecondary: {
      minHeight: 48,
    },
  },
});

export default theme;
