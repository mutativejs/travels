/**
 * Persistence adapter examples for localStorage, IndexedDB, and compression.
 */

import {
  Travels,
  TravelsPersistenceError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type TravelsSerializedHistory,
} from '../src/index';

type Snapshot<S> = TravelsSerializedHistory<S>;

export function createLocalStorageAdapter<S>(
  key: string,
  fallbackState: S
) {
  const fallback = (): Snapshot<S> => ({
    version: TRAVELS_HISTORY_SCHEMA_VERSION,
    state: fallbackState,
    patches: { patches: [], inversePatches: [] },
    position: 0,
  });

  return {
    save(snapshot: Snapshot<S>) {
      localStorage.setItem(key, JSON.stringify(snapshot));
    },
    load(): Snapshot<S> {
      return Travels.deserialize<S>(localStorage.getItem(key) ?? '', {
        fallback,
        onError(error) {
          if (error instanceof TravelsPersistenceError) {
            console.warn('Travels persistence fallback:', error.code);
          }
        },
      });
    },
    clear() {
      localStorage.removeItem(key);
    },
  };
}

export function createIndexedDBAdapter<S>(
  databaseName: string,
  storeName = 'travels-history'
) {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

  return {
    async save(key: string, snapshot: Snapshot<S>) {
      const database = await open();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).put(snapshot, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    async load(key: string): Promise<Snapshot<S> | null> {
      const database = await open();
      const snapshot = await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readonly');
        const request = transaction.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();

      return snapshot ? Travels.deserialize<S>(snapshot) : null;
    },
  };
}

type CompressionCodec = {
  compress(input: string): string;
  decompress(input: string): string | null;
};

export function createCompressedStringAdapter<S>(
  codec: CompressionCodec,
  fallbackState: S
) {
  const fallback = (): Snapshot<S> => ({
    version: TRAVELS_HISTORY_SCHEMA_VERSION,
    state: fallbackState,
    patches: { patches: [], inversePatches: [] },
    position: 0,
  });

  return {
    encode(snapshot: Snapshot<S>) {
      return codec.compress(JSON.stringify(snapshot));
    },
    decode(input: string) {
      return Travels.deserialize<S>(codec.decompress(input) ?? '', {
        fallback,
      });
    },
  };
}
