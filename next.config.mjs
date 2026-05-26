/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Prisma + Accelerate on the Node server runtime (avoids the bundler
  // resolving dist/index.js for these native-binding packages).
  serverExternalPackages: ["@prisma/client", "@prisma/extension-accelerate"],
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      // Vendor invoices and GRN photos can be 5–8 MB scans; payment proofs
      // sometimes ship as multi-page PDFs. Raise the default 1 MB cap to a
      // reasonable ceiling that still rejects accidental huge uploads.
      bodySizeLimit: "15mb",
    },
  },
  // lucide-react tree-shaking is handled by Next.js's built-in
  // `optimizePackageImports` default list (works for both webpack and
  // Turbopack), so we no longer need a `modularizeImports` rewrite.
};

export default nextConfig;
