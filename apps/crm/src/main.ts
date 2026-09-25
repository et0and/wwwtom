import { Effect, Option, Schema } from "effect";
import { Command, File, Runtime, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { defineTaggedUnion } from "foldkit/schema";
import { type Document, type Html, type HtmlBuilder } from "foldkit/html";
import { modifyFields } from "foldkit/struct";
import {
  CrmAssetId,
  CrmAssetStatusSchema,
  CrmAssetListResponseSchema,
  CrmAssetVersionSchema,
  CrmAssetUpdateSchema,
  CrmAssetSchema,
  CrmLocationUpdateSchema,
  type CrmAsset,
  type CrmAssetListResponse,
  type CrmAssetUpdate,
  type CrmAssetStatus,
} from "@tom/schemas/crm";
import { CmsError } from "@tom/types/errors";
import { adapterUrl, requestJson } from "./lib/api";
import { CrmSessionSchema, loadSession, signOut, startGitHubSignIn } from "./lib/auth";

const SessionState = defineTaggedUnion({
  Loading: {},
  SignedOut: {},
  SigningIn: {},
  SignedIn: { session: CrmSessionSchema },
});
type SessionState = typeof SessionState.Type;

const AssetState = defineTaggedUnion({
  Idle: {},
  Loading: {},
  Failure: { error: Schema.String },
  Ready: { response: CrmAssetListResponseSchema },
});
type AssetState = typeof AssetState.Type;

const AssetDraftSchema = Schema.Struct({
  name: Schema.String,
  serialNumber: Schema.String,
  description: Schema.String,
  category: Schema.String,
  status: CrmAssetStatusSchema,
  location: Schema.String,
  photos: Schema.Array(File.File),
});
type AssetDraft = typeof AssetDraftSchema.Type;

const FormState = defineTaggedUnion({
  Closed: {},
  Open: { draft: AssetDraftSchema },
  Submitting: { draft: AssetDraftSchema },
});
type FormState = typeof FormState.Type;

const LocationDraftSchema = Schema.Struct({
  location: Schema.String,
  note: Schema.String,
});
type LocationDraft = typeof LocationDraftSchema.Type;

const LocationFormState = defineTaggedUnion({
  Closed: {},
  Open: { draft: LocationDraftSchema },
  Submitting: { draft: LocationDraftSchema },
  Failure: { draft: LocationDraftSchema, error: Schema.String },
});
type LocationFormState = typeof LocationFormState.Type;

export const Message = defineMessageUnion({
  ClickedSignIn: {},
  SucceededSignIn: {},
  FailedSignIn: { error: Schema.String },
  ClickedSignOut: {},
  SucceededSignOut: {},
  FailedSignOut: { error: Schema.String },
  SucceededLoadSession: { session: Schema.NullOr(CrmSessionSchema) },
  FailedLoadSession: { error: Schema.String },
  SucceededLoadAssets: { response: CrmAssetListResponseSchema },
  FailedLoadAssets: { error: Schema.String },
  ClickedPreviousAssetPage: {},
  ClickedNextAssetPage: {},
  SucceededLoadAsset: { id: CrmAssetId, asset: CrmAssetSchema },
  FailedLoadAsset: { id: CrmAssetId, error: Schema.String },
  ClickedAddAsset: {},
  ClickedCancelAddAsset: {},
  UpdatedAssetName: { value: Schema.String },
  UpdatedAssetSerialNumber: { value: Schema.String },
  UpdatedAssetDescription: { value: Schema.String },
  UpdatedAssetCategory: { value: Schema.String },
  UpdatedAssetStatus: { value: CrmAssetStatusSchema },
  UpdatedAssetLocation: { value: Schema.String },
  UpdatedAssetPhotos: { files: Schema.Array(File.File) },
  SubmittedCreateAsset: {},
  SucceededCreateAsset: { asset: CrmAssetSchema },
  FailedCreateAsset: { error: Schema.String },
  ClickedEditAsset: {},
  SubmittedSaveAsset: {},
  SucceededUpdateAsset: { asset: CrmAssetSchema },
  FailedUpdateAsset: { id: CrmAssetId, error: Schema.String },
  SubmittedAddPhotos: { files: Schema.Array(File.File) },
  SucceededAddPhotos: { asset: CrmAssetSchema },
  FailedAddPhotos: { id: CrmAssetId, error: Schema.String },
  ClickedSelectAsset: { id: CrmAssetId },
  UpdatedLocation: { value: Schema.String },
  UpdatedLocationNote: { value: Schema.String },
  SubmittedLocation: {},
  SucceededLogLocation: { asset: CrmAssetSchema },
  FailedLogLocation: { id: CrmAssetId, error: Schema.String },
});
export type Message = typeof Message.Type;

const emptyDraft: AssetDraft = {
  name: "",
  serialNumber: "",
  description: "",
  category: "General",
  status: "available",
  location: "",
  photos: [],
};

const emptyLocationDraft: LocationDraft = { location: "", note: "" };

const draftForAsset = (asset: CrmAsset): AssetDraft => ({
  name: asset.name,
  serialNumber: asset.serialNumber ?? "",
  description: asset.description ?? "",
  category: asset.category,
  status: asset.status,
  location: asset.location ?? "",
  photos: [],
});

const selectedAssetFromLocation = (): Option.Option<CrmAssetId> => {
  const value = new URLSearchParams(window.location.search).get("asset");
  return value === null ? Option.none() : Schema.decodeOption(CrmAssetId)(value);
};

export const initialModel: Model = {
  session: SessionState.Loading(),
  assets: AssetState.Idle(),
  selectedAssetId: selectedAssetFromLocation(),
  selectedAsset: Option.none(),
  form: FormState.Closed(),
  editingAssetId: Option.none(),
  editingVersion: Option.none(),
  locationForm: LocationFormState.Closed(),
  notice: "",
};

export const Model = Schema.Struct({
  session: SessionState,
  assets: AssetState,
  selectedAssetId: Schema.Option(CrmAssetId),
  selectedAsset: Schema.Option(CrmAssetSchema),
  form: FormState,
  editingAssetId: Schema.Option(CrmAssetId),
  editingVersion: Schema.Option(CrmAssetVersionSchema),
  locationForm: LocationFormState,
  notice: Schema.String,
});
export type Model = typeof Model.Type;

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: initialModel,
  commands: [LoadSession()],
});

