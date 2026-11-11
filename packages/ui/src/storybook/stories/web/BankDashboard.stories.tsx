import preview from "#.storybook/preview";
import { Avatar } from "@tom/ui/avatar";
import { Badge } from "@tom/ui/badge";
import { Button } from "@tom/ui/button";
import { Field } from "@tom/ui/field";
import { IconButton } from "@tom/ui/icon-button";
import { LayerCard } from "@tom/ui/layer-card";
import { Switch } from "@tom/ui/switch";
import { Tabs } from "@tom/ui/tabs";
import { TextInput } from "@tom/ui/text-input";
import { MagnifyingGlass } from "@tom/icons/MagnifyingGlass";
import { X } from "@tom/icons/X";

const meta = preview.meta({
  title: "web/Bank dashboard",
  parameters: {
    layout: "centered",
  },
});

const tabs = [
  { value: "leaderboard", label: "Leaderboard" },
  { value: "activity", label: "Activity" },
  { value: "give", label: "Give" },
  { value: "admin", label: "Admin" },
];

const page = {
  width: "40rem",
  display: "flex",
  "flex-direction": "column",
  gap: "1rem",
};

export const Dashboard = meta.story({
  render: () => (
    <div style={page}>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <Avatar fallback="B" background="#3b5cf6" foreground="#ffffff" size="normal" />
          <span style={{ "font-size": "13px", "font-weight": 530 }}>bank</span>
          <Badge variant="subtle">Anomaly</Badge>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "0.5rem" }}>
          <Avatar fallback="Tom" size="normal" />
          <Button variant="ghost-muted" size="sm">
            Sign out
          </Button>
        </div>
      </div>

      <LayerCard>
        <div
          style={{ display: "flex", padding: "1rem", "flex-direction": "column", gap: "0.5rem" }}
        >
          <span style={{ color: "var(--text-color-tomui-subtle)", "font-size": "13px" }}>
            Your balance
          </span>
          <div style={{ display: "flex", "align-items": "baseline", gap: "0.5rem" }}>
            <span style={{ "font-size": "44px", "line-height": "48px", "font-weight": 600 }}>
              120
            </span>
            <span style={{ color: "var(--text-color-tomui-subtle)", "font-size": "13px" }}>
              coins
            </span>
          </div>
        </div>
      </LayerCard>

      <Tabs variant="line" tabs={tabs} value="give" />

      <LayerCard>
        <div style={{ display: "flex", "flex-direction": "column", gap: "1rem", padding: "1rem" }}>
          <Field>
            <Field.Label>To</Field.Label>
            <TextInput
              leadingIcon={<MagnifyingGlass size="sm" />}
              trailing={
                <IconButton
                  label="Clear"
                  size="small"
                  variant="ghost-muted"
                  icon={<X size="xs" />}
                />
              }
              placeholder="Search people"
            />
          </Field>
          <Field>
            <Field.Label>Amount</Field.Label>
            <TextInput numeric placeholder="10" />
          </Field>
          <div
            style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}
          >
            <div style={{ display: "flex", "flex-direction": "column" }}>
              <span style={{ "font-size": "13px", "font-weight": 530 }}>
                Notify on reaction gifts
              </span>
              <span style={{ color: "var(--text-color-tomui-subtle)", "font-size": "13px" }}>
                Message people when someone gives them coins.
              </span>
            </div>
            <Switch checked />
          </div>
          <div style={{ display: "flex", "justify-content": "flex-end" }}>
            <Button variant="contrast">Give 10 coins</Button>
          </div>
        </div>
      </LayerCard>
    </div>
  ),
});
