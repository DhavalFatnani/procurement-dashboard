import { signOut } from "@/app/actions/auth";
import { checkRole } from "@/lib/auth";
import { ROLES } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkRole(ROLES);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <span className="text-sm font-semibold">KNOT Procurement</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