const errorMessage = (cause: unknown): string =>
  cause instanceof CmsError ? cause.message : String(cause);

const reopenAssetForm = (state: FormState): FormState =>
  FormState.match(state, {
    Closed: () => FormState.Open({ draft: emptyDraft }),
    Open: ({ draft }) => FormState.Open({ draft }),
    Submitting: ({ draft }) => FormState.Open({ draft }),
  });

const updateDraft = (state: FormState, update: (draft: AssetDraft) => AssetDraft): FormState =>
  FormState.match(state, {
    Closed: () => state,
    Open: ({ draft }) => FormState.Open({ draft: update(draft) }),
    Submitting: ({ draft }) => FormState.Submitting({ draft: update(draft) }),
  });

const updateLocationDraft = (
  state: LocationFormState,
  update: (draft: LocationDraft) => LocationDraft,
): LocationFormState =>
  LocationFormState.match(state, {
    Closed: () => state,
    Open: ({ draft }) => LocationFormState.Open({ draft: update(draft) }),
    Submitting: ({ draft }) => LocationFormState.Submitting({ draft: update(draft) }),
    Failure: ({ draft }) => LocationFormState.Failure({ draft: update(draft), error: "" }),
  });

const readyResponse = (model: Model) =>
  model.assets._tag === "Ready"
    ? model.assets.response
    : {
        docs: [],
        totalDocs: 0,
        limit: 100,
        page: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };

const isStaleAssetResponse = (model: Model, asset: CrmAsset): boolean => {
  const selected = Option.getOrUndefined(model.selectedAsset);
  return selected !== undefined && selected.id === asset.id && selected.version > asset.version;
};

const isSelectedAsset = (model: Model, id: CrmAssetId): boolean =>
  Option.match(model.selectedAssetId, {
    onNone: () => false,
    onSome: (selectedId) => selectedId === id,
  });

const replaceAsset = (
  model: Model,
  asset: CrmAsset,
  selectAsset: boolean,
  insertIfMissing: boolean,
): Model => {
  const currentSelected = Option.getOrUndefined(model.selectedAsset);
  if (
    currentSelected !== undefined &&
    currentSelected.id === asset.id &&
    currentSelected.version > asset.version
  ) {
    return model;
  }
  const isSelected = isSelectedAsset(model, asset.id);
  if (model.assets._tag !== "Ready") {
    return modifyFields(model, {
      selectedAsset: () => (selectAsset || isSelected ? Option.some(asset) : model.selectedAsset),
    });
  }
  const response = model.assets.response;
  const wasListed = response.docs.some((item) => item.id === asset.id);
  const shouldInsert = insertIfMissing || wasListed;
  const docs = shouldInsert
    ? [asset, ...response.docs.filter((item) => item.id !== asset.id)].slice(0, response.limit)
    : response.docs;
  const totalDocs = shouldInsert && !wasListed ? response.totalDocs + 1 : response.totalDocs;
  const totalPages = Math.max(1, Math.ceil(totalDocs / response.limit));
  return modifyFields(model, {
    assets: () =>
      AssetState.Ready({
        response: {
          ...response,
          docs,
          totalDocs,
          totalPages,
          hasNextPage: response.page < totalPages,
          hasPrevPage: response.page > 1,
        },
      }),
    selectedAsset: () => (selectAsset || isSelected ? Option.some(asset) : model.selectedAsset),
  });
};

const reloadFirstPageAfterMutation = (model: Model, updated: Model, assetId: CrmAssetId) => {
  const shouldReload =
    model.assets._tag === "Ready" &&
    model.assets.response.page > 1 &&
    model.assets.response.docs.some((asset) => asset.id === assetId);
  return shouldReload
    ? {
        model: modifyFields(updated, { assets: () => AssetState.Loading() }),
        commands: [LoadAssets({ page: 1 })],
      }
    : { model: updated };
};

