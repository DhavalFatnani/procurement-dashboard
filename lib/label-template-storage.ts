import type { BarcodeLabelDefaultsState } from "@/lib/barcode-label-config";
import {
  barcodeLabelConfigSessionKey,
  loadBarcodeLabelDefaults,
  parseBarcodeLabelConfig,
} from "@/lib/barcode-label-config";
import { migrateBarcodeLabelConfigToTemplate } from "@/lib/label-template-migrate";
import type { LabelTemplate } from "@/lib/label-template-types";
import { normalizeLabelTemplate, parseLabelTemplate } from "@/lib/label-template-types";

const TEMPLATE_DEFAULTS_STORAGE_KEY = "knot-label-template-defaults-v1";
const TEMPLATE_SESSION_PREFIX = "knot-label-template-";
const MIGRATION_DONE_KEY = "knot-label-template-migrated-v1";

export type LabelTemplateDefaultsState = {
  locked: boolean;
  template: LabelTemplate;
};

export function labelTemplateSessionKey(reservationId: string): string {
  return `${TEMPLATE_SESSION_PREFIX}${reservationId}`;
}

export function saveLabelTemplateToSession(
  reservationId: string,
  template: LabelTemplate,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    labelTemplateSessionKey(reservationId),
    JSON.stringify(normalizeLabelTemplate(template)),
  );
}

export function loadLabelTemplateFromSession(reservationId: string): LabelTemplate | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(labelTemplateSessionKey(reservationId));
  if (!raw) return null;
  return parseLabelTemplate(JSON.parse(raw));
}

export function loadLabelTemplateDefaults(): LabelTemplateDefaultsState {
  if (typeof localStorage === "undefined") {
    return { locked: false, template: migrateBarcodeLabelConfigToTemplate(
      loadBarcodeLabelDefaults().config,
    ) };
  }

  const raw = localStorage.getItem(TEMPLATE_DEFAULTS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<LabelTemplateDefaultsState>;
      const template = parseLabelTemplate(parsed.template);
      if (template) {
        return { locked: parsed.locked === true, template };
      }
    } catch {
      // fall through to migration
    }
  }

  return migrateLegacyDefaultsIfNeeded();
}

function migrateLegacyDefaultsIfNeeded(): LabelTemplateDefaultsState {
  const legacy = loadBarcodeLabelDefaults();
  const template = migrateBarcodeLabelConfigToTemplate(legacy.config);
  const state: LabelTemplateDefaultsState = { locked: legacy.locked, template };

  if (typeof localStorage !== "undefined") {
    const migrated = localStorage.getItem(MIGRATION_DONE_KEY);
    if (!migrated) {
      persistLabelTemplateDefaults(state);
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
    }
  }

  return state;
}

function persistLabelTemplateDefaults(state: LabelTemplateDefaultsState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    TEMPLATE_DEFAULTS_STORAGE_KEY,
    JSON.stringify({
      locked: state.locked,
      template: normalizeLabelTemplate(state.template),
    }),
  );
}

export function lockLabelTemplateDefaults(template: LabelTemplate): LabelTemplateDefaultsState {
  const state: LabelTemplateDefaultsState = {
    locked: true,
    template: normalizeLabelTemplate(template),
  };
  persistLabelTemplateDefaults(state);
  return state;
}

export function unlockLabelTemplateDefaults(template: LabelTemplate): LabelTemplateDefaultsState {
  const state: LabelTemplateDefaultsState = {
    locked: false,
    template: normalizeLabelTemplate(template),
  };
  persistLabelTemplateDefaults(state);
  return state;
}

export function saveLabelTemplateDefaultsDraft(template: LabelTemplate): void {
  const current = loadLabelTemplateDefaults();
  if (current.locked) return;
  persistLabelTemplateDefaults({ locked: false, template: normalizeLabelTemplate(template) });
}

export function getLatestLabelTemplateForLock(): LabelTemplate {
  return loadLabelTemplateDefaults().template;
}

/** Migrate session legacy BarcodeLabelConfig to LabelTemplate on read. */
export function loadEffectiveLabelTemplateFromSession(
  reservationId: string,
): LabelTemplate | null {
  const templateSession = loadLabelTemplateFromSession(reservationId);
  if (templateSession) return templateSession;

  if (typeof sessionStorage === "undefined") return null;
  const legacyKey = barcodeLabelConfigSessionKey(reservationId);
  const legacyRaw = sessionStorage.getItem(legacyKey);
  if (!legacyRaw) return null;

  const legacyConfig = parseBarcodeLabelConfig(legacyRaw);
  const migrated = migrateBarcodeLabelConfigToTemplate(legacyConfig);
  saveLabelTemplateToSession(reservationId, migrated);
  sessionStorage.removeItem(legacyKey);
  return migrated;
}

export function migrateLegacyBarcodeDefaults(): LabelTemplateDefaultsState {
  const legacy: BarcodeLabelDefaultsState = loadBarcodeLabelDefaults();
  const template = migrateBarcodeLabelConfigToTemplate(legacy.config);
  const state: LabelTemplateDefaultsState = { locked: legacy.locked, template };
  persistLabelTemplateDefaults(state);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(MIGRATION_DONE_KEY, "1");
  }
  return state;
}
