import Dexie, { type Table } from 'dexie';
import { openDB, type DBSchema } from 'idb';
import localforage from 'localforage';
import localspace from 'localspace';
import {
  createTravels,
  Travels,
  TravelsPersistenceError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type TravelsSerializedHistory,
} from 'travels';

type DocumentState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

type Snapshot = TravelsSerializedHistory<DocumentState>;
type AdapterName = 'dexie' | 'idb' | 'localforage' | 'localspace';
type AdapterInfo = {
  rows?: number;
  audit?: number;
  metadata?: string;
};

type Adapter = {
  label: string;
  load: () => Promise<Snapshot | null>;
  save: (snapshot: Snapshot) => Promise<void>;
  clear: () => Promise<void>;
  info: () => Promise<AdapterInfo>;
  transactionSave?: (snapshot: Snapshot) => Promise<void>;
  seedOldRows?: () => Promise<void>;
  pruneOldRows?: () => Promise<void>;
};

const createDefaultDocument = (): DocumentState => ({
  title: 'Untitled',
  blocks: [],
});

const createEmptySnapshot = (): Snapshot => ({
  version: TRAVELS_HISTORY_SCHEMA_VERSION,
  state: createDefaultDocument(),
  patches: { patches: [], inversePatches: [] },
  position: 0,
});

const restoreTravels = (
  raw: unknown,
  onFallback?: (code: TravelsPersistenceError['code']) => void
) => {
  const history = Travels.deserialize<DocumentState>(
    raw ?? createEmptySnapshot(),
    {
      validation: 'semantic',
      fallback: createEmptySnapshot,
      onError(error) {
        if (error instanceof TravelsPersistenceError) {
          onFallback?.(error.code);
          console.warn('Ignoring invalid persisted history:', error.code);
        }
      },
    }
  );

  return createTravels(history.state, {
    history,
    maxHistory: 100,
    strictInitialPatches: true,
    warnOnUnsupportedState: false,
  });
};

const createUnreplayableSnapshot = (): Snapshot => ({
  version: TRAVELS_HISTORY_SCHEMA_VERSION,
  state: createDefaultDocument(),
  patches: {
    patches: [
      [{ op: 'replace', path: ['missing', 'value'], value: 'corrupted' }],
    ],
    inversePatches: [
      [{ op: 'replace', path: ['missing', 'value'], value: 'previous' }],
    ],
  },
  position: 0,
});

const attachAutoSave = (
  travels: ReturnType<typeof restoreTravels>,
  saveSnapshot: (snapshot: Snapshot) => Promise<void>,
  debounceMs = 200
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingSave = Promise.resolve();

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const flush = async () => {
    clearTimer();

    const snapshot = travels.serialize();

    pendingSave = pendingSave
      .catch(() => undefined)
      .then(() => saveSnapshot(snapshot));

    await pendingSave;
  };

  const unsubscribe = travels.subscribe(() => {
    clearTimer();

    timer = setTimeout(() => {
      void flush().catch((error) => {
        console.error('Failed to persist Travels history:', error);
      });
    }, debounceMs);
  });

  return {
    flush,
    async dispose(options: { flush?: boolean } = { flush: true }) {
      clearTimer();
      unsubscribe();

      if (options.flush !== false) {
        await flush();
      }
    },
  };
};

type SnapshotRow = {
  key: string;
  value: Snapshot;
  updatedAt: number;
};

type SnapshotAuditRow = {
  id?: number;
  key: string;
  action: 'save';
  updatedAt: number;
};

class TravelsDexieDB extends Dexie {
  snapshots!: Table<SnapshotRow, string>;
  snapshotAudit!: Table<SnapshotAuditRow, number>;

  constructor() {
    super('travels-e2e-dexie');

    this.version(1).stores({
      snapshots: 'key, updatedAt',
      snapshotAudit: '++id, key, updatedAt',
    });
  }
}

const SNAPSHOT_KEY = 'document:main';
const OLD_SNAPSHOT_KEY = 'document:old';
const UPDATED_AT_KEY = `${SNAPSHOT_KEY}:updatedAt`;

