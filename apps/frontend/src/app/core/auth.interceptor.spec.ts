import { TestBed } from '@angular/core/testing';
import {
    HttpClient,
    HttpHandlerFn,
    HttpRequest,
    HttpResponse,
    provideHttpClient,
    withInterceptors,
} from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

/**
 * Regression coverage for token routing. Specifically: when both a user
 * (admin) token and a session (anonymous participant) token are present, the
 * interceptor must send the SESSION token to participant-scoped endpoints
 * (`/sessions`, `/matches`). Otherwise the snapshot call returns 403 and the
 * single-shell renders an empty page even though the event is LIVE.
 */
describe('authInterceptor token routing', () => {
    let auth: AuthService;
    let http: HttpClient;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
            ],
        });
        auth = TestBed.inject(AuthService);
        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
        // Clear any tokens left over in localStorage from other specs.
        spyOn(auth, 'bearer').and.returnValue(null);
        spyOn(auth, 'sessionBearer').and.returnValue(null);
    });

    afterEach(() => httpMock.verify());

    function setTokens(user: string | null, session: string | null): void {
        (auth.bearer as jasmine.Spy).and.returnValue(user);
        (auth.sessionBearer as jasmine.Spy).and.returnValue(session);
    }

    it('sends the session token to /sessions/:id even when a user token is also present', () => {
        setTokens('USER', 'SESSION');
        http.get('/api/v1/sessions/abc').subscribe();
        const req = httpMock.expectOne('/api/v1/sessions/abc');
        expect(req.request.headers.get('Authorization')).toBe('Bearer SESSION');
        req.flush({});
    });

    it('sends the session token to /matches/:id when both tokens are present', () => {
        setTokens('USER', 'SESSION');
        http.post('/api/v1/matches/m1/confirm', {}).subscribe();
        const req = httpMock.expectOne('/api/v1/matches/m1/confirm');
        expect(req.request.headers.get('Authorization')).toBe('Bearer SESSION');
        req.flush({});
    });

    it('falls back to the user token on /sessions/:id when no session token is set', () => {
        setTokens('USER', null);
        http.get('/api/v1/sessions/abc').subscribe();
        const req = httpMock.expectOne('/api/v1/sessions/abc');
        expect(req.request.headers.get('Authorization')).toBe('Bearer USER');
        req.flush({});
    });

    it('prefers the user token for non-session endpoints (events, pools, admin)', () => {
        setTokens('USER', 'SESSION');
        http.get('/api/v1/events/e1/pools').subscribe();
        const req = httpMock.expectOne('/api/v1/events/e1/pools');
        expect(req.request.headers.get('Authorization')).toBe('Bearer USER');
        req.flush([]);
    });

    it('falls back to the session token for non-session endpoints when no user token is set', () => {
        setTokens(null, 'SESSION');
        http.get('/api/v1/events/e1/pools').subscribe();
        const req = httpMock.expectOne('/api/v1/events/e1/pools');
        expect(req.request.headers.get('Authorization')).toBe('Bearer SESSION');
        req.flush([]);
    });

    it('sends no Authorization header when neither token is set', () => {
        setTokens(null, null);
        http.get('/api/v1/events/e1/public').subscribe();
        const req = httpMock.expectOne('/api/v1/events/e1/public');
        expect(req.request.headers.has('Authorization')).toBeFalse();
        req.flush({});
    });

    it('preserves an Authorization header that is already on the request', () => {
        setTokens('USER', 'SESSION');
        http.get('/api/v1/sessions/abc', {
            headers: { Authorization: 'Bearer EXPLICIT' },
        }).subscribe();
        const req = httpMock.expectOne('/api/v1/sessions/abc');
        expect(req.request.headers.get('Authorization')).toBe('Bearer EXPLICIT');
        req.flush({});
    });

    it('sends the USER token to POST /sessions/for-event/:eventId even when a session token is present', () => {
        // This endpoint creates a session for a logged-in user, so it must
        // carry the user token. Routing the session token here makes the
        // controller throw "User token required" and 500.
        setTokens('USER', 'SESSION');
        http.post('/api/v1/sessions/for-event/evt-1', {}).subscribe();
        const req = httpMock.expectOne('/api/v1/sessions/for-event/evt-1');
        expect(req.request.headers.get('Authorization')).toBe('Bearer USER');
        req.flush({});
    });

    it('does not match URLs that merely contain the substring "sessions" without a path boundary', () => {
        // Defensive: e.g. a hypothetical /api/v1/sessionstats/x should not be
        // misclassified as session-scoped.
        setTokens('USER', 'SESSION');
        // Use a low-level call to confirm the regex requires a path boundary.
        const handler: HttpHandlerFn = (r) => of(new HttpResponse({ status: 200 }));
        const passthrough: HttpHandlerFn = (r: HttpRequest<unknown>) => {
            // The interceptor will choose USER because the URL is not
            // session-scoped; assert that here without going through HttpClient.
            expect(r.headers.get('Authorization')).toBe('Bearer USER');
            return handler(r);
        };
        TestBed.runInInjectionContext(() => {
            authInterceptor(
                new HttpRequest('GET', '/api/v1/sessionstats/x'),
                passthrough,
            ).subscribe();
        });
    });
});
