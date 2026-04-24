# 0002: ORM and Migration Strategy

**Status:** Accepted

## Context

The backend needs typed database access, a deterministic migration workflow, and a schema source that maps cleanly to `docs/data-model.md`. Candidates considered: Prisma, TypeORM, MikroORM, Drizzle, raw SQL with a query builder.

## Decision

- **ORM:** [Prisma](https://www.prisma.io/) (`@prisma/client`).
- **Schema source of truth:** `apps/backend/prisma/schema.prisma`. The schema is regenerated against `docs/data-model.md` whenever the data model changes; drift is caught in the M6 documentation consistency pass.
- **Migration tooling:** `prisma migrate dev --name <change>` for development, `prisma migrate deploy` for any non-development environment.
- **Migration files:** committed to source control. Once merged to main they are immutable. New changes are added as new migrations; never edit an existing migration file.
- **Backwards-compatible migration policy:** destructive changes (column drop, type narrowing, NOT NULL on existing nullable column) require a multi-step migration:
  1. Add new column / table / constraint as nullable or default.
  2. Backfill data in a migration or scheduled job.
  3. Remove or tighten the old shape in a follow-up migration after deploys are stable.
- **Seed:** `apps/backend/prisma/seed.ts` is idempotent (upsert by stable IDs) and is invoked via `prisma db seed`.
- **Forbidden:** `prisma db push` against any shared environment (dev DB shared between developers, staging, production). Local-only sandbox use is acceptable.
- **Naming:** snake_case columns and tables (mapped via `@map` / `@@map`); model names PascalCase, fields camelCase.

## Consequences

- Strong typing across the backend with generated client; eliminates a class of runtime field-name bugs.
- Clear migration history readable in source control.
- Multi-step destructive migrations slow down breaking changes intentionally — this is desirable for a multi-tenant production system.
- Team must learn Prisma's relational query patterns; raw SQL escape hatch is available via `$queryRaw` for performance-critical paths.