const openLocation = (): LocationFormState => LocationFormState.Open({ draft: emptyLocationDraft });

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedSignIn: () => ({
      model: modifyFields(model, { session: () => SessionState.SigningIn(), notice: () => "" }),
      commands: [StartSignIn()],
    }),
    SucceededSignIn: () => ({
      model: modifyFields(model, { session: () => SessionState.SignedOut(), notice: () => "" }),
    }),
    FailedSignIn: ({ error }) => ({
      model: modifyFields(model, {
        session: () => SessionState.SignedOut(),
        notice: () => error,
      }),
    }),
    ClickedSignOut: () => ({
      model: modifyFields(model, { notice: () => "" }),
      commands: [SignOut()],
    }),
    SucceededSignOut: () => ({
      model: {
        session: SessionState.SignedOut(),
        assets: AssetState.Idle(),
        selectedAssetId: Option.none(),
        selectedAsset: Option.none(),
        form: FormState.Closed(),
        editingAssetId: Option.none(),
        editingVersion: Option.none(),
        locationForm: LocationFormState.Closed(),
        notice: "",
      },
    }),
    FailedSignOut: ({ error }) => ({ model: modifyFields(model, { notice: () => error }) }),
    SucceededLoadSession: ({ session }) =>
      session === null
        ? {
            model: modifyFields(model, {
              session: () => SessionState.SignedOut(),
              assets: () => AssetState.Idle(),
              selectedAsset: () => Option.none(),
              editingAssetId: () => Option.none(),
              editingVersion: () => Option.none(),
            }),
          }
        : {
            model: modifyFields(model, {
              session: () => SessionState.SignedIn({ session }),
              assets: () => AssetState.Loading(),
              selectedAsset: () => Option.none(),
              editingAssetId: () => Option.none(),
              editingVersion: () => Option.none(),
              notice: () => "",
            }),
            commands: [LoadAssets({})],
          },
    FailedLoadSession: ({ error }) => ({
      model: modifyFields(model, {
        session: () => SessionState.SignedOut(),
        notice: () => error,
      }),
    }),
    SucceededLoadAssets: ({ response }) => {
      const selected = Option.getOrUndefined(model.selectedAsset);
      const visibleResponse =
        selected === undefined
          ? response
          : {
              ...response,
              docs: response.docs.map((asset) =>
                asset.id === selected.id && asset.version < selected.version ? selected : asset,
              ),
            };
      const requestedId = Option.match(model.selectedAssetId, {
        onNone: () => undefined,
        onSome: (id) => id,
      });
      const requestedAsset =
        requestedId === undefined
          ? undefined
          : visibleResponse.docs.find((asset) => asset.id === requestedId);
      if (requestedAsset !== undefined) {
        return {
          model: modifyFields(model, {
            assets: () => AssetState.Ready({ response: visibleResponse }),
            selectedAssetId: () => Option.some(requestedAsset.id),
            selectedAsset: () => Option.some(requestedAsset),
            locationForm: () => openLocation(),
          }),
        };
      }
      if (requestedId !== undefined) {
        return {
          model: modifyFields(model, {
            assets: () => AssetState.Ready({ response: visibleResponse }),
            selectedAsset: () => Option.none(),
            locationForm: () => LocationFormState.Closed(),
          }),
          commands: [LoadAsset({ id: requestedId })],
        };
      }
      const firstAsset = visibleResponse.docs[0];
      return {
        model: modifyFields(model, {
          assets: () => AssetState.Ready({ response: visibleResponse }),
          selectedAssetId: () =>
            firstAsset === undefined ? Option.none() : Option.some(firstAsset.id),
          selectedAsset: () => (firstAsset === undefined ? Option.none() : Option.some(firstAsset)),
          locationForm: () => (firstAsset === undefined ? model.locationForm : openLocation()),
        }),
      };
    },
    FailedLoadAssets: ({ error }) => ({
      model: modifyFields(model, { assets: () => AssetState.Failure({ error }) }),
    }),
    ClickedPreviousAssetPage: () => {
      if (
        model.form._tag === "Submitting" ||
        model.locationForm._tag === "Submitting" ||
        model.assets._tag !== "Ready" ||
        !model.assets.response.hasPrevPage
      )
        return { model };
      return {
        model: modifyFields(model, {
          assets: () => AssetState.Loading(),
          selectedAssetId: () => Option.none(),
          selectedAsset: () => Option.none(),
          form: () => FormState.Closed(),
          editingAssetId: () => Option.none(),
          editingVersion: () => Option.none(),
          locationForm: () => LocationFormState.Closed(),
        }),
        commands: [LoadAssets({ page: model.assets.response.page - 1 })],
      };
    },
    ClickedNextAssetPage: () => {
      if (
        model.form._tag === "Submitting" ||
        model.locationForm._tag === "Submitting" ||
        model.assets._tag !== "Ready" ||
        !model.assets.response.hasNextPage
      )
        return { model };
      return {
        model: modifyFields(model, {
          assets: () => AssetState.Loading(),
          selectedAssetId: () => Option.none(),
          selectedAsset: () => Option.none(),
          form: () => FormState.Closed(),
          editingAssetId: () => Option.none(),
          editingVersion: () => Option.none(),
          locationForm: () => LocationFormState.Closed(),
        }),
        commands: [LoadAssets({ page: model.assets.response.page + 1 })],
      };
    },
    SucceededLoadAsset: ({ id, asset }) => {
      const updated = replaceAsset(model, asset, false, false);
      const preserved = Option.getOrUndefined(updated.selectedAsset);
      if (preserved?.id === asset.id && preserved.version > asset.version) {
        return { model: updated };
      }
      const isCurrent = Option.match(model.selectedAssetId, {
        onNone: () => false,
        onSome: (selectedId) => selectedId === id,
      });
      return {
        model: isCurrent
          ? modifyFields(updated, {
              selectedAssetId: () => Option.some(asset.id),
              selectedAsset: () => Option.some(asset),
              editingVersion: () =>
                Option.match(model.editingAssetId, {
                  onNone: () => Option.none(),
                  onSome: (editingId) =>
                    editingId === asset.id ? Option.some(asset.version) : model.editingVersion,
                }),
              locationForm: () =>
                model.locationForm._tag === "Failure" && isSelectedAsset(model, asset.id)
                  ? model.locationForm
                  : openLocation(),
              notice: () =>
                model.locationForm._tag === "Failure" && isSelectedAsset(model, asset.id)
                  ? model.notice
                  : "",
            })
          : updated,
      };
    },
    FailedLoadAsset: ({ id, error }) => ({
      model: isSelectedAsset(model, id) ? modifyFields(model, { notice: () => error }) : model,
    }),
    ClickedAddAsset: () =>
      model.form._tag === "Submitting"
        ? { model }
        : {
            model: modifyFields(model, {
              form: () => FormState.Open({ draft: emptyDraft }),
              editingAssetId: () => Option.none(),
              editingVersion: () => Option.none(),
              notice: () => "",
            }),
          },
    ClickedEditAsset: () => {
      if (model.form._tag === "Submitting" || model.locationForm._tag === "Submitting") {
        return { model };
      }
      const asset = Option.getOrUndefined(model.selectedAsset);
      return asset === undefined
        ? { model }
        : {
            model: modifyFields(model, {
              form: () => FormState.Open({ draft: draftForAsset(asset) }),
              editingAssetId: () => Option.some(asset.id),
              editingVersion: () => Option.some(asset.version),
              locationForm: () => LocationFormState.Closed(),
              notice: () => "",
            }),
          };
    },
    ClickedCancelAddAsset: () =>
      model.form._tag === "Submitting"
        ? { model }
        : {
            model: modifyFields(model, {
              form: () => FormState.Closed(),
              editingAssetId: () => Option.none(),
              editingVersion: () => Option.none(),
            }),
          },
    UpdatedAssetName: ({ value }) => ({
      model: modifyFields(model, {
        form: () => updateDraft(model.form, (draft) => ({ ...draft, name: value })),
      }),
    }),
    UpdatedAssetSerialNumber: ({ value }) => ({
      model: modifyFields(model, {
        form: () => updateDraft(model.form, (draft) => ({ ...draft, serialNumber: value })),
      }),
    }),
    UpdatedAssetDescription: ({ value }) => ({
      model: modifyFields(model, {
        form: () => updateDraft(model.form, (draft) => ({ ...draft, description: value })),
      }),
    }),
    UpdatedAssetCategory: ({ value }) => ({
      model: modifyFields(model, {
        form: () => updateDraft(model.form, (draft) => ({ ...draft, category: value })),
      }),
    }),
    UpdatedAssetStatus: ({ value }) => ({
      model: modifyFields(model, {
        form: () => updateDraft(model.form, (draft) => ({ ...draft, status: value })),
      }),
    }),
    UpdatedAssetLocation: ({ value }) => ({
      model: modifyFields(model, {
        form: () => updateDraft(model.form, (draft) => ({ ...draft, location: value })),
      }),
    }),
    UpdatedAssetPhotos: ({ files }) => ({
      model: modifyFields(model, {
        form: () => updateDraft(model.form, (draft) => ({ ...draft, photos: files })),
      }),
    }),
    SubmittedCreateAsset: () => {
      const form = FormState.match(model.form, {
        Closed: () => Option.none<AssetDraft>(),
        Open: ({ draft }) => Option.some(draft),
        Submitting: () => Option.none<AssetDraft>(),
      });
      return Option.match(form, {
        onNone: () => ({ model }),
        onSome: (draft) =>
          draft.name.trim().length === 0
            ? { model }
            : {
                model: modifyFields(model, { form: () => FormState.Submitting({ draft }) }),
                commands: [CreateAsset({ draft })],
              },
      });
    },
    SubmittedSaveAsset: () => {
      const form = FormState.match(model.form, {
        Closed: () => Option.none<AssetDraft>(),
        Open: ({ draft }) => Option.some(draft),
        Submitting: () => Option.none<AssetDraft>(),
      });
      const id = Option.getOrUndefined(model.editingAssetId);
      const version = Option.getOrUndefined(model.editingVersion);
      const asset = Option.getOrUndefined(model.selectedAsset);
      return Option.match(form, {
        onNone: () => ({ model }),
        onSome: (draft) =>
          id === undefined ||
          version === undefined ||
          asset === undefined ||
          asset.id !== id ||
          draft.name.trim().length === 0
            ? { model }
            : {
                model: modifyFields(model, { form: () => FormState.Submitting({ draft }) }),
                commands: [UpdateAsset({ id, input: assetInputFor(draft, version) })],
              },
      });
    },
    SucceededCreateAsset: ({ asset }) => {
      if (model.form._tag !== "Submitting") {
        return {
          model: replaceAsset(
            model,
            asset,
            false,
            model.assets._tag === "Ready" && model.assets.response.page === 1,
          ),
        };
      }
      if (model.assets._tag === "Ready" && model.assets.response.page !== 1) {
        return {
          model: modifyFields(model, {
            assets: () => AssetState.Loading(),
            form: () => FormState.Closed(),
            editingAssetId: () => Option.none(),
            editingVersion: () => Option.none(),
            selectedAssetId: () => Option.some(asset.id),
            selectedAsset: () => Option.some(asset),
            locationForm: () => openLocation(),
            notice: () => "Asset created.",
          }),
          commands: [LoadAssets({ page: 1 })],
        };
      }
      return {
        model: modifyFields(replaceAsset(model, asset, true, true), {
          form: () => FormState.Closed(),
          editingAssetId: () => Option.none(),
          editingVersion: () => Option.none(),
          selectedAssetId: () => Option.some(asset.id),
          locationForm: () => openLocation(),
          notice: () => "Asset created.",
        }),
      };
    },
    FailedCreateAsset: ({ error }) =>
      model.form._tag === "Submitting"
        ? {
            model: modifyFields(model, {
              form: () => reopenAssetForm(model.form),
              notice: () => error,
            }),
          }
        : { model },
    SucceededUpdateAsset: ({ asset }) => {
      if (isStaleAssetResponse(model, asset)) return { model };
      const updated = replaceAsset(model, asset, false, false);
      const isCurrent = Option.match(model.editingAssetId, {
        onNone: () => false,
        onSome: (id) => id === asset.id,
      });
      const next = isCurrent
        ? modifyFields(updated, {
            form: () => FormState.Closed(),
            editingAssetId: () => Option.none(),
            editingVersion: () => Option.none(),
            locationForm: () => openLocation(),
            notice: () => "Asset updated.",
          })
        : updated;
      return reloadFirstPageAfterMutation(model, next, asset.id);
    },
    FailedUpdateAsset: ({ id, error }) => ({
      model: Option.match(model.editingAssetId, {
        onNone: () => model,
        onSome: (editingId) =>
          editingId === id
            ? modifyFields(model, {
                form: () => reopenAssetForm(model.form),
                notice: () => error,
              })
            : model,
      }),
      commands: isSelectedAsset(model, id) ? [LoadAsset({ id })] : [],
    }),
    SubmittedAddPhotos: ({ files }) => {
      if (model.form._tag === "Submitting" || model.locationForm._tag === "Submitting") {
        return { model };
      }
      const asset = Option.getOrUndefined(model.selectedAsset);
      return asset === undefined || files.length === 0
        ? { model }
        : { model, commands: [AddAssetPhotos({ id: asset.id, version: asset.version, files })] };
    },
    SucceededAddPhotos: ({ asset }) => {
      if (isStaleAssetResponse(model, asset)) return { model };
      const updated = replaceAsset(model, asset, false, false);
      return reloadFirstPageAfterMutation(
        model,
        modifyFields(updated, {
          notice: () => (isSelectedAsset(model, asset.id) ? "Photos added." : model.notice),
        }),
        asset.id,
      );
    },
    FailedAddPhotos: ({ id, error }) => ({
      model: isSelectedAsset(model, id) ? modifyFields(model, { notice: () => error }) : model,
      commands: isSelectedAsset(model, id) ? [LoadAsset({ id })] : [],
    }),
    ClickedSelectAsset: ({ id }) => {
      if (model.form._tag === "Submitting" || model.locationForm._tag === "Submitting") {
        return { model };
      }
      const asset = readyResponse(model).docs.find((item) => item.id === id);
      return {
        model: modifyFields(model, {
          selectedAssetId: () => Option.some(id),
          selectedAsset: () => (asset === undefined ? model.selectedAsset : Option.some(asset)),
          form: () => FormState.Closed(),
          editingAssetId: () => Option.none(),
          editingVersion: () => Option.none(),
          locationForm: () => openLocation(),
          notice: () => "",
        }),
      };
    },
    UpdatedLocation: ({ value }) => ({
      model: modifyFields(model, {
        locationForm: () =>
          updateLocationDraft(model.locationForm, (draft) => ({ ...draft, location: value })),
      }),
    }),
    UpdatedLocationNote: ({ value }) => ({
      model: modifyFields(model, {
        locationForm: () =>
          updateLocationDraft(model.locationForm, (draft) => ({ ...draft, note: value })),
      }),
    }),
    SubmittedLocation: () => {
      const form = LocationFormState.match(model.locationForm, {
        Closed: () => Option.none<LocationDraft>(),
        Open: ({ draft }) => Option.some(draft),
        Submitting: () => Option.none<LocationDraft>(),
        Failure: ({ draft }) => Option.some(draft),
      });
      const asset = Option.getOrUndefined(model.selectedAsset);
      return Option.match(form, {
        onNone: () => ({ model }),
        onSome: (draft) =>
          asset === undefined || draft.location.trim().length === 0
            ? { model }
            : {
                model: modifyFields(model, {
                  locationForm: () => LocationFormState.Submitting({ draft }),
                }),
                commands: [
                  LogLocation({
                    id: asset.id,
                    input: {
                      location: draft.location.trim(),
                      note: draft.note.trim() || null,
                      version: asset.version,
                    },
                  }),
                ],
              },
      });
    },
    SucceededLogLocation: ({ asset }) => {
      if (isStaleAssetResponse(model, asset)) return { model };
      const updated = replaceAsset(model, asset, false, false);
      const next = isSelectedAsset(model, asset.id)
        ? modifyFields(updated, {
            locationForm: () => openLocation(),
            notice: () => "Location logged.",
          })
        : updated;
      return reloadFirstPageAfterMutation(model, next, asset.id);
    },
    FailedLogLocation: ({ id, error }) => ({
      model: isSelectedAsset(model, id)
        ? modifyFields(model, {
            locationForm: () => {
              if (model.locationForm._tag === "Closed") return LocationFormState.Closed();
              return LocationFormState.Failure({ draft: model.locationForm.draft, error });
            },
            notice: () => error,
          })
        : model,
      commands: isSelectedAsset(model, id) ? [LoadAsset({ id })] : [],
    }),
  });

