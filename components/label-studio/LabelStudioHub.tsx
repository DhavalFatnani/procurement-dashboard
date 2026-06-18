"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { buildLabelStudioUrl } from "@/lib/label-studio-url";
import { cn } from "@/lib/utils";
import { Boxes, Tag } from "lucide-react";

const PURPOSE_CARDS = [
  {
    purpose: "serial" as const,
    title: "Serial labels",
    description:
      "Lock tags and serial batch labels for any series. Set an org-wide default or override per series.",
    icon: Tag,
    accent: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
  },
  {
    purpose: "bin" as const,
    title: "Bin labels",
    description:
      "Warehouse bin and location labels with custom fields like bin code, zone, and aisle.",
    icon: Boxes,
    accent: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
  },
];

export function LabelStudioHub() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Label Studio"
        subtitle="Design and manage label templates for different print purposes."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {PURPOSE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.purpose}
              className={cn(
                "flex flex-col items-start gap-4 rounded-xl border bg-gradient-to-br p-5 text-left transition-shadow hover:shadow-ds",
                card.accent,
              )}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(
                    buildLabelStudioUrl({ view: "library", purpose: card.purpose }),
                  )
                }
                className="flex w-full flex-col items-start gap-4 text-left"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-card shadow-ds">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-ds-md font-semibold text-foreground">{card.title}</h2>
                  <p className="text-ds-sm leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                </div>
                <span className="text-ds-sm font-medium text-primary">Browse templates →</span>
              </button>
              {card.purpose === "bin" ? (
                <Link
                  href="/bin-labels/print"
                  className="text-ds-sm font-medium text-primary hover:underline"
                >
                  Print bin labels →
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-ds-sm text-muted-foreground">
        You can also open Label Studio while reserving serials from a purchase request — your
        layout is saved for that print batch.
      </p>

      <Link href="/serial-governance">
        <Button type="button" variant="outline" size="sm">
          Serial Governance
        </Button>
      </Link>
    </div>
  );
}
