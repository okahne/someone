import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    // Prefer user (admin/organiser) token; fall back to anonymous session token.
    const token = auth.bearer() ?? auth.sessionBearer();
    if (token && !req.headers.has('Authorization')) {
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }
    return next(req);
};
