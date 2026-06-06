"use client";

import { type EmailOtpType } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export function RecoveryLinkVerifier({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string;
  type: EmailOtpType;
  next: string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleContinue() {
    setBusy(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    setBusy(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace(next);
  }

  return (
    <Card className="w-full border-border-subtle shadow-ds-2">
      <CardHeader className="text-center">
        <CardTitle className="text-ds-lg font-semibold tracking-tight">
          Open password reset
        </CardTitle>
        <CardDescription>
          This link is single-use. Tap continue to verify it in your browser.
          Chat apps sometimes open links in the background for previews — waiting
          for you to continue keeps the link valid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          className="w-full"
          disabled={busy}
          onClick={() => void handleContinue()}
        >
          {busy ? "Verifying…" : "Continue"}
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center border-t-0 pt-0">
        <p className="text-center text-xs text-muted-foreground">
          Link expired? Ask your admin to send a new password reset.
        </p>
      </CardFooter>
    </Card>
  );
}
