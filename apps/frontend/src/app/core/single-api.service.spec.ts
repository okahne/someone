import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SingleApiService } from './single-api.service';
import { API_BASE } from './api.constants';

describe('SingleApiService', () => {
    let service: SingleApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [SingleApiService],
        });
        service = TestBed.inject(SingleApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it('lists pools for an event under the versioned API base', () => {
        // Regression: the participant shell previously used a raw fetch to
        // /api/events/:id/pools (missing the /v1 prefix), which 404'd and
        // silently left anonymously-registered users with an empty pool list.
        const eventId = 'evt-123';
        const pools = [
            { id: 'p1', defaultTitle: 'Main pool' },
            { id: 'p2', defaultTitle: 'Quiet pool' },
        ];

        let received: { id: string; defaultTitle: string }[] | undefined;
        service.listEventPools(eventId).subscribe((p) => (received = p));

        const req = httpMock.expectOne(`${API_BASE}/events/${eventId}/pools`);
        expect(req.request.method).toBe('GET');
        expect(req.request.url).toBe(`/api/v1/events/${eventId}/pools`);
        req.flush(pools);

        expect(received).toEqual(pools);
    });
});
