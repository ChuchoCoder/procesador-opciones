import '@testing-library/jest-dom/vitest';
import { bootstrapFeeServices } from '../../src/services/bootstrap-defaults.js';

// Initialize fee services before tests run
await bootstrapFeeServices();
