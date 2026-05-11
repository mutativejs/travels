/**
 * Local-first persistence example.
 *
 * Persists versioned Travels snapshots to IndexedDB and broadcasts updates to
 * other tabs. Conflict resolution is intentionally simple: this is local-first
 * single-user persistence, not a CRDT/OT collaboration layer.
 */

import {
  createTravels,
  Travels,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type TravelsSerializedHistory,
} from '../src/index';

type DocumentState = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
};

const databaseName = 'travels-local-first';
const storeName = 'documents';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveSnapshot(
  key: string,
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(snapshot, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function loadSnapshot(
  key: string,
  fallback: TravelsSerializedHistory<DocumentState>
) {
  const database = await openDatabase();
  const snapshot = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();

  return snapshot
    ? Travels.deserialize<DocumentState>(snapshot, { fallback })
    : null;
}

export async function createLocalFirstDocument(documentId: string) {
  const fallback: TravelsSerializedHistory<DocumentState> = {
    version: TRAVELS_HISTORY_SCHEMA_VERSION,
    state: {
      id: documentId,
      title: 'Untitled',
      body: '',
      updatedAt: Date.now(),
    },
    patches: { patches: [], inversePatches: [] },
    position: 0,
  };

  const persisted = (await loadSnapshot(documentId, fallback)) ?? fallback;
  const travels = createTravels(persisted.state, {
    history: persisted,
    maxHistory: 1000,
    strictInitialPatches: true,
  });
  const channel = new BroadcastChannel(`travels:${documentId}`);
  let applyingRemoteSnapshot = false;

  travels.subscribe(() => {
    const snapshot = travels.serialize();
    saveSnapshot(documentId, snapshot);
    if (!applyingRemoteSnapshot) {
      channel.postMessage(snapshot);
    }
  });

  channel.onmessage = (event: MessageEvent<unknown>) => {
    const remote = Travels.deserialize<DocumentState>(event.data, {
      fallback: travels.serialize(),
    });

    if (remote.state.updatedAt <= travels.getState().updatedAt) {
      return;
    }

    applyingRemoteSnapshot = true;
    try {
      travels.replaceStateWithoutHistory(remote.state);
    } finally {
      applyingRemoteSnapshot = false;
    }
  };

  return travels;
}
