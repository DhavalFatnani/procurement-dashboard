"use server";

import { revalidateTag } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { ADMIN_ONLY_ROLES, CENTRAL_OPS_OR_ADMIN_ROLES, SM_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";
import { resolveLabelTemplateWithIds } from "@/lib/label-template-resolve";
import type {
  LabelTemplate,
  LabelTemplateListItem,
  LabelTemplatePurpose,
  ResolvedLabelTemplate,
} from "@/lib/label-template-types";
import {
  appPurposeToPrisma,
  normalizeLabelTemplate,
  parseLabelTemplate,
  prismaPurposeToApp,
} from "@/lib/label-template-types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireRoles } from "@/lib/server-action-guard";
import { assertSeriesCode } from "@/lib/series-codes";

const ORG_SETTINGS_TAG = "org-settings";
const SERIES_CONFIG_TAG = "series-config";
const LABEL_TEMPLATE_TAG = "label-templates";

const LIST_PAGE_SIZE = 20;

async function getOrgDefaultTemplates(): Promise<{
  serial: { template: unknown; templateId?: string } | null;
  bin: { template: unknown; templateId?: string } | null;
}> {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: "singleton" },
    include: {
      defaultLabelTemplate: true,
      defaultBinLabelTemplate: true,
    },
  });
  return {
    serial: settings?.defaultLabelTemplate
      ? {
          template: settings.defaultLabelTemplate.template,
          templateId: settings.defaultLabelTemplate.id,
        }
      : null,
    bin: settings?.defaultBinLabelTemplate
      ? {
          template: settings.defaultBinLabelTemplate.template,
          templateId: settings.defaultBinLabelTemplate.id,
        }
      : null,
  };
}

async function getSeriesTemplate(seriesCode: string): Promise<{
  template: unknown;
  templateId?: string;
} | null> {
  const config = await prisma.seriesConfig.findUnique({
    where: { code: seriesCode },
    include: { labelTemplate: true },
  });
  if (!config?.labelTemplate) return null;
  return {
    template: config.labelTemplate.template,
    templateId: config.labelTemplate.id,
  };
}

export async function getResolvedLabelTemplate(
  seriesCode: string,
  reservationId?: string,
): Promise<ResolvedLabelTemplate> {
  await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);
  return getResolvedLabelTemplateForPrint(seriesCode, reservationId);
}

/** SM-accessible resolution for print dialog. */
export async function getResolvedLabelTemplateForPrint(
  seriesCode: string,
  reservationId?: string,
): Promise<ResolvedLabelTemplate> {
  await requireRoles(SM_OPS_OR_ADMIN_ROLES);
  const code = assertSeriesCode(seriesCode);
  const [orgDefaults, seriesOverride, reservation] = await Promise.all([
    getOrgDefaultTemplates(),
    getSeriesTemplate(code),
    reservationId
      ? prisma.serialReservation.findUnique({
          where: { id: reservationId },
          select: { printTimeLabelOverride: true },
        })
      : Promise.resolve(null),
  ]);

  return resolveLabelTemplateWithIds({
    purpose: "serial",
    printTimeOverride: reservation?.printTimeLabelOverride ?? undefined,
    seriesTemplate: seriesOverride?.template,
    seriesTemplateId: seriesOverride?.templateId,
    orgDefaultTemplate: orgDefaults.serial?.template,
    orgDefaultTemplateId: orgDefaults.serial?.templateId,
  });
}

export async function getResolvedBinLabelTemplate(): Promise<ResolvedLabelTemplate> {
  await requireRoles(SM_OPS_OR_ADMIN_ROLES);
  const orgDefaults = await getOrgDefaultTemplates();
  return resolveLabelTemplateWithIds({
    purpose: "bin",
    orgBinDefaultTemplate: orgDefaults.bin?.template,
    orgBinDefaultTemplateId: orgDefaults.bin?.templateId,
  });
}

export async function listLabelTemplates(input?: {
  purpose?: LabelTemplatePurpose;
  page?: number;
}): Promise<{ items: LabelTemplateListItem[]; total: number }> {
  await requireRoles(SM_OPS_OR_ADMIN_ROLES);
  const page = Math.max(1, input?.page ?? 1);
  const skip = (page - 1) * LIST_PAGE_SIZE;
  const purpose = input?.purpose ? appPurposeToPrisma(input.purpose) : undefined;

  const orgDefaults = await getOrgDefaultTemplates();
  const orgDefaultIds = new Set(
    [orgDefaults.serial?.templateId, orgDefaults.bin?.templateId].filter(Boolean) as string[],
  );

  const where = purpose ? { purpose } : undefined;

  const [rows, total] = await Promise.all([
    prisma.labelTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: LIST_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        description: true,
        purpose: true,
        updatedAt: true,
      },
    }),
    prisma.labelTemplate.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      purpose: prismaPurposeToApp(row.purpose),
      isOrgDefault: orgDefaultIds.has(row.id),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
  };
}

