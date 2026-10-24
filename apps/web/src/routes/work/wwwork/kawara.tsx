import { createSignal, Show, For, onSettled, createEffect } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { isServer } from "@solidjs/web";
import { Title, Meta } from "@solidjs/meta";
import numberToWords from "number-to-words";
import { colors } from "@tom/ui/colors.stylex";
import { textAlign } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { Loader } from "@tom/ui/loader";
import { layoutStyles } from "../../../chrome/layout.stylex";

const BP_SM = "@media (width >= 40rem)";
const BP_MD = "@media (width >= 48rem)";
const BP_LG = "@media (width >= 64rem)";
const BP_XL = "@media (width >= 80rem)";
const BP_2XL = "@media (width >= 96rem)";

const styles = stylex.create({
  centeredScreen: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100dvh",
  },
  kawaraContainer: { backgroundColor: colors["--color-white"] },
  // Tailwind's `container` utility: full width, capped at each breakpoint.
  kawaraMain: {
    width: "100%",
    marginInline: "auto",
    maxWidth: {
      default: "none",
      [BP_SM]: "40rem",
      [BP_MD]: "48rem",
      [BP_LG]: "64rem",
      [BP_XL]: "80rem",
      [BP_2XL]: "96rem",
    },
    lineHeight: "2.5rem",
  },
});

const TOTAL_COUNT = 1000000;
const ITEM_HEIGHT = 40;

const NumberItem = (props: { index: number }) => (
  <Text style={[layoutStyles.mb1, layoutStyles.itemHeight(`${ITEM_HEIGHT}px`)]}>
    {numberToWords.toWords(props.index + 1)}
  </Text>
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
          <div {...stylex.attrs(styles.centeredScreen)}>
            <Loader />
          </div>
        }
      >
        <style>{`
					html, body {
						overflow: hidden;
						height: 100dvh;
					}
					.kawara-container {
						container-type: inline-size;
						height: 100dvh;
						overflow: hidden;
					}
					.kawara-main {
						container-type: inline-size;
						height: 100dvh;
						padding-block: 2rem;
					}
					/* Hide Nav and Footer specifically for this page */
					body > div > div > nav,
					body > div > div > footer {
						display: none !important;
					}
				`}</style>
        <div class={`kawara-container ${stylex.attrs(styles.kawaraContainer).class ?? ""}`}>
          <main
            class={`kawara-main ${stylex.attrs(styles.kawaraMain, textAlign.center).class ?? ""}`}
          >
            {windowHeight() === 0 ? (
              <div>
                <Loader />
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
                          "inset-block-start": 0,
                          "inset-inline-start": 0,
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