const assetInputFor = (draft: AssetDraft, version: number): CrmAssetUpdate => ({
  name: draft.name.trim(),
  serialNumber: draft.serialNumber.trim() || null,
  description: draft.description.trim() || null,
  category: draft.category.trim() || "General",
  status: draft.status,
  location: draft.location.trim() || null,
  version,
});

const formDataForPhotos = (files: ReadonlyArray<File.File>, version: number): FormData => {
  const form = new FormData();
  form.append("version", String(version));
  files.forEach((file) => form.append("photos", file, file.name));
  return form;
};

const formDataFor = (draft: AssetDraft): FormData => {
  const form = new FormData();
  form.append("name", draft.name.trim());
  form.append("serialNumber", draft.serialNumber.trim());
  form.append("description", draft.description.trim());
  form.append("category", draft.category.trim());
  form.append("status", draft.status);
  form.append("location", draft.location.trim());
  draft.photos.forEach((file) => form.append("photos", file, file.name));
  return form;
};

export const LoadSession = Command.define("LoadSession", {
  messages: [Message.SucceededLoadSession, Message.FailedLoadSession],
  execute: loadSession.pipe(
    Effect.map((session) => Message.SucceededLoadSession({ session })),
    Effect.catch((cause) =>
      Effect.succeed(Message.FailedLoadSession({ error: errorMessage(cause) })),
    ),
  ),
});

