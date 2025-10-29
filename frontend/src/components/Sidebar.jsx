import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Popover from '@mui/material/Popover';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import SyncIcon from '@mui/icons-material/Sync';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { NavLink, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;
const SUBMENU_BORDER_COLOR = '#9c27b0';

const Sidebar = ({ strings, routes, brokerStatus, onBrokerLogout }) => {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [brokerPopoverAnchor, setBrokerPopoverAnchor] = useState(null);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [submenuPopoverAnchor, setSubmenuPopoverAnchor] = useState(null);
  const [submenuPopoverItems, setSubmenuPopoverItems] = useState([]);

  const isActive = useCallback(
    (path, options = {}) => {
      if (!path) {
        return false;
      }

      const { exact = false } = options;
      const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
      const currentPath = location.pathname.endsWith('/') && location.pathname !== '/'
        ? location.pathname.slice(0, -1)
        : location.pathname;

      if (exact) {
        return currentPath === normalizedPath;
      }

      return currentPath === normalizedPath || currentPath.startsWith(`${normalizedPath}/`);
    },
    [location.pathname],
  );

  const menuItems = useMemo(
    () => [
      {
        key: 'processor',
        path: routes.processor,
        label: strings.navigation.processor,
        icon: <PlayCircleOutlineIcon />,
      },
      {
        key: 'settings',
        label: strings.navigation.settings,
        icon: <SettingsIcon />,
        children: [
          {
            key: 'settings-general',
            path: routes.settings,
            exact: true,
            label:
              strings.navigation.settingsGeneral ||
              strings.settings?.title ||
              strings.navigation.settings,
          },
          {
            key: 'settings-fees',
            path: routes.settingsFees,
            label:
              strings.navigation.settingsFees ||
              strings.settings?.brokerFees?.title ||
              'Comisiones',
          },
        ],
      },
    ],
    [routes, strings],
  );

  useEffect(() => {
    setExpandedMenus((prev) => {
      const next = { ...prev };
      menuItems.forEach((item) => {
        if (!item.children?.length) {
          return;
        }
        if (item.children.some((child) => isActive(child.path))) {
          next[item.key] = true;
        } else if (next[item.key] === undefined) {
          next[item.key] = false;
        }
      });
      return next;
    });
  }, [isActive, menuItems]);

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
    onBrokerLogout?.();
  };

  const handleSubmenuToggle = (key) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmenuPopoverOpen = (event, children) => {
    setSubmenuPopoverAnchor(event.currentTarget);
    setSubmenuPopoverItems(children);
  };

  const handleSubmenuPopoverClose = () => {
    setSubmenuPopoverAnchor(null);
    setSubmenuPopoverItems([]);
  };

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
          {menuItems.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const itemActive = isActive(item.path);
            const childActive = hasChildren && item.children.some((child) => isActive(child.path, { exact: child.exact }));
            const isExpanded = hasChildren ? expandedMenus[item.key] || childActive : false;
            
            // When collapsed and has children, show popover on click
            const buttonProps = hasChildren
              ? { 
                  onClick: open 
                    ? () => handleSubmenuToggle(item.key)
                    : (event) => handleSubmenuPopoverOpen(event, item.children)
                }
              : { component: NavLink, to: item.path };

            return (
              <Fragment key={item.key}>
                <ListItem disablePadding sx={{ display: 'block' }}>
                  <Tooltip title={!open ? item.label : ''} placement="right">
                    <ListItemButton
                      {...buttonProps}
                      selected={itemActive || childActive}
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
                      aria-controls={hasChildren ? `submenu-${item.key}` : undefined}
                      aria-expanded={hasChildren ? Boolean(isExpanded) : undefined}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: open ? 3 : 'auto',
                          justifyContent: 'center',
                          color: itemActive || childActive ? 'primary.main' : 'text.secondary',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {open && (
                        <>
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{
                              fontWeight: itemActive || childActive ? 600 : 500,
                            }}
                          />
                          {hasChildren && (
                            <Box component="span" sx={{ ml: 'auto', color: isExpanded ? 'primary.main' : 'text.secondary' }}>
                              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </Box>
                          )}
                        </>
                      )}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
                {hasChildren && (
                  <Collapse in={open && Boolean(isExpanded)} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding id={`submenu-${item.key}`}>
                      {item.children.map((child) => {
                        const childIsActive = isActive(child.path, { exact: child.exact });
                        return (
                          <ListItem key={child.key} disablePadding sx={{ display: 'block' }}>
                            <ListItemButton
                              component={NavLink}
                              to={child.path}
                              selected={childIsActive}
                              sx={(theme) => ({
                                minHeight: 36,
                                justifyContent: open ? 'flex-start' : 'center',
                                pl: open ? 3.5 : 2.5,
                                pr: open ? 2.5 : 0,
                                ml: open ? 0.5 : 0,
                                mr: open ? 0.5 : 0,
                                borderRadius: 1,
                                transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                                color: childIsActive ? theme.palette.text.primary : theme.palette.text.secondary,
                                border: 'none',
                                borderLeft: 'none !important',
                                boxShadow: open && childIsActive ? `inset 3px 0 0 0 ${SUBMENU_BORDER_COLOR}` : 'none',
                                '&:hover': {
                                  backgroundColor: theme.palette.action.hover,
                                },
                                '& .MuiListItemText-primary': {
                                  fontSize: theme.typography.body2.fontSize,
                                  fontWeight: childIsActive ? 600 : 500,
                                },
                                '&.Mui-selected': {
                                  backgroundColor: theme.palette.action.selected,
                                  color: theme.palette.text.primary,
                                  pl: open ? '28px !important' : '20px !important',
                                  borderLeft: 'none !important',
                                  boxShadow: open ? `inset 3px 0 0 0 ${SUBMENU_BORDER_COLOR} !important` : 'none',
                                  '&:hover': {
                                    backgroundColor: theme.palette.action.selected,
                                  },
                                },
                              })}
                              data-testid={`sidebar-nav-${child.key}`}
                            >
                              {open && <ListItemText primary={child.label} />}
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                )}
              </Fragment>
            );
          })}
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
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
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

      {/* Submenu Popover (when sidebar is collapsed) */}
      <Popover
        open={Boolean(submenuPopoverAnchor)}
        anchorEl={submenuPopoverAnchor}
        onClose={handleSubmenuPopoverClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { ml: 1, minWidth: 200 },
          },
        }}
      >
        <List sx={{ py: 1 }}>
          {submenuPopoverItems.map((child) => {
            const childIsActive = isActive(child.path, { exact: child.exact });
            return (
              <ListItem key={child.key} disablePadding>
                <ListItemButton
                  component={NavLink}
                  to={child.path}
                  selected={childIsActive}
                  onClick={handleSubmenuPopoverClose}
                  sx={(theme) => ({
                    minHeight: 40,
                    px: 2,
                    color: childIsActive ? theme.palette.primary.main : theme.palette.text.primary,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.selected,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      },
                    },
                  })}
                >
                  <ListItemText 
                    primary={child.label}
                    primaryTypographyProps={{
                      fontWeight: childIsActive ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Popover>
    </Drawer>
  );
};

Sidebar.DRAWER_WIDTH = DRAWER_WIDTH;

export default Sidebar;
