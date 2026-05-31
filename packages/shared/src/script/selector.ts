import {
    ParsedAct,
    ParsedActSource,
    ParsedQuestion,
    ParsedQuestionPool,
    ParsedQuestionScript,
    TagRequirement,
} from './types';

export interface SelectorState {
    /** Index of the act currently running (0-based). */
    actIndex: number;
    /** Number of questions asked so far in the current act. */
    askedInAct: number;
    /** Total elapsed seconds since the meeting started. */
    elapsedSeconds: number;
    /** Seconds elapsed since the current act started. */
    actElapsedSeconds: number;
    /** Question ids (`"<pool>:<index>"`) already asked in this meeting. */
    asked: string[];
}

export interface SelectorContext {
    selfTags: string[];
    partnerTags: string[];
    /**
     * Hard cap from the singles-pool's `meetingTimeLimitMinutes`. A script
     * NEVER overrides this; once we hit it the selector returns `done`.
     */
    poolTimeLimitSeconds: number | null;
}

export interface PickedQuestion {
    actName: string;
    poolName: string;
    questionIndex: number;
    question: ParsedQuestion;
    id: string;
}

export type SelectorResult =
    | { kind: 'question'; pick: PickedQuestion; state: SelectorState }
    | { kind: 'act-end'; nextActIndex: number; state: SelectorState }
    | { kind: 'done'; reason: 'script-finished' | 'time-limit'; state: SelectorState };

export function initSelectorState(): SelectorState {
    return { actIndex: 0, askedInAct: 0, elapsedSeconds: 0, actElapsedSeconds: 0, asked: [] };
}

function tagsSatisfied(req: TagRequirement, ctx: SelectorContext): boolean {
    const selfOk = req.self.every((t) => ctx.selfTags.includes(t));
    const partnerOk = req.partner.every((t) => ctx.partnerTags.includes(t));
    return selfOk && partnerOk;
}

function combinedRequires(q: ParsedQuestion, s: ParsedActSource): TagRequirement {
    return {
        self: Array.from(new Set([...q.requires.self, ...s.requires.self])),
        partner: Array.from(new Set([...q.requires.partner, ...s.requires.partner])),
    };
}

interface Candidate { pick: PickedQuestion; sourceIndex: number; }

function eligibleQuestionsForAct(
    act: ParsedAct,
    poolsByName: Map<string, ParsedQuestionPool>,
    ctx: SelectorContext,
    askedIds: Set<string>,
): Candidate[] {
    const out: Candidate[] = [];
    for (let si = 0; si < act.sources.length; si++) {
        const src = act.sources[si];
        const pool = poolsByName.get(src.poolName);
        if (!pool) continue;
        for (let qi = 0; qi < pool.questions.length; qi++) {
            const q = pool.questions[qi];
            const id = `${pool.name}:${qi}`;
            if (askedIds.has(id)) continue;
            if (!tagsSatisfied(combinedRequires(q, src), ctx)) continue;
            out.push({
                sourceIndex: si,
                pick: { actName: act.name, poolName: pool.name, questionIndex: qi, question: q, id },
            });
        }
    }
    return out;
}

/**
 * Pick the next question (or signal act/script end). Pure function; the
 * caller persists `state` between calls.
 *
 * `rng` allows deterministic tests; defaults to `Math.random`.
 */
export function nextQuestion(
    script: ParsedQuestionScript,
    state: SelectorState,
    ctx: SelectorContext,
    rng: () => number = Math.random,
): SelectorResult {
    // Hard pool-level time cap — never overridden by the script.
    if (ctx.poolTimeLimitSeconds !== null && state.elapsedSeconds >= ctx.poolTimeLimitSeconds) {
        return { kind: 'done', reason: 'time-limit', state };
    }
    if (state.actIndex >= script.acts.length) {
        return { kind: 'done', reason: 'script-finished', state };
    }

    const act = script.acts[state.actIndex];
    const durOver = act.end.durationSeconds !== undefined && state.actElapsedSeconds >= act.end.durationSeconds;
    const countOver = act.end.questionCount !== undefined && state.askedInAct >= act.end.questionCount;
    if (durOver || countOver) {
        const next = state.actIndex + 1;
        const nextState: SelectorState = {
            ...state,
            actIndex: next,
            askedInAct: 0,
            actElapsedSeconds: 0,
        };
        if (next >= script.acts.length) {
            return { kind: 'done', reason: 'script-finished', state: nextState };
        }
        return { kind: 'act-end', nextActIndex: next, state: nextState };
    }

    const poolsByName = new Map(script.pools.map((p) => [p.name, p]));
    const askedIds = new Set(state.asked);
    const candidates = eligibleQuestionsForAct(act, poolsByName, ctx, askedIds);

    if (candidates.length === 0) {
        // No question fits — skip to next act.
        const nextIdx = state.actIndex + 1;
        const nextState: SelectorState = { ...state, actIndex: nextIdx, askedInAct: 0, actElapsedSeconds: 0 };
        if (nextIdx >= script.acts.length) {
            return { kind: 'done', reason: 'script-finished', state: nextState };
        }
        return { kind: 'act-end', nextActIndex: nextIdx, state: nextState };
    }

    let chosen: Candidate;
    // For each source: sequential picks the first eligible candidate from
    // that source in document order. Mixed-mode acts iterate sources in
    // declaration order: the first source with eligible questions wins.
    const firstSourceIdx = candidates[0].sourceIndex;
    const src = act.sources[firstSourceIdx];
    const pool = poolsByName.get(src.poolName)!;
    const fromThisSource = candidates.filter((c) => c.sourceIndex === firstSourceIdx);
    if (pool.mode === 'sequential') {
        fromThisSource.sort((a, b) => a.pick.questionIndex - b.pick.questionIndex);
        chosen = fromThisSource[0];
    } else {
        const idx = Math.floor(rng() * fromThisSource.length);
        chosen = fromThisSource[Math.min(idx, fromThisSource.length - 1)];
    }

    const nextState: SelectorState = {
        ...state,
        askedInAct: state.askedInAct + 1,
        asked: [...state.asked, chosen.pick.id],
    };
    return { kind: 'question', pick: chosen.pick, state: nextState };
}
