// Tag Manager v2 discovery document revision: 2025-03-06 (Last updated)
// Verified against https://tagmanager.googleapis.com/$discovery/rest?version=v2

export type Account = {
  path: string;
  accountId: string;
  name: string;
  tagManagerUrl: string;
  fingerprint?: string;
  // Read-only (returned by get/list, not sent on create/update)
  shareData?: boolean;
  features?: AccountFeatures;
};

export type AccountFeatures = {
  supportUserPermissions?: boolean;
  supportMultipleContainers?: boolean;
};

export type ContainerUsageContext = "WEB" | "ANDROID" | "IOS" | (string & {});

export type ContainerFeatures = {
  supportUserPermissions?: boolean;
  supportEnvironments?: boolean;
  supportWorkspaces?: boolean;
  supportGtagConfigs?: boolean;
  supportBuiltInVariables?: boolean;
  supportClients?: boolean;
  supportFolders?: boolean;
  supportTags?: boolean;
  supportTemplates?: boolean;
  supportTriggers?: boolean;
  supportVariables?: boolean;
  supportVersions?: boolean;
  supportZones?: boolean;
  supportTransformations?: boolean;
};

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
  // Read-only (returned by get/list)
  tagIds?: string[];
  features?: ContainerFeatures;
  taggingServerUrls?: string[];
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

// Discovery list envelopes (paginated)
export type ListContainersResponse = {
  container?: Container[];
  nextPageToken?: string;
};

export type ListWorkspacesResponse = {
  workspace?: Workspace[];
  nextPageToken?: string;
};

// ---------------------------------------------------------------------------
// Tags + Triggers
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
  autoEventFilter?: Condition[];
  fingerprint?: string;
  parentFolderId?: string;
  notes?: string;
  tagManagerUrl?: string;
  // Trigger-type-specific Parameter fields (all optional, validated server-side per type)
  waitForTags?: Parameter;
  checkValidation?: Parameter;
  waitForTagsTimeout?: Parameter;
  uniqueTriggerId?: Parameter;
  eventName?: Parameter;
  interval?: Parameter;
  limit?: Parameter;
  selector?: Parameter;
  intervalSeconds?: Parameter;
  maxTimerLengthSeconds?: Parameter;
  verticalScrollPercentageList?: Parameter;
  horizontalScrollPercentageList?: Parameter;
  visibilitySelector?: Parameter;
  visiblePercentageMin?: Parameter;
  visiblePercentageMax?: Parameter;
  continuousTimeMinMilliseconds?: Parameter;
  totalTimeMinMilliseconds?: Parameter;
};

export type ListTagsResponse = {
  tag?: Tag[];
  nextPageToken?: string;
};

export type ListTriggersResponse = {
  trigger?: Trigger[];
  nextPageToken?: string;
};
