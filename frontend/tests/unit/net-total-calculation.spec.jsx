// net-total-calculation.spec.jsx - Unit tests for net total calculation
// Tests the calculateNetTotal logic for BUY and SELL operations

import { describe, it, expect } from 'vitest';

/**
 * Calculate net total based on operation type.
 * BUY operations (positive quantity): add fees to gross total
 * SELL operations (negative quantity): subtract fees from gross total
 */
const calculateNetTotal = (grossNotional, feeAmount, totalQuantity) => {
  const gross = grossNotional ?? 0;
  const fee = feeAmount ?? 0;
  
  // BUY operations have positive quantity: gross + fees
  if (totalQuantity > 0) {
    return gross + fee;
  }
  
  // SELL operations have negative quantity: gross - fees
  return gross - fee;
};

describe('calculateNetTotal', () => {
  describe('BUY operations (positive quantity)', () => {
    it('should add fees to gross total for BUY operations', () => {
      const grossNotional = 10000;
      const feeAmount = 100;
      const totalQuantity = 5; // Positive = BUY
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(10100); // 10000 + 100
    });

    it('should handle small fee amounts for BUY operations', () => {
      const grossNotional = 5000;
      const feeAmount = 6.5;
      const totalQuantity = 10;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(5006.5);
    });

    it('should handle zero fees for BUY operations', () => {
      const grossNotional = 15000;
      const feeAmount = 0;
      const totalQuantity = 3;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(15000);
    });

    it('should handle large BUY quantities', () => {
      const grossNotional = 100000;
      const feeAmount = 78.65;
      const totalQuantity = 1000;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(100078.65);
    });
  });

  describe('SELL operations (negative quantity)', () => {
    it('should subtract fees from gross total for SELL operations', () => {
      const grossNotional = 10000;
      const feeAmount = 100;
      const totalQuantity = -5; // Negative = SELL
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(9900); // 10000 - 100
    });

    it('should handle small fee amounts for SELL operations', () => {
      const grossNotional = 5000;
      const feeAmount = 6.5;
      const totalQuantity = -10;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(4993.5);
    });

    it('should handle zero fees for SELL operations', () => {
      const grossNotional = 15000;
      const feeAmount = 0;
      const totalQuantity = -3;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(15000);
    });

    it('should handle large SELL quantities', () => {
      const grossNotional = 100000;
      const feeAmount = 78.65;
      const totalQuantity = -1000;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(99921.35);
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined grossNotional', () => {
      const result = calculateNetTotal(null, 50, 10);
      expect(result).toBe(50); // 0 + 50
    });

    it('should handle null/undefined feeAmount', () => {
      const result = calculateNetTotal(10000, null, 10);
      expect(result).toBe(10000); // 10000 + 0
    });

    it('should handle both null values', () => {
      const result = calculateNetTotal(null, null, 10);
      expect(result).toBe(0);
    });

    it('should handle zero quantity as BUY (edge case)', () => {
      // Zero quantity is technically not valid, but should default to BUY logic
      const grossNotional = 5000;
      const feeAmount = 50;
      const totalQuantity = 0;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      // Zero is not > 0, so it goes to SELL branch (gross - fees)
      expect(result).toBe(4950);
    });

    it('should handle decimal quantities', () => {
      const grossNotional = 10000;
      const feeAmount = 100;
      const totalQuantity = 2.5; // Positive fraction
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(10100);
    });

    it('should handle negative decimal quantities', () => {
      const grossNotional = 10000;
      const feeAmount = 100;
      const totalQuantity = -2.5; // Negative fraction
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(9900);
    });

    it('should handle precision for floating point operations', () => {
      const grossNotional = 10000.12;
      const feeAmount = 78.65;
      const totalQuantity = 5;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBeCloseTo(10078.77, 2);
    });
  });

  describe('realistic examples', () => {
    it('should calculate correctly for typical option BUY', () => {
      // Example: Buy 10 contracts at $5.00, contractMultiplier = 100
      // grossNotional = 10 * 100 * 5.00 = 5000
      // feeAmount = 3.90 (0.06% commission + 0.005% rights + VAT)
      const grossNotional = 5000;
      const feeAmount = 3.9;
      const totalQuantity = 10;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(5003.9);
    });

    it('should calculate correctly for typical option SELL', () => {
      // Example: Sell 10 contracts at $5.00
      const grossNotional = 5000;
      const feeAmount = 3.9;
      const totalQuantity = -10;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(4996.1);
    });

    it('should calculate correctly for large trade BUY', () => {
      // Example: Buy 100 contracts at $12.50
      const grossNotional = 125000; // 100 * 100 * 12.50
      const feeAmount = 97.50;
      const totalQuantity = 100;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(125097.50);
    });

    it('should calculate correctly for large trade SELL', () => {
      // Example: Sell 100 contracts at $12.50
      const grossNotional = 125000;
      const feeAmount = 97.50;
      const totalQuantity = -100;
      
      const result = calculateNetTotal(grossNotional, feeAmount, totalQuantity);
      
      expect(result).toBe(124902.50);
    });
  });
});
