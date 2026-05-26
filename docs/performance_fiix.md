# KNOT Procurement — Performance Fix Prompt
## Paste this into Cursor and run it as a single pass across the codebase

---

## WHAT IS SLOW AND WHY

This is a Next.js 14 App Router app with Prisma + Supabase running locally.
General sluggishness across all pages is caused by a predictable set of issues.
Fix all of them in one pass in this exact order.

---

## FIX 1 — PRISMA CLIENT SINGLETON (highest impact, do this first)

**Problem:** Prisma is likely instantiating a new PrismaClient on every hot reload in development, exhausting the connection pool and causing every query to wait for a new connection.

**Fix:** Open `/lib/prisma.ts` and replace whatever is there with exactly this:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['warn', 'error']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

This ensures a single PrismaClient instance is reused across all hot reloads in development. Without this, every file save creates a new connection pool and the old ones linger — this alone can make local dev feel 3–5x slower.

---

## FIX 2 — PARALLEL DATA FETCHING (eliminate sequential waterfalls)

**Problem:** Every page that needs multiple pieces of data is likely doing this:

```ts
// SLOW — sequential, each waits for the previous
const vendors = await getVendors()
const categories = await getCategories()
const warehouses = await getWarehouses()
```

Each `await` blocks the next one. If each query takes 80ms, three sequential queries = 240ms minimum.

**Fix:** Audit every page.tsx and layout.tsx server component. Replace all sequential top-level awaits with `Promise.all`:

```ts
// FAST — parallel, all fire simultaneously
const [vendors, categories, warehouses] = await Promise.all([
  getVendors(),
  getCategories(),
  getWarehouses(),
])
```

**Pages to fix — check every one of these:**
- `/app/(dashboard)/dashboard/page.tsx` — likely fetching 4–6 separate metrics sequentially
- `/app/(dashboard)/purchase-requests/page.tsx` — filters + data + counts
- `/app/(dashboard)/purchase-requests/[id]/page.tsx` — PR + versions + vendor + category
- `/app/(dashboard)/purchase-orders/[id]/page.tsx` — PO + GRNs + invoices + payments + vendor
- `/app/(dashboard)/vendors/[id]/page.tsx` — vendor + change log + linked POs
- `/app/(dashboard)/serial-governance/page.tsx` — 3 series + config + recent reservations

**Rule:** If a page.tsx has more than one `await` at the top level and those awaits are not dependent on each other's results, they must be wrapped in `Promise.all`.

