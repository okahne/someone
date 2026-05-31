import { parseQuestionScript } from './parser';
import { initSelectorState, nextQuestion, SelectorContext } from './selector';

const ctx = (partial: Partial<SelectorContext> = {}): SelectorContext => ({
    selfTags: [],
    partnerTags: [],
    poolTimeLimitSeconds: null,
    ...partial,
});

describe('nextQuestion selector', () => {
    it('returns sequential questions in declaration order and ends the act at the count limit', () => {
        const { script } = parseQuestionScript(`
pool seq sequential
  - q1
  - q2
  - q3
act a
  end = 2 questions
  use seq
`);
        let state = initSelectorState();
        const r1 = nextQuestion(script, state, ctx());
        expect(r1.kind).toBe('question');
        if (r1.kind !== 'question') return;
        expect(r1.pick.question.defaultText).toBe('q1');
        state = r1.state;

        const r2 = nextQuestion(script, state, ctx());
        expect(r2.kind).toBe('question');
        if (r2.kind !== 'question') return;
        expect(r2.pick.question.defaultText).toBe('q2');
        state = r2.state;

        const r3 = nextQuestion(script, state, ctx());
        expect(r3.kind).toBe('done');
    });

    it('picks random questions and never repeats within a meeting', () => {
        const { script } = parseQuestionScript(`
pool r random
  - a
  - b
  - c
act only
  end = 3 questions
  use r
`);
        let state = initSelectorState();
        const seen: string[] = [];
        for (let i = 0; i < 3; i++) {
            const result = nextQuestion(script, state, ctx(), () => 0.5);
            expect(result.kind).toBe('question');
            if (result.kind !== 'question') return;
            seen.push(result.pick.question.defaultText);
            state = result.state;
        }
        expect(new Set(seen).size).toBe(3);
    });

    it('filters questions by self and partner tags (per-question and act-level)', () => {
        const { script } = parseQuestionScript(`
pool p sequential
  - open question
    self = open
  - safe question
act a
  end = 2 questions
  use p
    partner = trusted
`);
        // Single has "open"; partner lacks "trusted" → only the safe question
        // is reachable, but the act source itself requires partner trusted,
        // so nothing is eligible at all.
        let state = initSelectorState();
        const r = nextQuestion(script, state, ctx({ selfTags: ['open'], partnerTags: [] }));
        expect(r.kind).toBe('done');

        // Same single, partner trusted → both candidates available; act
        // source adds partner=trusted, question 1 adds self=open. Both pass.
        state = initSelectorState();
        const r2 = nextQuestion(script, state, ctx({ selfTags: ['open'], partnerTags: ['trusted'] }));
        expect(r2.kind).toBe('question');
    });

    it('advances to the next act when the current act has no eligible questions', () => {
        const { script } = parseQuestionScript(`
pool first sequential
  - locked
    self = vip
pool second sequential
  - hello
act warmup
  end = 1 questions
  use first
act main
  end = 1 questions
  use second
`);
        const state = initSelectorState();
        const r1 = nextQuestion(script, state, ctx({ selfTags: [] }));
        expect(r1.kind).toBe('act-end');
        if (r1.kind !== 'act-end') return;
        const r2 = nextQuestion(script, r1.state, ctx({ selfTags: [] }));
        expect(r2.kind).toBe('question');
        if (r2.kind !== 'question') return;
        expect(r2.pick.actName).toBe('main');
    });

    it('honours the pool time limit and never overrides it from the script', () => {
        const { script } = parseQuestionScript(`
pool p sequential
  - a
  - b
  - c
act long
  end = 1h
  use p
`);
        const state = initSelectorState();
        // 60 minute act, but the singles-pool limits the date to 10 minutes
        // — the selector must report `done` once we reach the cap.
        const overTimeState = { ...state, elapsedSeconds: 600 };
        const r = nextQuestion(script, overTimeState, ctx({ poolTimeLimitSeconds: 600 }));
        expect(r.kind).toBe('done');
        if (r.kind !== 'done') return;
        expect(r.reason).toBe('time-limit');
    });

    it('ends the act when the duration is exceeded', () => {
        const { script } = parseQuestionScript(`
pool p sequential
  - a
  - b
act short
  end = 30s
  use p
`);
        const state = { ...initSelectorState(), actElapsedSeconds: 35 };
        const r = nextQuestion(script, state, ctx());
        expect(r.kind).toBe('done'); // only one act, so done after end
    });
});
