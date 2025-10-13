import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SettingsIcon from '@mui/icons-material/Settings';
import { NavLink, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 240;

const Sidebar = ({ strings, routes }) => {
  const location = useLocation();
  const settingsNav = strings.settings?.navigation ?? {};

  const isActive = (path) => location.pathname.startsWith(path);

  const menuItems = [
    {
      key: 'processor',
      path: routes.processor,
      label: strings.navigation.processor,
      icon: <AccountTreeIcon />,
    },
    {
      key: 'settings',
      path: routes.settings,
      label: strings.navigation.settings,
      icon: <SettingsIcon />,
      children: [
        {
          key: 'settings-prefixes',
          path: routes.settingsPrefixes,
          label: settingsNav.prefixes ?? strings.settings?.prefixes?.title,
        },
        {
          key: 'settings-expirations',
          path: routes.settingsExpirations,
          label: settingsNav.expirations ?? strings.settings?.expirations?.title,
        },
      ],
    },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          {strings.app.title}
        </Typography>
      </Toolbar>
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.key} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                component={NavLink}
                to={item.path}
                selected={isActive(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                    '& .MuiListItemText-primary': {
                      fontWeight: 600,
                    },
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  },
                }}
                data-testid={`sidebar-nav-${item.key}`}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
              {item.children && (
                <List disablePadding sx={{ pl: 4, pb: 1 }}>
                  {item.children.map((child) => (
                    <ListItem key={child.key} disablePadding>
                      <ListItemButton
                        component={NavLink}
                        to={child.path}
                        selected={isActive(child.path)}
                        sx={{
                          borderRadius: 1,
                          '&.Mui-selected': {
                            backgroundColor: 'action.selected',
                            '& .MuiListItemText-primary': {
                              fontWeight: 600,
                            },
                            '&:hover': {
                              backgroundColor: 'action.selected',
                            },
                          },
                        }}
                        data-testid={`sidebar-nav-${child.key}`}
                      >
                        <ListItemText primary={child.label} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

Sidebar.DRAWER_WIDTH = DRAWER_WIDTH;

export default Sidebar;