export const StartSignIn = Command.define("StartSignIn", {
  messages: [Message.SucceededSignIn, Message.FailedSignIn],
  execute: startGitHubSignIn.pipe(
    Effect.tap((url) => Effect.sync(() => window.location.assign(url))),
    Effect.as(Message.SucceededSignIn()),
    Effect.catch((cause) => Effect.succeed(Message.FailedSignIn({ error: errorMessage(cause) }))),
  ),
});

export const SignOut = Command.define("SignOut", {
  messages: [Message.SucceededSignOut, Message.FailedSignOut],
  execute: signOut.pipe(
    Effect.as(Message.SucceededSignOut()),
    Effect.catch((cause) => Effect.succeed(Message.FailedSignOut({ error: errorMessage(cause) }))),
  ),
});

export const LoadAssets = Command.define("LoadAssets", {
  args: { page: Schema.optional(Schema.Int) },
  messages: [Message.SucceededLoadAssets, Message.FailedLoadAssets],
  execute: ({ page }) =>
    requestJson(
      page === undefined ? "/crm/assets" : `/crm/assets?page=${page}`,
      {},
      CrmAssetListResponseSchema,
      "load_assets",
    ).pipe(
      Effect.map((response) => Message.SucceededLoadAssets({ response })),
      Effect.catch((cause) =>
        Effect.succeed(Message.FailedLoadAssets({ error: errorMessage(cause) })),
      ),
    ),
});

export const LoadAsset = Command.define("LoadAsset", {
  args: { id: CrmAssetId },
  messages: [Message.SucceededLoadAsset, Message.FailedLoadAsset],
  execute: ({ id }) =>
    requestJson(`/crm/assets/${id}`, {}, CrmAssetSchema, "load_asset").pipe(
      Effect.map((asset) => Message.SucceededLoadAsset({ id, asset })),
      Effect.catch((cause) =>
        Effect.succeed(Message.FailedLoadAsset({ id, error: errorMessage(cause) })),
      ),
    ),
});

export const CreateAsset = Command.define("CreateAsset", {
  args: { draft: AssetDraftSchema },
  messages: [Message.SucceededCreateAsset, Message.FailedCreateAsset],
  execute: ({ draft }) =>
    requestJson(
      "/crm/assets",
      { method: "POST", body: formDataFor(draft) },
      CrmAssetSchema,
      "create_asset",
    ).pipe(
      Effect.map((asset) => Message.SucceededCreateAsset({ asset })),
      Effect.catch((cause) =>
        Effect.succeed(Message.FailedCreateAsset({ error: errorMessage(cause) })),
      ),
    ),
});

