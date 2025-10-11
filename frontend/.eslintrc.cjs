/* ESLint configuration for frontend SPA */
// Using flat config via ESLint 9 still supports legacy config export for simplicity here.
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: [
    'eslint:recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['react-refresh'],
  settings: {},
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
