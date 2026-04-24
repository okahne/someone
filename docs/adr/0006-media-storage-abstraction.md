# 0006: Media Storage Abstraction

**Status:** Accepted

## Context

The product stores meeting-spot images and (optionally, after consent) single profile pictures. In development the team needs a zero-setup local storage backend; in deployed environments storage will eventually move to an object store (S3, GCS, R2, MinIO). Persisting binaries in Postgres is rejected for cost and operational reasons.

## Decision

- **Database role:** Postgres holds metadata only (`MeetingSpotImage.storageKey`, `SingleSession.profileImageKey`). Binary content is never stored in Postgres.
- **Abstraction:** a `StorageAdapter` interface in `apps/backend/src/modules/storage/storage.adapter.ts`:
  ```ts
  interface StorageAdapter {
    put(key: string, data: Buffer, contentType: string): Promise<void>;
    get(key: string): Promise<{ data: Buffer; contentType: string }>;
    getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
    delete(key: string): Promise<void>;
  }
  ```
- **Development adapter:** `LocalFileStorageAdapter` writes under `./uploads/` (mounted as a Docker volume). `getSignedUrl` returns a backend-served URL routed through a thin signed-token controller; no third-party signing.
- **Deployed adapter:** an `S3StorageAdapter` (AWS SDK v3) is the default expected production binding. Selection is driven by environment configuration (`STORAGE_DRIVER=local|s3`) wired in the storage module's `useFactory`.
- **Key scheme:** `<entity>/<entityId>/<uuid>.<ext>` (e.g. `meeting-spot/<spotId>/<uuid>.jpg`). Keys are opaque to the database; only the storage layer parses them.
- **Validation:** controllers validate MIME type (allowlist: `image/jpeg`, `image/png`, `image/webp`) and size (max 5 MB) before delegating to the adapter. Frontend performs the same validation pre-upload but the server is authoritative.
- **Consent gate:** profile picture uploads require `profileImageConsent === true` on the request body; the adapter is never called without this check.
- **Lifecycle:** spot images are hard-deleted from storage when the spot is archived. Profile images are deleted on account deletion. Orphan reaping is acceptable but not required for MVP.

## Consequences

- Local development needs no cloud credentials; new contributors are productive immediately.
- Swapping storage backend in deployed environments is a configuration change plus an adapter implementation, with no domain-code impact.
- Signed URLs are an interface-level concern even in local dev, so frontend code does not branch on environment.
- Orphan files in storage are possible if a delete partially fails; an out-of-band reaper job is a future enhancement.
