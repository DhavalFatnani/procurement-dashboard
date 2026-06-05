"use client";

import { Role } from "@/lib/prisma-enums";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { updateSeriesConfig } from "@/app/actions/serial";
import type { SeriesConfigSummary } from "@/lib/serial-governance-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SeriesCode } from "@/lib/series-codes";
import { cn } from "@/lib/utils";

export function SerialAdvancedConfig({
  configs,
  role,
}: {
  configs: SeriesConfigSummary[];
  role: Role;
}) {
  const router = useRouter();
  const isAdmin = role === Role.ADMIN;
  const [open, setOpen] = React.useState(false);
  const [ceilings, setCeilings] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(configs.map((c) => [c.series, c.ceilingNumber])),
  );
  const [savingSeries, setSavingSeries] = React.useState<SeriesCode | null>(null);

  async function handleSave(series: SeriesCode) {
    setSavingSeries(series);
    const res = await updateSeriesConfig(series, {
      ceilingNumber: ceilings[series] ?? "",
    });
    setSavingSeries(null);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to save configuration.");
      return;
    }
    toast.success("Series ceiling saved.");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-muted/20">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-ds-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="size-4 shrink-0" strokeWidth={1.5} />
        )}
        Advanced settings
        <span className="font-normal text-muted-foreground">
          {isAdmin ? "(Admin — ceilings; full config on platform)" : "(Ops Head — range ceilings)"}
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border-subtle px-4 pb-4 pt-3">
          {isAdmin ? (
            <p className="text-ds-xs text-muted-foreground">
              Rename series labels, prefix patterns, thresholds, and ceilings on{" "}
              <Link href="/admin/platform/series" className="font-medium text-foreground underline-offset-2 hover:underline">
                Platform → Series config
              </Link>
              . Changes are audited.
            </p>
          ) : (
            <p className="text-ds-xs text-muted-foreground">
              Hard backstop for the maximum serial number per series. Ranges are long-tail by
              design — these ceilings rarely need attention.
            </p>
          )}
          {configs.map((config) => (
            <div
              key={config.series}
              className={cn(
                "flex flex-wrap items-end gap-3 rounded-lg border border-border-subtle bg-card p-3",
              )}
            >
              <div className="min-w-[140px] flex-1 space-y-1">
                <p className="text-ds-sm font-medium">{config.displayName}</p>
                <label className="text-ds-xs text-muted-foreground" htmlFor={`ceiling-${config.series}`}>
                  Range ceiling (max serial)
                </label>
                <Input
                  id={`ceiling-${config.series}`}
                  value={ceilings[config.series] ?? config.ceilingNumber}
                  onChange={(e) =>
                    setCeilings((prev) => ({ ...prev, [config.series]: e.target.value }))
                  }
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={savingSeries === config.series}
                onClick={() => void handleSave(config.series)}
              >
                {savingSeries === config.series ? "Saving…" : "Save"}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
