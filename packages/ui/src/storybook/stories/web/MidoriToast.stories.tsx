import preview from "#.storybook/preview";
import { For } from "solid-js";
import { Button } from "@tom/ui/button";
import { Toaster, createToastStore, type MidoriToastVariant } from "@tom/ui/toast";

const meta = preview.meta({
  title: "web/Toast",
  component: Toaster,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const VARIANTS: ReadonlyArray<{ readonly variant: MidoriToastVariant; readonly label: string }> = [
  { variant: "default", label: "Default" },
  { variant: "success", label: "Success" },
  { variant: "error", label: "Error" },
  { variant: "warning", label: "Warning" },
  { variant: "info", label: "Info" },
];

function LiveDemo(props: { duration?: number }) {
  const store = createToastStore();
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "1rem" }}>
      <div style={{ display: "flex", "flex-wrap": "wrap", gap: "0.5rem" }}>
        <For each={VARIANTS}>
          {(item) => (
            <Button
              size="sm"
              onClick={() =>
                store.notify({
                  title: `${item.label} toast`,
                  description: "Click × on the toast to dismiss it.",
                  variant: item.variant,
                  duration: props.duration,
                })
              }
            >
              {item.label}
            </Button>
          )}
        </For>
      </div>
      <Toaster toasts={store.toasts()} onDismiss={(id) => store.dismiss(id)} />
    </div>
  );
}

export const Playground = meta.story({
  render: () => <LiveDemo />,
});

export const NoAutoDismiss = meta.story({
  render: () => <LiveDemo duration={0} />,
});
