import { Loader2 } from "lucide-react";

export default function PrintPurchaseRequestLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Loader2 className="size-8 animate-spin text-primary" strokeWidth={1.5} />
      <div className="space-y-1">
        <p className="text-ds-md font-semibold text-foreground">Loading reservation summary</p>
        <p className="text-ds-sm text-muted-foreground">
          Redirecting you to the print summary…
        </p>
      </div>
    </div>
  );
}