The only exception: a query that needs the result of a previous query (e.g. fetch PR first, then fetch PO using PR's poId). These must remain sequential — but make sure nothing else is blocking alongside them.

---

## FIX 3 — ADD `loading.tsx` TO EVERY ROUTE SEGMENT

**Problem:** Without `loading.tsx`, Next.js App Router waits for the entire server component to resolve before sending anything to the browser. The user sees a blank white screen for the full duration of all data fetching. This feels like slowness even when the actual query time is acceptable.

**Fix:** Create a `loading.tsx` file in every route directory that has a `page.tsx`. Use skeleton loaders that match the page layout so the user sees a shaped placeholder immediately while data loads.

Create this base skeleton component at `/components/shared/SkeletonTable.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonTableProps {
  columns: number
  rows?: number
  showHeader?: boolean
}

export function SkeletonTable({
  columns,
  rows = 8,
  showHeader = true,
}: SkeletonTableProps) {
  return (
    <div className="rounded-lg border border-border-subtle overflow-hidden">
      {showHeader && (
        <div className="flex items-center gap-4 px-3 py-2 border-b border-border-subtle bg-bg-base">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-3 bg-bg-hover"
              style={{ width: `${60 + Math.random() * 80}px` }}
            />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 px-3 py-2.5 border-b border-border-subtle last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-3.5 bg-bg-hover"
              style={{ width: `${50 + Math.random() * 120}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

Create this base skeleton component at `/components/shared/SkeletonMetrics.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border-subtle p-5 bg-bg-elevated">
          <Skeleton className="h-3 w-20 bg-bg-hover mb-3" />
          <Skeleton className="h-6 w-16 bg-bg-hover mb-2" />
          <Skeleton className="h-3 w-28 bg-bg-hover" />
        </div>
      ))}
    </div>
  )
}
```

Now create `loading.tsx` for every route:

`/app/(dashboard)/dashboard/loading.tsx`:
```tsx
import { SkeletonMetrics } from '@/components/shared/SkeletonMetrics'
import { SkeletonTable } from '@/components/shared/SkeletonTable'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <SkeletonMetrics count={4} />
      <SkeletonMetrics count={3} />
      <SkeletonTable columns={5} rows={5} />
    </div>
  )
}
```

`/app/(dashboard)/purchase-requests/loading.tsx`:
```tsx
import { SkeletonTable } from '@/components/shared/SkeletonTable'
export default function Loading() {
  return <div className="p-8"><SkeletonTable columns={8} rows={10} /></div>
}
```

`/app/(dashboard)/purchase-requests/[id]/loading.tsx`:
```tsx
import { Skeleton } from '@/components/ui/skeleton'
export default function Loading() {
  return (
    <div className="p-8 grid grid-cols-[1fr_340px] gap-6">
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border-subtle p-5 bg-bg-elevated">
            <Skeleton className="h-4 w-32 bg-bg-hover mb-4" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-full bg-bg-hover" />
              <Skeleton className="h-3 w-3/4 bg-bg-hover" />
              <Skeleton className="h-3 w-1/2 bg-bg-hover" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border-subtle p-5 bg-bg-elevated h-64">
        <Skeleton className="h-4 w-24 bg-bg-hover mb-4" />
        <Skeleton className="h-8 w-full bg-bg-hover mb-3" />
        <Skeleton className="h-8 w-full bg-bg-hover" />
      </div>
    </div>
  )
}
```

Repeat the same pattern for:
- `/app/(dashboard)/vendors/loading.tsx` — SkeletonTable columns={7}
- `/app/(dashboard)/vendors/[id]/loading.tsx` — two-column layout skeleton
- `/app/(dashboard)/purchase-orders/loading.tsx` — SkeletonTable columns={7}
- `/app/(dashboard)/purchase-orders/[id]/loading.tsx` — reconciliation panel + cards skeleton
- `/app/(dashboard)/goods-receipt/loading.tsx` — SkeletonTable columns={6}
- `/app/(dashboard)/invoices/loading.tsx` — SkeletonTable columns={7}
- `/app/(dashboard)/payments/loading.tsx` — SkeletonTable columns={8}
- `/app/(dashboard)/serial-governance/loading.tsx` — three cards + table skeleton
- `/app/(dashboard)/reports/loading.tsx` — SkeletonTable columns={6}

---

## FIX 4 — NEXT.JS DATA CACHING ON SERVER ACTIONS AND FETCHES

**Problem:** Every navigation to a page that was just visited re-fetches all data from the database with zero caching. Reference data that almost never changes (categories, subcategories, warehouses, series configs) is being re-queried on every page load.

**Fix in two parts:**

**Part A — Cache static reference data using `unstable_cache`:**

In `/lib/cache.ts`, create cached versions of reference data fetchers:

```ts
import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'

// Cache categories + subcategories for 1 hour — they never change in production
export const getCachedCategories = unstable_cache(
  async () => {
    return prisma.category.findMany({
      include: { subcategories: true },
      orderBy: { name: 'asc' },
    })
  },
  ['categories-with-subcategories'],
  { revalidate: 3600, tags: ['categories'] }
)

// Cache warehouses for 1 hour
export const getCachedWarehouses = unstable_cache(
  async () => {
    return prisma.warehouse.findMany({ orderBy: { name: 'asc' } })
  },
  ['warehouses'],
  { revalidate: 3600, tags: ['warehouses'] }
)

// Cache series configs for 5 minutes — Ops Head can update these
export const getCachedSeriesConfigs = unstable_cache(
  async () => {
    return prisma.seriesConfig.findMany()
  },
  ['series-configs'],
  { revalidate: 300, tags: ['series-configs'] }
)
```

Replace every direct `prisma.category.findMany()`, `prisma.warehouse.findMany()`, and `prisma.seriesConfig.findMany()` call across the codebase with the cached versions above.

When Ops Head updates a series config, invalidate the cache:
```ts
import { revalidateTag } from 'next/cache'
// Add this inside updateSeriesConfig server action after the DB write:
revalidateTag('series-configs')
```

**Part B — Add `revalidatePath` to all mutating server actions:**

Every server action that writes to the database must call `revalidatePath` after the write so the Next.js cache for the affected pages is cleared and the next navigation gets fresh data instead of a stale cache.

Add these calls to the end of every server action (after the DB write, before the return):

```ts
// In /app/actions/purchase-requests.ts
import { revalidatePath } from 'next/cache'

// After createPR:
revalidatePath('/purchase-requests')

// After approvePR / rejectPR / sendForRevision:
revalidatePath('/purchase-requests')
revalidatePath(`/purchase-requests/${prId}`)
revalidatePath('/purchase-orders')
revalidatePath('/dashboard')

// After submitPR:
revalidatePath('/purchase-requests')
revalidatePath(`/purchase-requests/${prId}`)
revalidatePath('/dashboard')
```

```ts
// In /app/actions/vendors.ts
// After createVendor / updateVendor / deactivateVendor:
revalidatePath('/vendors')
revalidatePath(`/vendors/${vendorId}`)

// After reviewVendorRequest (activate):
revalidatePath('/vendors')
revalidatePath('/purchase-requests') // vendor dropdown updates
```

```ts
// In /app/actions/grn.ts
// After createGRN:
revalidatePath('/goods-receipt')
revalidatePath(`/purchase-orders/${poId}`)
revalidatePath('/purchase-orders')
revalidatePath('/dashboard')
```

```ts
// In /app/actions/invoices.ts
// After createInvoice:
revalidatePath('/invoices')
revalidatePath(`/purchase-orders/${poId}`)
revalidatePath('/dashboard')
```

```ts
// In /app/actions/payments.ts
// After updatePayment:
revalidatePath('/payments')
revalidatePath('/invoices')
revalidatePath(`/purchase-orders/${poId}`)
revalidatePath('/dashboard')
```

```ts
// In /app/actions/serial.ts
// After reserveSerialRange:
revalidatePath('/serial-governance')
revalidatePath('/purchase-requests')
revalidatePath('/dashboard')
```

---

## FIX 5 — PRISMA QUERY OPTIMIZATION (stop fetching what you don't need)

**Problem:** Prisma `findMany` calls across the codebase are likely using deep nested `include` statements that pull far more data than the page needs, creating large payloads that slow down both the DB query and the network transfer to the browser.

**Fix:** Audit every Prisma query and apply these rules:

**Rule A — Use `select` instead of `include` for list views:**

List views only need summary columns. They should never load nested relations. Example for PR list:

```ts
// WRONG — loads everything including relations
const prs = await prisma.purchaseRequest.findMany({
  include: {
    category: true,
    subcategory: true,
    vendor: true,
    versions: true, // ← never needed on a list
    purchaseOrder: true, // ← never needed on a list
  }
})

// RIGHT — select only what the table columns need
const prs = await prisma.purchaseRequest.findMany({
  select: {
    id: true,
    status: true,
    executionType: true,
    quantity: true,
    currentVersion: true,
    createdAt: true,
    updatedAt: true,
    category: { select: { name: true } },
    subcategory: { select: { name: true } },
    vendor: { select: { businessName: true } },
    createdBy: { select: { name: true } },
    warehouse: { select: { name: true } },
  },
  orderBy: { createdAt: 'desc' },
  take: 25, // ← always paginate
  skip: offset,
})
```

Apply this pattern to every list-view query across all actions files:
- `getVendors` — select name, pocName, phone, email, status, createdAt only
- `getPurchaseRequests` — select as above
- `getPurchaseOrders` — select id, status, orderedQty, vendor name, createdAt
- `getGRNs` — select id, poId, receivedQty, acceptedQty, receivedAt
- `getInvoices` — select id, poId, amount, matchStatus, paymentStatus, createdAt
- `getPayments` — select id, invoiceId, status, method, paidAt
- `getSerialReservations` — select id, series, rangeStart, rangeEnd, qty, createdAt

**Rule B — Use `include` with nested `select` on detail pages:**

Detail pages need relations, but still scope them:

```ts
// PO detail — load what the detail page actually renders
const po = await prisma.purchaseOrder.findUnique({
  where: { id: poId },
  include: {
    vendor: {
      select: { businessName: true, pocName: true, phone: true, email: true }
    },
    grns: {
      select: {
        id: true, receivedQty: true, acceptedQty: true, disputedQty: true,
        receivedAt: true, deliveryNoteRef: true,
        receivedBy: { select: { name: true } },
        exceptions: true,
      }
    },
    invoices: {
      select: {
        id: true, invoiceNumber: true, amount: true, expectedAmount: true,
        matchStatus: true, paymentStatus: true, createdAt: true,
        grnLinks: { select: { grnId: true } },
      }
    },
    purchaseRequest: {
      select: { id: true, categoryId: true, subcategoryId: true }
    },
    serialReservation: {
      select: { rangeStart: true, rangeEnd: true, series: true }
    },
  }
})
```

**Rule C — Always paginate list queries:**

No list query should ever run without `take` and `skip`. Default page size: 25. Add to every `findMany` in action files:

```ts
// Add these params to every list-fetching action
interface ListParams {
  page?: number
  pageSize?: number
}

const take = pageSize ?? 25
const skip = ((page ?? 1) - 1) * take

// Always include total count for pagination UI (use Promise.all):
const [items, total] = await Promise.all([
  prisma.model.findMany({ where, select, orderBy, take, skip }),
  prisma.model.count({ where }),
])
```

---

## FIX 6 — ELIMINATE CLIENT COMPONENT BLOAT

**Problem:** Components marked `'use client'` in Next.js App Router opt out of server-side rendering for their entire subtree. If large page sections are unnecessarily marked as client components, they add JavaScript bundle weight and delay interactivity.

**Fix:** Audit every component file for `'use client'` directives.

**Rule:** A component only needs `'use client'` if it uses:
- `useState`, `useEffect`, `useReducer`, `useRef`
- Event handlers (`onClick`, `onChange`, etc.) that aren't passed as props from a server component
- Browser APIs (`window`, `document`, `localStorage`)
- Third-party hooks that require client context

**If a component only renders HTML and receives data as props → remove `'use client'`.**

Common offenders to check and fix:
- `StatusBadge.tsx` — pure render, no state → remove `'use client'`
- `DataTable.tsx` — if it has no client interactions → remove or split
- `PageHeader.tsx` — pure render → remove `'use client'`
- `EmptyState.tsx` — pure render → remove `'use client'`
- Any card component that just displays props → remove `'use client'`

**Correct pattern — split client interactivity into leaf components:**

```tsx
// PurchaseRequestsPage.tsx — SERVER COMPONENT (no 'use client')
// Fetches data, renders layout, passes data down
import { PRTable } from './PRTable' // client component
import { PRFilters } from './PRFilters' // client component

export default async function PurchaseRequestsPage() {
  const prs = await getPurchaseRequests()
  return (
    <div>
      <PRFilters /> {/* client — handles filter state */}
      <PRTable data={prs} /> {/* client — handles row clicks, hover */}
    </div>
  )
}
```

Keep the page itself as a server component. Push `'use client'` as far down the tree as possible — ideally only on the interactive leaf nodes (the table row action buttons, the filter dropdowns, the form inputs).

---

## FIX 7 — SUPABASE CLIENT INITIALIZATION

**Problem:** If the Supabase client is being initialized on every request rather than reused, it adds latency to every authenticated operation.

**Fix:** Open `/lib/supabase.ts` and ensure the server client is created correctly for App Router:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Use this in server components and server actions
export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

Make sure you are NOT importing a shared singleton Supabase client in server components — each server request needs its own client instance created via this function (Next.js requires this for cookie handling). The Prisma singleton fix in Fix 1 is different — Prisma doesn't deal with per-request cookies.

---

## FIX 8 — NEXTJS CONFIG OPTIMIZATIONS

Open `next.config.js` (or `next.config.ts`) and ensure these are set:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables React Server Components optimizations
  experimental: {
    // Enables PPR (Partial Prerendering) if on Next.js 14.1+
    // ppr: true,

    // Faster server actions
    serverActions: {
      bodySizeLimit: '2mb', // limit upload size — prevents slow action parsing on large files
    },
  },

  // Reduces bundle size — removes unused Lucide icons from client bundle
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
}

