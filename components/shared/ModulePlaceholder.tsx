import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";

export function ModulePlaceholder({
  title,
  subtitle,
  body,
  action,
}: {
  title: string;
  subtitle?: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        title="Coming next"
        description={
          body ??
          "This module is scaffolded with route guards. Domain workflows will be wired in the upcoming implementation pass."
        }
        action={action}
      />
    </div>
  );
}
