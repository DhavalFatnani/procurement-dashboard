import { Download, Eye, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Force a Supabase signed URL to download with a friendly filename.
 *
 * Supabase honours `?download=<name>` on signed URLs by setting
 * `Content-Disposition: attachment; filename=<name>`. Without this, browsers
 * inline-render PDFs/images and ignore the HTML `download` attribute because
 * the URL is cross-origin.
 */
function toDownloadUrl(url: string, filename?: string): string {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(filename ?? "")}`;
}

/**
 * Standard preview + download affordance for any uploaded document
 * (invoice PDF, payment proof, etc.). Two icon buttons next to each other —
 * preview opens in a new tab; download streams the file with an attachment
 * disposition.
 */
export function DocumentLinks({
  url,
  filename,
  size = "sm",
  showLabel = false,
  label,
  className,
}: {
  /** Signed URL pointing at the asset. Falsy renders an inert chip. */
  url: string | null | undefined;
  /** Suggested filename for the download. */
  filename?: string;
  size?: "xs" | "sm";
  /** Render a small "Attachment" label next to the buttons. */
  showLabel?: boolean;
  /** Override the label text (default: "Attachment"). */
  label?: string;
  className?: string;
}) {
  if (!url) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-ds-xs text-muted-foreground/70",
          className,
        )}
      >
        <Paperclip className="size-3" strokeWidth={1.5} aria-hidden />
        No file
      </span>
    );
  }

  const downloadUrl = toDownloadUrl(url, filename);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {showLabel ? (
        <span className="inline-flex items-center gap-1 text-ds-xs text-muted-foreground">
          <Paperclip className="size-3" strokeWidth={1.5} aria-hidden />
          {label ?? "Attachment"}
        </span>
      ) : null}
      <Button
        variant="outline"
        size={size === "xs" ? "icon-xs" : "icon-sm"}
        title="Preview in a new tab"
        aria-label={`Preview ${filename ?? "document"}`}
        render={
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <Eye className="size-3.5" strokeWidth={1.5} aria-hidden />
      </Button>
      <Button
        variant="outline"
        size={size === "xs" ? "icon-xs" : "icon-sm"}
        title="Download"
        aria-label={`Download ${filename ?? "document"}`}
        render={
          <a
            href={downloadUrl}
            download={filename ?? true}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <Download className="size-3.5" strokeWidth={1.5} aria-hidden />
      </Button>
    </span>
  );
}