export const UpdateAsset = Command.define("UpdateAsset", {
  args: { id: CrmAssetId, input: CrmAssetUpdateSchema },
  messages: [Message.SucceededUpdateAsset, Message.FailedUpdateAsset],
  execute: ({ id, input }) =>
    requestJson(
      `/crm/assets/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      CrmAssetSchema,
      "update_asset",
    ).pipe(
      Effect.map((asset) => Message.SucceededUpdateAsset({ asset })),
      Effect.catch((cause) =>
        Effect.succeed(Message.FailedUpdateAsset({ id, error: errorMessage(cause) })),
      ),
    ),
});

export const AddAssetPhotos = Command.define("AddAssetPhotos", {
  args: { id: CrmAssetId, version: Schema.Finite, files: Schema.Array(File.File) },
  messages: [Message.SucceededAddPhotos, Message.FailedAddPhotos],
  execute: ({ id, version, files }) =>
    requestJson(
      `/crm/assets/${id}/photos`,
      { method: "POST", body: formDataForPhotos(files, version) },
      CrmAssetSchema,
      "add_photos",
    ).pipe(
      Effect.map((asset) => Message.SucceededAddPhotos({ asset })),
      Effect.catch((cause) =>
        Effect.succeed(Message.FailedAddPhotos({ id, error: errorMessage(cause) })),
      ),
    ),
});

export const LogLocation = Command.define("LogLocation", {
  args: { id: CrmAssetId, input: CrmLocationUpdateSchema },
  messages: [Message.SucceededLogLocation, Message.FailedLogLocation],
  execute: ({ id, input }) =>
    requestJson(
      `/crm/assets/${id}/locations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      CrmAssetSchema,
      "log_location",
    ).pipe(
      Effect.map((asset) => Message.SucceededLogLocation({ asset })),
      Effect.catch((cause) =>
        Effect.succeed(Message.FailedLogLocation({ id, error: errorMessage(cause) })),
      ),
    ),
});

const fieldClass = "field";
const buttonClass = "button button-primary";
const secondaryButtonClass = "button button-secondary";

const statusOptions: ReadonlyArray<{ readonly value: CrmAssetStatus; readonly label: string }> = [
  { value: "available", label: "Available" },
  { value: "in-use", label: "In use" },
  { value: "maintenance", label: "Maintenance" },
  { value: "retired", label: "Retired" },
];

const statusLabel = (status: CrmAssetStatus): string =>
  statusOptions.find((option) => option.value === status)?.label ?? status;

const statusFromValue = (value: string): CrmAssetStatus =>
  statusOptions.find((option) => option.value === value)?.value ?? "available";

const qrUrl = (asset: CrmAsset): string => `${adapterUrl()}${asset.qrPath}`;

const photoUrl = (photo: CrmAsset["photos"][number]): string => `${adapterUrl()}${photo.filePath}`;

const qrDownloadUrl = (asset: CrmAsset): string => `${qrUrl(asset)}?download=1`;

const textField = (
  id: string,
  label: string,
  value: string,
  onInput: (value: string) => Message,
  h: HtmlBuilder<Message>,
  options?: { readonly type?: string; readonly required?: boolean; readonly disabled?: boolean },
): Html =>
  h.div(
    [h.Class("field-group")],
    [
      h.label([h.For(id)], [label]),
      h.input([
        h.Id(id),
        h.Name(id),
        h.Type(options?.type ?? "text"),
        h.Value(value),
        h.Required(options?.required ?? false),
        h.Disabled(options?.disabled ?? false),
        h.OnInput(onInput),
        h.Class(fieldClass),
      ]),
    ],
  );

const assetForm = (model: Model, h: HtmlBuilder<Message>): Html =>
  FormState.match(model.form, {
    Closed: () => h.empty,
    Open: ({ draft }) =>
      assetFormFields(
        draft,
        false,
        Option.isSome(model.editingAssetId)
          ? Message.SubmittedSaveAsset()
          : Message.SubmittedCreateAsset(),
        h,
      ),
    Submitting: ({ draft }) =>
      assetFormFields(
        draft,
        true,
        Option.isSome(model.editingAssetId)
          ? Message.SubmittedSaveAsset()
          : Message.SubmittedCreateAsset(),
        h,
      ),
  });

