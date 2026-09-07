import preview from "#.storybook/preview";
import { Bollinger } from "@tom/ui/tomui/bollinger";

const meta = preview.meta({
  title: "web/Bollinger",
  component: Bollinger,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

const series = [
  { color: "#0A4DA6", label: "National", values: [31, 30, 32, 29, 31, 33, 30, 31] },
  { color: "#D62027", label: "Labour", values: [28, 29, 27, 30, 28, 27, 29, 28] },
];

const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];

export const Default = meta.story({
  args: {
    series,
    labels,
    caption: "Support over time, with five-poll Bollinger bands.",
  },
});
