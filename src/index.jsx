import React from 'react';
import { createRoot } from 'react-dom/client';
import Fade from '@mui/material/Fade';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider, StyledEngineProvider, createTheme, alpha } from '@mui/material/styles';
import App from './components/app/App';
import LayoutContext from './components/app/LayoutContext';
import './index.scss';
import { COLORS } from './common/colors';
import './i18n/config';

const theme = createTheme();
const v5Theme = createTheme(theme, {
  palette: {
    ...COLORS,
    success: {
      ...COLORS.primary
    },
    info: {
      ...COLORS.secondary
    },
    surface: {
      ...COLORS.surface
    },
    "default": {
      main: COLORS.surface.n96,
      dark: COLORS.surface.n96,
      light: COLORS.secondary['40']
    },
  },
  components: {
    MuiTooltip: {
      defaultProps: {
        arrow: true,
        leaveDelay: 300,
        TransitionComponent: Fade,
        TransitionProps: { timeout: 300 }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: 'small'
      },
      styleOverrides: {
        root: {
          background: COLORS.primary.contrastText,
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: COLORS.surface.contrastText
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: COLORS.surface.contrastText
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: 'rgba(94, 92, 113, 0.2)'
          }
        }
      }
    },
    MuiButton: {
      variants: [
        {
          props: { variant: "contained", color: COLORS.surface.n96 },
          style: {
            color: theme.palette.getContrastText(COLORS.surface.n96)
          }
        },
        {
          props: { variant: "outlined", color: COLORS.surface.n96 },
          style: {
            color: theme.palette.text.primary,
            borderColor:
                    theme.palette.mode === "light"
                    ? "rgba(0, 0, 0, 0.23)"
                    : "rgba(255, 255, 255, 0.23)",
            "&.Mui-disabled": {
              border: `1px solid ${theme.palette.action.disabledBackground}`
            },
            "&:hover": {
              borderColor:
                      theme.palette.mode === "light"
                      ? "rgba(0, 0, 0, 0.23)"
                      : "rgba(255, 255, 255, 0.23)",
              backgroundColor: alpha(
                theme.palette.text.primary,
                theme.palette.action.hoverOpacity
              )
            }
          }
        },
        {
          props: { color: COLORS.surface.contrastText, variant: "text" },
          style: {
            color: theme.palette.text.primary,
            "&:hover": {
              backgroundColor: alpha(
                theme.palette.text.primary,
                theme.palette.action.hoverOpacity
              )
            }
          }
        }
      ]
    }
  }
})


const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <HashRouter>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={v5Theme}>
          <LayoutContext subPages ={(<App />)} />
      </ThemeProvider>
    </StyledEngineProvider>
  </HashRouter>
);
