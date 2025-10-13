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
      main: '#1565c0',
      light: '#5e92f3',
      dark: '#003c8f',
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
    action: {
      hover: 'rgba(0, 0, 0, 0.04)',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
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
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 600,
            backgroundColor: '#fafafa',
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
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
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
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
