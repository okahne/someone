/**
 * Modes a single may explicitly request via `PUT /sessions/:id/mode`.
 * This is a subset of `SingleState` representing user-selectable modes only.
 */
export enum SingleMode {
    AVAILABLE = 'AVAILABLE',
    SEARCHING = 'SEARCHING',
    BOOKED = 'BOOKED',
}
