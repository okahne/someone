import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', redirectTo: 'admin/login', pathMatch: 'full' },
    {
        path: 'event/:slug',
        loadComponent: () =>
            import('./single/event-entry.component').then((m) => m.EventEntryComponent),
    },
    {
        path: 'play/:sessionId',
        loadComponent: () =>
            import('./single/single-shell.component').then((m) => m.SingleShellComponent),
    },
    {
        path: 'admin/login',
        loadComponent: () =>
            import('./admin/admin-login.component').then((m) => m.AdminLoginComponent),
    },
    {
        path: 'admin',
        loadComponent: () =>
            import('./admin/admin-shell.component').then((m) => m.AdminShellComponent),
        children: [
            {
                path: 'events',
                loadComponent: () =>
                    import('./admin/admin-events.component').then((m) => m.AdminEventsComponent),
            },
            {
                path: 'events/:id',
                loadComponent: () =>
                    import('./admin/admin-event-detail.component').then((m) => m.AdminEventDetailComponent),
            },
            {
                path: 'events/:id/configure',
                loadComponent: () =>
                    import('./admin/organiser-config.component').then((m) => m.OrganiserConfigComponent),
            },
            {
                path: 'audit',
                loadComponent: () =>
                    import('./admin/admin-audit.component').then((m) => m.AdminAuditComponent),
            },
            { path: '', redirectTo: 'events', pathMatch: 'full' },
        ],
    },
];
