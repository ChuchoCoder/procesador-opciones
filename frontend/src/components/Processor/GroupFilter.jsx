import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

const DEFAULT_LABEL = 'Filter by group';

const GroupFilter = ({ options = [], selectedGroupId, onChange, strings = {} }) => {
  if (!options.length) {
    return null;
  }

  const label = strings.filterLabel ?? DEFAULT_LABEL;

  const handleClick = (optionId) => {
    if (optionId !== selectedGroupId) {
      onChange(optionId);
    }
  };

  return (
    <Stack spacing={1} data-testid="group-filter">
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          py: 1,
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: 4,
          },
        }}
      >
        {options.map((option) => {
          const selected = selectedGroupId === option.id;
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
