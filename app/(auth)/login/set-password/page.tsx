import { completeRequiredPasswordChange } from "@/app/actions/auth";
import { signOut } from "@/app/actions/sign-out";
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
  searchParams: Promise<{ error?: string }>;
};

export default async function SetPasswordPage({ searchParams }: Props) {
  const sp = await searchParams;
  const error = sp.error;

  return (
    <Card className="w-full max-w-sm shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Set your password
        </CardTitle>
        <CardDescription>
          Welcome — choose a personal password before continuing to the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={completeRequiredPasswordChange} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              New password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirmPassword">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
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
            Continue to dashboard
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t-0 pt-0">
        <form action={signOut}>
          <button
            type="submit"
            className="text-center text-xs text-muted-foreground underline underline-offset-4"
          >
            Sign out
          </button>
        </form>
      </CardFooter>
    </Card>
  );
}
