"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold">Something went wrong loading this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Try again, or return to the dashboard. If the problem persists, contact your administrator.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={handleRetry}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }))}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
