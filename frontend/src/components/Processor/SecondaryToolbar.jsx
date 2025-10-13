import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';

const SecondaryToolbar = ({
  fileMenuSlot,
}) => {
  return (
    <Toolbar
      variant="dense"
      sx={{
        gap: 1,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        minHeight: 48,
        px: 2,
      }}
    >
      {/* File menu */}
      <Box sx={{ display:'flex', alignItems:'center', gap: 0.5 }}>
        {fileMenuSlot}
      </Box>
    </Toolbar>
  );
};

export default SecondaryToolbar;
