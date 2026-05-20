import { PageHeader } from "@/components/shared/PageHeader";
import { checkRole } from "@/lib/auth";
import { ACCESS } from "@/lib/route-access";

export default async function DashboardHomePage() {
  const user = await checkRole([...ACCESS.dashboard]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of procurement activity and quick links."
      />
      <p className="text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user.email}</span> ({user.role})
      </p>
      <p className="text-sm text-muted-foreground">
        Invoice and payment proof uploads use Supabase Storage buckets{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">invoices</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">payment-proofs</code>.
      </p>
    </div>
  );
}
