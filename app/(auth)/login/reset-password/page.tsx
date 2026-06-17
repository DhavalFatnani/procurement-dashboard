import Link from "next/link";

import { updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const sp = await searchParams;
  const error = sp.error;

  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">Choose a new password</CardTitle>
        <CardDescription>Enter and confirm your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updatePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              New password
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirmPassword">
              Confirm password
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
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
