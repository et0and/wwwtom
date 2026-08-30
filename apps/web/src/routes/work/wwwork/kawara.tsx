import { createSignal, Show, For, onSettled, createEffect } from "solid-js";
import { isServer } from "@solidjs/web";
import { Title, Meta } from "@solidjs/meta";
import numberToWords from "number-to-words";
import { Spinner } from "@tom/ui/Spinner";

const TOTAL_COUNT = 1000000;
const ITEM_HEIGHT = 40;

const NumberItem = (props: { index: number }) => (
  <p class="mb-1" style={{ height: `${ITEM_HEIGHT}px` }}>
    {numberToWords.toWords(props.index + 1)}
  </p>
);

export default function Kawara() {
  const [windowHeight, setWindowHeight] = createSignal(0);
  const [scrollTop, setScrollTop] = createSignal(0);
  const [isClient, setIsClient] = createSignal(false);
  // oxlint-disable-next-line no-unassigned-vars -- assigned by the Solid `ref` below
  let scrollContainer: HTMLDivElement | undefined;

  onSettled(() => {
    if (isServer) return;
    setIsClient(true);
    setWindowHeight(window.innerHeight);

    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  const startIndex = () => Math.floor(scrollTop() / ITEM_HEIGHT);
  const endIndex = () =>
    Math.min(startIndex() + Math.ceil(windowHeight() / ITEM_HEIGHT) + 5, TOTAL_COUNT);

  const visibleItems = () => {
    const items = [];
    for (let i = startIndex(); i < endIndex(); i++) {
      items.push(i);
    }
    return items;
  };

  // Ensure the scroll listener is attached when the container is ready
  createEffect(
    () => (isClient() ? scrollContainer : undefined),
    (container) => {
      if (isServer || !container) return;
      const handleScroll = () => {
        setScrollTop(container.scrollTop);
      };
      container.addEventListener("scroll", handleScroll);

      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    },
  );

  return (
    <>
      <Title>Kawara | Tom Hackshaw</Title>
      <Meta name="description" content="One million numbers." />
      <Show
        when={isClient()}
        fallback={
          <div class="flex justify-center items-center h-screen">
            <Spinner />
          </div>
        }
      >
        <style>{`
					html, body {
						overflow: hidden;
						height: 100vh;
					}
					.kawara-container {
						container-type: inline-size;
						height: 100vh;
						overflow: hidden;
					}
					.kawara-main {
						container-type: inline-size;
						height: 100vh;
						padding: 2rem 0;
					}
					/* Hide Nav and Footer specifically for this page */
					body > div > div > nav,
					body > div > div > footer {
						display: none !important;
					}
				`}</style>
        <div class="kawara-container bg-white">
          <main class="kawara-main container mx-auto leading-10 text-center">
            {windowHeight() === 0 ? (
              <div>
                <Spinner />
              </div>
            ) : (
              <div
                ref={scrollContainer}
                style={{
                  height: `${windowHeight() - 64}px`,
                  overflow: "auto",
                }}
              >
                <div
                  style={{
                    height: `${TOTAL_COUNT * ITEM_HEIGHT}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  <For each={visibleItems()}>
                    {(index) => (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${ITEM_HEIGHT}px`,
                          transform: `translateY(${index * ITEM_HEIGHT}px)`,
                        }}
                      >
                        <NumberItem index={index} />
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </main>
        </div>
      </Show>
    </>
  );
}
