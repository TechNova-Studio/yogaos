import { describe, it, expect } from 'vitest';
import { TaxCalculator } from '../src/modules/billing/tax-calculator.js';

describe('TaxCalculator Unit Tests', () => {
  it('correctly calculates intra-state GST (CGST 9% + SGST 9%)', () => {
    const result = TaxCalculator.calculate(
      [
        {
          description: '10 Class Pass',
          unitPrice: 5000,
          quantity: 1,
          discountAmount: 500, // Taxable: 4500
        },
      ],
      {
        isGstRegistered: true,
        supplierStateCode: 'DL',
        customerStateCode: 'DL',
        defaultTaxRate: 18.0,
      }
    );

    expect(result.isInterState).toBe(false);
    expect(result.subtotal).toBe(5000);
    expect(result.discountAmount).toBe(500);
    expect(result.taxableAmount).toBe(4500);
    expect(result.cgstAmount).toBe(405); // 9% of 4500
    expect(result.sgstAmount).toBe(405); // 9% of 4500
    expect(result.igstAmount).toBe(0);
    expect(result.totalTax).toBe(810);
    expect(result.totalAmount).toBe(5310);
  });

  it('correctly calculates inter-state GST (IGST 18%)', () => {
    const result = TaxCalculator.calculate(
      [
        {
          description: 'Weekend Meditation Workshop',
          unitPrice: 3000,
          quantity: 2, // 6000
          discountAmount: 1000, // Taxable: 5000
        },
      ],
      {
        isGstRegistered: true,
        supplierStateCode: 'DL',
        customerStateCode: 'MH', // Maharashtra vs Delhi
        defaultTaxRate: 18.0,
      }
    );

    expect(result.isInterState).toBe(true);
    expect(result.subtotal).toBe(6000);
    expect(result.discountAmount).toBe(1000);
    expect(result.taxableAmount).toBe(5000);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
    expect(result.igstAmount).toBe(900); // 18% of 5000
    expect(result.totalTax).toBe(900);
    expect(result.totalAmount).toBe(5900);
  });

  it('applies 0% GST when organization is unregistered', () => {
    const result = TaxCalculator.calculate(
      [
        {
          description: 'Drop-in Class',
          unitPrice: 600,
          quantity: 1,
        },
      ],
      {
        isGstRegistered: false,
        supplierStateCode: 'DL',
        customerStateCode: 'DL',
        defaultTaxRate: 18.0,
      }
    );

    expect(result.taxableAmount).toBe(600);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
    expect(result.igstAmount).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.totalAmount).toBe(600);
  });

  it('supports custom SAC code and item-specific tax rate override', () => {
    const result = TaxCalculator.calculate(
      [
        {
          description: 'Yoga Mat Props Sale',
          sacCode: '9984',
          quantity: 1,
          unitPrice: 1000,
          taxRatePercent: 12.0, // 12% override
        },
        {
          description: 'Monthly Pass',
          quantity: 1,
          unitPrice: 2000,
          taxRatePercent: 18.0, // 18%
        },
      ],
      {
        isGstRegistered: true,
        supplierStateCode: 'KA',
        customerStateCode: 'KA',
        defaultTaxRate: 18.0,
      }
    );

    // Item 1: 1000 @ 12% = 60 CGST + 60 SGST = 120 tax -> 1120 total
    // Item 2: 2000 @ 18% = 180 CGST + 180 SGST = 360 tax -> 2360 total
    expect(result.lineItems[0].sacCode).toBe('9984');
    expect(result.lineItems[0].cgstAmount).toBe(60);
    expect(result.lineItems[0].sgstAmount).toBe(60);
    expect(result.lineItems[0].totalAmount).toBe(1120);

    expect(result.lineItems[1].cgstAmount).toBe(180);
    expect(result.lineItems[1].sgstAmount).toBe(180);
    expect(result.lineItems[1].totalAmount).toBe(2360);

    expect(result.subtotal).toBe(3000);
    expect(result.cgstAmount).toBe(240);
    expect(result.sgstAmount).toBe(240);
    expect(result.totalTax).toBe(480);
    expect(result.totalAmount).toBe(3480);
  });

  it('prevents negative taxable amount if discount exceeds subtotal', () => {
    const result = TaxCalculator.calculate(
      [
        {
          description: 'Complimentary pass',
          unitPrice: 500,
          discountAmount: 1000,
        },
      ],
      {
        isGstRegistered: true,
        supplierStateCode: 'DL',
        customerStateCode: 'DL',
        defaultTaxRate: 18.0,
      }
    );

    expect(result.taxableAmount).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});
