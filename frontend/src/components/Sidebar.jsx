import { useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { NavLink, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const Sidebar = ({ strings, routes }) => {
  const location = useLocation();
  const [open, setOpen] = useState(true);

  const isActive = (path) => location.pathname.startsWith(path);

  const handleToggle = () => {
    setOpen(!open);
  };

  const menuItems = [
    {
      key: 'processor',
      path: routes.processor,
      label: strings.navigation.processor,
      icon: <PlayCircleOutlineIcon />,
    },
    {
      key: 'settings',
      path: routes.settings,
      label: strings.navigation.settings,
      icon: <SettingsIcon />,
    },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
        flexShrink: 0,
        transition: 'width 0.3s ease',
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          transition: 'width 0.3s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Toolbar
        sx={{
          background: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {open ? (
          <Typography
            variant="h6"
            noWrap
            component="a"
            href="https://x.com/ChuchoTrader"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontWeight: 600,
              color: 'inherit',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            {strings.app.title}
          </Typography>
        ) : (
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Tooltip title={strings.app.title} placement="right">
              <IconButton
                component="a"
                href="https://x.com/ChuchoTrader"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'white' }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        {open && (
          <IconButton onClick={handleToggle} sx={{ color: 'white' }}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      {!open && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <IconButton onClick={handleToggle} size="small">
            <MenuIcon />
          </IconButton>
        </Box>
      )}
      <Divider />
      <Box sx={{ overflow: 'auto', p: open ? 1 : 0.5 }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.key} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={!open ? item.label : ''} placement="right">
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  selected={isActive(item.path)}
                  sx={{
                    minHeight: 48,
                    justifyContent: open ? 'initial' : 'center',
                    px: 2.5,
                    '&.Mui-selected': {
                      '& .MuiListItemIcon-root': {
                        color: 'primary.main',
                      },
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                      },
                    },
                  }}
                  data-testid={`sidebar-nav-${item.key}`}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 3 : 'auto',
                      justifyContent: 'center',
                      color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {open && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: isActive(item.path) ? 600 : 500,
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

Sidebar.DRAWER_WIDTH = DRAWER_WIDTH;

export default Sidebar;
