import { parseQuestionScript } from './parser';

describe('parseQuestionScript', () => {
    it('parses pools, acts, translations, tag requirements and end conditions', () => {
        const src = `
# blind date script
pool greetings random
  - How are you today?
    sv = Hur mår du idag?
    de = Wie geht es dir heute?
  - Where are you from?
    self = curious

pool deep sequential
  - What's something you're proud of?
    self = open, brave
    partner = open
  - What scares you?

act warmup
  end = 3m
  use greetings

act main
  end = 4 questions
  use deep
    self = deep
    partner = deep
`;
        const { script, errors } = parseQuestionScript(src);
        expect(errors).toEqual([]);
        expect(script.pools).toHaveLength(2);
        expect(script.pools[0]).toEqual({
            name: 'greetings',
            mode: 'random',
            questions: [
                {
                    defaultText: 'How are you today?',
                    translations: [
                        { locale: 'sv', title: 'Hur mår du idag?' },
                        { locale: 'de', title: 'Wie geht es dir heute?' },
                    ],
                    requires: { self: [], partner: [] },
                },
                {
                    defaultText: 'Where are you from?',
                    translations: [],
                    requires: { self: ['curious'], partner: [] },
                },
            ],
        });
        expect(script.pools[1].mode).toBe('sequential');
        expect(script.pools[1].questions[0].requires).toEqual({
            self: ['open', 'brave'],
            partner: ['open'],
        });
        expect(script.acts).toHaveLength(2);
        expect(script.acts[0].end).toEqual({ durationSeconds: 180 });
        expect(script.acts[1].end).toEqual({ questionCount: 4 });
        expect(script.acts[1].sources[0]).toEqual({
            poolName: 'deep',
            requires: { self: ['deep'], partner: ['deep'] },
        });
    });

    it('reports unknown directives, end conditions and missing pool references', () => {
        const src = `
nonsense
pool p1 random
  - q1
act a1
  end = ten years
  use unknown
`;
        const { errors } = parseQuestionScript(src);
        const messages = errors.map((e) => e.message);
        expect(messages.some((m) => m.includes('Unknown top-level directive'))).toBe(true);
        expect(messages.some((m) => m.includes('Invalid end condition'))).toBe(true);
        expect(messages.some((m) => m.includes('unknown pool "unknown"'))).toBe(true);
        expect(messages.some((m) => m.includes('has no end condition'))).toBe(true);
    });

    it('supports h / m / s duration suffixes and bare numbers as question counts', () => {
        const { script: s1 } = parseQuestionScript('pool p random\n  - q\nact a\n  end = 1h\n  use p\n');
        expect(s1.acts[0].end).toEqual({ durationSeconds: 3600 });
        const { script: s2 } = parseQuestionScript('pool p random\n  - q\nact a\n  end = 30s\n  use p\n');
        expect(s2.acts[0].end).toEqual({ durationSeconds: 30 });
        const { script: s3 } = parseQuestionScript('pool p random\n  - q\nact a\n  end = 5\n  use p\n');
        expect(s3.acts[0].end).toEqual({ questionCount: 5 });
    });

    it('rejects duplicate pool/act names', () => {
        const { errors } = parseQuestionScript(`
pool p random
  - q
pool p sequential
  - q
act a
  end = 1m
  use p
act a
  end = 1m
  use p
`);
        expect(errors.some((e) => e.message.includes('Duplicate pool'))).toBe(true);
        expect(errors.some((e) => e.message.includes('Duplicate act'))).toBe(true);
    });

    it('treats # as comment-to-end-of-line', () => {
        const { script, errors } = parseQuestionScript(`
# header
pool p random   # inline comment
  - hello       # trailing
act a
  end = 1m
  use p
`);
        expect(errors).toEqual([]);
        expect(script.pools[0].questions[0].defaultText).toBe('hello');
    });
});
