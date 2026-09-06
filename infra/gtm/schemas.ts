// Tag Manager v2 discovery document revision: 2025-03-06 (Last updated)
// Verified against https://tagmanager.googleapis.com/$discovery/rest?version=v2
// All models are Schema.Struct with readonly derived types.

import { Schema } from "effect";

// Shared

export const AccountFeaturesSchema = Schema.Struct({
  supportUserPermissions: Schema.optional(Schema.Boolean),
  supportMultipleContainers: Schema.optional(Schema.Boolean),
});
export type AccountFeatures = Schema.Schema.Type<typeof AccountFeaturesSchema>;

export const ContainerFeaturesSchema = Schema.Struct({
  supportUserPermissions: Schema.optional(Schema.Boolean),
  supportEnvironments: Schema.optional(Schema.Boolean),
  supportWorkspaces: Schema.optional(Schema.Boolean),
  supportGtagConfigs: Schema.optional(Schema.Boolean),
  supportBuiltInVariables: Schema.optional(Schema.Boolean),
  supportClients: Schema.optional(Schema.Boolean),
  supportFolders: Schema.optional(Schema.Boolean),
  supportTags: Schema.optional(Schema.Boolean),
  supportTemplates: Schema.optional(Schema.Boolean),
  supportTriggers: Schema.optional(Schema.Boolean),
  supportVariables: Schema.optional(Schema.Boolean),
  supportVersions: Schema.optional(Schema.Boolean),
  supportZones: Schema.optional(Schema.Boolean),
  supportTransformations: Schema.optional(Schema.Boolean),
});
export type ContainerFeatures = Schema.Schema.Type<typeof ContainerFeaturesSchema>;

export type ContainerUsageContext = "WEB" | "ANDROID" | "IOS" | (string & {});
export const ContainerUsageContextSchema = Schema.String;

// Account / Container / Workspace

export const AccountSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  name: Schema.String,
  tagManagerUrl: Schema.String,
  fingerprint: Schema.optional(Schema.String),
  shareData: Schema.optional(Schema.Boolean),
  features: Schema.optional(AccountFeaturesSchema),
});
export type Account = Schema.Schema.Type<typeof AccountSchema>;

export const ContainerSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  name: Schema.String,
  domainName: Schema.optional(Schema.Array(Schema.String)),
  publicId: Schema.optional(Schema.String),
  usageContext: Schema.optional(Schema.Array(ContainerUsageContextSchema)),
  fingerprint: Schema.optional(Schema.String),
  tagManagerUrl: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  tagIds: Schema.optional(Schema.Array(Schema.String)),
  features: Schema.optional(ContainerFeaturesSchema),
  taggingServerUrls: Schema.optional(Schema.Array(Schema.String)),
});
export type Container = Schema.Schema.Type<typeof ContainerSchema>;

export const WorkspaceSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  workspaceId: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  fingerprint: Schema.optional(Schema.String),
  tagManagerUrl: Schema.optional(Schema.String),
});
export type Workspace = Schema.Schema.Type<typeof WorkspaceSchema>;

const containerWritableFields = {
  name: Schema.String,
  domainName: Schema.optional(Schema.Array(Schema.String)),
  usageContext: Schema.optional(Schema.Array(ContainerUsageContextSchema)),
  notes: Schema.optional(Schema.String),
  fingerprint: Schema.optional(Schema.String),
};

export const ContainerDraftSchema = Schema.Struct(containerWritableFields);
export type ContainerDraft = Schema.Schema.Type<typeof ContainerDraftSchema>;

const workspaceWritableFields = {
  name: Schema.String,
  description: Schema.optional(Schema.String),
  fingerprint: Schema.optional(Schema.String),
};

export const WorkspaceDraftSchema = Schema.Struct(workspaceWritableFields);
export type WorkspaceDraft = Schema.Schema.Type<typeof WorkspaceDraftSchema>;

export const ListContainersResponseSchema = Schema.Struct({
  container: Schema.optional(Schema.Array(ContainerSchema)),
  nextPageToken: Schema.optional(Schema.String),
});
export type ListContainersResponse = Schema.Schema.Type<typeof ListContainersResponseSchema>;

