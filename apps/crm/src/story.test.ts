import { Option, Schema } from "effect";
import { Command, given, message, model, story } from "foldkit/story";
import { describe, expect, test } from "vitest";
import { CrmAssetListResponseSchema, CrmAssetSchema } from "@tom/schemas/crm";
import { CrmSessionSchema } from "./lib/auth";
import {
  CreateAsset,
  LoadAssets,
  LoadSession,
  Message,
  UpdateAsset,
  init,
  initialModel,
  update,
} from "./main";

const session = Schema.decodeSync(CrmSessionSchema)({
  session: { id: "session-1" },
  user: { id: "user-1", email: "admin@example.com", name: "Admin" },
});

const asset = Schema.decodeSync(CrmAssetSchema)({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Camera",
  serialNumber: "CAM-001",
  description: null,
  category: "Gear",
  status: "available",
  location: "Shelf A",
  hash: "a".repeat(64),
  version: 1,
  qrPath: "/crm/assets/00000000-0000-4000-8000-000000000001/qr.svg",
  photos: [],
  locations: [],
  createdBy: "admin@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const assetPage = Schema.decodeSync(CrmAssetListResponseSchema)({
  docs: [asset],
  totalDocs: 2,
  limit: 1,
  page: 1,
  totalPages: 2,
  hasNextPage: true,
  hasPrevPage: false,
});

describe("mono update", () => {
  test("init starts session loading", () => {
    const result = init();
    expect(result.model.session._tag).toBe("Loading");
    expect(result.commands?.some((command) => command.name === LoadSession.name)).toBe(true);
  });

  test("a signed-in session starts the asset request", () => {
    story(
      update,
      given(initialModel),
      message(Message.SucceededLoadSession({ session })),
      Command.expectHas(LoadAssets),
      model((current) => {
        expect(current.session._tag).toBe("SignedIn");
        expect(current.assets._tag).toBe("Loading");
      }),
      Command.resolve(LoadAssets, Message.FailedLoadAssets({ error: "No assets" })),
    );
  });

  test("a signed-out session does not request assets", () => {
    story(
      update,
      given(initialModel),
      message(Message.SucceededLoadSession({ session: null })),
      Command.expectNone(),
      model((current) => {
        expect(current.session._tag).toBe("SignedOut");
      }),
    );
  });

  test("keeps a loading asset list when creation finishes first", () => {
    const loading = update(initialModel, Message.SucceededLoadSession({ session })).model;
    const open = update(loading, Message.ClickedAddAsset()).model;
    const named = update(open, Message.UpdatedAssetName({ value: "Camera" })).model;
    const submitting = update(named, Message.SubmittedCreateAsset()).model;
    const result = update(submitting, Message.SucceededCreateAsset({ asset }));

    expect(result.model.assets._tag).toBe("Loading");
    expect(result.model.selectedAsset._tag).toBe("Some");
    expect(Option.getOrUndefined(result.model.selectedAsset)?.id).toBe(asset.id);
  });

  test("requests the next asset page", () => {
    const signedIn = update(initialModel, Message.SucceededLoadSession({ session })).model;
    const ready = update(signedIn, Message.SucceededLoadAssets({ response: assetPage })).model;
    const next = update(ready, Message.ClickedNextAssetPage());

    expect(next.model.assets._tag).toBe("Loading");
    expect(next.commands?.some((command) => command.name === LoadAssets.name)).toBe(true);
  });

  test("editing an existing asset sends an update command", () => {
    const signedIn = update(initialModel, Message.SucceededLoadSession({ session })).model;
    const withAsset = {
      ...signedIn,
      selectedAssetId: Option.some(asset.id),
      selectedAsset: Option.some(asset),
    };
    const opened = update(withAsset, Message.ClickedEditAsset()).model;
    const submitted = update(opened, Message.SubmittedSaveAsset());

    expect(opened.editingAssetId._tag).toBe("Some");
    expect(submitted.commands?.some((command) => command.name === UpdateAsset.name)).toBe(true);
  });

  test("submitting a named asset enters submitting state", () => {
    story(
      update,
      given(initialModel),
      message(Message.ClickedAddAsset()),
      message(Message.UpdatedAssetName({ value: "Camera" })),
      message(Message.SubmittedCreateAsset()),
      model((current) => {
        expect(current.form._tag).toBe("Submitting");
      }),
      Command.expectHas(CreateAsset),
      Command.resolve(CreateAsset, Message.FailedCreateAsset({ error: "No upload" })),
    );
  });
});
