import { expect, given, scene, text } from "foldkit/scene";
import { describe, test } from "vitest";

import { type Model, update, view } from "../main";

const initialModel: Model = {};

describe("view", () => {
  test("renders the app heading", () => {
    scene({ update, view }, given(initialModel), expect(text("ABOUT YUFU")).toExist());
  });
});
