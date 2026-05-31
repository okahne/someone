import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EventEntryComponent } from './event-entry.component';
import { SingleApiService, PublicEvent, SessionTokenResponse } from '../core/single-api.service';
import { AuthService } from '../core/auth.service';

/**
 * Logged-in users (admins, organisers, returning OAuth users) should never
 * see the "Join as guest" form: they get-or-create a session bound to their
 * user account and route straight to the participant shell.
 */
describe('EventEntryComponent logged-in routing', () => {
    let api: jasmine.SpyObj<SingleApiService>;
    let auth: jasmine.SpyObj<AuthService>;
    let router: jasmine.SpyObj<Router>;

    const liveEvent: PublicEvent = {
        id: 'e1', slug: 'blind-date', title: 'Blind Date', description: 'Test',
        status: 'LIVE', languages: [], pools: [],
    };

    function configure(opts: { userToken: string | null }) {
        api = jasmine.createSpyObj<SingleApiService>('SingleApiService', [
            'publicEvent', 'sessionForUser',
        ]);
        auth = jasmine.createSpyObj<AuthService>(
            'AuthService',
            ['bearer', 'sessionBearer', 'setSessionToken', 'anonymous'],
        );
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);

        auth.bearer.and.returnValue(opts.userToken);
        auth.sessionBearer.and.returnValue(null);

        TestBed.configureTestingModule({
            imports: [EventEntryComponent],
            providers: [
                { provide: SingleApiService, useValue: api },
                { provide: AuthService, useValue: auth },
                { provide: Router, useValue: router },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ slug: 'blind-date' }) } },
                },
            ],
        });
    }

    it('auto-joins a live event when the user is signed in and routes past the guest form', () => {
        configure({ userToken: 'USER' });
        api.publicEvent.and.returnValue(of(liveEvent));
        const tokenResponse: SessionTokenResponse = {
            accessToken: 'SESSION-TOKEN', sessionId: 'sess-1', expiresAt: '2099-01-01T00:00:00Z',
        };
        api.sessionForUser.and.returnValue(of(tokenResponse));

        const fixture = TestBed.createComponent(EventEntryComponent);
        fixture.detectChanges();

        expect(api.sessionForUser).toHaveBeenCalledWith('e1', undefined);
        expect(auth.setSessionToken).toHaveBeenCalledWith('SESSION-TOKEN');
        expect(router.navigate).toHaveBeenCalledWith(['/play', 'sess-1']);

        // No anonymous flow should be exercised.
        expect(auth.anonymous).not.toHaveBeenCalled();
    });

    it('does not auto-join if the event is CLOSED, even for signed-in users', () => {
        configure({ userToken: 'USER' });
        api.publicEvent.and.returnValue(of({ ...liveEvent, status: 'CLOSED' }));

        const fixture = TestBed.createComponent(EventEntryComponent);
        fixture.detectChanges();

        expect(api.sessionForUser).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('does not auto-join when no user token is present (anonymous visitors see the guest form)', () => {
        configure({ userToken: null });
        api.publicEvent.and.returnValue(of(liveEvent));

        const fixture = TestBed.createComponent(EventEntryComponent);
        fixture.detectChanges();

        expect(api.sessionForUser).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('surfaces an error and clears the auto-joining flag if sessionForUser fails', () => {
        configure({ userToken: 'USER' });
        api.publicEvent.and.returnValue(of(liveEvent));
        api.sessionForUser.and.returnValue(
            throwError(() => ({ error: { message: 'boom' } })),
        );

        const fixture = TestBed.createComponent(EventEntryComponent);
        fixture.detectChanges();

        expect(fixture.componentInstance.autoJoining()).toBeFalse();
        expect(fixture.componentInstance.error()).toBe('boom');
        expect(router.navigate).not.toHaveBeenCalled();
    });
});