export const ListWorkspacesResponseSchema = Schema.Struct({
  workspace: Schema.optional(Schema.Array(WorkspaceSchema)),
  nextPageToken: Schema.optional(Schema.String),
});
export type ListWorkspacesResponse = Schema.Schema.Type<typeof ListWorkspacesResponseSchema>;

// Tags + Triggers

export const ParameterTypeSchema = Schema.Literals([
  "template",
  "boolean",
  "integer",
  "list",
  "map",
  "triggerReference",
  "tagReference",
  "typeUnspecified",
]);
export type ParameterType = Schema.Schema.Type<typeof ParameterTypeSchema>;

export interface Parameter {
  readonly type: ParameterType;
  readonly key?: string;
  readonly value?: string;
  readonly list?: readonly Parameter[];
  readonly map?: readonly Parameter[];
  readonly isWeakReference?: boolean;
}

export const ParameterSchema: Schema.Schema<Parameter> = Schema.suspend(() =>
  Schema.Struct({
    type: ParameterTypeSchema,
    key: Schema.optional(Schema.String),
    value: Schema.optional(Schema.String),
    list: Schema.optional(Schema.Array(ParameterSchema)),
    map: Schema.optional(Schema.Array(ParameterSchema)),
    isWeakReference: Schema.optional(Schema.Boolean),
  }),
) as Schema.Schema<Parameter>;

export const ConditionSchema = Schema.Struct({
  type: Schema.String,
  parameter: Schema.Array(ParameterSchema),
});
export type Condition = Schema.Schema.Type<typeof ConditionSchema>;

export const SetupTagSchema = Schema.Struct({
  tagName: Schema.String,
  stopOnSetupFailure: Schema.optional(Schema.Boolean),
});
export type SetupTag = Schema.Schema.Type<typeof SetupTagSchema>;

export const TeardownTagSchema = Schema.Struct({
  tagName: Schema.String,
  stopTeardownOnFailure: Schema.optional(Schema.Boolean),
});
export type TeardownTag = Schema.Schema.Type<typeof TeardownTagSchema>;

export const ConsentSettingsSchema = Schema.Struct({
  consentStatus: Schema.optional(Schema.Literals(["notSet", "notNeeded", "needed"])),
  consentType: Schema.optional(ParameterSchema),
});
export type ConsentSettings = Schema.Schema.Type<typeof ConsentSettingsSchema>;

const tagWritableFields = {
  name: Schema.String,
  type: Schema.String,
  parameter: Schema.optional(Schema.Array(ParameterSchema)),
  firingTriggerId: Schema.optional(Schema.Array(Schema.String)),
  blockingTriggerId: Schema.optional(Schema.Array(Schema.String)),
  setupTag: Schema.optional(Schema.Array(SetupTagSchema)),
  teardownTag: Schema.optional(Schema.Array(TeardownTagSchema)),
  parentFolderId: Schema.optional(Schema.String),
  tagFiringOption: Schema.optional(
    Schema.Literals(["oncePerEvent", "oncePerLoad", "unlimited", "tagFiringOptionUnspecified"]),
  ),
  paused: Schema.optional(Schema.Boolean),
  notes: Schema.optional(Schema.String),
  scheduleStartMs: Schema.optional(Schema.String),
  scheduleEndMs: Schema.optional(Schema.String),
  liveOnly: Schema.optional(Schema.Boolean),
  priority: Schema.optional(ParameterSchema),
  consentSettings: Schema.optional(ConsentSettingsSchema),
  monitoringMetadata: Schema.optional(ParameterSchema),
  monitoringMetadataTagNameKey: Schema.optional(Schema.String),
  fingerprint: Schema.optional(Schema.String),
};

export const TagSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  workspaceId: Schema.String,
  tagId: Schema.String,
  ...tagWritableFields,
  tagManagerUrl: Schema.optional(Schema.String),
});
export type Tag = Schema.Schema.Type<typeof TagSchema>;

