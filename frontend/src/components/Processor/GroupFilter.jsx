import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

const DEFAULT_LABEL = 'Filter by instrument';
const ALL_OPTION_ID = '__ALL__';

const GroupFilter = ({ options = [], selectedGroupId, onChange, strings = {} }) => {
  if (!options.length) {
    return null;
  }

  const label = strings.filterLabel ?? DEFAULT_LABEL;

  // Support both single selection (string) and multi-selection (array)
  const selectedIds = Array.isArray(selectedGroupId) 
    ? selectedGroupId 
    : selectedGroupId 
      ? [selectedGroupId] 
      : [];

  const handleClick = (optionId) => {
    // Check if this is the "All" option
    const isAllOption = optionId === ALL_OPTION_ID || 
                        options.find(opt => opt.id === optionId)?.id === ALL_OPTION_ID;

    if (isAllOption) {
      // Clicking "All" resets to show all instruments
      onChange([]);
      return;
    }

    // Multi-select behavior
    const isCurrentlySelected = selectedIds.includes(optionId);
    
    if (isCurrentlySelected) {
      // Deselect: remove from array
      const newSelection = selectedIds.filter(id => id !== optionId);
      onChange(newSelection.length === 0 ? [] : newSelection);
    } else {
      // Select: add to array
      const newSelection = [...selectedIds, optionId];
      onChange(newSelection);
    }
  };

  return (
    <Stack spacing={1} data-testid="group-filter" sx={{ px: 2, pt: 2, pb: 1 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          py: 1,
        }}
      >
        {options.map((option) => {
          const isAllOption = option.id === ALL_OPTION_ID;
          const selected = isAllOption 
            ? selectedIds.length === 0 
            : selectedIds.includes(option.id);
          const baseTestId = option.testId ?? option.id;
          // Provide an alternate simpler test id based on label (sanitized) for robustness
          const labelTestId = option.label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          return (
            <Chip
              key={option.id}
              label={option.label}
              onClick={() => handleClick(option.id)}
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              data-testid={`group-filter-option-${baseTestId}`}
              aria-pressed={selected ? 'true' : undefined}
              sx={{ cursor: 'pointer' }}
              {...{ 'data-label-testid': `group-filter-option-${labelTestId}` }}
            />
          );
        })}
      </Box>
    </Stack>
  );
};

export default GroupFilter;
