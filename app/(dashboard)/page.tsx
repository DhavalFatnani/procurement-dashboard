import { getSessionUser } from "@/lib/auth";

export default async function DashboardHomePage() {
  const user = await getSessionUser();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user?.email}</span> (
        {user?.role})
      </p>
      <p className="text-sm text-muted-foreground">
        Invoice and payment proof uploads use Supabase Storage buckets{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">invoices</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">payment-proofs</code>.
      </p>
    </div>
  );
}
