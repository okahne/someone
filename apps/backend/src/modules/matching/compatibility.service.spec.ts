import { CompatibilityService } from './compatibility.service';
import { BlossomService } from './blossom.service';

describe('CompatibilityService', () => {
    const c = new CompatibilityService();

    it('returns true when both sides have empty mandatory sets', () => {
        expect(c.areCompatible(
            { sessionId: 'a', ownTagIds: ['x'], mandatoryTagIds: [] },
            { sessionId: 'b', ownTagIds: ['y'], mandatoryTagIds: [] },
        )).toBe(true);
    });

    it('rejects when other side does not have all required tags', () => {
        expect(c.areCompatible(
            { sessionId: 'a', ownTagIds: ['x'], mandatoryTagIds: ['z'] },
            { sessionId: 'b', ownTagIds: ['y'], mandatoryTagIds: [] },
        )).toBe(false);
    });

    it('is bidirectional', () => {
        const a = { sessionId: 'a', ownTagIds: ['x', 'y'], mandatoryTagIds: ['p'] };
        const b = { sessionId: 'b', ownTagIds: ['p', 'q'], mandatoryTagIds: ['x'] };
        expect(c.areCompatible(a, b)).toBe(true);
        expect(c.areCompatible(b, a)).toBe(true);
    });

    it('rejects when one side is missing tags the other requires', () => {
        const a = { sessionId: 'a', ownTagIds: ['x'], mandatoryTagIds: [] };
        const b = { sessionId: 'b', ownTagIds: [], mandatoryTagIds: ['x'] };
        expect(c.areCompatible(a, b)).toBe(true);
        const c2 = { sessionId: 'c', ownTagIds: [], mandatoryTagIds: [] };
        const d = { sessionId: 'd', ownTagIds: [], mandatoryTagIds: ['x'] };
        expect(c.areCompatible(c2, d)).toBe(false);
    });
});

describe('BlossomService', () => {
    const b = new BlossomService();

    it('returns no pairs for an empty graph', () => {
        expect(b.computeMatching(0, [])).toEqual([]);
        expect(b.computeMatching(4, [])).toEqual([]);
    });

    it('matches all vertices when a perfect matching exists (even count)', () => {
        const pairs = b.computeMatching(4, [[0, 1], [2, 3], [0, 2], [1, 3]]);
        expect(pairs.length).toBe(2);
    });

    it('leaves at most one vertex unmatched on odd count chain', () => {
        const pairs = b.computeMatching(3, [[0, 1], [1, 2]]);
        expect(pairs.length).toBe(1);
    });

    it('handles dense uniform graph (all-same-tags equivalent)', () => {
        const edges: [number, number][] = [];
        for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) edges.push([i, j]);
        const pairs = b.computeMatching(6, edges);
        expect(pairs.length).toBe(3);
    });
});