const assetFormFields = (
  draft: AssetDraft,
  isSubmitting: boolean,
  submitMessage: Message,
  h: HtmlBuilder<Message>,
): Html =>
  h.form(
    [h.Class("asset-form"), h.OnSubmit(submitMessage), h.Novalidate(false)],
    [
      h.div(
        [h.Class("form-heading")],
        [
          h.h2([], [submitMessage._tag === "SubmittedSaveAsset" ? "Edit asset" : "Add asset"]),
          h.p(
            [],
            submitMessage._tag === "SubmittedSaveAsset"
              ? ["Update the asset record and its metadata hash."]
              : ["Record metadata, attach photos, and create a QR label."],
          ),
        ],
      ),
      textField("name", "Name", draft.name, (value) => Message.UpdatedAssetName({ value }), h, {
        required: true,
        disabled: isSubmitting,
      }),
      textField(
        "serialNumber",
        "Serial number",
        draft.serialNumber,
        (value) => Message.UpdatedAssetSerialNumber({ value }),
        h,
        { disabled: isSubmitting },
      ),
      h.div(
        [h.Class("field-group")],
        [
          h.label([h.For("category")], ["Category"]),
          h.input([
            h.Id("category"),
            h.Name("category"),
            h.Type("text"),
            h.Value(draft.category),
            h.Disabled(isSubmitting),
            h.OnInput((value) => Message.UpdatedAssetCategory({ value })),
            h.Class(fieldClass),
          ]),
        ],
      ),
      h.div(
        [h.Class("field-group")],
        [
          h.label([h.For("status")], ["Status"]),
          h.select(
            [
              h.Id("status"),
              h.Name("status"),
              h.Value(draft.status),
              h.Disabled(isSubmitting),
              h.OnChange((value) => Message.UpdatedAssetStatus({ value: statusFromValue(value) })),
              h.Class(fieldClass),
            ],
            statusOptions.map((option) =>
              h.option(
                [h.Value(option.value), h.Selected(option.value === draft.status)],
                [option.label],
              ),
            ),
          ),
        ],
      ),
      textField(
        "location",
        "Initial location",
        draft.location,
        (value) => Message.UpdatedAssetLocation({ value }),
        h,
        { disabled: isSubmitting },
      ),
      h.div(
        [h.Class("field-group")],
        [
          h.label([h.For("description")], ["Description"]),
          h.textarea([
            h.Id("description"),
            h.Name("description"),
            h.Value(draft.description),
            h.Disabled(isSubmitting),
            h.OnInput((value) => Message.UpdatedAssetDescription({ value })),
            h.Class(fieldClass),
            h.Rows(4),
          ]),
        ],
      ),
      submitMessage._tag === "SubmittedSaveAsset"
        ? h.empty
        : h.div(
            [h.Class("field-group")],
            [
              h.label([h.For("photos")], ["Photos"]),
              h.input([
                h.Id("photos"),
                h.Name("photos"),
                h.Type("file"),
                h.Accept("image/jpeg,image/png,image/webp,image/gif,image/avif"),
                h.Multiple(true),
                h.Disabled(isSubmitting),
                h.OnFileChange((files) => Message.UpdatedAssetPhotos({ files })),
                h.Class("file-input"),
              ]),
              h.p(
                [h.Class("field-help")],
                [`${draft.photos.length} photo${draft.photos.length === 1 ? "" : "s"} selected`],
              ),
            ],
          ),
      h.div(
        [h.Class("form-actions")],
        [
          h.button(
            [h.Type("submit"), h.Class(buttonClass), h.Disabled(isSubmitting)],
            [
              isSubmitting
                ? "Saving…"
                : submitMessage._tag === "SubmittedSaveAsset"
                  ? "Save changes"
                  : "Create asset",
            ],
          ),
          h.button(
            [
              h.Type("button"),
              h.Class(secondaryButtonClass),
              h.Disabled(isSubmitting),
              h.OnClick(Message.ClickedCancelAddAsset()),
            ],
            ["Cancel"],
          ),
        ],
      ),
    ],
  );

const assetPagination = (response: CrmAssetListResponse, h: HtmlBuilder<Message>): Html =>
  response.totalPages <= 1
    ? h.empty
    : h.div(
        [h.Class("asset-pagination")],
        [
          h.button(
            [
              h.Type("button"),
              h.Class(secondaryButtonClass),
              h.Disabled(!response.hasPrevPage),
              h.OnClick(Message.ClickedPreviousAssetPage()),
            ],
            ["Previous"],
          ),
          h.span([h.Class("count")], [`Page ${response.page} of ${response.totalPages}`]),
          h.button(
            [
              h.Type("button"),
              h.Class(secondaryButtonClass),
              h.Disabled(!response.hasNextPage),
              h.OnClick(Message.ClickedNextAssetPage()),
            ],
            ["Next"],
          ),
        ],
      );

const assetList = (model: Model, h: HtmlBuilder<Message>): Html =>
  AssetState.match(model.assets, {
    Idle: () => h.p([h.Class("muted")], ["Choose an asset or add a new one."]),
    Loading: () => h.p([h.Class("muted")], ["Loading assets…"]),
    Failure: ({ error }) => h.p([h.Class("error-text")], [error]),
    Ready: ({ response }) =>
      response.docs.length === 0
        ? h.p([h.Class("muted")], ["No assets yet."])
        : h.div(
            [h.Class("asset-list-panel")],
            [
              h.ul(
                [h.Class("asset-list")],
                response.docs.map((asset) =>
                  h.keyed("li")(
                    asset.id,
                    [
                      h.OnClick(Message.ClickedSelectAsset({ id: asset.id })),
                      h.Class("asset-list-item"),
                    ],
                    [
                      h.span([h.Class("asset-list-name")], [asset.name]),
                      h.span([h.Class("asset-list-meta")], [statusLabel(asset.status)]),
                    ],
                  ),
                ),
              ),
              assetPagination(response, h),
            ],
          ),
  });

const locationForm = (model: Model, h: HtmlBuilder<Message>): Html =>
  LocationFormState.match(model.locationForm, {
    Closed: () => h.empty,
    Open: ({ draft }) => locationFields(draft, false, undefined, h),
    Submitting: ({ draft }) => locationFields(draft, true, undefined, h),
    Failure: ({ draft, error }) => locationFields(draft, false, error, h),
  });

const locationFields = (
  draft: LocationDraft,
  isSubmitting: boolean,
  error: string | undefined,
  h: HtmlBuilder<Message>,
): Html =>
  h.form(
    [h.Class("location-form"), h.OnSubmit(Message.SubmittedLocation())],
    [
      h.h3([], ["Log a location"]),
      textField(
        "location-log",
        "Location",
        draft.location,
        (value) => Message.UpdatedLocation({ value }),
        h,
        {
          required: true,
          disabled: isSubmitting,
        },
      ),
      h.div(
        [h.Class("field-group")],
        [
          h.label([h.For("location-note")], ["Note"]),
          h.input([
            h.Id("location-note"),
            h.Name("location-note"),
            h.Type("text"),
            h.Value(draft.note),
            h.Disabled(isSubmitting),
            h.OnInput((value) => Message.UpdatedLocationNote({ value })),
            h.Class(fieldClass),
          ]),
        ],
      ),
      error === undefined ? h.empty : h.p([h.Class("error-text"), h.Role("alert")], [error]),
      h.button(
        [h.Type("submit"), h.Class(buttonClass), h.Disabled(isSubmitting)],
        [isSubmitting ? "Saving…" : "Save location"],
      ),
    ],
  );

