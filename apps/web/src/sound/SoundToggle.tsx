import { Show } from "solid-js";
import { Button } from "@tom/ui/button";
import { useSound } from "./SoundProvider";

/** Speaker with two arcs when sound is on, a slash when it is muted. */
function SpeakerIcon(props: { muted: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M2.4 6h1.9l3-2.6v9.2l-3-2.6H2.4z" fill="currentColor" />
      <Show
        when={!props.muted}
        fallback={
          <path
            d="M10.4 6.1 13.9 9.6M13.9 6.1 10.4 9.6"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        }
      >
        <path
          d="M9.7 6.1a2.7 2.7 0 0 1 0 3.8"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
        <path
          d="M11.6 4.4a5.2 5.2 0 0 1 0 7.2"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </Show>
    </svg>
  );
}

/**
 * The one control for the sound layer. Sound is on by default, so this exists
 * to turn it off; turning it back on plays the `start` flourish, which is the
 * only way to confirm a muted interface has come back.
 */
export function SoundToggle() {
  const sound = useSound();

  const toggle = (): void => {
    const next = !sound.isEnabled();
    sound.setEnabled(next);
    if (next) sound.play("start", 0.75);
  };

  return (
    <Button
      variant="glass"
      form="circle"
      size="base"
      aria-label={sound.isEnabled() ? "Mute interface sounds" : "Unmute interface sounds"}
      aria-pressed={sound.isEnabled() ? "true" : "false"}
      onClick={toggle}
      icon={<SpeakerIcon muted={!sound.isEnabled()} />}
    />
  );
}
