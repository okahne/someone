import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Routes the right bearer token to each request.
 *
 * Some users hold both tokens at once — e.g. a system admin who is also
 * testing the participant flow as an anonymous single. Participant endpoints
 * (sessions, matches) only accept the session token, while admin/organiser
 * endpoints only accept the user token. Picking the wrong one silently 403s
 * and leaves the page blank, so we route by URL:
 *
 *   - URLs scoped to a single's own session (sessions, matches) → session token.
 *   - Everything else → user token, falling back to session token.
 *
 * Exception: `POST /sessions/for-event/:eventId` is the endpoint that *creates*
 * a session for a logged-in user, so it must carry the user token even though
 * the URL lives under `/sessions/`. If we sent the session token here, the
 * controller would see `principal.userId === undefined` and 500.
 */
const SESSION_SCOPED = /\/(sessions|matches)(\/|$)/;
const USER_SCOPED_OVERRIDE = /\/sessions\/for-event\//;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const userToken = auth.bearer();
    const sessionToken = auth.sessionBearer();

    let token: string | null;
    if (USER_SCOPED_OVERRIDE.test(req.url)) {
        token = userToken ?? sessionToken;
    } else if (SESSION_SCOPED.test(req.url)) {
        token = sessionToken ?? userToken;
    } else {
        token = userToken ?? sessionToken;
    }

    if (token && !req.headers.has('Authorization')) {
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }
    return next(req);
};