const triggerWritableFields = {
  name: Schema.String,
  type: Schema.String,
  parameter: Schema.optional(Schema.Array(ParameterSchema)),
  filter: Schema.optional(Schema.Array(ConditionSchema)),
  customEventFilter: Schema.optional(Schema.Array(ConditionSchema)),
  autoEventFilter: Schema.optional(Schema.Array(ConditionSchema)),
  parentFolderId: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  waitForTags: Schema.optional(ParameterSchema),
  checkValidation: Schema.optional(ParameterSchema),
  waitForTagsTimeout: Schema.optional(ParameterSchema),
  uniqueTriggerId: Schema.optional(ParameterSchema),
  eventName: Schema.optional(ParameterSchema),
  interval: Schema.optional(ParameterSchema),
  limit: Schema.optional(ParameterSchema),
  selector: Schema.optional(ParameterSchema),
  intervalSeconds: Schema.optional(ParameterSchema),
  maxTimerLengthSeconds: Schema.optional(ParameterSchema),
  verticalScrollPercentageList: Schema.optional(ParameterSchema),
  horizontalScrollPercentageList: Schema.optional(ParameterSchema),
  visibilitySelector: Schema.optional(ParameterSchema),
  visiblePercentageMin: Schema.optional(ParameterSchema),
  visiblePercentageMax: Schema.optional(ParameterSchema),
  continuousTimeMinMilliseconds: Schema.optional(ParameterSchema),
  totalTimeMinMilliseconds: Schema.optional(ParameterSchema),
  fingerprint: Schema.optional(Schema.String),
};

export const TriggerSchemaStruct = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  workspaceId: Schema.String,
  triggerId: Schema.String,
  ...triggerWritableFields,
  tagManagerUrl: Schema.optional(Schema.String),
});
export type Trigger = Schema.Schema.Type<typeof TriggerSchemaStruct>;
export const TriggerSchema = TriggerSchemaStruct;

export const TagDraftSchema = Schema.Struct(tagWritableFields);
export type TagDraft = Schema.Schema.Type<typeof TagDraftSchema>;

export const TriggerDraftSchema = Schema.Struct(triggerWritableFields);
export type TriggerDraft = Schema.Schema.Type<typeof TriggerDraftSchema>;

export const ListTagsResponseSchema = Schema.Struct({
  tag: Schema.optional(Schema.Array(TagSchema)),
  nextPageToken: Schema.optional(Schema.String),
});
export type ListTagsResponse = Schema.Schema.Type<typeof ListTagsResponseSchema>;

export const ListTriggersResponseSchema = Schema.Struct({
  trigger: Schema.optional(Schema.Array(TriggerSchema)),
  nextPageToken: Schema.optional(Schema.String),
});
export type ListTriggersResponse = Schema.Schema.Type<typeof ListTriggersResponseSchema>;

// Variables / Folders

export const VariableFormatValueSchema = Schema.Struct({
  caseConversionType: Schema.optional(Schema.Literals(["none", "lowercase", "uppercase"])),
  convertNullToValue: Schema.optional(ParameterSchema),
  convertUndefinedToValue: Schema.optional(ParameterSchema),
  convertTrueToValue: Schema.optional(ParameterSchema),
  convertFalseToValue: Schema.optional(ParameterSchema),
  convertToBoolean: Schema.optional(Schema.Boolean),
  convertToNumber: Schema.optional(
    Schema.Literals(["decimalSeparatorTypeUnspecified", "period", "comma", "automatic"]),
  ),
});
export type VariableFormatValue = Schema.Schema.Type<typeof VariableFormatValueSchema>;

const variableWritableFields = {
  name: Schema.String,
  type: Schema.String,
  parameter: Schema.optional(Schema.Array(ParameterSchema)),
  parentFolderId: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  scheduleStartMs: Schema.optional(Schema.String),
  scheduleEndMs: Schema.optional(Schema.String),
  formatValue: Schema.optional(VariableFormatValueSchema),
  enablingTriggerId: Schema.optional(Schema.Array(Schema.String)),
  disablingTriggerId: Schema.optional(Schema.Array(Schema.String)),
  fingerprint: Schema.optional(Schema.String),
};

export const VariableSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  workspaceId: Schema.String,
  variableId: Schema.String,
  ...variableWritableFields,
  tagManagerUrl: Schema.optional(Schema.String),
});
export type Variable = Schema.Schema.Type<typeof VariableSchema>;

export const VariableDraftSchema = Schema.Struct(variableWritableFields);
export type VariableDraft = Schema.Schema.Type<typeof VariableDraftSchema>;

