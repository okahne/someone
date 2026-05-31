import {
    ParsedAct,
    ParsedActSource,
    ParsedQuestion,
    ParsedQuestionPool,
    ParsedQuestionScript,
    QuestionSelectionMode,
    ScriptParseError,
    ScriptParseResult,
    TagRequirement,
} from './types';

/**
 * Parse the question-script DSL.
 *
 * Format (indentation-sensitive, 2 spaces per level):
 *
 *   # Comments start with #
 *
 *   pool <name> (random|sequential)
 *     - <question text>
 *       <locale> = <translated text>
 *       self    = tag1, tag2
 *       partner = tag3
 *
 *   act <name>
 *     end = 5m              # OR  end = 3 questions
 *     use <pool-name>
 *       self    = tag1
 *       partner = tag2
 *
 * The parser is lenient: it collects every problem it finds into
 * `result.errors` instead of throwing, so callers can present all issues at
 * once. A best-effort `script` is always returned.
 */
export function parseQuestionScript(source: string): ScriptParseResult {
    const errors: ScriptParseError[] = [];
    const pools: ParsedQuestionPool[] = [];
    const acts: ParsedAct[] = [];

    const rawLines = source.split(/\r?\n/);

    type Ctx =
        | { kind: 'none' }
        | { kind: 'pool'; pool: ParsedQuestionPool; question?: ParsedQuestion }
        | { kind: 'act'; act: ParsedAct; source?: ParsedActSource };
    let ctx: Ctx = { kind: 'none' };

    const err = (line: number, message: string): void => {
        errors.push({ line, message });
    };

    const RESERVED_KEYS = new Set(['self', 'partner', 'end', 'use']);
    const LOCALE_RE = /^[a-z]{2}(?:-[a-zA-Z0-9]{2,8})?$/;

    const parseTagList = (value: string): string[] =>
        value
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

    const emptyRequires = (): TagRequirement => ({ self: [], partner: [] });

    const parseEnd = (line: number, raw: string): ParsedAct['end'] | null => {
        const v = raw.trim().toLowerCase();
        const dur = /^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs)$/.exec(v);
        if (dur) {
            const n = Number(dur[1]);
            const unit = dur[2];
            const multiplier =
                unit.startsWith('h') ? 3600 :
                    unit.startsWith('m') ? 60 :
                        1;
            return { durationSeconds: n * multiplier };
        }
        const count = /^(\d+)\s*(questions?|q)?$/.exec(v);
        if (count) {
            return { questionCount: Number(count[1]) };
        }
        err(line, `Invalid end condition "${raw}". Use e.g. "5m", "30s", "1h", or "4 questions".`);
        return null;
    };

    for (let i = 0; i < rawLines.length; i++) {
        const rawLine = rawLines[i];
        const lineNo = i + 1;

        // Strip inline comments (# outside of question text — but we apply
        // it to every line; users can escape with literal text "\\#" which
        // we don't bother stripping back since # in prompts is unusual).
        const hashIdx = rawLine.indexOf('#');
        const noComment = hashIdx >= 0 ? rawLine.substring(0, hashIdx) : rawLine;

        // Empty / whitespace-only lines reset nothing — they're separators.
        if (noComment.trim().length === 0) continue;

        const indentMatch = /^( *)/.exec(noComment);
        const indent = indentMatch ? indentMatch[1].length : 0;
        const content = noComment.substring(indent).trimEnd();
        const level = Math.floor(indent / 2);

        // Top-level declaration ---------------------------------------------
        if (level === 0) {
            const poolMatch = /^pool\s+(\S+)\s+(random|sequential)\s*$/i.exec(content);
            if (poolMatch) {
                const name = poolMatch[1];
                const mode = poolMatch[2].toLowerCase() as QuestionSelectionMode;
                if (pools.some((p) => p.name === name)) {
                    err(lineNo, `Duplicate pool name "${name}".`);
                }
                const pool: ParsedQuestionPool = { name, mode, questions: [] };
                pools.push(pool);
                ctx = { kind: 'pool', pool };
                continue;
            }
            const actMatch = /^act\s+(\S+)\s*$/i.exec(content);
            if (actMatch) {
                const name = actMatch[1];
                if (acts.some((a) => a.name === name)) {
                    err(lineNo, `Duplicate act name "${name}".`);
                }
                const act: ParsedAct = { name, end: {}, sources: [] };
                acts.push(act);
                ctx = { kind: 'act', act };
                continue;
            }
            err(lineNo, `Unknown top-level directive: "${content}". Expected "pool <name> random|sequential" or "act <name>".`);
            continue;
        }

        // Inside a pool ------------------------------------------------------
        if (ctx.kind === 'pool') {
            if (level === 1 && content.startsWith('- ')) {
                const text = content.substring(2).trim();
                if (!text) {
                    err(lineNo, `Empty question text.`);
                    continue;
                }
                const q: ParsedQuestion = {
                    defaultText: text,
                    translations: [],
                    requires: emptyRequires(),
                };
                ctx.pool.questions.push(q);
                ctx.question = q;
                continue;
            }

            if (level >= 2 && ctx.question) {
                // <key> = <value>
                const kv = /^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.*)$/.exec(content);
                if (!kv) {
                    err(lineNo, `Expected "key = value" inside question.`);
                    continue;
                }
                const key = kv[1].toLowerCase();
                const value = kv[2];
                if (key === 'self') {
                    ctx.question.requires.self = parseTagList(value);
                } else if (key === 'partner') {
                    ctx.question.requires.partner = parseTagList(value);
                } else if (LOCALE_RE.test(key) && !RESERVED_KEYS.has(key)) {
                    ctx.question.translations.push({ locale: key, title: value.trim() });
                } else {
                    err(lineNo, `Unknown question attribute "${kv[1]}".`);
                }
                continue;
            }

            err(lineNo, `Unexpected line inside pool "${ctx.pool.name}".`);
            continue;
        }

        // Inside an act ------------------------------------------------------
        if (ctx.kind === 'act') {
            if (level === 1) {
                const useMatch = /^use\s+(\S+)\s*$/i.exec(content);
                if (useMatch) {
                    const src: ParsedActSource = {
                        poolName: useMatch[1],
                        requires: emptyRequires(),
                    };
                    ctx.act.sources.push(src);
                    ctx.source = src;
                    continue;
                }
                const kv = /^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.*)$/.exec(content);
                if (kv) {
                    const key = kv[1].toLowerCase();
                    const value = kv[2];
                    if (key === 'end') {
                        const parsed = parseEnd(lineNo, value);
                        if (parsed) ctx.act.end = { ...ctx.act.end, ...parsed };
                    } else {
                        err(lineNo, `Unknown act attribute "${kv[1]}".`);
                    }
                    continue;
                }
                err(lineNo, `Expected "end = ..." or "use <pool>" inside act "${ctx.act.name}".`);
                continue;
            }

            if (level >= 2 && ctx.source) {
                const kv = /^(self|partner)\s*=\s*(.*)$/i.exec(content);
                if (!kv) {
                    err(lineNo, `Expected "self = ..." or "partner = ..." inside use clause.`);
                    continue;
                }
                const key = kv[1].toLowerCase();
                const tags = parseTagList(kv[2]);
                if (key === 'self') ctx.source.requires.self = tags;
                else ctx.source.requires.partner = tags;
                continue;
            }

            err(lineNo, `Unexpected line inside act "${ctx.act.name}".`);
            continue;
        }

        err(lineNo, `Unexpected content: "${content}".`);
    }

    // Cross-reference validation -------------------------------------------
    const poolNames = new Set(pools.map((p) => p.name));
    for (const a of acts) {
        for (const s of a.sources) {
            if (!poolNames.has(s.poolName)) {
                errors.push({ line: 0, message: `Act "${a.name}" references unknown pool "${s.poolName}".` });
            }
        }
        if (a.end.durationSeconds === undefined && a.end.questionCount === undefined) {
            errors.push({ line: 0, message: `Act "${a.name}" has no end condition (set "end = 5m" or "end = 3 questions").` });
        }
    }
    if (pools.length === 0) {
        errors.push({ line: 0, message: 'Script defines no pools.' });
    }
    if (acts.length === 0) {
        errors.push({ line: 0, message: 'Script defines no acts.' });
    }

    const script: ParsedQuestionScript = { pools, acts };
    return { script, errors };
}
