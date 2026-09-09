import { For, Show, createMemo, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "@tom/ui/tomui/button";
import { LayerCard } from "@tom/ui/tomui/layer-card";
import { Text } from "@tom/ui/tomui/text";
import { Select } from "@tom/ui/tomui/select";
import { Label } from "@tom/ui/tomui/label";
import { Input } from "@tom/ui/tomui/input";
import { Radio } from "@tom/ui/tomui/radio";
import { Banner } from "@tom/ui/tomui/banner";
import { formatElapsed } from "../lib/format";
import { PRESET_IMAGES, loadImageSize, readFileAsDataUrl } from "../lib/images";

export type SetupConfig = {
  readonly imageKey: string;
  readonly imageSrc: string;
  readonly rows: number;
  readonly cols: number;
  readonly boardW: number;
  readonly boardH: number;
};

export type SavedSummary = {
  readonly label: string;
  readonly rows: number;
  readonly cols: number;
  readonly elapsed: number;
};

const COUNT_OPTIONS = ["2", "3", "4", "5", "6"];

export const SetupView = (props: {
  readonly saved: SavedSummary | null;
  readonly onStart: (config: SetupConfig) => void;
  readonly onResume: () => void;
  readonly onDiscard: () => void;
}): JSX.Element => {
  const [selected, setSelected] = createSignal("mist-hills");
  const [customSrc, setCustomSrc] = createSignal<string | null>(null);
  const [rows, setRows] = createSignal("3");
  const [cols, setCols] = createSignal("4");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const count = (): number => Number(rows()) * Number(cols());
  const activeSrc = (): string | null => {
    if (selected() === "custom") return customSrc();
    return PRESET_IMAGES.find((preset) => preset.id === selected())?.src ?? null;
  };
  const canStart = (): boolean => activeSrc() !== null && !busy();

  const onFile: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Place an image file to use it as a puzzle.");
      return;
    }
    setBusy(true);
    void readFileAsDataUrl(file)
      .then((url) => {
        setCustomSrc(url);
        setSelected("custom");
        setError(null);
      })
      .catch(() => setError("That image did not load. Try another file."))
      .finally(() => setBusy(false));
  };

  const onStartClick = (): void => {
    const src = activeSrc();
    if (!src) {
      setError("Choose an image or place your own first.");
      return;
    }
    setBusy(true);
    setError(null);
    void loadImageSize(src)
      .then((size) => {
        const scale = Math.min(800 / size.w, 560 / size.h, 1);
        const boardW = Math.max(240, Math.round(size.w * scale));
        const boardH = Math.max(180, Math.round(size.h * scale));
        props.onStart({
          imageKey: selected(),
          imageSrc: src,
          rows: Number(rows()),
          cols: Number(cols()),
          boardW,
          boardH,
        });
      })
      .finally(() => setBusy(false));
  };

  const countLabel = createMemo(() => `${count()} pieces`);

  return (
    <div class="jigjam-setup">
      <Show when={props.saved}>
        {(saved) => (
          <Banner
            title="Welcome back"
            description={`${saved().label} · ${saved().rows} × ${saved().cols} · ${formatElapsed(saved().elapsed)} so far. Your progress is saved on this device.`}
            action={
              <span class="flex gap-2">
                <Banner.Action onClick={props.onResume}>Resume</Banner.Action>
                <Banner.Action variant="secondary" onClick={props.onDiscard}>
                  Discard
                </Banner.Action>
              </span>
            }
          />
        )}
      </Show>
      <LayerCard class="px-5 py-4">
        <Text variant="heading" size="lg" as="h1">
          Jigjam
        </Text>
        <Text variant="secondary" size="sm">
          A quiet puzzle. Choose an image, pick a grid, take your time.
        </Text>
        <div class="jigjam-setup-body">
          <Radio.Group
            legend="Image"
            value={selected()}
            onValueChange={setSelected}
            orientation="horizontal"
          >
            <For each={PRESET_IMAGES}>
              {(preset) => (
                <Radio.Item
                  value={preset.id}
                  label={
                    <span class="jigjam-pick">
                      <img src={preset.src} alt={preset.label} class="jigjam-thumb" />
                      <span>{preset.label}</span>
                    </span>
                  }
                />
              )}
            </For>
            <Show when={customSrc()}>
              {(src) => (
                <Radio.Item
                  value="custom"
                  label={
                    <span class="jigjam-pick">
                      <img src={src()} alt="Your upload" class="jigjam-thumb" />
                      <span>Your image</span>
                    </span>
                  }
                />
              )}
            </Show>
          </Radio.Group>
          <Input
            data-jigjam-upload="true"
            type="file"
            accept="image/*"
            label="Or place your own image"
            description="Stays on this device, saved locally with your progress."
            onChange={onFile}
          />
          <div class="jigjam-grid-picks">
            <span class="jigjam-select">
              <Label>Rows</Label>
              <Select
                aria-label="Rows"
                value={rows()}
                onChange={setRows}
                options={COUNT_OPTIONS.map((value) => ({ label: value, value }))}
              />
            </span>
            <span class="jigjam-select">
              <Label>Columns</Label>
              <Select
                aria-label="Columns"
                value={cols()}
                onChange={setCols}
                options={COUNT_OPTIONS.map((value) => ({ label: value, value }))}
              />
            </span>
            <Text variant="secondary" size="sm" class="jigjam-count">
              {countLabel()}
            </Text>
          </div>
          <Show when={error()}>{(message) => <Text variant="error">{message()}</Text>}</Show>
          <Button variant="primary" loading={busy()} disabled={!canStart()} onClick={onStartClick}>
            Start puzzle
          </Button>
        </div>
      </LayerCard>
    </div>
  );
};
