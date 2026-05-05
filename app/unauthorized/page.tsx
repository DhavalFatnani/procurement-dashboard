import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Unauthorized</h1>
      <p className="max-w-md text-muted-foreground">
        You do not have permission to view this area, or your account is missing a valid role in
        Supabase user metadata.
      </p>
      <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
