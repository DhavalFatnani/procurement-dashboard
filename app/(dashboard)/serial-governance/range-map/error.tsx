"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function SerialRangeMapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Serial range map failed to render:", error);
  }, [error]);

  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="page-stack max-w-lg">
      <h1 className="text-lg font-semibold text-foreground">Could not load the range map</h1>
      <p className="text-ds-sm text-muted-foreground">
        The database connection timed out while loading serial reservations. This often happens
        when many pages are open in dev or the remote pooler is busy. Wait a moment and try again.
      </p>
      {error.digest ? (
        <p className="font-mono text-ds-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleRetry}>
          Try again
        </Button>
        <Button variant="outline" render={<Link href="/serial-governance" />}>
          Back to serial governance
        </Button>
      </div>
    </div>
  );
}
