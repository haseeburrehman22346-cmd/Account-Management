"use client";

import { FileIcon, Loader2Icon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/format";
import { assetUrl, uploadsService } from "@/services";

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads immediately on pick and reports the stored URL; the expense save sends that URL. */
export function ReceiptUpload({
  id,
  value,
  onChange,
  onBusyChange,
}: {
  id?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Receipt must be 5 MB or smaller");
      return;
    }
    setUploading(true);
    onBusyChange?.(true);
    try {
      const { url } = await uploadsService.receipt(file);
      onChange(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      onBusyChange?.(false);
      if (input.current) input.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
        <FileIcon className="size-4 text-muted-foreground" />
        <a href={assetUrl(value)} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary hover:underline">
          View receipt
        </a>
        <button type="button" onClick={() => onChange(null)} aria-label="Remove receipt" className="text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" className="w-full" disabled={uploading} onClick={() => input.current?.click()}>
        {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
        {uploading ? "Uploading…" : "Upload Receipt"}
      </Button>
    </>
  );
}
