export interface TaxCalculationItemInput {
  description: string;
  sacCode?: string;
  quantity?: number;
  unitPrice: number;
  discountAmount?: number;
  taxRatePercent?: number;
}

export interface CalculatedLineItem {
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  taxRatePercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface TaxCalculationResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
  isInterState: boolean;
  lineItems: CalculatedLineItem[];
}

export class TaxCalculator {
  static round(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  static calculate(
    items: TaxCalculationItemInput[],
    options: {
      isGstRegistered: boolean;
      supplierStateCode: string;
      customerStateCode: string;
      defaultTaxRate?: number;
      defaultSacCode?: string;
      overallDiscount?: number;
    }
  ): TaxCalculationResult {
    const isInterState =
      options.isGstRegistered &&
      options.supplierStateCode.trim().toUpperCase() !== options.customerStateCode.trim().toUpperCase();

    let subtotal = 0;
    let itemsDiscount = 0;
    let taxableTotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const calculatedItems: CalculatedLineItem[] = [];

    for (const item of items) {
      const qty = item.quantity || 1;
      const price = item.unitPrice || 0;
      const lineSubtotal = this.round(qty * price);
      const lineDiscount = this.round(item.discountAmount || 0);
      const taxableAmount = Math.max(0, this.round(lineSubtotal - lineDiscount));

      subtotal += lineSubtotal;
      itemsDiscount += lineDiscount;
      taxableTotal += taxableAmount;

      const taxRate = options.isGstRegistered
        ? item.taxRatePercent !== undefined
          ? item.taxRatePercent
          : options.defaultTaxRate !== undefined
          ? options.defaultTaxRate
          : 18.0
        : 0;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (options.isGstRegistered && taxRate > 0) {
        if (isInterState) {
          igst = this.round((taxableAmount * taxRate) / 100);
        } else {
          const halfRate = taxRate / 2;
          cgst = this.round((taxableAmount * halfRate) / 100);
          sgst = this.round((taxableAmount * halfRate) / 100);
        }
      }

      const lineTotal = this.round(taxableAmount + cgst + sgst + igst);

      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      calculatedItems.push({
        description: item.description,
        sacCode: item.sacCode || options.defaultSacCode || '9992',
        quantity: qty,
        unitPrice: price,
        discountAmount: lineDiscount,
        taxableAmount,
        taxRatePercent: taxRate,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: lineTotal,
      });
    }

    const overallDiscount = this.round(options.overallDiscount || 0);
    const totalDiscount = this.round(itemsDiscount + overallDiscount);
    const finalTaxable = Math.max(0, this.round(subtotal - totalDiscount));

    // If there is an overall invoice-level discount applied, scale taxes proportionally
    let finalCgst = this.round(totalCgst);
    let finalSgst = this.round(totalSgst);
    let finalIgst = this.round(totalIgst);

    if (overallDiscount > 0 && taxableTotal > 0) {
      const discountRatio = finalTaxable / taxableTotal;
      finalCgst = this.round(totalCgst * discountRatio);
      finalSgst = this.round(totalSgst * discountRatio);
      finalIgst = this.round(totalIgst * discountRatio);
    }

    const totalTax = this.round(finalCgst + finalSgst + finalIgst);
    const totalAmount = this.round(finalTaxable + totalTax);

    return {
      subtotal: this.round(subtotal),
      discountAmount: totalDiscount,
      taxableAmount: finalTaxable,
      cgstAmount: finalCgst,
      sgstAmount: finalSgst,
      igstAmount: finalIgst,
      totalTax,
      totalAmount,
      isInterState,
      lineItems: calculatedItems,
    };
  }
}
