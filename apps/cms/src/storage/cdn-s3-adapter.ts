import { s3Storage } from "@payloadcms/storage-s3";
import type { S3StorageOptions } from "@payloadcms/storage-s3";

export const cdnS3Storage = (storageOptions: S3StorageOptions) => {
  return s3Storage(storageOptions);
};