export async function getLabelTemplateById(
  templateId: string,
): Promise<
  | {
      id: string;
      name: string;
      description: string | null;
      purpose: LabelTemplatePurpose;
      template: LabelTemplate;
      isOrgDefault: boolean;
    }
  | null
> {
  await requireRoles(SM_OPS_OR_ADMIN_ROLES);
  const row = await prisma.labelTemplate.findUnique({ where: { id: templateId } });
  if (!row) return null;

  const orgDefaults = await getOrgDefaultTemplates();
  const isOrgDefault =
    orgDefaults.serial?.templateId === row.id || orgDefaults.bin?.templateId === row.id;

  const template = parseLabelTemplate(row.template);
  if (!template) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    purpose: prismaPurposeToApp(row.purpose),
    template,
    isOrgDefault,
  };
}

export async function updateLabelTemplateRecord(
  templateId: string,
  template: LabelTemplate,
  name?: string,
  description?: string | null,
): Promise<MutationResult> {
  await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);
  const normalized = normalizeLabelTemplate(template);
  const existing = await prisma.labelTemplate.findUnique({ where: { id: templateId } });
  if (!existing) {
    return { ok: false, message: "Template not found." };
  }

  await prisma.labelTemplate.update({
    where: { id: templateId },
    data: {
      template: normalized,
      ...(name != null ? { name: name.trim() || existing.name } : {}),
      ...(description !== undefined ? { description } : {}),
    },
  });

  revalidateTag(LABEL_TEMPLATE_TAG);
  revalidateTag(ORG_SETTINGS_TAG);
  revalidateTag(SERIES_CONFIG_TAG);
  return { ok: true };
}

export async function deleteLabelTemplate(templateId: string): Promise<MutationResult> {
  await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);
  const orgDefaults = await getOrgDefaultTemplates();
  if (
    orgDefaults.serial?.templateId === templateId ||
    orgDefaults.bin?.templateId === templateId
  ) {
    return { ok: false, message: "Cannot delete a template that is set as organization default." };
  }

  const seriesUsing = await prisma.seriesConfig.count({
    where: { labelTemplateId: templateId },
  });
  if (seriesUsing > 0) {
    return { ok: false, message: "Cannot delete a template linked to a series." };
  }

  await prisma.labelTemplate.delete({ where: { id: templateId } });
  revalidateTag(LABEL_TEMPLATE_TAG);
  return { ok: true };
}

export async function duplicateLabelTemplate(
  templateId: string,
): Promise<MutationResult & { templateId?: string }> {
  const user = await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);
  const existing = await prisma.labelTemplate.findUnique({ where: { id: templateId } });
  if (!existing) {
    return { ok: false, message: "Template not found." };
  }

  const created = await prisma.labelTemplate.create({
    data: {
      name: `${existing.name} (copy)`,
      description: existing.description,
      purpose: existing.purpose,
      template: existing.template as Prisma.InputJsonValue,
      createdById: user.id,
    },
  });

  revalidateTag(LABEL_TEMPLATE_TAG);
  return { ok: true, templateId: created.id };
}

export async function saveOrgDefaultLabelTemplate(
  template: LabelTemplate,
  name = "Org default (serial)",
): Promise<MutationResult & { templateId?: string }> {
  const user = await requireRoles(ADMIN_ONLY_ROLES);
  const normalized = normalizeLabelTemplate(template);

  const existing = await prisma.orgSettings.findUnique({
    where: { id: "singleton" },
    select: { defaultLabelTemplateId: true },
  });

  let templateId: string;

  if (existing?.defaultLabelTemplateId) {
    await prisma.labelTemplate.update({
      where: { id: existing.defaultLabelTemplateId },
      data: { name, template: normalized, purpose: "SERIAL" },
    });
    templateId = existing.defaultLabelTemplateId;
  } else {
    const created = await prisma.labelTemplate.create({
      data: {
        name,
        purpose: "SERIAL",
        template: normalized,
        createdById: user.id,
        orgDefaultFor: {
          connectOrCreate: {
            where: { id: "singleton" },
            create: { id: "singleton", updatedAt: new Date() },
          },
        },
      },
    });
    templateId = created.id;
  }

  revalidateTag(ORG_SETTINGS_TAG);
  revalidateTag(LABEL_TEMPLATE_TAG);
  return { ok: true, templateId };
}

