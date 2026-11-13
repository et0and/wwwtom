import { Show, createSignal, onSettled, untrack } from "solid-js";
import { isServer } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/solid-query";
import { Banner } from "@tom/ui/banner";
import { Button } from "@tom/ui/button";
import { Input } from "@tom/ui/input";
import { Text } from "@tom/ui/text";
import type { GavinFrameState } from "@tom/schemas/frame-state";
import { settledGavinMood, type GavinMood } from "@tom/schemas/gavin";
import { askGavin, errorMessage, setGavinMood } from "./api";
import { styles } from "./frame.stylex";

interface SpeechResult {
  readonly transcript: string;
}

interface SpeechEvent {
  readonly results: {
    readonly [index: number]: {
      readonly [index: number]: SpeechResult;
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const speechConstructor = (): SpeechRecognitionConstructor | null => {
  if (isServer) return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

const STATUS_LABELS = {
  idle: "Gavin is idle.",
  listening: "Gavin is listening.",
  thinking: "Gavin is thinking.",
  speaking: "Gavin is speaking.",
  happy: "Gavin is happy.",
  sleepy: "Gavin is sleepy.",
  surprised: "Gavin is surprised.",
} satisfies Record<GavinMood, string>;

export interface GavinPanelProps {
  readonly frame: GavinFrameState;
}

export function GavinPanel(props: GavinPanelProps) {
  const [status, setStatus] = createSignal<GavinMood>(untrack(() => props.frame.gavinMood));
  const [reply, setReply] = createSignal<string | null>(null);
  const [transcript, setTranscript] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [isListening, setIsListening] = createSignal(false);
  const [supportsSpeech, setSupportsSpeech] = createSignal(false);
  const [recognition, setRecognition] = createSignal<SpeechRecognitionLike | null>(null);
  const [typed, setTyped] = createSignal("");

  const moodMutation = useMutation(() => ({
    mutationFn: setGavinMood,
    onError: (cause) => setError(errorMessage(cause)),
  }));

  const syncMood = (mood: GavinMood): void => {
    setStatus(mood);
    moodMutation.mutate(mood);
  };

  const speak = (text: string, mood: GavinMood): void => {
    const nextMood = settledGavinMood(mood);
    if (isServer || !("speechSynthesis" in window)) {
      syncMood(nextMood);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => syncMood(nextMood);
    utterance.onerror = () => syncMood(nextMood);
    syncMood("speaking");
    window.speechSynthesis.speak(utterance);
  };

  const askMutation = useMutation(() => ({
    mutationFn: askGavin,
    onSuccess: (result) => {
      setReply(result.reply);
      speak(result.reply, result.mood);
    },
    onError: (cause) => {
      setError(errorMessage(cause));
      syncMood("idle");
    },
  }));

  const ask = (text: string): void => {
    setError(null);
    setReply(null);
    setTranscript(text);
    syncMood("thinking");
    askMutation.mutate(text);
  };

  const startListening = (): void => {
    const Constructor = speechConstructor();
    if (Constructor === null) return;
    setError(null);
    setTranscript("");
    const next = new Constructor();
    next.lang = "en-NZ";
    next.continuous = false;
    next.interimResults = false;
    next.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (text.length > 0) ask(text);
    };
    next.onerror = (_event: Event) => {
      setError("Could not hear you. Try again or type instead.");
      setIsListening(false);
      setRecognition(null);
      syncMood("idle");
    };
    next.onend = () => {
      setIsListening(false);
      setRecognition(null);
      if (transcript().length === 0) syncMood("idle");
    };
    setRecognition(next);
    setIsListening(true);
    syncMood("listening");
    next.start();
  };

  const stopListening = (): void => {
    recognition()?.stop();
    setIsListening(false);
    setRecognition(null);
    syncMood("idle");
  };

  const submitTyped = (): void => {
    const text = typed().trim();
    if (text.length === 0) return;
    setTyped("");
    ask(text);
  };

  onSettled(() => {
    setSupportsSpeech(speechConstructor() !== null);
    // A page opened after a closed tab can inherit a transient mood. No
    // speech is running in this tab, so settle it back to idle.
    const initialMood = untrack(() => status());
    if (initialMood !== settledGavinMood(initialMood)) syncMood("idle");
    return () => {
      recognition()?.stop();
      if (!isServer && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  });

  return (
    <div {...stylex.attrs(styles.gavinPanel)}>
      <Text variant="secondary" size="sm">
        {STATUS_LABELS[status()]}
      </Text>

      <Show when={error()}>
        {(message) => (
          <Banner variant="error" title="Gavin could not respond" description={message()} />
        )}
      </Show>

      <Show when={transcript()}>
        {(text) => (
          <Text variant="secondary" size="sm">
            You said: {text()}
          </Text>
        )}
      </Show>

      <Show when={reply()}>{(text) => <Text>{text()}</Text>}</Show>

      <Show
        when={supportsSpeech()}
        fallback={
          <div {...stylex.attrs(styles.gavinInputRow)}>
            <Input
              label="Or type to Gavin"
              type="text"
              value={typed()}
              onInput={(event) => setTyped(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitTyped();
              }}
              style={styles.field}
            />
            <Button variant="secondary" onClick={submitTyped} disabled={askMutation.isPending}>
              Send
            </Button>
          </div>
        }
      >
        <Button
          variant={isListening() ? "secondary" : "primary"}
          onClick={isListening() ? stopListening : startListening}
          disabled={askMutation.isPending}
        >
          {isListening() ? "Stop listening" : "Talk to Gavin"}
        </Button>
      </Show>
    </div>
  );
}
