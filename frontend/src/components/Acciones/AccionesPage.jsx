import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import { useAccionesMarketDataWS } from '../../hooks/useAccionesMarketDataWS';
import { useConfig } from '../../state/config-hooks';

/**
 * AccionesPage - Real-time market data display for stocks (CFI: ESXXXX)
 * 
 * Phase 3: Migrated to WebSocket for real-time market data
 * Shows real-time prices, bid/offer, and volume for stock instruments
 */
const AccionesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [settlementFilter, setSettlementFilter] = useState('ALL');
  const config = useConfig();
  
  // Get token from config context (broker authentication)
  const token = config.brokerAuth?.token || null;
  
  const {
    instruments,
    isConnected,
    error,
    instrumentCount,
    dataCount,
    getAllInstrumentsWithData,
  } = useAccionesMarketDataWS({
    token,
    enabled: Boolean(token),
    entries: ['LA', 'BI', 'OF', 'TV'], // Last, Bid, Offer, Volume
    depth: 1,
  });

  // Extract settlement from symbol (e.g., "MERV - XMEV - CRES - 24hs" -> "24hs")
  const getSettlement = (symbol) => {
    const parts = symbol.split(' - ');
    return parts.length > 3 ? parts[3].trim() : '';
  };

  // Filter instruments by search term, currency, and settlement
  const filteredData = useMemo(() => {
    const allData = getAllInstrumentsWithData();
    
    return allData.filter(({ instrument }) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!instrument.symbol.toLowerCase().includes(term)) {
          return false;
        }
      }
      
      // Currency filter
      if (currencyFilter !== 'ALL' && instrument.currency !== currencyFilter) {
        return false;
      }
      
      // Settlement filter
      if (settlementFilter !== 'ALL') {
        const settlement = getSettlement(instrument.symbol);
        if (settlement !== settlementFilter) {
          return false;
        }
      }
      
      return true;
    });
  }, [getAllInstrumentsWithData, searchTerm, currencyFilter, settlementFilter]);

  // Format price with appropriate decimals
  const formatPrice = (price, decimals = 2) => {
    if (price == null) return '-';
    return price.toFixed(decimals);
  };

  // Format size/volume
  const formatSize = (size) => {
    if (size == null) return '-';
    return size.toLocaleString('es-AR');
  };

  // Get bid/offer from array or object
  const getBidOffer = (data) => {
    if (!data) return { bid: null, offer: null };
    
    const bid = Array.isArray(data.BI) && data.BI.length > 0
      ? data.BI[0]
      : data.BI;
    
    const offer = Array.isArray(data.OF) && data.OF.length > 0
      ? data.OF[0]
      : data.OF;
    
    return { bid, offer };
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Acciones
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Datos de mercado en tiempo real para acciones
        </Typography>
      </Box>

      {/* Status Bar */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          label={isConnected ? 'Conectado' : 'Desconectado'}
          color={isConnected ? 'success' : 'default'}
          size="small"
        />
        <Typography variant="body2" color="text.secondary">
          {instrumentCount} instrumentos | {dataCount} con datos
        </Typography>
        
        {/* Search */}
        <TextField
          size="small"
          placeholder="Buscar por símbolo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ ml: 'auto', minWidth: 250 }}
        />
      </Box>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="currency-filter-label">Moneda</InputLabel>
            <Select
              labelId="currency-filter-label"
              id="currency-filter"
              value={currencyFilter}
              label="Moneda"
              onChange={(e) => setCurrencyFilter(e.target.value)}
            >
              <MenuItem value="ALL">Todas</MenuItem>
              <MenuItem value="ARS">ARS</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="settlement-filter-label">Liquidación</InputLabel>
            <Select
              labelId="settlement-filter-label"
              id="settlement-filter"
              value={settlementFilter}
              label="Liquidación"
              onChange={(e) => setSettlementFilter(e.target.value)}
            >
              <MenuItem value="ALL">Todas</MenuItem>
              <MenuItem value="CI">Contado Inmediato (CI)</MenuItem>
              <MenuItem value="24hs">24 horas</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity={error.includes('Rate limit') ? 'warning' : 'error'} 
          sx={{ mb: 3 }}
        >
          {error.includes('Rate limit') && '⏱️ '}
          {error}
        </Alert>
      )}

      {/* No Token Warning */}
      {!token && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No hay token de autenticación disponible. Por favor, inicie sesión para ver datos de mercado en tiempo real.
        </Alert>
      )}

      {/* Loading State */}
      {token && !isConnected && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Market Data Table */}
      {token && instruments.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Símbolo</TableCell>
                <TableCell>Moneda</TableCell>
                <TableCell align="right">Último</TableCell>
                <TableCell align="right">Compra</TableCell>
                <TableCell align="right">Venta</TableCell>
                <TableCell align="right">Volumen</TableCell>
                <TableCell align="center">Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {searchTerm || currencyFilter !== 'ALL' || settlementFilter !== 'ALL'
                        ? 'No se encontraron instrumentos con los filtros aplicados'
                        : 'No hay datos disponibles'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {filteredData.map(({ instrument, data }) => {
                const { bid, offer } = getBidOffer(data);
                const hasData = data != null;
                
                return (
                  <TableRow
                    key={`${instrument.marketId}::${instrument.symbol}`}
                    hover
                    sx={{
                      opacity: hasData ? 1 : 0.5,
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {instrument.symbol}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={instrument.currency} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      {data?.LA?.price != null ? (
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color="primary"
                        >
                          {formatPrice(data.LA.price, instrument.priceDecimals)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {bid?.price != null ? (
                        <Typography variant="body2" color="success.main">
                          {formatPrice(bid.price, instrument.priceDecimals)}
                          {bid.size != null && (
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 1 }}
                            >
                              ({formatSize(bid.size)})
                            </Typography>
                          )}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {offer?.price != null ? (
                        <Typography variant="body2" color="error.main">
                          {formatPrice(offer.price, instrument.priceDecimals)}
                          {offer.size != null && (
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ ml: 1 }}
                            >
                              ({formatSize(offer.size)})
                            </Typography>
                          )}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {data?.TV != null ? (
                        <Typography variant="body2">
                          {formatSize(data.TV.size || data.TV)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={hasData ? 'Activo' : 'Sin datos'}
                        size="small"
                        color={hasData ? 'success' : 'default'}
                        variant={hasData ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Empty State */}
      {!token && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Autenticación Requerida
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure su token de autenticación para acceder a datos de mercado en tiempo real
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default AccionesPage;
