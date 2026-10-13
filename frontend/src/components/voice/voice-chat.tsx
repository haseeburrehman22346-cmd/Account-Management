"use client";

import { Loader2Icon, MicIcon, RotateCcwIcon, SendIcon, SquareIcon, SquarePenIcon, Volume2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_VOICE_LANGUAGE, VOICE_LANGUAGES, VOICE_RESULT_EVENT } from "@/data";
import { useAuth } from "@/hooks/use-auth";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";
import { voiceService } from "@/services";
import type { VoiceCommandResult } from "@/types";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  ok: boolean;
}

interface FailedRequest {
  text: string;
  reset: boolean;
  message: string;
}

/** Kept outside the component: the page remounts whenever a command changes data, and the chat must survive that. */
const store = { userId: "", messages: [] as ChatMessage[], seq: 1, language: DEFAULT_VOICE_LANGUAGE as string, speak: false };

/** Chat with the assistant by typing or speaking; it answers questions and carries out commands on categories and expenses. */
export function VoiceChat() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [messages, setMessages] = useState<ChatMessage[]>(() => (store.userId === userId ? store.messages : []));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<FailedRequest | null>(null);
  const [language, setLanguage] = useState(store.language);
  const [speak, setSpeak] = useState(store.speak);
  const bottom = useRef<HTMLDivElement>(null);

  const push = useCallback(
    (role: ChatMessage["role"], text: string, ok = true) => {
      if (store.userId !== userId) {
        store.userId = userId;
        store.messages = [];
      }
      store.messages = [...store.messages, { id: store.seq++, role, text, ok }];
      setMessages(store.messages);
    },
    [userId],
  );

  const say = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = store.language;
    window.speechSynthesis.speak(utterance);
  }, []);

  const ask = useCallback(
    async (text: string, reset: boolean) => {
      setFailed(null);
      setBusy(true);
      try {
        const result = await voiceService.command(text, "chat", reset);
        push("assistant", result.message, result.ok);
        if (store.speak) say(result.message);
        // The assistant in the app shell carries out the action, except the ones that would leave the chat.
        const leaves = result.changed || result.action.type === "navigate" || result.action.type === "back";
        const detail: VoiceCommandResult = { ...result, quiet: true, action: leaves ? { type: "none" } : result.action };
        window.dispatchEvent(new CustomEvent(VOICE_RESULT_EVENT, { detail }));
      } catch (err) {
        setFailed({ text, reset, message: errorMessage(err) });
      } finally {
        setBusy(false);
      }
    },
    [push, say],
  );

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    // The first message of a chat tells the backend to forget the previous conversation.
    const reset = store.userId !== userId || store.messages.length === 0;
    push("user", text);
    setDraft("");
    void ask(text, reset);
  };

  const onHeard = useCallback((text: string) => setDraft((d) => (d ? `${d} ${text}` : text)), []);
  const speech = useSpeechRecognition(onHeard);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, failed]);

  const newChat = () => {
    window.speechSynthesis?.cancel();
    store.messages = [];
    setMessages([]);
    setFailed(null);
    setDraft("");
  };

  const changeLanguage = (next: string) => {
    store.language = next;
    setLanguage(next);
  };

  const toggleSpeak = (next: boolean) => {
    store.speak = next;
    setSpeak(next);
    if (!next) window.speechSynthesis?.cancel();
  };

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[28rem] flex-col rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Switch id="speak-replies" checked={speak} onCheckedChange={toggleSpeak} />
          <Label htmlFor="speak-replies" className="text-sm font-normal text-muted-foreground">
            Read replies aloud
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={changeLanguage} disabled={speech.listening}>
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
          <Button variant="ghost" size="sm" onClick={newChat} disabled={busy || (!messages.length && !failed)}>
            <SquarePenIcon /> New chat
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!messages.length && !busy && !failed && (
          <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted-foreground">
            Type a message or tap the mic and speak. Ask about your categories and expenses, or tell the assistant what to
            add, change or delete.
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                !m.ok && "text-destructive",
              )}
            >
              {m.text}
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => say(m.text)}
                  aria-label="Read this reply aloud"
                  className="ml-2 inline-flex align-middle text-muted-foreground hover:text-foreground"
                >
                  <Volume2Icon className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}

        {failed && !busy && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          >
            <p className="text-destructive">{failed.message}</p>
            <Button variant="outline" size="sm" onClick={() => void ask(failed.text, failed.reset)}>
              <RotateCcwIcon /> Retry
            </Button>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="space-y-2 border-t p-3">
        {speech.listening && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/60" />
              <span className="relative size-2.5 rounded-full bg-destructive" />
            </span>
            <p className="min-w-0 flex-1">
              <span className="text-muted-foreground">Recording… </span>
              {speech.interim && <span className="font-medium">“{speech.interim}”</span>}
            </p>
            <Button size="sm" onClick={speech.stop}>
              <SquareIcon className="fill-current" /> Stop
            </Button>
            <Button variant="ghost" size="sm" onClick={speech.cancel}>
              <XIcon /> Cancel
            </Button>
          </div>
        )}
        {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <Button
            type="button"
            variant={speech.listening ? "destructive" : "outline"}
            size="icon-lg"
            disabled={!speech.supported || busy}
            onClick={() => (speech.listening ? speech.stop() : speech.start(language))}
            aria-label={speech.listening ? "Stop recording" : "Start recording"}
            title={speech.supported ? undefined : "Voice isn't supported in this browser — type instead"}
          >
            {speech.listening ? <SquareIcon className="fill-current" /> : <MicIcon />}
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message, or use the mic and edit what was heard"
            aria-label="Message"
            maxLength={500}
            rows={1}
            className="max-h-40 min-h-9 flex-1 resize-none"
          />
          <Button type="submit" size="icon-lg" disabled={!draft.trim() || busy || speech.listening} aria-label="Send message">
            {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          </Button>
        </form>
      </div>
    </div>
  );
}
