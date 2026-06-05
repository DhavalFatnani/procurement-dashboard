"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function PurchaseOrderDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Purchase order detail failed to render:", error);
  }, [error]);

  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="page-stack max-w-lg">
      <h1 className="text-lg font-semibold text-foreground">
        Could not load this purchase order
      </h1>
      <p className="text-ds-sm text-muted-foreground">
        The server timed out or hit a database error while loading receipts and
        disputes. Wait a moment and try again. If this keeps happening, confirm
        production uses a Prisma Accelerate URL for{" "}
        <code className="text-ds-xs">DATABASE_URL</code> (see{" "}
        <code className="text-ds-xs">.env.example</code>).
      </p>
      {error.digest ? (
        <p className="font-mono text-ds-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleRetry}>
          Try again
        </Button>
        <Button variant="outline" render={<Link href="/purchase-orders" />}>
          Back to purchase orders
        </Button>
      </div>
    </div>
  );
}
