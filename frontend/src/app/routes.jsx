export const ROUTES = {
  processor: '/procesador',
  settings: '/configuracion',
};

export const APP_ROUTE_SEGMENTS = [
  { key: 'processor', path: ROUTES.processor },
  { key: 'settings', path: ROUTES.settings },
];

export const getDefaultRoute = () => ROUTES.processor;
