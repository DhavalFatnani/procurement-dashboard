import Link from "next/link";

import { signInWithEmail } from "@/app/actions/auth";
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
  searchParams: Promise<{ error?: string; reset?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const error = sp.error;
  const resetSuccess = sp.reset === "1";

  return (
    <Card className="w-full border-border-subtle shadow-ds-2">
      <CardHeader className="text-center">
        <CardTitle className="text-ds-lg font-semibold tracking-tight">Sign in</CardTitle>
        <CardDescription>Use your KNOT procurement account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signInWithEmail} className="space-y-4">
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Link
                href="/login/forgot-password"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {resetSuccess ? (
            <p className="text-sm text-green-600 dark:text-green-500" role="status">
              Your password has been updated. Sign in with your new password.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="gradient" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t-0 pt-0">
        <p className="text-center text-xs text-muted-foreground">
          Need access?{" "}
          <Link href="/unauthorized" className="underline underline-offset-4">
            Contact your admin
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
