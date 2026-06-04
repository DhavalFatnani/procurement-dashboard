"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  forceClosePO,
  markDeliveryComplete,
} from "@/app/actions/purchase-orders";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import { Button } from "@/components/ui/button";
import type { PONextAction, PONextActionId } from "@/lib/po-next-actions";

/**
 * Sticky action bar for the PO detail page. Renders the primary contextual
 * action plus any destructive Ops actions. Mutate-style actions live here so
 * the confirmation dialogs are owned alongside their triggers.
 *
 * The parent invokes `runMutateAction(id)` (returned by `useActionRunner`)
 * when the side-panel "Next actions" list has the same mutate action; this
 * keeps both surfaces wired to the same handlers.
 */
export function PODetailActionBar({
  poId,
  actions,
  runMutateActionRef,
}: {
  poId: string;
  actions: PONextAction[];
  runMutateActionRef: React.MutableRefObject<
    (id: PONextActionId) => void
  >;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [markDeliveryOpen, setMarkDeliveryOpen] = React.useState(false);
  const [forceCloseOpen, setForceCloseOpen] = React.useState(false);

  function handleMarkDeliveryComplete() {
    startTransition(async () => {
      const res = await markDeliveryComplete(poId);
      if (!res.ok) {
        toast.error(res.message ?? "Failed to mark delivery complete.");
        return;
      }
      toast.success("Delivery marked complete.");
      router.refresh();
    });
  }

  function handleForceClose(reason: string) {
    startTransition(async () => {
      const res = await forceClosePO(poId, reason);
      if (!res.ok) {
        toast.error(res.message ?? "Failed to force close.");
        return;
      }
      toast.success("Purchase order force closed.");
      router.refresh();
    });
  }

  const runMutateAction = React.useCallback(
    (id: PONextActionId) => {
      if (id === "mark-delivery-complete") {
        setMarkDeliveryOpen(true);
        return;
      }
      if (id === "force-close") {
        setForceCloseOpen(true);
      }
    },
    [],
  );

  // Expose imperative handler to parent so the side-panel actions can route
  // through the same dialog state.
  React.useEffect(() => {
    runMutateActionRef.current = runMutateAction;
  }, [runMutateAction, runMutateActionRef]);

  if (actions.length === 0) {
    return null;
  }

  const primary = actions[0]!;
  const secondary = actions.filter(
    (a, i) => i !== 0 && a.tone !== "destructive",
  );
  const destructive = actions.find((a) => a.tone === "destructive");

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {primary.href ? (
          <Button render={<Link href={primary.href} />} className="gap-1.5">
            {primary.label}
            <ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            className="gap-1.5"
            loading={pending}
            disabled={pending}
            onClick={() => runMutateAction(primary.id)}
          >
            {primary.label}
            <ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden />
          </Button>
        )}
        {secondary.map((action) =>
          action.href ? (
            <Button
              key={action.id}
              variant="soft"
              render={<Link href={action.href} />}
            >
              {action.label}
            </Button>
          ) : (
            <Button
              key={action.id}
              type="button"
              variant="soft"
              loading={pending}
              disabled={pending}
              onClick={() => runMutateAction(action.id)}
            >
              {action.label}
            </Button>
          ),
        )}
      </div>
      {destructive ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          loading={pending}
          disabled={pending}
          onClick={() => runMutateAction(destructive.id)}
        >
          {destructive.label}
        </Button>
      ) : null}

      <div className="sr-only">
        <ConfirmDialog
        open={markDeliveryOpen}
        onOpenChange={setMarkDeliveryOpen}
        title="Mark delivery complete?"
        description="This flags the PO as delivery complete and runs auto-close evaluation."
        confirmLabel="Confirm"
        pending={pending}
        onConfirm={handleMarkDeliveryComplete}
      />

      <TextareaActionDialog
        open={forceCloseOpen}
        onOpenChange={setForceCloseOpen}
        title="Force close purchase order"
        description="Provide a mandatory reason. This cannot be undone through normal workflow."
        label="Reason"
        confirmLabel="Force close"
        pending={pending}
        onConfirm={(reason) => handleForceClose(reason)}
        />
      </div>
    </div>
  );
}
