export const ROUTES = {
  processor: '/procesador',
  settings: '/configuracion',
  settingsFees: '/configuracion/comisiones',
  settingsPrefixes: '/configuracion/prefijos',
  settingsExpirations: '/configuracion/vencimientos',
  settingsBroker: '/configuracion/broker',
};

export const APP_ROUTE_SEGMENTS = [
  { key: 'processor', path: ROUTES.processor },
  { key: 'settings', path: ROUTES.settings },
  { key: 'settingsFees', path: ROUTES.settingsFees },
];

export const getDefaultRoute = () => ROUTES.processor;
