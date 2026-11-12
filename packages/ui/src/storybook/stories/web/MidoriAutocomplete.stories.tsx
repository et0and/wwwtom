import preview from "#.storybook/preview";
import { Autocomplete } from "@tom/ui/autocomplete";

const meta = preview.meta({
  title: "web/Autocomplete",
  component: Autocomplete,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const fruits = ["Apple", "Banana", "Cherry", "Grape", "Orange"];

export const Default = meta.story({
  render: () => (
    <div style={{ width: "20rem" }}>
      <Autocomplete items={fruits} label="Fruit">
        <Autocomplete.InputGroup placeholder="Search fruit" />
        <Autocomplete.Content>
          <Autocomplete.List>
            {(item) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
          <Autocomplete.Empty>No fruits match this search.</Autocomplete.Empty>
        </Autocomplete.Content>
      </Autocomplete>
    </div>
  ),
});

export const Open = meta.story({
  render: () => (
    <div style={{ width: "20rem" }}>
      <Autocomplete items={fruits} label="Fruit" defaultOpen>
        <Autocomplete.InputGroup placeholder="Search fruit" />
        <Autocomplete.Content>
          <Autocomplete.List>
            {(item) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    </div>
  ),
});

export const Small = meta.story({
  render: () => (
    <div style={{ width: "20rem" }}>
      <Autocomplete items={fruits} label="Fruit" defaultOpen>
        <Autocomplete.InputGroup size="sm" placeholder="Small input" />
        <Autocomplete.Content>
          <Autocomplete.List>
            {(item) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    </div>
  ),
});

export const Large = meta.story({
  render: () => (
    <div style={{ width: "20rem" }}>
      <Autocomplete items={fruits} label="Fruit" defaultOpen>
        <Autocomplete.InputGroup size="lg" placeholder="Large input" />
        <Autocomplete.Content>
          <Autocomplete.List>
            {(item) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
        </Autocomplete.Content>
      </Autocomplete>
    </div>
  ),
});

export const WithError = meta.story({
  render: () => (
    <div style={{ width: "20rem" }}>
      <Autocomplete items={fruits} label="Fruit" error="Select a fruit to continue">
        <Autocomplete.InputGroup placeholder="Search fruit" />
        <Autocomplete.Content>
          <Autocomplete.List>
            {(item) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
          <Autocomplete.Empty>No fruits match this search.</Autocomplete.Empty>
        </Autocomplete.Content>
      </Autocomplete>
    </div>
  ),
});

export const Empty = meta.story({
  render: () => (
    <div style={{ width: "20rem" }}>
      <Autocomplete items={[]} label="Fruit" defaultOpen>
        <Autocomplete.InputGroup placeholder="Search fruit" />
        <Autocomplete.Content>
          <Autocomplete.Empty>No fruits match this search.</Autocomplete.Empty>
        </Autocomplete.Content>
      </Autocomplete>
    </div>
  ),
});