module.exports = nextConfig
```

The `modularizeImports` for Lucide alone can reduce your client JavaScript bundle by 200–400kb, which meaningfully speeds up initial page load.

---

## FIX 9 — FONT LOADING (eliminate layout shift and font flash)

**Problem:** If Geist font is being loaded via a `<link>` tag in a stylesheet or a CSS `@import`, it blocks rendering until the font is downloaded. This causes a visible flash of system font and a layout shift.

**Fix:** Use Next.js font optimization. Replace any CSS font imports with this in `/app/layout.tsx`:

```tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

// Install first: npm install geist
// Geist is now directly available as a package — no Google Fonts needed

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className={GeistSans.className}>
        {children}
      </body>
    </html>
  )
}
```

Then in your Tailwind config, reference the CSS variables:

```js
// tailwind.config.ts
theme: {
  extend: {
    fontFamily: {
      sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      mono: ['var(--font-geist-mono)', 'monospace'],
    },
  },
},
```

Next.js font optimization automatically self-hosts the font, adds `font-display: swap`, and preloads the font file — eliminating the flash and the network dependency on Google Fonts.

---

## VERIFICATION CHECKLIST

After applying all fixes, verify each one worked:

```
□ Fix 1 — Prisma singleton
  Open the app, make a code change, save. Check terminal — you should NOT see
  "warn(prisma-client) There are already 10 instances of Prisma Client" warning.
  If you see that warning → Fix 1 was not applied correctly.

