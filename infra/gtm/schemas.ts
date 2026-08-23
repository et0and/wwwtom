// Tag Manager v2 discovery document revision pinned: 20260817
// Hand-written types derived from the discovery doc; deliberately minimal for
// ticket 1 (Account / Container / Workspace). Later tickets extend this file.

export type Account = {
  path: string;
  accountId: string;
  name: string;
  tagManagerUrl: string;
  fingerprint?: string;
};

export type ContainerUsageContext = "WEB" | "ANDROID" | "IOS" | (string & {});

export type Container = {
  path: string;
  accountId: string;
  containerId: string;
  name: string;
  domainName?: string[];
  publicId?: string;
  usageContext?: ContainerUsageContext[];
  fingerprint?: string;
  tagManagerUrl?: string;
  notes?: string;
};

export type Workspace = {
  path: string;
  accountId: string;
  containerId: string;
  workspaceId: string;
  name: string;
  description?: string;
  fingerprint?: string;
  tagManagerUrl?: string;
};

// Discovery list envelopes
export type ListContainersResponse = {
  container?: Container[];
};

export type ListWorkspacesResponse = {
  workspace?: Workspace[];
};

// ---------------------------------------------------------------------------
// Ticket 2: Tags + Triggers
// ---------------------------------------------------------------------------

export type ParameterType =
  | "template"
  | "boolean"
  | "integer"
  | "list"
  | "map"
  | "triggerReference"
  | "tagReference"
  | "typeUnspecified";

export type Parameter = {
  type: ParameterType;
  key?: string;
  value?: string;
  list?: Parameter[];
  map?: Parameter[];
  isWeakReference?: boolean;
};

export type Condition = {
  type: string;
  parameter: Parameter[];
};

export type SetupTag = {
  tagName: string;
  stopOnSetupFailure?: boolean;
};

export type TeardownTag = {
  tagName: string;
  stopTeardownOnFailure?: boolean;
};

export type ConsentSettings = {
  consentStatus?: "notSet" | "notNeeded" | "needed";
  consentType?: Parameter;
};

export type Tag = {
  path: string;
  accountId: string;
  containerId: string;
  workspaceId: string;
  tagId: string;
  name: string;
  type: string;
  parameter?: Parameter[];
  fingerprint?: string;
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
  setupTag?: SetupTag[];
  teardownTag?: TeardownTag[];
  parentFolderId?: string;
  tagFiringOption?: "oncePerEvent" | "oncePerLoad" | "unlimited" | "tagFiringOptionUnspecified";
  paused?: boolean;
  notes?: string;
  scheduleStartMs?: string;
  scheduleEndMs?: string;
  liveOnly?: boolean;
  priority?: Parameter;
  consentSettings?: ConsentSettings;
  monitoringMetadata?: Parameter;
  monitoringMetadataTagNameKey?: string;
  tagManagerUrl?: string;
};

export type Trigger = {
  path: string;
  accountId: string;
  containerId: string;
  workspaceId: string;
  triggerId: string;
  name: string;
  type: string;
  parameter?: Parameter[];
  filter?: Condition[];
  customEventFilter?: Condition[];
  fingerprint?: string;
  parentFolderId?: string;
  notes?: string;
  tagManagerUrl?: string;
};

export type ListTagsResponse = {
  tag?: Tag[];
};

export type ListTriggersResponse = {
  trigger?: Trigger[];
};
