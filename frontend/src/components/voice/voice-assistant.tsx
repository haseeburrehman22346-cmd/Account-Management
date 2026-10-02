"use client";

import { Loader2Icon, MicIcon, SendIcon, SquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoryHref, homeFor, profileHref, ROUTES, voiceHref } from "@/constants/routes";
import { DEFAULT_VOICE_LANGUAGE, VOICE_COMMAND_EXAMPLES, VOICE_LANGUAGES, VOICE_RESULT_EVENT } from "@/data";
import { useAuth } from "@/hooks/use-auth";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";
import { categoriesService, expensesService, usersService, voiceService } from "@/services";
import type { User, VoiceCommandResult, VoiceConfirmDeleteAction, VoiceNavigateAction } from "@/types";

const YES = /^(yes|yeah|yep|confirm|delete|do it|ok|okay|haan|han|ji)\b/i;
const NO = /^(no|nope|cancel|stop|nahi|nahin)\b/i;

const REMOVERS = {
  category: categoriesService.remove,
  expense: expensesService.remove,
  user: usersService.remove,
};

function hrefFor(user: User, action: VoiceNavigateAction) {
  const withQuery = (path: string) => (action.q ? `${path}?q=${encodeURIComponent(action.q)}` : path);
  switch (action.page) {
    case "category":
      return withQuery(categoryHref(user, action.categoryId!));
    case "categories":
      return user.role === "admin" ? ROUTES.admin.categories : ROUTES.user.categories;
    case "expenses":
      return withQuery(ROUTES.admin.expenses);
    case "users":
      return withQuery(ROUTES.admin.users);
    case "settings":
      return profileHref(user);
    case "voice":
      return voiceHref(user);
    default:
      return homeFor(user);
  }
}

/** Top-bar mic: say a command ("show all categories", "give Ali access to Food") from any page. Alt+V toggles it. */
export function VoiceAssistant({ user, onDataChanged }: { user: User; onDataChanged: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(DEFAULT_VOICE_LANGUAGE);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [last, setLast] = useState<VoiceCommandResult | null>(null);
  const [confirming, setConfirming] = useState<VoiceConfirmDeleteAction | null>(null);

  const remove = useCallback(
    async (target: VoiceConfirmDeleteAction) => {
      await REMOVERS[target.target](target.id);
      toast.success(`${target.target[0].toUpperCase()}${target.target.slice(1)} deleted`);
      if (target.target === "category") {
        router.push(user.role === "admin" ? ROUTES.admin.categories : ROUTES.user.categories);
      }
      onDataChanged();
    },
    [router, user, onDataChanged],
  );

  const apply = useCallback(
    async (result: VoiceCommandResult) => {
      setLast(result);
      (result.ok ? toast.success : toast.error)(result.message);
      if (result.changed) onDataChanged();

      const { action } = result;
      if (action.type === "navigate") router.push(hrefFor(user, action));
      else if (action.type === "back") router.back();
      else if (action.type === "theme") setTheme(action.theme);
      else if (action.type === "confirm-delete") setConfirming(action);
      else if (action.type === "logout") {
        await logout();
        router.replace(ROUTES.login);
      }
      setOpen(action.type === "help");
    },
    [onDataChanged, router, user, setTheme, logout],
  );

  const run = useCallback(
    async (transcript: string) => {
      setBusy(true);
      try {
        if (confirming && (YES.test(transcript) || NO.test(transcript))) {
          if (YES.test(transcript)) await remove(confirming);
          setConfirming(null);
          return;
        }
        const result = await voiceService.command(transcript);
        await apply(result);
        if (!result.ok) setOpen(true);
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [confirming, remove, apply],
  );

  useEffect(() => {
    const onResult = (e: Event) => void apply((e as CustomEvent<VoiceCommandResult>).detail);
    window.addEventListener(VOICE_RESULT_EVENT, onResult);
    return () => window.removeEventListener(VOICE_RESULT_EVENT, onResult);
  }, [apply]);

  const speech = useSpeechRecognition(run, { singlePhrase: true });
  const { supported, listening, start, stop } = speech;

  const toggle = useCallback(() => {
    if (listening) stop();
    else if (!busy) start(language);
  }, [listening, busy, language, start, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== "v" || !supported) return;
      e.preventDefault();
      if (!confirming) setOpen(true);
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [supported, confirming, toggle]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    run(text.trim());
    setText("");
  };

  const status = busy
    ? "Working…"
    : listening
      ? "Listening… say a command"
      : supported
        ? "Tap the mic or press Alt+V"
        : "Voice isn't supported in this browser — type a command instead";

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next && supported && !listening && !busy) start(language);
          if (!next && listening) stop();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voice control"
            title="Voice control (Alt+V)"
            className={cn(listening && "text-destructive")}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <MicIcon className={cn(listening && "animate-pulse")} />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Voice control</p>
            <Select value={language} onValueChange={setLanguage} disabled={listening}>
              <SelectTrigger size="sm" className="w-40" aria-label="Speech language">
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              disabled={!supported || busy}
              aria-label={listening ? "Stop listening" : "Start listening"}
              aria-pressed={listening}
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full text-primary-foreground transition focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
                listening ? "bg-destructive" : "bg-primary",
              )}
            >
              {busy ? (
                <Loader2Icon className="size-5 animate-spin" />
              ) : listening ? (
                <SquareIcon className="size-4 fill-current" />
              ) : (
                <MicIcon className="size-5" />
              )}
            </button>
            <div className="min-w-0 text-sm" aria-live="polite">
              <p className="text-muted-foreground">{status}</p>
              {speech.interim && <p className="font-medium">“{speech.interim}”</p>}
              {speech.error && <p className="text-destructive">{speech.error}</p>}
            </div>
          </div>

          {last && !listening && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <p className="text-muted-foreground">“{last.transcript}”</p>
              <p className={cn("font-medium", !last.ok && "text-destructive")}>{last.message}</p>
            </div>
          )}

          <form onSubmit={submit} className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Or type a command"
              aria-label="Type a command"
              maxLength={500}
            />
            <Button type="submit" size="icon" disabled={!text.trim() || busy} aria-label="Run command">
              <SendIcon />
            </Button>
          </form>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Try saying</p>
            <ul className="flex flex-wrap gap-1.5">
              {VOICE_COMMAND_EXAMPLES[user.role].map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => setText(example)}
                    className="rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/70"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={confirming?.title ?? ""}
        description={confirming?.description}
        onConfirm={() => remove(confirming!)}
      />
    </>
  );
}
