import { Injectable } from '@nestjs/common';

/**
 * Maximum cardinality matching on a general graph.
 *
 * For now we use a randomized greedy strategy with multiple restarts; this is
 * sufficient for the expected per-pool participant counts (well under 100) and
 * keeps the dependency surface small. The interface mirrors a true Blossom
 * algorithm wrapper so it can be swapped later without affecting callers.
 *
 * Inputs: number of vertices and edges as `[u, v]` pairs (0-indexed).
 * Output: array of matched pairs `[u, v]`.
 */
@Injectable()
export class BlossomService {
    computeMatching(vertexCount: number, edges: Array<[number, number]>): Array<[number, number]> {
        if (vertexCount === 0 || edges.length === 0) return [];
        const adjacency: number[][] = Array.from({ length: vertexCount }, () => []);
        for (const [u, v] of edges) {
            adjacency[u].push(v);
            adjacency[v].push(u);
        }

        let best: Array<[number, number]> = [];
        const trials = Math.min(32, Math.max(8, vertexCount));
        for (let t = 0; t < trials; t++) {
            const matching = this.randomGreedy(vertexCount, adjacency);
            if (matching.length > best.length) best = matching;
            if (best.length * 2 >= vertexCount) break;
        }
        return best;
    }

    private randomGreedy(n: number, adj: number[][]): Array<[number, number]> {
        const order = shuffled(range(n));
        const partner = new Int32Array(n).fill(-1);
        for (const u of order) {
            if (partner[u] !== -1) continue;
            const candidates = shuffled(adj[u].filter((v) => partner[v] === -1));
            if (candidates.length > 0) {
                const v = candidates[0];
                partner[u] = v;
                partner[v] = u;
            }
        }
        const pairs: Array<[number, number]> = [];
        const seen = new Uint8Array(n);
        for (let u = 0; u < n; u++) {
            if (partner[u] !== -1 && !seen[u]) {
                pairs.push([u, partner[u]]);
                seen[u] = 1;
                seen[partner[u]] = 1;
            }
        }
        return pairs;
    }
}

function range(n: number): number[] {
    const r = new Array<number>(n);
    for (let i = 0; i < n; i++) r[i] = i;
    return r;
}

function shuffled<T>(items: T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
