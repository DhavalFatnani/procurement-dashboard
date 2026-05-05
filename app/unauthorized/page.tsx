import Link from "next/link";

import { getSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function UnauthorizedPage() {
  const sessionUser = await getSessionUser();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const roleLabel = sessionUser ? ROLE_LABELS[sessionUser.role] : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Unauthorized</h1>
        <p className="text-muted-foreground">
          You do not have permission to view this area, or your account is missing a valid role in
          Supabase user metadata.
        </p>
      </div>

      {sessionUser ? (
        <p className="text-sm text-foreground">
          Your current role:{" "}
          <span className="font-medium">
            {roleLabel} ({sessionUser.role})
          </span>
        </p>
      ) : user ? (
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}, but no procurement role was found on your profile.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
        ) : (
          <Button render={<Link href="/login" />}>Sign in</Button>
        )}
      </div>
    </div>
  );
}
