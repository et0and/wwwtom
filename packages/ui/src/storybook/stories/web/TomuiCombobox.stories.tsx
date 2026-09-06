import preview from "#.storybook/preview";
import { Combobox } from "@tom/ui/tomui/combobox";

const meta = preview.meta({
  title: "web/Combobox",
  component: Combobox,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const frameworks = ["Solid", "React", "Svelte", "Vue"];

export const Single = meta.story({
  render: () => (
    <div class="w-xs">
      <Combobox label="Framework" defaultValue="Solid">
        <Combobox.TriggerValue placeholder="Select a framework" />
        <Combobox.Content>
          <Combobox.List items={frameworks}>
            {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    </div>
  ),
});

export const WithSearchInput = meta.story({
  render: () => (
    <div class="w-xs">
      <Combobox label="Framework">
        <Combobox.TriggerInput placeholder="Search frameworks" />
        <Combobox.Content>
          <Combobox.List items={frameworks}>
            {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    </div>
  ),
});

export const Multiple = meta.story({
  render: () => (
    <div class="w-xs">
      <Combobox label="Frameworks" multiple defaultValue={["Solid", "Svelte"]}>
        <Combobox.TriggerMultipleWithInput placeholder="Pick frameworks" />
        <Combobox.Content>
          <Combobox.List items={frameworks}>
            {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    </div>
  ),
});

export const MultipleTopInput = meta.story({
  render: () => (
    <div class="w-xs">
      <Combobox label="Frameworks" multiple defaultValue={["Solid"]}>
        <Combobox.TriggerMultipleWithInput inputSide="top" placeholder="Search above" />
        <Combobox.Content>
          <Combobox.List items={frameworks}>
            {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    </div>
  ),
});

export const WithError = meta.story({
  render: () => (
    <div class="w-xs">
      <Combobox label="Framework" error="Select at least one framework">
        <Combobox.TriggerValue placeholder="Select a framework" />
      </Combobox>
    </div>
  ),
});

export const Empty = meta.story({
  render: () => (
    <div class="w-xs">
      <Combobox label="Framework">
        <Combobox.TriggerValue placeholder="Select a framework" />
        <Combobox.Content>
          <Combobox.Empty>No frameworks found.</Combobox.Empty>
        </Combobox.Content>
      </Combobox>
    </div>
  ),
});
