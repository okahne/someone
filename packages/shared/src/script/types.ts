/**
 * Parsed representation of a question script.
 *
 * Terminology note: this file deals with *question pools* — collections of
 * conversation prompts. Do NOT confuse with *singles pools* (`Pool` in the
 * data model), which group singles for matching. A singles pool may have
 * exactly one question script attached to it; that script may contain many
 * named question pools that the script's acts draw from.
 */

export type QuestionSelectionMode = 'random' | 'sequential';

/** End condition for an act — at least one of the two fields is set. */
export interface ActEndCondition {
    /** Maximum duration of the act in seconds. */
    durationSeconds?: number;
    /** Maximum number of questions asked during the act. */
    questionCount?: number;
}

/** Tag-based gate. All listed tags must be present (logical AND). */
export interface TagRequirement {
    /** Tags the current single must have. */
    self: string[];
    /** Tags the partner single must have. */
    partner: string[];
}

/** Translation of a single question text into a locale. */
export interface QuestionTranslation {
    locale: string;
    title: string;
}

/** A single question entry inside a *question pool*. */
export interface ParsedQuestion {
    /** Default-language text (the line after the `- `). */
    defaultText: string;
    translations: QuestionTranslation[];
    requires: TagRequirement;
}

/** A named pool of questions (random or sequential). */
export interface ParsedQuestionPool {
    name: string;
    mode: QuestionSelectionMode;
    questions: ParsedQuestion[];
}

/**
 * A `use <questionpool>` reference inside an act, optionally with
 * additional act-level tag filters that AND with each question's own
 * requirements.
 */
export interface ParsedActSource {
    poolName: string;
    requires: TagRequirement;
}

/** One act of the date. */
export interface ParsedAct {
    name: string;
    end: ActEndCondition;
    sources: ParsedActSource[];
}

export interface ParsedQuestionScript {
    pools: ParsedQuestionPool[];
    acts: ParsedAct[];
}

export interface ScriptParseError {
    /** 1-based line number in the source. */
    line: number;
    message: string;
}

export interface ScriptParseResult {
    script: ParsedQuestionScript;
    errors: ScriptParseError[];
}
