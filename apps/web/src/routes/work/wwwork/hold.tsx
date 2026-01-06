import { createSignal, onMount, onCleanup, Show, createEffect } from "solid-js";
import { Title, Meta } from "@solidjs/meta";
import { Spinner } from "~/components";
import { logger } from "@tom/utils";

export default function Hold() {
  const [timer, setTimer] = createSignal(0);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isPlaybackInitiated, setIsPlaybackInitiated] = createSignal(false);
  const [isClient, setIsClient] = createSignal(false);
  let audioRef: HTMLAudioElement | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    setIsClient(true);

    const savedTimer = localStorage.getItem("timer");
    if (savedTimer) {
      setTimer(parseInt(savedTimer, 10));
    }

    interval = setInterval(() => {
      setTimer((prevTimer) => prevTimer + 1);
    }, 1000);

    onCleanup(() => {
      if (interval) clearInterval(interval);
      audioRef?.pause();
    });
  });

  createEffect(() => {
    localStorage.setItem("timer", timer().toString());
  });

  const handleAudioStart = () => {
    const audio = new Audio("https://cdn.tom.so/hold.mp3");
    audio.loop = true;
    audio.play().catch((error) => {
      logger.error("Failed to play audio:", error);
    });
    audioRef = audio;
    setIsPlaybackInitiated(true);
    setIsPlaying(true);
  };

  const handleAudioToggle = () => {
    if (isPlaying()) {
      audioRef?.pause();
      setIsPlaying(false);
    } else {
      audioRef?.play().catch((error) => {
        logger.error("Failed to play audio:", error);
      });
      setIsPlaying(true);
    }
  };

  const formatTime = () => {
    const t = timer();
    const hours = Math.floor(t / 3600);
    const minutes = Math.floor((t % 3600) / 60);
    const seconds = t % 60;
    return `${hours} hours, ${minutes} minutes, and ${seconds} seconds.`;
  };

  return (
    <>
      <Title>Hold | Tom Hackshaw</Title>
      <Meta
        name="description"
        content="As I await your response, my memory of you grows with time."
      />
      <Show
        when={isClient()}
        fallback={
          <div class="flex justify-center items-center h-screen">
            <Spinner />
          </div>
        }
      >
        <style>{`
					/* Hide Nav and Footer specifically for this page */
					body > div > div > nav,
					body > div > div > footer {
						display: none !important;
					}
					html, body {
						margin: 0;
						padding: 0;
					}
                    button {
                        cursor: pointer;
                    }
                    button:hover {
                        color: #cc0081;
                    }
					.hold-container {
						padding: 4rem;
						max-width: 100vw;
                        max-height: 100vh;
						box-sizing: border-box;
					}
				`}</style>
        <div class="hold-container max-h-screen">
          <main class="flex flex-col">
            <p class="text-2xl">You have been waiting for {formatTime()}</p>
            <div>
              <Show when={!isPlaybackInitiated()}>
                <button onClick={handleAudioStart}>Trigger music</button>
              </Show>
              <Show when={isPlaybackInitiated()}>
                <button onClick={handleAudioToggle}>
                  {isPlaying() ? "Click to pause music" : "Click to play music"}
                </button>
              </Show>
            </div>
          </main>
        </div>
      </Show>
    </>
  );
}