const db = new TravelsDexieDB();

const loadSnapshotFromDexie = async () => {
  const row = await db.snapshots.get(SNAPSHOT_KEY);
  return row?.value ?? null;
};

const saveSnapshotToDexie = async (snapshot: Snapshot) => {
  await db.snapshots.put({
    key: SNAPSHOT_KEY,
    value: snapshot,
    updatedAt: Date.now(),
  });
};

const saveDexieSnapshotWithRelatedRows = async (snapshot: Snapshot) => {
  const updatedAt = Date.now();

  await db.transaction('rw', db.snapshots, db.snapshotAudit, async () => {
    await db.snapshots.put({
      key: SNAPSHOT_KEY,
      value: snapshot,
      updatedAt,
    });

    await db.snapshotAudit.add({
      key: SNAPSHOT_KEY,
      action: 'save',
      updatedAt,
    });
  });
};

const dexieAdapter: Adapter = {
  label: 'Dexie.js',
  load: loadSnapshotFromDexie,
  save: saveSnapshotToDexie,
  clear: async () => {
    await db.snapshots.clear();
    await db.snapshotAudit.clear();
  },
  info: async () => ({
    rows: await db.snapshots.count(),
    audit: await db.snapshotAudit.count(),
  }),
  transactionSave: saveDexieSnapshotWithRelatedRows,
};

interface TravelsPersistenceDB extends DBSchema {
  snapshots: {
    key: string;
    value: SnapshotRow;
    indexes: {
      'by-updatedAt': number;
    };
  };
}

const dbPromise = openDB<TravelsPersistenceDB>('travels-e2e-idb', 1, {
  upgrade(upgradeDb) {
    const store = upgradeDb.createObjectStore('snapshots', {
      keyPath: 'key',
    });

    store.createIndex('by-updatedAt', 'updatedAt');
  },
});

const loadSnapshotFromIdb = async () => {
  const idb = await dbPromise;
  const row = await idb.get('snapshots', SNAPSHOT_KEY);

  return row?.value ?? null;
};

const saveSnapshotToIdb = async (snapshot: Snapshot) => {
  const idb = await dbPromise;
  const tx = idb.transaction('snapshots', 'readwrite');

  await tx.store.put({
    key: SNAPSHOT_KEY,
    value: snapshot,
    updatedAt: Date.now(),
  });

  await tx.done;
};

const deleteIdbSnapshotsOlderThan = async (cutoff: number) => {
  const idb = await dbPromise;
  const tx = idb.transaction('snapshots', 'readwrite');
  const index = tx.store.index('by-updatedAt');
  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff, true));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
};

const idbAdapter: Adapter = {
  label: 'idb',
  load: loadSnapshotFromIdb,
  save: saveSnapshotToIdb,
  clear: async () => {
    const idb = await dbPromise;
    await idb.clear('snapshots');
  },
  info: async () => {
    const idb = await dbPromise;
    return { rows: await idb.count('snapshots') };
  },
  seedOldRows: async () => {
    const idb = await dbPromise;
    const tx = idb.transaction('snapshots', 'readwrite');

    await tx.store.put({
      key: OLD_SNAPSHOT_KEY,
      value: createEmptySnapshot(),
      updatedAt: 1,
    });

    await tx.done;
  },
  pruneOldRows: async () => {
    await deleteIdbSnapshotsOlderThan(Date.now() - 1000);
  },
};

const localForageStore = localforage.createInstance({
  name: 'travels-e2e-localforage',
  storeName: 'snapshots',
});

const localForageAdapter: Adapter = {
  label: 'localForage',
  load: async () => {
    await localForageStore.ready();

    return localForageStore.getItem<Snapshot>(SNAPSHOT_KEY);
  },
  save: async (snapshot) => {
    await localForageStore.setItem(SNAPSHOT_KEY, snapshot);
  },
  clear: async () => {
    await localForageStore.ready();
    await localForageStore.removeItem(SNAPSHOT_KEY);
  },
  info: async () => {
    await localForageStore.ready();
    const keys = await localForageStore.keys();

    return { rows: keys.length };
  },
};

