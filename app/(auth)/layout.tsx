import { BrandMark } from "@/components/shared/BrandMark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-shell-gradient p-4">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-[420px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--brand-accent) 35%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 size-[460px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent-role-finance) 30%, transparent), transparent)",
        }}
      />
    </>
  );
}
