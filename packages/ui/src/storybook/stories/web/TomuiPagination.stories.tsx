import preview from "#.storybook/preview";
import { Pagination } from "@tom/ui/pagination";

const meta = preview.meta({
  title: "web/Pagination",
  component: Pagination,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const FirstPage = meta.story({
  args: {
    page: 1,
    pageCount: 10,
  },
});

export const MiddlePage = meta.story({
  args: {
    page: 5,
    pageCount: 10,
  },
});

export const LastPage = meta.story({
  args: {
    page: 10,
    pageCount: 10,
  },
});

export const Simple = meta.story({
  args: {
    controls: "simple",
    page: 3,
    pageCount: 8,
  },
});

export const SinglePage = meta.story({
  args: {
    page: 1,
    pageCount: 1,
  },
});