export async function saveOrgBinDefaultLabelTemplate(
  template: LabelTemplate,
  name = "Org default (bin)",
  preferredTemplateId?: string,
): Promise<MutationResult & { templateId?: string }> {
  const user = await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);
  const normalized = normalizeLabelTemplate(template);

  if (preferredTemplateId) {
    const existing = await prisma.labelTemplate.findUnique({
      where: { id: preferredTemplateId },
    });
    if (!existing) {
      return { ok: false, message: "Template not found." };
    }
    if (existing.purpose !== "BIN") {
      return { ok: false, message: "Template is not a bin label template." };
    }

    await prisma.labelTemplate.update({
      where: { id: preferredTemplateId },
      data: {
        template: normalized,
        ...(name?.trim() ? { name: name.trim() } : {}),
      },
    });

    await prisma.orgSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        defaultBinLabelTemplateId: preferredTemplateId,
        updatedAt: new Date(),
      },
      update: { defaultBinLabelTemplateId: preferredTemplateId },
    });

    revalidateTag(ORG_SETTINGS_TAG);
    revalidateTag(LABEL_TEMPLATE_TAG);
    return { ok: true, templateId: preferredTemplateId };
  }

  const existing = await prisma.orgSettings.findUnique({
    where: { id: "singleton" },
    select: { defaultBinLabelTemplateId: true },
  });

  let templateId: string;

  if (existing?.defaultBinLabelTemplateId) {
    await prisma.labelTemplate.update({
      where: { id: existing.defaultBinLabelTemplateId },
      data: { name, template: normalized, purpose: "BIN" },
    });
    templateId = existing.defaultBinLabelTemplateId;
  } else {
    const created = await prisma.labelTemplate.create({
      data: {
        name,
        purpose: "BIN",
        template: normalized,
        createdById: user.id,
      },
    });
    await prisma.orgSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        defaultBinLabelTemplateId: created.id,
        updatedAt: new Date(),
      },
      update: { defaultBinLabelTemplateId: created.id },
    });
    templateId = created.id;
  }

  revalidateTag(ORG_SETTINGS_TAG);
  revalidateTag(LABEL_TEMPLATE_TAG);
  return { ok: true, templateId };
}

export async function saveSeriesLabelTemplate(
  seriesCode: string,
  templateId: string | null,
): Promise<MutationResult> {
  await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);
  const code = assertSeriesCode(seriesCode);

  if (templateId) {
    const exists = await prisma.labelTemplate.findUnique({ where: { id: templateId } });
    if (!exists) {
      return { ok: false, message: "Template not found." };
    }
  }

  await prisma.seriesConfig.update({
    where: { code },
    data: { labelTemplateId: templateId },
  });

  revalidateTag(SERIES_CONFIG_TAG);
  return { ok: true };
}

export async function createLabelTemplateRecord(
  template: LabelTemplate,
  name: string,
  purpose: LabelTemplatePurpose = "serial",
  description?: string,
): Promise<MutationResult & { templateId?: string }> {
  const user = await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);
  const normalized = normalizeLabelTemplate(template);

  const created = await prisma.labelTemplate.create({
    data: {
      name: name.trim() || "Custom template",
      description: description?.trim() || null,
      purpose: appPurposeToPrisma(purpose),
      template: normalized,
      createdById: user.id,
    },
  });

  revalidateTag(LABEL_TEMPLATE_TAG);
  return { ok: true, templateId: created.id };
}

export async function savePrintTimeLabelOverride(
  reservationId: string,
  template: LabelTemplate,
): Promise<MutationResult> {
  await requireRoles(SM_OPS_OR_ADMIN_ROLES);
  const normalized = normalizeLabelTemplate(template);

  await prisma.serialReservation.update({
    where: { id: reservationId },
    data: { printTimeLabelOverride: normalized },
  });

  return { ok: true };
}

export async function clearPrintTimeLabelOverride(
  reservationId: string,
): Promise<MutationResult> {
  await requireRoles(CENTRAL_OPS_OR_ADMIN_ROLES);

  await prisma.serialReservation.update({
    where: { id: reservationId },
    data: { printTimeLabelOverride: Prisma.JsonNull },
  });

  return { ok: true };
}

export async function getOrgDefaultLabelTemplate(): Promise<LabelTemplate | null> {
  const org = await getOrgDefaultTemplates();
  if (!org.serial?.template) return null;
  return parseLabelTemplate(org.serial.template);
}

export async function seedOrgDefaultIfMissing(): Promise<void> {
  const org = await getOrgDefaultTemplates();
  if (org.serial) return;

  const settings = await prisma.orgSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    await prisma.orgSettings.create({
      data: { id: "singleton", updatedAt: new Date() },
    });
  }
}
