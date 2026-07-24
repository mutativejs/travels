import { apply, type Patches } from 'mutative';
import type { PatchesOption } from '../type.js';

type MutableStateJournalEntry<P extends PatchesOption> = {
  state: object;
  inversePatches: Patches<P>;
};

/**
 * Owns the mutable rollback journal used by nested transactions. Timeline and
 * observer snapshots stay in Travels, while imperative state rollback is kept
 * behind this focused coordinator.
 */
export class TransactionCoordinator<P extends PatchesOption = {}> {
  private readonly stateJournal: MutableStateJournalEntry<P>[] = [];

  public get journalLength(): number {
    return this.stateJournal.length;
  }

  public recordMutableChange(
    transactionDepth: number,
    state: object,
    inversePatches: Patches<P>
  ): void {
    if (transactionDepth > 0 && inversePatches.length > 0) {
      this.stateJournal.push({ state, inversePatches });
    }
  }

  public rollbackTo(journalLength: number): void {
    for (
      let index = this.stateJournal.length - 1;
      index >= journalLength;
      index -= 1
    ) {
      const entry = this.stateJournal[index];
      apply(entry.state, entry.inversePatches, { mutable: true });
    }
    this.stateJournal.length = journalLength;
  }

  public truncateTo(journalLength: number): void {
    this.stateJournal.length = journalLength;
  }
}
