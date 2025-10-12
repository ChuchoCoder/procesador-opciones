import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

const DEFAULT_LABEL = 'Filter by group';

const GroupFilter = ({ options = [], selectedGroupId, onChange, strings = {} }) => {
  if (!options.length) {
    return null;
  }

  const label = strings.filterLabel ?? DEFAULT_LABEL;

  const handleChange = (_event, nextValue) => {
    if (!nextValue || nextValue === selectedGroupId) {
      return;
    }
    onChange(nextValue);
  };

  return (
    <Stack spacing={1} data-testid="group-filter">
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={selectedGroupId}
        onChange={handleChange}
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleButton
            key={option.id}
            value={option.id}
            data-testid={`group-filter-option-${option.testId ?? option.id}`}
          >
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
};

export default GroupFilter;
