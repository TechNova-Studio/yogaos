import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@yogaos/database';
import {
  OrganizationTaxSettings,
  UpdateOrganizationTaxSettingsRequest,
} from '@yogaos/contracts';
import { AuditService } from '../../common/services/audit.service.js';

@Injectable()
export class TaxSettingsService {
  constructor(private readonly audit: AuditService) {}

  async getTaxSettings(tenantId: string): Promise<OrganizationTaxSettings> {
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${tenantId} not found`);
    }

    const settings = (org.settings as Record<string, any>) || {};

    return {
      legalEntityName: org.legalEntityName || org.name,
      isGstRegistered: org.isGstRegistered,
      gstin: org.gstin,
      panNumber: org.panNumber,
      defaultTaxRatePercent: settings.defaultTaxRatePercent ?? 18.0,
      defaultSacCode: settings.defaultSacCode || '9992',
      supplierStateCode: settings.supplierStateCode || 'DL',
      billingAddress: org.billingAddress || null,
    };
  }

  async updateTaxSettings(
    tenantId: string,
    data: UpdateOrganizationTaxSettingsRequest,
    userId: string
  ): Promise<OrganizationTaxSettings> {
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID ${tenantId} not found`);
    }

    const currentSettings = (org.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...currentSettings,
      defaultTaxRatePercent:
        data.defaultTaxRatePercent !== undefined
          ? data.defaultTaxRatePercent
          : currentSettings.defaultTaxRatePercent ?? 18.0,
      defaultSacCode:
        data.defaultSacCode !== undefined
          ? data.defaultSacCode
          : currentSettings.defaultSacCode || '9992',
      supplierStateCode:
        data.supplierStateCode !== undefined
          ? data.supplierStateCode
          : currentSettings.supplierStateCode || 'DL',
    };

    const updated = await prisma.organization.update({
      where: { id: tenantId },
      data: {
        legalEntityName: data.legalEntityName !== undefined ? data.legalEntityName : undefined,
        isGstRegistered: data.isGstRegistered !== undefined ? data.isGstRegistered : undefined,
        gstin: data.gstin !== undefined ? data.gstin : undefined,
        panNumber: data.panNumber !== undefined ? data.panNumber : undefined,
        billingAddress: data.billingAddress !== undefined ? (data.billingAddress as any) : undefined,
        settings: updatedSettings,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'TAX_SETTINGS_UPDATED',
      resourceType: 'OrganizationTaxSettings',
      resourceId: tenantId,
      details: {
        isGstRegistered: updated.isGstRegistered,
        gstin: updated.gstin,
        supplierStateCode: updatedSettings.supplierStateCode,
      },
    });

    return {
      legalEntityName: updated.legalEntityName || updated.name,
      isGstRegistered: updated.isGstRegistered,
      gstin: updated.gstin,
      panNumber: updated.panNumber,
      defaultTaxRatePercent: updatedSettings.defaultTaxRatePercent,
      defaultSacCode: updatedSettings.defaultSacCode,
      supplierStateCode: updatedSettings.supplierStateCode,
      billingAddress: updated.billingAddress || null,
    };
  }
}
