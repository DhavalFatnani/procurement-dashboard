import { type EmailOtpType } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";

import { RecoveryLinkVerifier } from "@/components/auth/RecoveryLinkVerifier";
import { AUTH_RECOVERY_NEXT_PATH } from "@/lib/get-site-origin";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Verify password reset",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
};

const RECOVERY_TYPES = new Set<EmailOtpType>(["recovery", "invite", "signup"]);

function parseNext(value: string | undefined): string {
  if (value?.startsWith("/")) return value;
  return AUTH_RECOVERY_NEXT_PATH;
}

export default async function VerifyRecoveryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tokenHash = sp.token_hash?.trim();
  const type = sp.type as EmailOtpType | undefined;
  const next = parseNext(sp.next);

  if (!tokenHash || !type || !RECOVERY_TYPES.has(type)) {
    return (
      <Card className="w-full border-border-subtle shadow-ds-2">
        <CardHeader className="text-center">
          <CardTitle className="text-ds-lg font-semibold tracking-tight">
            Invalid reset link
          </CardTitle>
          <CardDescription>
            This link is missing required details or has already been used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login/forgot-password"
            className="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a new reset link
          </Link>
        </CardContent>
        <CardFooter className="flex justify-center border-t-0 pt-0">
          <Link
            href="/login"
            className="text-center text-xs text-muted-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return <RecoveryLinkVerifier tokenHash={tokenHash} type={type} next={next} />;
}
