import { Injectable } from '@nestjs/common';

export interface CompatibleSingle {
    sessionId: string;
    ownTagIds: string[];
    mandatoryTagIds: string[];
}

@Injectable()
export class CompatibilityService {
    areCompatible(a: CompatibleSingle, b: CompatibleSingle): boolean {
        const aHas = new Set(a.ownTagIds);
        const bHas = new Set(b.ownTagIds);
        for (const t of b.mandatoryTagIds) if (!aHas.has(t)) return false;
        for (const t of a.mandatoryTagIds) if (!bHas.has(t)) return false;
        return true;
    }

    buildEdges(singles: CompatibleSingle[], excludePairs: Set<string> = new Set()): Array<[number, number]> {
        const edges: Array<[number, number]> = [];
        for (let i = 0; i < singles.length; i++) {
            for (let j = i + 1; j < singles.length; j++) {
                const key = pairKey(singles[i].sessionId, singles[j].sessionId);
                if (excludePairs.has(key)) continue;
                if (this.areCompatible(singles[i], singles[j])) {
                    edges.push([i, j]);
                }
            }
        }
        return edges;
    }
}

export function pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}
