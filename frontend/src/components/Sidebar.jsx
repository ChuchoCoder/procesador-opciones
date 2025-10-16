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
import Collapse from '@mui/material/Collapse';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { NavLink, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const Sidebar = ({ strings, routes }) => {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState({});

  const isActive = useCallback(
    (path) => Boolean(path) && location.pathname.startsWith(path),
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
            label:
              strings.navigation.settingsGeneral ||
              strings.settings?.title ||
              strings.navigation.settings,
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

  const handleSubmenuToggle = (key) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
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
            const childActive = hasChildren && item.children.some((child) => isActive(child.path));
            const isExpanded = hasChildren ? expandedMenus[item.key] || childActive : false;
            const buttonProps = hasChildren
              ? { onClick: () => handleSubmenuToggle(item.key) }
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
                        const childIsActive = isActive(child.path);
                        return (
                          <ListItem key={child.key} disablePadding sx={{ display: 'block' }}>
                            <ListItemButton
                              component={NavLink}
                              to={child.path}
                              selected={childIsActive}
                              sx={(theme) => ({
                                minHeight: 36,
                                justifyContent: open ? 'flex-start' : 'center',
                                pl: open ? 7 : 2.5,
                                pr: open ? 2 : 0,
                                mx: open ? 1 : 0,
                                borderRadius: 1,
                                alignItems: 'center',
                                transition: 'background-color 0.2s ease, border-color 0.2s ease',
                                color: childIsActive
                                  ? theme.palette.text.primary
                                  : theme.palette.text.secondary,
                                borderLeft: open
                                  ? `3px solid ${childIsActive ? theme.palette.primary.main : 'transparent'}`
                                  : 0,
                                '&:hover': {
                                  backgroundColor: theme.palette.action.hover,
                                },
                                '& .MuiListItemText-primary': {
                                  fontSize: theme.typography.body2.fontSize,
                                },
                                '&.Mui-selected': {
                                  backgroundColor: theme.palette.action.selected,
                                  color: theme.palette.text.primary,
                                  '&:hover': {
                                    backgroundColor: theme.palette.action.selected,
                                  },
                                  '& .MuiListItemText-primary': {
                                    fontWeight: 600,
                                  },
                                },
                              })}
                              data-testid={`sidebar-nav-${child.key}`}
                            >
                              {open && (
                                <ListItemText
                                  primary={child.label}
                                  primaryTypographyProps={{
                                    fontWeight: childIsActive ? 600 : 500,
                                  }}
                                />
                              )}
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
    </Drawer>
  );
};

Sidebar.DRAWER_WIDTH = DRAWER_WIDTH;

export default Sidebar;
