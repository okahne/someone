import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { throwError } from 'rxjs';
import { OrganiserConfigComponent } from './organiser-config.component';
import {
    OrganiserApiService,
    EventLanguage,
    TagDto,
    MeetingSpotDto,
    QuestionScriptDto,
} from '../core/organiser-api.service';
import { AdminApiService, EventDto } from '../core/admin-api.service';

/**
 * Unit tests for the organiser config component focused on the translation
 * editing flow. We mock both API services so the tests run without a server,
 * and verify that the component sends complete and partial translation
 * payloads to the right endpoints.
 */
describe('OrganiserConfigComponent translations', () => {
    let api: jasmine.SpyObj<OrganiserApiService>;
    let admin: jasmine.SpyObj<AdminApiService>;

    const languages: EventLanguage[] = [
        { locale: 'en', isDefault: true },
        { locale: 'sv', isDefault: false },
        { locale: 'de', isDefault: false },
    ];

    function makeTag(overrides: Partial<TagDto> = {}): TagDto {
        return {
            id: 't1', poolId: 'p1', defaultLabel: 'Coffee', translations: [],
            archivedAt: null, ...overrides,
        };
    }

    function makeSpot(overrides: Partial<MeetingSpotDto> = {}): MeetingSpotDto {
        return {
            id: 's1', poolId: 'p1', title: 'Cafe', description: null,
            images: [], translations: [], archivedAt: null, ...overrides,
        };
    }

    beforeEach(() => {
        api = jasmine.createSpyObj<OrganiserApiService>('OrganiserApiService', [
            'listLanguages', 'listPools', 'createPool', 'updatePool',
            'listTags', 'createTag', 'updateTag', 'archiveTag',
            'listSpots', 'createSpot', 'updateSpot', 'archiveSpot', 'uploadSpotImage',
            'getScript', 'setScript', 'uploadScript', 'setLanguages', 'dashboard',
        ]);
        admin = jasmine.createSpyObj<AdminApiService>('AdminApiService', ['getEvent', 'updateEvent']);

        api.listLanguages.and.returnValue(of(languages));
        api.listPools.and.returnValue(of([]));
        api.dashboard.and.returnValue(of({
            eventId: 'e1', poolCounts: [], activeMatchIds: [], recentMatchRuns: [],
        }));
        admin.getEvent.and.returnValue(of({
            id: 'e1', slug: 'e1', title: 'Event', description: null,
            status: 'DRAFT', timezone: 'UTC', createdBy: 'u1',
            createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        } satisfies EventDto));

        TestBed.configureTestingModule({
            imports: [OrganiserConfigComponent],
            providers: [
                { provide: OrganiserApiService, useValue: api },
                { provide: AdminApiService, useValue: admin },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ id: 'e1' }) } },
                },
            ],
        });
    });

    function createInitialised(): OrganiserConfigComponent {
        const fixture = TestBed.createComponent(OrganiserConfigComponent);
        const c = fixture.componentInstance;
        c.ngOnInit();
        return c;
    }

    // -- Tag creation -------------------------------------------------------

    it('createTag sends a complete translations array (one per non-default language)', () => {
        const c = createInitialised();
        api.createTag.and.returnValue(of(makeTag()));
        api.listTags.and.returnValue(of([]));

        c.newTagLabel = 'Coffee';
        c.newTagTranslations = { sv: 'Kaffe', de: 'Kaffee' };
        c.selectedPoolId.set('p1');
        c.createTag();

        expect(api.createTag).toHaveBeenCalledWith('p1', 'Coffee', [
            { locale: 'sv', label: 'Kaffe' },
            { locale: 'de', label: 'Kaffee' },
        ]);
    });

    it('createTag drops empty/whitespace translations (partial payload)', () => {
        const c = createInitialised();
        api.createTag.and.returnValue(of(makeTag()));
        api.listTags.and.returnValue(of([]));

        c.newTagLabel = 'Coffee';
        c.newTagTranslations = { sv: 'Kaffe', de: '   ' };
        c.selectedPoolId.set('p1');
        c.createTag();

        expect(api.createTag).toHaveBeenCalledWith('p1', 'Coffee', [
            { locale: 'sv', label: 'Kaffe' },
        ]);
    });

    it('createTag sends an empty translations array when no language inputs are filled in', () => {
        const c = createInitialised();
        api.createTag.and.returnValue(of(makeTag()));
        api.listTags.and.returnValue(of([]));

        c.newTagLabel = 'Coffee';
        c.newTagTranslations = {};
        c.selectedPoolId.set('p1');
        c.createTag();

        expect(api.createTag).toHaveBeenCalledWith('p1', 'Coffee', []);
    });

    // -- Tag update ---------------------------------------------------------

    it('saveTag posts only non-empty translations after edits (partial)', () => {
        const c = createInitialised();
        const tag = makeTag({ translations: [{ locale: 'sv', label: 'Kaffe' }] });
        api.updateTag.and.returnValue(of(tag));
        api.listTags.and.returnValue(of([tag]));
        c.selectedPoolId.set('p1');
        // Seed the edit buffer (normally done by selectPool).
        c.tagEdits.set({
            t1: {
                defaultLabel: 'Coffee',
                translations: { sv: 'Kaffe', de: '' },
                dirty: false,
            },
        });

        c.updateTagEdit(tag, 'sv', 'Kafé');
        expect(c.tagEdits()['t1'].dirty).toBeTrue();

        c.saveTag(tag);

        expect(api.updateTag).toHaveBeenCalledWith('t1', {
            defaultLabel: 'Coffee',
            translations: [{ locale: 'sv', label: 'Kafé' }],
        });
    });

    // -- Spot creation ------------------------------------------------------

    it('createSpot sends complete per-language title + description', () => {
        const c = createInitialised();
        api.createSpot.and.returnValue(of(makeSpot()));
        api.listSpots.and.returnValue(of([]));
        c.selectedPoolId.set('p1');

        c.newSpotTitle = 'Cafe';
        c.newSpotDescription = 'Cozy';
        c.updateNewSpotTranslation('sv', 'title', 'Kafé');
        c.updateNewSpotTranslation('sv', 'description', 'Mysig');
        c.updateNewSpotTranslation('de', 'title', 'Café');
        c.updateNewSpotTranslation('de', 'description', 'Gemütlich');

        c.createSpot();

        expect(api.createSpot).toHaveBeenCalledWith('p1', 'Cafe', 'Cozy', [
            { locale: 'sv', title: 'Kafé', description: 'Mysig' },
            { locale: 'de', title: 'Café', description: 'Gemütlich' },
        ]);
    });

    it('createSpot omits languages whose title is empty (partial), and nulls empty descriptions', () => {
        const c = createInitialised();
        api.createSpot.and.returnValue(of(makeSpot()));
        api.listSpots.and.returnValue(of([]));
        c.selectedPoolId.set('p1');

        c.newSpotTitle = 'Cafe';
        // sv has a title only, de left blank entirely
        c.updateNewSpotTranslation('sv', 'title', 'Kafé');

        c.createSpot();

        expect(api.createSpot).toHaveBeenCalledWith('p1', 'Cafe', undefined, [
            { locale: 'sv', title: 'Kafé', description: null },
        ]);
    });

    // -- Spot update --------------------------------------------------------

    it('saveSpot posts the trimmed, filtered translations array', () => {
        const c = createInitialised();
        const spot = makeSpot();
        api.updateSpot.and.returnValue(of(spot));
        api.listSpots.and.returnValue(of([spot]));
        c.selectedPoolId.set('p1');
        c.spotEdits.set({
            s1: {
                title: 'Cafe',
                description: '',
                translations: {
                    sv: { title: 'Kafé ', description: ' Mysig ' },
                    de: { title: '', description: 'Gemütlich' }, // dropped — title empty
                },
                dirty: false,
            },
        });

        c.updateSpotEdit(spot, 'default', 'description', 'Cozy');
        expect(c.spotEdits()['s1'].dirty).toBeTrue();

        c.saveSpot(spot);

        expect(api.updateSpot).toHaveBeenCalledWith('s1', {
            title: 'Cafe',
            description: 'Cozy',
            translations: [
                { locale: 'sv', title: 'Kafé', description: 'Mysig' },
            ],
        });
    });

    // -- Question script ----------------------------------------------------

    it('saveScript sends questions with translations for every supplied language (complete)', () => {
        const c = createInitialised();
        api.setScript.and.returnValue(of(undefined));
        c.selectedPoolId.set('p1');

        c.script.set([
            { translations: { en: 'Favorite hobby?', sv: 'Favorithobby?', de: 'Lieblingshobby?' } },
        ]);
        c.saveScript();

        expect(api.setScript).toHaveBeenCalledWith('p1', [
            { translations: [
                { locale: 'en', title: 'Favorite hobby?' },
                { locale: 'sv', title: 'Favorithobby?' },
                { locale: 'de', title: 'Lieblingshobby?' },
            ] },
        ]);
    });

    it('saveScript drops questions missing a default-locale title (partial)', () => {
        const c = createInitialised();
        api.setScript.and.returnValue(of(undefined));
        c.selectedPoolId.set('p1');

        c.script.set([
            { translations: { en: 'Has default', sv: 'Också svensk' } },
            { translations: { sv: 'Bara svensk' } }, // no English → dropped
            { translations: {} }, // empty → dropped
        ]);
        c.saveScript();

        expect(api.setScript).toHaveBeenCalledWith('p1', [
            { translations: [
                { locale: 'en', title: 'Has default' },
                { locale: 'sv', title: 'Också svensk' },
            ] },
        ]);
    });

    it('updateQuestionTranslation mutates only the targeted index/locale', () => {
        const c = createInitialised();
        c.script.set([
            { translations: { en: 'Q1' } },
            { translations: { en: 'Q2' } },
        ]);

        c.updateQuestionTranslation(1, 'sv', 'Fråga 2');

        expect(c.script()).toEqual([
            { translations: { en: 'Q1' } },
            { translations: { en: 'Q2', sv: 'Fråga 2' } },
        ]);
    });

    // -- Pool selection seeds edit buffers ----------------------------------

    it('selectPool seeds tag/spot edit buffers and loads the script', () => {
        const c = createInitialised();
        const pool = {
            id: 'p1', eventId: 'e1', defaultTitle: 'Main', translations: [],
            allowRematch: false, callSchedule: { cron: '*/15 * * * *' },
            meetingTimeLimitMinutes: 20, archivedAt: null,
        };
        const tag = makeTag({ translations: [{ locale: 'sv', label: 'Kaffe' }] });
        const spot = makeSpot({
            translations: [{ locale: 'sv', title: 'Kafé', description: 'Mysig' }],
        });
        const script: QuestionScriptDto = {
            id: 'qs1', poolId: 'p1',
            questions: [{ translations: [{ locale: 'en', title: 'Hi?' }] }],
        };
        api.listTags.and.returnValue(of([tag]));
        api.listSpots.and.returnValue(of([spot]));
        api.getScript.and.returnValue(of(script));

        c.selectPool(pool);

        expect(c.tagEdits()['t1']).toEqual({
            defaultLabel: 'Coffee',
            translations: { sv: 'Kaffe' },
            dirty: false,
        });
        expect(c.spotEdits()['s1']).toEqual({
            title: 'Cafe',
            description: '',
            translations: { sv: { title: 'Kafé', description: 'Mysig' } },
            dirty: false,
        });
        expect(c.script()).toEqual([{ translations: { en: 'Hi?' } }]);
    });

    // -- DSL script upload --------------------------------------------------

    describe('uploadScript', () => {
        it('posts the textarea source and stores the parsed preview on success', () => {
            const c = createInitialised();
            c.selectedPoolId.set('p1');
            c.scriptSource = 'pool greetings random\n  - hi\nact a\n  end = 1m\n  use greetings\n';
            const parsed = {
                pools: [{ name: 'greetings', mode: 'random' as const, questions: [{ defaultText: 'hi', translations: [], requires: { self: [], partner: [] } }] }],
                acts: [{ name: 'a', end: { durationSeconds: 60 }, sources: [{ poolName: 'greetings', requires: { self: [], partner: [] } }] }],
            };
            api.uploadScript.and.returnValue(of({
                id: 'qs1', poolId: 'p1', questions: [], source: c.scriptSource, parsed,
            }));

            c.uploadScript();

            expect(api.uploadScript).toHaveBeenCalledWith('p1', c.scriptSource);
            expect(c.scriptErrors()).toEqual([]);
            expect(c.scriptParsed()?.pools[0].name).toBe('greetings');
            expect(c.scriptUploadMessage()).toContain('uploaded');
        });

        it('surfaces structured parse errors from the backend', () => {
            const c = createInitialised();
            c.selectedPoolId.set('p1');
            c.scriptSource = 'gibberish';
            const errors = [{ line: 1, message: 'Unknown top-level directive: "gibberish".' }];
            api.uploadScript.and.returnValue(throwError(() => ({
                error: { code: 'QUESTION_SCRIPT_INVALID', errors },
            })));

            c.uploadScript();

            expect(c.scriptErrors()).toEqual(errors);
            expect(c.scriptUploadMessage()).toContain('errors');
        });

        it('does nothing when no pool is selected or the source is empty', () => {
            const c = createInitialised();
            c.scriptSource = '';
            c.selectedPoolId.set('p1');
            c.uploadScript();
            expect(api.uploadScript).not.toHaveBeenCalled();

            c.scriptSource = 'pool x random\n  - hi\nact a\n  end = 1m\n  use x\n';
            c.selectedPoolId.set(null);
            c.uploadScript();
            expect(api.uploadScript).not.toHaveBeenCalled();
        });
    });
});
