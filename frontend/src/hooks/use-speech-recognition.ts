"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Minimal typings for the Web Speech API (not in every TS DOM lib). */
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface SpeechErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);
const RESTART_DELAY_MS = 150;
const QUICK_END_MS = 1000;
const MAX_QUICK_ENDS = 10;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone permission was denied. Allow it in the browser's address bar and try again.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection.",
};

/** Browser speech-to-text; keeps listening until `stop()` is called, then calls `onFinal` with the recognised text. */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => getRecognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => () => cancelRef.current?.(), []);

  const start = useCallback((lang: string) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    cancelRef.current?.();

    let finalText = "";
    let live = "";
    let done = false;
    let rec: Recognition | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let quickEnds = 0;

    const teardown = () => {
      done = true;
      clearTimeout(restartTimer);
      stopRef.current = null;
      cancelRef.current = null;
      const r = rec;
      rec = null;
      r?.abort();
    };

    const finalize = () => {
      if (done) return;
      teardown();
      setListening(false);
      setInterim("");
      const text = `${finalText} ${live}`.trim();
      if (text) onFinalRef.current(text);
    };

    const spawn = () => {
      if (done) return;
      const r = new Ctor();
      const startedAt = Date.now();
      r.lang = lang;
      r.interimResults = true;
      r.continuous = true;

      r.onresult = (e) => {
        if (rec !== r) return;
        live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += " " + res[0].transcript;
          else live += res[0].transcript;
        }
        setInterim(`${finalText} ${live}`.trim());
      };
      r.onerror = (e) => {
        if (rec !== r || !FATAL_ERRORS.has(e.error)) return;
        setError(ERROR_MESSAGES[e.error] ?? `Speech recognition error: ${e.error}`);
        finalize();
      };
      r.onend = () => {
        if (rec !== r || done) return;
        finalText += " " + live;
        live = "";
        quickEnds = Date.now() - startedAt < QUICK_END_MS ? quickEnds + 1 : 0;
        if (quickEnds > MAX_QUICK_ENDS) {
          setError(ERROR_MESSAGES.network);
          finalize();
          return;
        }
        restartTimer = setTimeout(spawn, RESTART_DELAY_MS);
      };

      rec = r;
      try {
        r.start();
      } catch {
        restartTimer = setTimeout(spawn, RESTART_DELAY_MS);
      }
    };

    stopRef.current = finalize;
    cancelRef.current = teardown;
    setError(null);
    setInterim("");
    setListening(true);
    spawn();
  }, []);

  const stop = useCallback(() => stopRef.current?.(), []);

  return { supported, listening, interim, error, start, stop };
}
