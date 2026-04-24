# 0005: Matching Engine Wrapper

**Status:** Accepted

## Context

Scheduled matching calls require a maximum-cardinality matching over a non-bipartite compatibility graph (singles within the same pool, where each pair is either compatible or not). Edmonds's Blossom algorithm is the standard polynomial-time algorithm for this problem. Implementing it correctly from scratch is risky; we want a vetted library, but we also need a stable internal interface so we can swap implementations without churn.

## Decision

- **Library:** [`blossom`](https://www.npmjs.com/package/blossom) npm package (or equivalent maintained Edmonds implementation). Final library choice is made at task M5-T02 based on maintenance status at implementation time; the wrapper interface below is library-independent.
- **Wrapper module:** `apps/backend/src/modules/matches/matching/blossom.service.ts` exposes a single method:
  ```ts
  computeMatching(graph: CompatibilityGraph): MatchingResult;
  ```
  where `CompatibilityGraph` is `{ nodes: SessionId[]; edges: Array<[SessionId, SessionId]> }` and `MatchingResult` is `{ pairs: Array<[SessionId, SessionId]>; unmatched: SessionId[] }`.
- **Graph preparation:** a separate `CompatibilityService` builds the graph from the booked singles list:
  1. Filter to singles in the target pool with state `BOOKED`.
  2. For each unordered pair, evaluate bidirectional tag compatibility (A's tags satisfy B's mandatory set AND vice versa).
  3. If `pool.allowRematch === false`, drop edges for any pair that has a prior `MatchLog` in the same pool.
- **Randomisation:** the input node order is shuffled with a per-run seed before being passed to the Blossom solver. This avoids deterministic biases in the chosen maximum matching when multiple maxima exist. The seed is logged with the `MatchRun` for reproducibility in incident review.
- **Pure function:** the wrapper is pure (no I/O, no globals). All side effects (spot reservation, state transitions, persistence) happen in the orchestrating `ScheduledCallJob` after the wrapper returns.
- **Test surface:**
  - Unit tests cover: even node count, odd node count, no edges, fully connected graph, single-edge graph, rematch-edge removal.
  - Property tests assert that the returned matching is valid (no shared endpoints) and is at most ⌊n/2⌋ pairs.

## Consequences

- The orchestration layer is testable independently of the algorithm: feed it a stub `MatchingResult` and assert downstream behaviour (spot reservation, state transitions, audit emission).
- Swapping the underlying library later is a one-file change as long as the new library can implement `computeMatching`.
- Randomisation makes match outcomes irreproducible by default; the per-run seed mitigates this for forensics.
- Performance ceiling is the Blossom implementation's; we expect MVP pool sizes well within its tractable range (hundreds of singles per call).
