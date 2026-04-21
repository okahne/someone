# Documentation Index

## Requirements

- [Specification](./specification.md) — canonical product and system requirements

## Planning

- [Implementation Backlog](./implementation-plan.md) — milestone-by-milestone ticket backlog
- [Architecture Plan](./architecture-plan.md) — system boundaries and early design decisions
- [Testing and Quality Plan](./testing-plan.md) — quality strategy and release gates

## Reference

- [Data Model](./data-model.md) — all entities, relationships, indexes, enums, and retention rules
- [API Reference](./api.md) — REST endpoint contracts and WebSocket protocol
- [Code Standards](./code-standards.md) — TypeScript, tooling, naming, and process conventions

## ADRs

Architectural Decision Records live under `docs/adr/`. The following are required before development begins (see M1 in the implementation backlog):

- `0001-auth-session-model.md`
- `0002-orm-and-migration-strategy.md`
- `0003-websocket-event-conventions.md`
- `0004-background-job-framework.md`
- `0005-matching-engine-wrapper.md`
- `0006-media-storage-abstraction.md`