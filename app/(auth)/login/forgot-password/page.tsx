import Link from "next/link";

import { requestPasswordReset } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const sp = await searchParams;
  const error = sp.error;
  const sent = sp.sent === "1";

  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">Reset password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground" role="status">
              If an account exists for that email, you&apos;ll receive a reset link shortly. Check
              your inbox and spam folder.
            </p>
            <Button render={<Link href="/login" />} nativeButton={false} className="w-full">
              Back to sign in
            </Button>
          </div>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
        )}
      </CardContent>
      {!sent ? (
        <CardFooter className="flex justify-center border-t-0 pt-0">
          <Link
            href="/login"
            className="text-center text-xs text-muted-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  );
}
