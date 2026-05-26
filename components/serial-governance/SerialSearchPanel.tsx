"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { searchSerialNumber } from "@/app/actions/serial";
import type { SerialSearchResult } from "@/lib/serial-governance-types";
import { ProcurementRefText } from "@/components/shared/ProcurementRef";
import { formatSerialBatchLabel } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SerialSearchPanel() {
  const [serialQuery, setSerialQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchResult, setSearchResult] = React.useState<
    SerialSearchResult | null | undefined
  >(undefined);

  async function runSerialSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = serialQuery.trim();
    if (!q) {
      return;
    }
    setSearching(true);
    setSearchResult(undefined);
    try {
      const result = await searchSerialNumber(q);
      setSearchResult(result);
    } catch {
      toast.error("Serial lookup failed. Please try again.");
      setSearchResult(undefined);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={runSerialSearch}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-border-subtle bg-card p-4"
      >
        <div className="min-w-[240px] flex-1 space-y-1">
          <label htmlFor="serial-search" className="text-ds-sm font-medium">
            Serial number lookup
          </label>
          <Input
            id="serial-search"
            placeholder="Enter any serial number to find its reservation"
            value={serialQuery}
            onChange={(e) => setSerialQuery(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={searching} className="gap-2">
          <Search className="size-3.5" strokeWidth={1.5} />
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>

      {searchResult === null ? (
        <p className="text-ds-sm text-muted-foreground">
          This serial number has no reservation on record.
        </p>
      ) : searchResult ? (
        <SerialSearchResultPanel result={searchResult} />
      ) : null}
    </div>
  );
}

function SerialSearchResultPanel({ result }: { result: SerialSearchResult }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card p-4 text-ds-sm">
      <p className="font-medium">Reservation found</p>
      <p className="mt-1 text-muted-foreground">
        {formatSerialBatchLabel({
          seriesName: result.seriesName,
          rangeStart: result.rangeStart,
          rangeEnd: result.rangeEnd,
        })}
      </p>
      <p className="mt-2 font-mono">
        {result.rangeStart} → {result.rangeEnd}
      </p>
      <p className="mt-1 text-muted-foreground">
        Created by {result.createdByName} on {formatDateTimeMedium(result.createdAt)}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Link
          href={`/serial-governance?tab=activity&batch=${result.id}`}
          className="text-primary hover:underline"
        >
          View in activity ledger →
        </Link>
        {result.prId ? (
          <Link
            href={`/purchase-requests/${result.prId}`}
            className="text-primary hover:underline"
          >
            View PR <ProcurementRefText id={result.prId} /> →
          </Link>
        ) : null}
        {result.poId ? (
          <Link
            href={`/purchase-orders/${result.poId}`}
            className="text-primary hover:underline"
          >
            View PO <ProcurementRefText id={result.poId} /> →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