const localspaceStore = localspace.createInstance({
  name: 'travels-e2e-localspace',
  storeName: 'snapshots',
  driver: [localspace.INDEXEDDB, localspace.LOCALSTORAGE],
});

const localspaceAdapter: Adapter = {
  label: 'localspace',
  load: async () => {
    await localspaceStore.ready();

    return localspaceStore.getItem<Snapshot>(SNAPSHOT_KEY);
  },
  save: async (snapshot) => {
    await localspaceStore.setItem(SNAPSHOT_KEY, snapshot);
  },
  clear: async () => {
    await localspaceStore.ready();
    await localspaceStore.removeItems([SNAPSHOT_KEY, UPDATED_AT_KEY]);
  },
  info: async () => {
    await localspaceStore.ready();
    const keys = await localspaceStore.keys();
    const updatedAt = await localspaceStore.getItem<number>(UPDATED_AT_KEY);

    return {
      rows: keys.filter((key) => key.startsWith('document:')).length,
      metadata: updatedAt ? 'updated' : '',
    };
  },
  transactionSave: async (snapshot) => {
    await localspaceStore.runTransaction('readwrite', async (tx) => {
      await tx.set(SNAPSHOT_KEY, snapshot);
      await tx.set(UPDATED_AT_KEY, Date.now());
    });
  },
};

const adapters: Record<AdapterName, Adapter> = {
  dexie: dexieAdapter,
  idb: idbAdapter,
  localforage: localForageAdapter,
  localspace: localspaceAdapter,
};

const adapterNames = Object.keys(adapters) as AdapterName[];

const setPanelText = (root: HTMLElement, testId: string, value: string) => {
  const element = root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`Missing element: ${testId}`);
  }
  element.textContent = value;
};

