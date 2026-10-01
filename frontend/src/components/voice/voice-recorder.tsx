"use client";

import { ImageIcon, KeyboardIcon, Loader2Icon, MicIcon, SendIcon, SquareIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOICE_LANGUAGES } from "@/data";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetUrl, uploadsService } from "@/services";

const RECEIPT_ACCEPT = "image/png,image/jpeg,image/webp";
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export function VoiceRecorder({
  supported,
  listening,
  interim,
  error,
  busy,
  language,
  onLanguageChange,
  onStart,
  onStop,
  onSubmitText,
  idleHint = "Tap the mic and say your expense",
  placeholder = "Or type it: Food 500 lunch with team",
  receiptUrl,
  onReceiptChange,
  showTextInput = true,
  uploadLabel = "Or upload a receipt image",
}: {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  busy: boolean;
  language: string;
  onLanguageChange: (lang: string) => void;
  onStart: () => void;
  onStop: () => void;
  onSubmitText: (text: string) => void;
  idleHint?: string;
  placeholder?: string;
  /** Omit `onReceiptChange` to hide the image upload button. */
  receiptUrl?: string | null;
  onReceiptChange?: (url: string | null) => void;
  showTextInput?: boolean;
  uploadLabel?: string;
}) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickReceipt(file: File | undefined) {
    if (!file || !onReceiptChange) return;
    if (file.size > RECEIPT_MAX_BYTES) {
      toast.error("Image must be 5 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadsService.receipt(file);
      onReceiptChange(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy || uploading) return;
    onSubmitText(text.trim());
    setText("");
  };

  const status = uploading
    ? "Uploading image…"
    : busy
    ? "Working…"
    : listening
      ? "Listening… tap to stop"
      : supported
        ? idleHint
        : showTextInput
          ? "Voice isn't supported in this browser — type below instead"
          : "Voice isn't supported in this browser — upload an image below instead";

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 py-4">
        <div className="flex w-full justify-end">
          <Select value={language} onValueChange={onLanguageChange} disabled={listening}>
            <SelectTrigger size="sm" className="w-44" aria-label="Speech language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {VOICE_LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex size-28 items-center justify-center">
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />}
          <button
            type="button"
            onClick={listening ? onStop : onStart}
            disabled={!supported || busy}
            aria-label={listening ? "Stop listening" : "Start voice entry"}
            aria-pressed={listening}
            className={cn(
              "relative flex size-24 items-center justify-center rounded-full text-primary-foreground shadow-lg transition focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
              listening ? "bg-destructive" : "bg-primary hover:scale-105",
            )}
          >
            {busy ? (
              <Loader2Icon className="size-9 animate-spin" />
            ) : listening ? (
              <SquareIcon className="size-8 fill-current" />
            ) : (
              <MicIcon className="size-10" />
            )}
          </button>
        </div>

        <div className="min-h-14 w-full max-w-xl text-center" aria-live="polite">
          <p className="text-sm font-medium text-muted-foreground">{status}</p>
          {interim && <p className="mt-2 text-lg font-medium">“{interim}”</p>}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        {showTextInput && (
          <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
            <div className="relative flex-1">
              <KeyboardIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                aria-label="Type it"
                className="pl-9"
                maxLength={500}
              />
            </div>
            <Button type="submit" disabled={!text.trim() || busy || uploading}>
              <SendIcon /> Add
            </Button>
          </form>
        )}

        {onReceiptChange && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={RECEIPT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => pickReceipt(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || uploading || listening}
              onClick={() => fileInput.current?.click()}
              className="h-auto w-full max-w-xl border-dashed py-4"
            >
              {uploading || busy ? <Loader2Icon className="animate-spin" /> : <ImageIcon />}
              {uploading ? "Uploading…" : busy ? "Reading image…" : uploadLabel}
            </Button>
          </>
        )}

        {receiptUrl && onReceiptChange && (
          <div className="flex w-full max-w-xl items-center gap-3 rounded-lg border p-2 text-sm">
            <a href={assetUrl(receiptUrl)} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(receiptUrl)} alt="Attached receipt" className="size-12 rounded-md object-cover" />
            </a>
            <p className="flex-1 text-muted-foreground">
              Couldn&apos;t read this receipt — say the expense and it will be saved with this image.
            </p>
            <button
              type="button"
              onClick={() => onReceiptChange(null)}
              aria-label="Remove receipt"
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