□ Fix 2 — Parallel fetching
  Add console.time('page-load') and console.timeEnd('page-load') around the
  data fetching in your slowest page.tsx. Time should drop by 40–70% if you
  had sequential awaits.

□ Fix 3 — loading.tsx
  Navigate to any page. You should see the skeleton layout appear instantly
  (within 50ms) before data populates. If you see a blank screen for any
  duration → loading.tsx is missing or not in the right directory.

□ Fix 4 — Caching
  Navigate to /purchase-requests, then go to Dashboard, then come back to
  /purchase-requests. The second visit should feel noticeably faster.
  In dev tools Network tab, you should see fewer DB queries on repeat visits.

□ Fix 5 — Query optimization
  Open Prisma Studio (npx prisma studio) or add query logging temporarily.
  List page queries should return in < 50ms locally with proper select scoping.

□ Fix 6 — Client component audit
  Run: npx next build
  Look at the "First Load JS" column in the build output.
  Pages should be under 150kb first load JS. If any page is above 200kb →
  there are unnecessary client components in that page's tree.

□ Fix 7 — Supabase client
  No change visible in UI — just confirm no Supabase auth errors appear
  in terminal after the fix.

□ Fix 8 — Next config
  Run: npx next build
  Bundle sizes should be smaller than before modularizeImports was added.

□ Fix 9 — Fonts
  Hard refresh the page (Cmd+Shift+R). You should see NO flash of system font.
  Geist should appear immediately on first paint.
```

---

## EXPECTED OUTCOME AFTER ALL FIXES

On localhost with a local or nearby Supabase instance:

```
Initial page load (first visit):     < 800ms  (was likely 2–4s)
Subsequent navigation:               < 300ms  (was likely 1–2s)
Table population after skeleton:     < 400ms  (was likely 800ms–2s)
Form submission feedback:            < 500ms  (was likely 1–2s)
```

When you deploy to Vercel + Supabase in the same region, these numbers will roughly halve again. Match your Supabase project region to your Vercel deployment region — this single decision is the biggest performance lever after the code fixes above.