const runPanelAction = async (
  root: HTMLElement,
  name: AdapterName,
  action: () => Promise<void>
) => {
  try {
    await action();
  } catch (error) {
    setPanelText(
      root,
      `${name}-adapter-status`,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
};

const renderInfo = async (
  root: HTMLElement,
  name: AdapterName,
  adapter: Adapter
) => {
  const info = await adapter.info();

  setPanelText(root, `${name}-adapter-rows`, String(info.rows ?? 0));
  setPanelText(root, `${name}-adapter-audit`, String(info.audit ?? 0));
  setPanelText(root, `${name}-adapter-metadata`, info.metadata ?? '');
};

const initAdapterPanel = async (root: HTMLElement, name: AdapterName) => {
  const adapter = adapters[name];

  root.insertAdjacentHTML(
    'beforeend',
    `
      <section class="adapter-panel" data-adapter="${name}">
        <h3>${adapter.label}</h3>
        <p class="value" data-testid="${name}-adapter-state"></p>
        <p class="value" data-testid="${name}-adapter-position"></p>
        <p class="value" data-testid="${name}-adapter-status">loading</p>
        <p class="value" data-testid="${name}-adapter-rows">0</p>
        <p class="value" data-testid="${name}-adapter-audit">0</p>
        <p class="value" data-testid="${name}-adapter-metadata"></p>
        <div class="row">
          <button data-testid="${name}-adapter-add-block">Add Block</button>
          <button data-testid="${name}-adapter-publish">Publish</button>
          <button data-testid="${name}-adapter-flush">Flush</button>
          <button data-testid="${name}-adapter-transaction">Transaction Save</button>
          <button data-testid="${name}-adapter-seed-old">Seed Old</button>
          <button data-testid="${name}-adapter-seed-corrupt">Seed Corrupt</button>
          <button data-testid="${name}-adapter-prune-old">Prune Old</button>
          <button data-testid="${name}-adapter-back">Back</button>
          <button data-testid="${name}-adapter-forward">Forward</button>
          <button data-testid="${name}-adapter-clear">Clear</button>
        </div>
      </section>
    `
  );

  const panel = root.querySelector<HTMLElement>(`[data-adapter="${name}"]`)!;
  let fallbackCode: TravelsPersistenceError['code'] | undefined;
  const travels = restoreTravels(await adapter.load(), (code) => {
    fallbackCode = code;
  });
  const controls = travels.getControls();
  const persistence = attachAutoSave(travels, adapter.save);

  const render = async () => {
    const state = travels.getState();

    setPanelText(
      root,
      `${name}-adapter-state`,
      `${state.title}|${state.blocks.map((block) => block.text).join(',')}`
    );
    setPanelText(root, `${name}-adapter-position`, String(travels.getPosition()));
    await renderInfo(root, name, adapter);
  };

  travels.subscribe(() => {
    void render();
  });

  panel
    .querySelector(`[data-testid="${name}-adapter-add-block"]`)!
    .addEventListener('click', () => {
      travels.setState((draft) => {
        const index = draft.blocks.length + 1;
        draft.blocks.push({ id: String(index), text: `Block ${index}` });
      });
      setPanelText(root, `${name}-adapter-status`, 'dirty');
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-publish"]`)!
    .addEventListener('click', () => {
      travels.setState((draft) => {
        draft.title = 'Published';
      });
      setPanelText(root, `${name}-adapter-status`, 'dirty');
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-flush"]`)!
    .addEventListener('click', () => {
      void runPanelAction(root, name, async () => {
        await persistence.flush();
        setPanelText(root, `${name}-adapter-status`, 'saved');
        await renderInfo(root, name, adapter);
      });
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-transaction"]`)!
    .addEventListener('click', () => {
      void runPanelAction(root, name, async () => {
        if (!adapter.transactionSave) {
          setPanelText(root, `${name}-adapter-status`, 'unsupported');
          return;
        }

        await adapter.transactionSave(travels.serialize());
        setPanelText(root, `${name}-adapter-status`, 'transaction-saved');
        await renderInfo(root, name, adapter);
      });
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-seed-old"]`)!
    .addEventListener('click', () => {
      void runPanelAction(root, name, async () => {
        if (!adapter.seedOldRows) {
          setPanelText(root, `${name}-adapter-status`, 'unsupported');
          return;
        }

        await adapter.seedOldRows();
        setPanelText(root, `${name}-adapter-status`, 'old-seeded');
        await renderInfo(root, name, adapter);
      });
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-prune-old"]`)!
    .addEventListener('click', () => {
      void runPanelAction(root, name, async () => {
        if (!adapter.pruneOldRows) {
          setPanelText(root, `${name}-adapter-status`, 'unsupported');
          return;
        }

        await adapter.pruneOldRows();
        setPanelText(root, `${name}-adapter-status`, 'old-pruned');
        await renderInfo(root, name, adapter);
      });
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-seed-corrupt"]`)!
    .addEventListener('click', () => {
      void runPanelAction(root, name, async () => {
        await adapter.save(createUnreplayableSnapshot());
        setPanelText(root, `${name}-adapter-status`, 'corrupt-seeded');
        await renderInfo(root, name, adapter);
      });
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-back"]`)!
    .addEventListener('click', () => {
      controls.back();
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-forward"]`)!
    .addEventListener('click', () => {
      controls.forward();
    });

  panel
    .querySelector(`[data-testid="${name}-adapter-clear"]`)!
    .addEventListener('click', () => {
      void runPanelAction(root, name, async () => {
        await persistence.dispose({ flush: false });
        await adapter.clear();
        setPanelText(root, `${name}-adapter-status`, 'cleared');
        await renderInfo(root, name, adapter);
      });
    });

  setPanelText(
    root,
    `${name}-adapter-status`,
    fallbackCode ? `fallback:${fallbackCode}` : 'ready'
  );
  await render();
};

export const initPersistenceAdapters = () => {
  const root = document.getElementById('persistence-adapters-root');
  if (!root) {
    throw new Error('Missing persistence adapters root');
  }

  root.innerHTML = '<div class="adapter-grid"></div>';
  const grid = root.querySelector<HTMLElement>('.adapter-grid')!;

  adapterNames.forEach((name) => {
    void initAdapterPanel(grid, name);
  });
};
