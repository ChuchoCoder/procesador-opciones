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
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Popover from '@mui/material/Popover';
import Button from '@mui/material/Button';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import LogoutIcon from '@mui/icons-material/Logout';
import { NavLink, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const Sidebar = ({ strings, routes, brokerStatus, onBrokerLogout }) => {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [brokerPopoverAnchor, setBrokerPopoverAnchor] = useState(null);

  const isActive = (path) => location.pathname.startsWith(path);

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleBrokerClick = (event) => {
    setBrokerPopoverAnchor(event.currentTarget);
  };

  const handleBrokerPopoverClose = () => {
    setBrokerPopoverAnchor(null);
  };

  const handleLogout = () => {
    handleBrokerPopoverClose();
    if (onBrokerLogout) {
      onBrokerLogout();
    }
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
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <Tooltip title={strings.app.title} placement="right">
          <IconButton
            component="a"
            href="https://x.com/ChuchoTrader"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ p: 0 }}
          >
            <Avatar
              src="https://pbs.twimg.com/profile_images/837675800707096577/k2ZKpg8p_400x400.jpg"
              alt={strings.app.title}
              sx={{ 
                width: 40, 
                height: 40,
                border: '2px solid white',
              }}
            />
          </IconButton>
        </Tooltip>
        {open && (
          <IconButton 
            onClick={handleToggle} 
            sx={{ 
              color: 'white',
              position: 'absolute',
              right: 8,
            }}
          >
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
      
      {/* Broker Status Indicator */}
      {brokerStatus?.isAuthenticated && (
        <>
          <Box sx={{ flexGrow: 1 }} />
          <Divider />
          <Box sx={{ p: open ? 2 : 1 }}>
            <Box
              onClick={handleBrokerClick}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: open ? 'flex-start' : 'center',
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: brokerStatus.syncInProgress ? 'action.hover' : 'success.light',
                color: brokerStatus.syncInProgress ? 'text.primary' : 'success.dark',
                transition: 'all 0.3s',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: brokerStatus.syncInProgress ? 'action.selected' : 'success.main',
                  color: brokerStatus.syncInProgress ? 'text.primary' : 'white',
                },
              }}
            >
              {brokerStatus.syncInProgress ? (
                <SyncIcon
                  sx={{
                    fontSize: 20,
                    animation: 'spin 1s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              ) : (
                <CloudDoneIcon sx={{ fontSize: 20 }} />
              )}
              {open && (
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                  {brokerStatus.syncInProgress ? 'Sincronizando...' : 'Conectado'}
                </Typography>
              )}
            </Box>
            
            <Popover
              open={Boolean(brokerPopoverAnchor)}
              anchorEl={brokerPopoverAnchor}
              onClose={handleBrokerPopoverClose}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
            >
              <Box sx={{ p: 2, minWidth: 220 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Estado del Broker
                  </Typography>
                  
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Estado:
                    </Typography>
                    <Chip
                      size="small"
                      label={brokerStatus.syncInProgress ? 'Sincronizando' : 'Conectado'}
                      color={brokerStatus.syncInProgress ? 'info' : 'success'}
                      icon={brokerStatus.syncInProgress ? <SyncIcon /> : <CloudDoneIcon />}
                    />
                  </Stack>
                  
                  {brokerStatus.accountId && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Cuenta:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {brokerStatus.accountId}
                      </Typography>
                    </Stack>
                  )}
                  
                  {brokerStatus.lastSyncTime && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Última sincronización:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {new Date(brokerStatus.lastSyncTime).toLocaleTimeString('es-AR')}
                      </Typography>
                    </Stack>
                  )}
                  
                  {brokerStatus.operationsCount !== undefined && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Operaciones:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {brokerStatus.operationsCount}
                      </Typography>
                    </Stack>
                  )}
                  
                  {brokerStatus.syncInProgress && brokerStatus.pagesFetched !== undefined && (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Páginas obtenidas:
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {brokerStatus.pagesFetched}
                      </Typography>
                    </Stack>
                  )}
                  
                  <Divider />
                  
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    fullWidth
                    startIcon={<LogoutIcon />}
                    onClick={handleLogout}
                    disabled={brokerStatus.syncInProgress}
                  >
                    Cerrar sesión
                  </Button>
                </Stack>
              </Box>
            </Popover>
          </Box>
        </>
      )}
    </Drawer>
  );
};

Sidebar.DRAWER_WIDTH = DRAWER_WIDTH;

export default Sidebar;