const assetDetail = (asset: CrmAsset, model: Model, h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("asset-detail")],
    [
      h.div(
        [h.Class("detail-header")],
        [
          h.div([], [h.p([h.Class("eyebrow")], ["Asset record"]), h.h2([], [asset.name])]),
          h.div(
            [h.Class("detail-actions")],
            [
              h.button(
                [
                  h.Type("button"),
                  h.Class(secondaryButtonClass),
                  h.OnClick(Message.ClickedEditAsset()),
                ],
                ["Edit"],
              ),
              h.span([h.Class("status-badge")], [statusLabel(asset.status)]),
            ],
          ),
        ],
      ),
      asset.description === null ? h.empty : h.p([h.Class("description")], [asset.description]),
      h.dl(
        [h.Class("metadata")],
        [
          h.div([], [h.dt([], ["Serial number"]), h.dd([], [asset.serialNumber ?? "—"])]),
          h.div([], [h.dt([], ["Category"]), h.dd([], [asset.category])]),
          h.div([], [h.dt([], ["Location"]), h.dd([], [asset.location ?? "Not logged"])]),
          h.div([], [h.dt([], ["Metadata hash"]), h.dd([h.Class("hash")], [asset.hash])]),
        ],
      ),
      h.div(
        [h.Class("qr-panel")],
        [
          h.img([h.Src(qrUrl(asset)), h.Alt(`QR code for ${asset.name}`), h.Class("qr-code")]),
          h.div(
            [],
            [
              h.h3([], ["QR label"]),
              h.p([], ["Scan this code to open this asset record."]),
              h.a(
                [h.Href(qrDownloadUrl(asset)), h.Download(`mono-${asset.id}.svg`)],
                ["Download QR code"],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("section-heading")],
        [h.h3([], ["Photos"]), h.span([h.Class("count")], [`${asset.photos.length}`])],
      ),
      h.div(
        [h.Class("photo-upload")],
        [
          h.label([h.For("asset-photos")], ["Add photos"]),
          h.input([
            h.Id("asset-photos"),
            h.Name("asset-photos"),
            h.Type("file"),
            h.Accept("image/jpeg,image/png,image/webp,image/gif,image/avif"),
            h.Multiple(true),
            h.OnFileChange((files) => Message.SubmittedAddPhotos({ files })),
            h.Class("file-input"),
          ]),
        ],
      ),
      asset.photos.length === 0
        ? h.p([h.Class("muted")], ["No photos uploaded."])
        : h.div(
            [h.Class("photo-grid")],
            asset.photos.map((photo) =>
              h.figure(
                [h.Class("photo-card")],
                [
                  h.img([h.Src(photoUrl(photo)), h.Alt(photo.originalName)]),
                  h.figcaption([], [photo.originalName]),
                ],
              ),
            ),
          ),
      h.div([h.Class("section-heading")], [h.h3([], ["Location history"])]),
      asset.locations.length === 0
        ? h.p([h.Class("muted")], ["No location history."])
        : h.ul(
            [h.Class("location-history")],
            asset.locations.map((entry) =>
              h.keyed("li")(
                entry.id,
                [h.Class("location-entry")],
                [
                  h.div(
                    [h.Class("location-copy")],
                    [
                      h.span([], [entry.location]),
                      entry.note === null ? h.empty : h.small([], [entry.note]),
                    ],
                  ),
                  h.small([], [`${entry.createdAt} · ${entry.loggedBy}`]),
                ],
              ),
            ),
          ),
      locationForm(model, h),
    ],
  );

const signedInView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("app-shell")],
    [
      h.header(
        [h.Class("topbar")],
        [
          h.div([], [h.p([h.Class("eyebrow")], ["mono"]), h.h1([], ["Asset room"])]),
          h.div(
            [h.Class("account")],
            [
              h.span(
                [],
                [
                  SessionState.match(model.session, {
                    Loading: () => "",
                    SignedOut: () => "",
                    SigningIn: () => "",
                    SignedIn: ({ session }) => session.user.email,
                  }),
                ],
              ),
              h.button(
                [
                  h.Type("button"),
                  h.Class(secondaryButtonClass),
                  h.OnClick(Message.ClickedSignOut()),
                ],
                ["Sign out"],
              ),
            ],
          ),
        ],
      ),
      model.notice.length === 0
        ? h.empty
        : h.p([h.Class("notice"), h.Role("status")], [model.notice]),
      h.div(
        [h.Class("workspace")],
        [
          h.aside(
            [h.Class("sidebar")],
            [
              h.div(
                [h.Class("sidebar-heading")],
                [
                  h.h2([], ["Assets"]),
                  h.button(
                    [h.Type("button"), h.Class(buttonClass), h.OnClick(Message.ClickedAddAsset())],
                    ["Add"],
                  ),
                ],
              ),
              assetList(model, h),
            ],
          ),
          h.main(
            [h.Class("main-content")],
            [
              FormState.match(model.form, {
                Closed: () => selectedAssetView(model, h),
                Open: () => assetForm(model, h),
                Submitting: () => assetForm(model, h),
              }),
            ],
          ),
        ],
      ),
    ],
  );

const selectedAssetView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(model.selectedAsset, {
    onNone: () =>
      h.div(
        [h.Class("empty-state")],
        [
          h.h2([], ["Start tracking an asset"]),
          h.p([], ["Add metadata, photos, a location, and a QR label from one record."]),
        ],
      ),
    onSome: (asset) => assetDetail(asset, model, h),
  });

const signedOutView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class("signin-shell")],
    [
      h.div(
        [h.Class("signin-card")],
        [
          h.p([h.Class("eyebrow")], ["mono"]),
          h.h1([], ["Know what you own."]),
          h.p([], ["A small asset room for photos, locations, hashes, and QR labels."]),
          h.button(
            [
              h.Type("button"),
              h.Class(buttonClass),
              h.Disabled(model.session._tag === "SigningIn"),
              h.OnClick(Message.ClickedSignIn()),
            ],
            [model.session._tag === "SigningIn" ? "Opening GitHub…" : "Sign in with GitHub"],
          ),
          model.notice.length === 0
            ? h.empty
            : h.p([h.Class("error-text"), h.Role("alert")], [model.notice]),
        ],
      ),
    ],
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "mono",
  body: h.div(
    [h.Class("page")],
    [
      h.p([h.Class("skip-link")], ["Skip to content"]),
      SessionState.match(model.session, {
        Loading: () => h.main([h.Class("loading-shell")], [h.p([], ["Loading mono…"])]),
        SignedOut: () => signedOutView(model, h),
        SigningIn: () => signedOutView(model, h),
        SignedIn: () => signedInView(model, h),
      }),
    ],
  ),
});
