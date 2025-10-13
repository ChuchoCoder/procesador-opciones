import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

export const OPERATION_TYPES = {
  OPCIONES: 'opciones',
  COMPRA_VENTA: 'compraVenta',
  ARBITRAJES: 'arbitrajes',
};

const OperationTypeTabs = ({ strings, activeTab, onTabChange }) => {
  const opcionesLabel = strings?.operationTypeTabs?.opciones ?? 'Opciones';
  const compraVentaLabel = strings?.operationTypeTabs?.compraVenta ?? 'Compra y Venta';
  const arbitrajesLabel = strings?.operationTypeTabs?.arbitrajes ?? 'Arbitrajes de Plazo';
  const ariaLabel = strings?.operationTypeTabs?.ariaLabel ?? 'Seleccionar tipo de operación';

  const handleChange = (event, newValue) => {
    if (onTabChange) {
      onTabChange(newValue);
    }
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={activeTab}
        onChange={handleChange}
        aria-label={ariaLabel}
        variant="standard"
      >
        <Tab 
          label={opcionesLabel} 
          value={OPERATION_TYPES.OPCIONES} 
          data-testid="tab-opciones"
        />
        <Tab 
          label={compraVentaLabel} 
          value={OPERATION_TYPES.COMPRA_VENTA}
          data-testid="tab-compra-venta"
        />
        <Tab 
          label={arbitrajesLabel} 
          value={OPERATION_TYPES.ARBITRAJES}
          data-testid="tab-arbitrajes"
        />
      </Tabs>
    </Box>
  );
};

export default OperationTypeTabs;