export const ListVariablesResponseSchema = Schema.Struct({
  variable: Schema.optional(Schema.Array(VariableSchema)),
  nextPageToken: Schema.optional(Schema.String),
});
export type ListVariablesResponse = Schema.Schema.Type<typeof ListVariablesResponseSchema>;

const folderWritableFields = {
  name: Schema.String,
  notes: Schema.optional(Schema.String),
  fingerprint: Schema.optional(Schema.String),
};

export const FolderSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  workspaceId: Schema.String,
  folderId: Schema.String,
  ...folderWritableFields,
  tagManagerUrl: Schema.optional(Schema.String),
});
export type Folder = Schema.Schema.Type<typeof FolderSchema>;

export const FolderDraftSchema = Schema.Struct(folderWritableFields);
export type FolderDraft = Schema.Schema.Type<typeof FolderDraftSchema>;

export const ListFoldersResponseSchema = Schema.Struct({
  folder: Schema.optional(Schema.Array(FolderSchema)),
  nextPageToken: Schema.optional(Schema.String),
});
export type ListFoldersResponse = Schema.Schema.Type<typeof ListFoldersResponseSchema>;

// Versions

export const ContainerVersionHeaderSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  containerVersionId: Schema.String,
  name: Schema.optional(Schema.String),
  deleted: Schema.optional(Schema.Boolean),
  numTags: Schema.optional(Schema.String),
  numTriggers: Schema.optional(Schema.String),
  numVariables: Schema.optional(Schema.String),
});
export type ContainerVersionHeader = Schema.Schema.Type<typeof ContainerVersionHeaderSchema>;

export const ContainerVersionSchema = Schema.Struct({
  path: Schema.String,
  accountId: Schema.String,
  containerId: Schema.String,
  containerVersionId: Schema.String,
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  fingerprint: Schema.optional(Schema.String),
  tagManagerUrl: Schema.optional(Schema.String),
  container: Schema.optional(ContainerSchema),
  tag: Schema.optional(Schema.Array(TagSchema)),
  trigger: Schema.optional(Schema.Array(TriggerSchema)),
  variable: Schema.optional(Schema.Array(VariableSchema)),
  folder: Schema.optional(Schema.Array(FolderSchema)),
});
export type ContainerVersion = Schema.Schema.Type<typeof ContainerVersionSchema>;

export const CreateContainerVersionRequestVersionOptionsSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
});
export type CreateContainerVersionRequestVersionOptions = Schema.Schema.Type<
  typeof CreateContainerVersionRequestVersionOptionsSchema
>;

export const CreateContainerVersionResponseSchema = Schema.Struct({
  containerVersion: Schema.optional(ContainerVersionSchema),
  compilerError: Schema.optional(Schema.Boolean),
  syncStatus: Schema.optional(
    Schema.Struct({
      syncError: Schema.optional(Schema.Boolean),
      mergeConflict: Schema.optional(Schema.Boolean),
    }),
  ),
  newWorkspacePath: Schema.optional(Schema.String),
});
export type CreateContainerVersionResponse = Schema.Schema.Type<
  typeof CreateContainerVersionResponseSchema
>;

export const GetWorkspaceStatusResponseSchema = Schema.Struct({
  workspaceChange: Schema.optional(
    Schema.Array(
      Schema.Struct({
        type: Schema.optional(Schema.String),
        resource: Schema.optional(Schema.Unknown),
      }),
    ),
  ),
  mergeConflict: Schema.optional(Schema.Array(Schema.Unknown)),
});
export type GetWorkspaceStatusResponse = Schema.Schema.Type<
  typeof GetWorkspaceStatusResponseSchema
>;

export const ListContainerVersionsResponseSchema = Schema.Struct({
  containerVersionHeader: Schema.optional(Schema.Array(ContainerVersionHeaderSchema)),
  nextPageToken: Schema.optional(Schema.String),
});
export type ListContainerVersionsResponse = Schema.Schema.Type<
  typeof ListContainerVersionsResponseSchema
>;

export const PublishContainerVersionResponseSchema = Schema.Struct({
  containerVersion: Schema.optional(ContainerVersionSchema),
  compilerError: Schema.optional(Schema.Boolean),
});
export type PublishContainerVersionResponse = Schema.Schema.Type<
  typeof PublishContainerVersionResponseSchema
>;
