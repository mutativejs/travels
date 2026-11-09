# 存储适配器 (/zh/docs/persistence/storage-adapters)

Travels 的持久化不依赖具体存储。唯一需要存储的值，就是 `travels.serialize()` 返回的带版本号快照。用 `Travels.deserialize(...)` 恢复它，再把校验后的快照传给 `restoreTravels(...)`。

本指南针对以下库展示面向生产环境的适配器：

- Dexie.js
- idb
- localForage
- localspace

以下 API 说明已于 2026-05-15 对照最新文档和 npm 包元数据核对：

| 库 | 核对的包版本 | 存储模型 | 适用场景 |
| --- | --- | --- | --- |
| Dexie.js | `dexie@4.4.2` | IndexedDB 表、索引、事务、复杂查询 | 多文档、可搜索的快照目录、自定义清理查询 |
| idb | `idb@8.0.3` | 原生 IndexedDB 之上的轻量 Promise 封装 | 需要显式模式控制的小型 IndexedDB 适配器 |
| localForage | `localforage@1.10.0` | 基于 IndexedDB 和 localStorage 的异步键值 API，并提供面向旧浏览器的遗留 WebSQL 驱动 | 简单浏览器键值持久化，兼顾遗留兼容性 |
| localspace | `localspace@1.2.0` | 兼容 localForage 的异步键值 API，提供 IndexedDB/localStorage 驱动、批量 API、事务和插件 | TypeScript 优先的键值持久化、批处理，以及插件驱动的 TTL/压缩/加密 |

Playwright 端到端测试套件会在真实的浏览器存储实现上检验这些适配器模式。它还会植入结构有效但无法重放的历史记录，以验证语义校验和回退恢复。测试夹具使用测试专用的数据库名，但保存、加载、事务和清理的语义与下面的示例保持一致。

## 快照契约 [#快照契约]

把序列化后的完整快照作为单条存储记录。它包含状态、补丁历史记录、当前位置、可选的元数据以及 Travels 模式版本。

```ts
import {
  restoreTravels,
  Travels,
  TravelsPersistenceError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type TravelsSerializedHistory,
} from 'travels';

type DocumentState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

const createDefaultDocument = (): DocumentState => ({
  title: 'Untitled',
  blocks: [],
});

const createEmptySnapshot = (): TravelsSerializedHistory<DocumentState> => ({
  version: TRAVELS_HISTORY_SCHEMA_VERSION,
  state: createDefaultDocument(),
  patches: { patches: [], inversePatches: [] },
  position: 0,
});

function restoreDocument(raw: unknown) {
  const history = Travels.deserialize<DocumentState>(
    raw ?? createEmptySnapshot(),
    {
      validation: 'semantic',
      fallback: createEmptySnapshot,
      onError(error) {
        if (error instanceof TravelsPersistenceError) {
          console.warn('Ignoring invalid persisted history:', error.code);
        }
      },
    }
  );

  return restoreTravels(history, { maxHistory: 100 });
}
```

为了实现可靠的持久化，状态、保留的补丁值和历史记录元数据必须使用普通对象、稠密数组、字符串、除 `-0` 之外的有限数字、布尔值和 `null`。路径必须是 Travels 接受的 JSON Pointer 字符串，或由字符串或有限非负整数组成的稠密数组；其他值都是无效的路径段。对 `bigint` 进行编码；`NaN`、无穷大和 `-0` 需要规范化，因为 JSON 会拒绝或改变它们。数组空洞以及自定义属性/原型不会被快照或 JSON/JSON Patch 保留；用 `null` 填充空洞，并使用普通数组和对象。即使 IndexedDB 或其他适配器能够存储 Map 和 Set，它们作为 Travels 状态和保留的补丁载荷仍会被拒绝。旧历史记录中仅存在于运行时的值或路径，仍会保留在存储记录中。

下面的适配器示例会复用本节中的 `DocumentState`、`restoreDocument(...)` 和 `attachAutoSave(...)` 定义。

## 自动保存模式 [#自动保存模式]

存储写入通常应做防抖。这样快速编辑时不会每按一次键就写入一个快照，同时仍会持久化 Travels 最新已提交的状态。

```ts
function attachAutoSave(
  travels: ReturnType<typeof restoreDocument>,
  saveSnapshot: (
    snapshot: TravelsSerializedHistory<DocumentState>
  ) => Promise<void>,
  debounceMs = 200
) {
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
}
```

在路由切换或其他由应用控制的关闭时机之前，调用 `flush()`。Travels 实例不再活跃时使用 `dispose()`；它会清除所有待处理的防抖任务、移除订阅，并默认写入最新快照。

如果编辑内容必须在关闭标签页后仍然保留，还要在页面生命周期处理器中调用 `travels.serialize()`，尽力执行最后一次保存；如果页面仍处于活跃状态，也可以调用返回的 `flush()` 方法。这条路径应尽量精简：浏览器关闭事件并不可靠，不适合执行长时间的异步工作。

## Dexie.js [#dexiejs]

Dexie.js 是 IndexedDB 的高层封装，提供表 API、模式版本管理、索引、事务和批量操作。当应用需要保存许多条持久化时间线，并按文档、时间戳、所有者或项目查询时，它很合适。

安装：

```bash
npm install dexie
```

适配器：

```ts
import Dexie, { type Table } from 'dexie';
import type { TravelsSerializedHistory } from 'travels';

type SnapshotRow = {
  key: string;
  value: TravelsSerializedHistory<DocumentState>;
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
    super('travels');

    this.version(1).stores({
      snapshots: 'key, updatedAt',
      snapshotAudit: '++id, key, updatedAt',
    });
  }
}

const db = new TravelsDexieDB();
const SNAPSHOT_KEY = 'document:main';

async function loadSnapshotFromDexie() {
  const row = await db.snapshots.get(SNAPSHOT_KEY);
  return row?.value ?? null;
}

async function saveSnapshotToDexie(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  await db.snapshots.put({
    key: SNAPSHOT_KEY,
    value: snapshot,
    updatedAt: Date.now(),
  });
}

async function initDexiePersistence() {
  const travels = restoreDocument(await loadSnapshotFromDexie());
  const persistence = attachAutoSave(travels, saveSnapshotToDexie);

  return { travels, persistence };
}
```

当一次用户操作同时更新快照和一张关联表时，使用事务：

```ts
async function saveDexieSnapshotWithRelatedRows(
  travels: ReturnType<typeof restoreDocument>
) {
  const updatedAt = Date.now();

  await db.transaction('rw', db.snapshots, db.snapshotAudit, async () => {
    await db.snapshots.put({
      key: SNAPSHOT_KEY,
      value: travels.serialize(),
      updatedAt,
    });

    await db.snapshotAudit.add({
      key: SNAPSHOT_KEY,
      action: 'save',
      updatedAt,
    });
  });
}
```

清理旧快照记录时，使用 `updatedAt` 索引：

```ts
async function deleteDexieSnapshotsOlderThan(cutoff: number) {
  await db.snapshots.where('updatedAt').below(cutoff).delete();
}
```

Dexie 专属说明：

- 使用 `version(...).stores(...)` 进行模式演进。
- 需要原子恢复时，将序列化后的 Travels 快照保存在同一行记录中。
- 只为实际查询的值添加二级索引，例如 `updatedAt`。
- 当持久化属于更大范围的 IndexedDB 数据模型，而不只是一条键值记录时，优先选择 Dexie。

## idb [#idb]

`idb` 是一个轻量的 Promise 封装，接口基本与原生 IndexedDB 一致。当你需要 IndexedDB 的对象存储、索引和事务语义，又不想引入更重的抽象时，它很合适。

安装：

```bash
npm install idb
```

适配器：

```ts
import { openDB, type DBSchema } from 'idb';
import type { TravelsSerializedHistory } from 'travels';

interface TravelsPersistenceDB extends DBSchema {
  snapshots: {
    key: string;
    value: {
      key: string;
      value: TravelsSerializedHistory<DocumentState>;
      updatedAt: number;
    };
    indexes: {
      'by-updatedAt': number;
    };
  };
}

const SNAPSHOT_KEY = 'document:main';

const dbPromise = openDB<TravelsPersistenceDB>('travels', 1, {
  upgrade(db) {
    const store = db.createObjectStore('snapshots', {
      keyPath: 'key',
    });

    store.createIndex('by-updatedAt', 'updatedAt');
  },
});

async function loadSnapshotFromIdb() {
  const db = await dbPromise;
  const row = await db.get('snapshots', SNAPSHOT_KEY);

  return row?.value ?? null;
}

async function saveSnapshotToIdb(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  const db = await dbPromise;
  const tx = db.transaction('snapshots', 'readwrite');

  await tx.store.put({
    key: SNAPSHOT_KEY,
    value: snapshot,
    updatedAt: Date.now(),
  });

  await tx.done;
}

async function deleteIdbSnapshotsOlderThan(cutoff: number) {
  const db = await dbPromise;
  const tx = db.transaction('snapshots', 'readwrite');
  const index = tx.store.index('by-updatedAt');
  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff, true));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

async function initIdbPersistence() {
  const travels = restoreDocument(await loadSnapshotFromIdb());
  const persistence = attachAutoSave(travels, saveSnapshotToIdb);

  return { travels, persistence };
}
```

idb 专属说明：

- `openDB(name, version, { upgrade })` 是创建或迁移对象存储与索引的地方。
- 针对单存储操作，可使用 `db.get(...)`、`db.put(...)`、`db.delete(...)` 和 `db.clear(...)` 这些快捷方法。
- 一次保存包含多个操作时，使用显式事务并 `await tx.done`。
- 不要在活跃的 IndexedDB 事务中间等待无关的异步工作，例如 `fetch(...)`。等待期间事务可能会自动关闭。

## localForage [#localforage]

localForage 提供类似 `localStorage` 的异步 API，包括 `getItem`、`setItem`、`removeItem`、`clear`、`keys` 和 `iterate`。文档给出的默认驱动顺序是 IndexedDB、WebSQL、localStorage，但 WebSQL 在现代浏览器中已被废弃。将 WebSQL 视为遗留迁移场景，并围绕 IndexedDB 设计新的持久化。

安装：

```bash
npm install localforage
```

适配器：

```ts
import localforage from 'localforage';
import type { TravelsSerializedHistory } from 'travels';

const SNAPSHOT_KEY = 'document:main';

const store = localforage.createInstance({
  name: 'travels',
  storeName: 'snapshots',
});

async function loadSnapshotFromLocalForage() {
  await store.ready();

  return store.getItem<TravelsSerializedHistory<DocumentState>>(SNAPSHOT_KEY);
}

async function saveSnapshotToLocalForage(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  await store.setItem(SNAPSHOT_KEY, snapshot);
}

async function initLocalForagePersistence() {
  const travels = restoreDocument(await loadSnapshotFromLocalForage());
  const persistence = attachAutoSave(travels, saveSnapshotToLocalForage);

  return { travels, persistence };
}
```

localForage 专属说明：

- 在任何数据 API 调用之前调用 `config(...)`，或者优先使用 `createInstance(...)` 创建隔离的存储。
- `setItem(...)` 返回已保存的值；键不存在时 `getItem(...)` 返回 `null`。
- `undefined` 不是可持久化的存储值；如果要有意表示空值，使用 `null`。
- `clear()` 会删除当前存储中的全部内容。要删除单个 Travels 快照，使用 `removeItem(key)`。
- localForage 是简单的键值适配器。如果需要原子的多键写入，直接使用 IndexedDB、Dexie.js、idb，或使用以 IndexedDB 为活动驱动的 localspace。

## localspace [#localspace]

localspace 保留了 localForage 风格的存储方法，同时加入 TypeScript 优先的 API、批量操作、事务辅助工具、插件和显式指定的现代驱动。它在浏览器中支持 IndexedDB 和 localStorage，不支持 WebSQL。内存驱动只有在显式添加为回退时才可用，且重新加载后会丢失数据。

安装：

```bash
npm install localspace
```

适配器：

```ts
import localspace from 'localspace';
import type { TravelsSerializedHistory } from 'travels';

const SNAPSHOT_KEY = 'document:main';

const store = localspace.createInstance({
  name: 'travels',
  storeName: 'snapshots',
  driver: [localspace.INDEXEDDB, localspace.LOCALSTORAGE],
});

async function loadSnapshotFromLocalspace() {
  await store.ready();

  return store.getItem<TravelsSerializedHistory<DocumentState>>(SNAPSHOT_KEY);
}

async function saveSnapshotToLocalspace(
  snapshot: TravelsSerializedHistory<DocumentState>
) {
  await store.setItem(SNAPSHOT_KEY, snapshot);
}

async function initLocalspacePersistence() {
  const travels = restoreDocument(await loadSnapshotFromLocalspace());
  const persistence = attachAutoSave(travels, saveSnapshotToLocalspace);

  return { travels, persistence };
}
```

需要同时保存关联记录时，使用 `runTransaction(...)` 或批量 API。在 IndexedDB 驱动下，这具备事务性；localStorage 回退会依次执行这些操作，但无法提供 IndexedDB 风格的原子提交：

```ts
async function saveLocalspaceSnapshotWithRelatedRows(
  travels: ReturnType<typeof restoreDocument>
) {
  await store.runTransaction('readwrite', async (tx) => {
    await tx.set(SNAPSHOT_KEY, travels.serialize());
    await tx.set(`${SNAPSHOT_KEY}:updatedAt`, Date.now());
  });
}
```

如需处理多条时间线：

```ts
async function saveMultipleLocalspaceSnapshots(
  entries: Array<{
    key: string;
    snapshot: TravelsSerializedHistory<DocumentState>;
  }>
) {
  await store.setItems(
    entries.map(({ key, snapshot }) => ({ key, value: snapshot }))
  );
}
```

localspace 专属说明：

- 需要可靠的浏览器回退时，优先使用 `[localspace.INDEXEDDB, localspace.LOCALSTORAGE]`。
- 只有在可以接受仅运行时回退时，才添加 `localspace.MEMORY`。
- 批量场景下，使用 `setItems(...)`、`getItems(...)` 和 `removeItems(...)`。在 localStorage 回退下，批量操作不是原子的。
- 仅对突发性的多键写入使用 `coalesceWrites`。对于单个经过防抖的 `SNAPSHOT_KEY`，通常没有必要。
- 使用加密时，设置 `pluginErrorPolicy: 'strict'`，以免持久化错误被吞掉。
- 销毁插件较多的实例时，调用 `destroy()`。

## 选择适配器 [#选择适配器]

| 需求 | 推荐适配器 |
| --- | --- |
| 每个应用一个快照，API 尽量精简 | localForage 或 localspace |
| 每个应用一个快照，需要严格的 IndexedDB 语义 | idb |
| 多文档、索引、清理查询 | Dexie.js |
| 批量写入，以及兼容 localForage 的迁移路径 | localspace |
| 已有 localForage 代码库 | 优先 localForage；在采用 TypeScript 优先 API 或批处理时改用 localspace |
| 避免 WebSQL，并显式指定现代浏览器驱动 | localspace、idb 或 Dexie.js |

## 迁移与损坏恢复 [#迁移与损坏恢复]

当存储的结构早于 Travels 当前的序列化历史记录模式时，使用 `migrate`：

```ts
type LegacyDocumentSnapshot = {
  version: 0;
  state: DocumentState;
  history: TravelsSerializedHistory<DocumentState>['patches'];
  cursor: number;
};

const history = Travels.deserialize<DocumentState>(stored, {
  validation: 'semantic',
  migrate(snapshot) {
    if (
      snapshot &&
      typeof snapshot === 'object' &&
      (snapshot as { version?: unknown }).version === 0
    ) {
      const legacy = snapshot as LegacyDocumentSnapshot;

      return {
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: legacy.state,
        patches: legacy.history,
        position: legacy.cursor,
      };
    }

    // Current-schema input still goes through Travels' validation below.
    return snapshot as TravelsSerializedHistory<DocumentState>;
  },
  fallback: createEmptySnapshot,
});
```

`migrate` 和函数形式的 `fallback` 都是同步回调。在调用 `Travels.deserialize(...)` 之前，先等待存储、网络或其他异步工作完成。回调若返回类 Promise 的结果，会以 `MIGRATION_FAILED` 或 `FALLBACK_FAILED` 失败，Travels 会捕获其拒绝，以防出现未处理的 Promise 拒绝。

## 完整性与来源 [#完整性与来源]

`Travels.deserialize(...)` 始终验证快照的结构有效性。启用 `validation: 'semantic'` 时，它还会在独立的校验副本上验证历史记录能否在正反两个方向上一致重放，同时不让重放修改传入的状态或补丁值。两种模式都不能证明快照来自何处，也不能证明重建出的过去就是最初记录的那段历史。版本 1 没有独立且可信的历史锚点，因此内部可逆的替代历史记录会被接受，且不会触发 `fallback`。这一边界由 [`test/persistence-semantics.test.ts`](https://github.com/mutativejs/travels/blob/main/test/persistence-semantics.test.ts) 覆盖。

对于对象形式的输入，顶层快照字段以及补丁容器的 `patches` 和 `inversePatches` 字段必须是自有数据属性。访问器和继承字段会被直接拒绝，不会被求值；被接受的字段只会读取一次。补丁历史记录容器、补丁组、数组路径和元数据列表必须是普通的稠密数组，不能带有自定义的自有属性或原型。冻结的普通数组是有效的。校验过程和历史记录克隆过程都使用按索引的数据属性访问，而不是输入自行定义的数组方法，因此格式错误的数组会通过稳定的持久化错误码被拒绝。

当完整性或来源很重要时，验证**必须**在 Travels 之外进行，并且要在反序列化之前完成：

```text
stored bytes -> verify envelope -> decode snapshot -> Travels.deserialize -> restoreTravels
```

如果外部验证失败，丢弃未经验证的快照，并恢复受信任的默认值或最近一次已知可用的快照。不要依赖 `fallback` 去发现内部一致的替代历史记录。

结构校验是默认选项，以保持同步 API 的低延迟行为。它会拒绝格式错误的模式和补丁编码，但不能证明导航一定能够成功应用。对于未经验证或可能已损坏的存储，显式使用语义校验：

```ts
const history = Travels.deserialize(unverifiedSnapshot, {
  validation: 'semantic',
});
```

语义重放会在恢复后的历史记录投入使用之前，发现适用性和可逆性失败。其开销会随可达历史记录增长，也会随每个补丁复制的容器数量增加。如果快照已经由受信任的应用边界完成认证或以其他方式验证，那么在恢复延迟很重要时，可以使用默认的结构校验路径。

根据应用的信任模型选择完整性机制：

| 场景 | 宿主应用的职责 |
| --- | --- |
| 短暂的 UI 撤销/重做 | Travels 的重放校验加上已知安全的回退通常就足够了。 |
| 重要的离线草稿 | 对编码后的字节本身计算校验和，保存单调递增的修订号，并至少保留一份此前已验证的快照。校验和能发现意外损坏，但不能认证写入者。 |
| 多设备同步 | 将文档和租户/用户标识绑定到由服务端控制的修订号，并在反序列化之前处理过期或冲突的快照。 |
| 防篡改存储 | 验证由服务端持有的 HMAC、数字签名或认证加密标签。与攻击者控制的浏览器数据放在一起的密钥，无法建立信任。 |
| 审计级历史记录 | 维护以服务端为权威的仅追加事件日志，以及可信的签名链头或等效的密码学承诺机制。把 Travels 快照视为可重建的客户端缓存。 |

对每个补丁计算哈希、存储额外的检查点，或在同一个可变数据块中嵌入哈希链，都会增加冗余，但本身无法证明历史的原始意图；能够改写该数据块的攻击者，同样可以改写这些值。受信任的校验和、签名、修订号或链承诺，必须由其保护的快照之外的一方掌管。

恢复规则：

- 始终应为浏览器启动路径提供 `fallback`。它能从检测到的解析、迁移和校验失败中恢复；外部完整性失败则必须在反序列化之前选定受信任的快照。
- 对未经验证的快照选择 `validation: 'semantic'`。只有在模式校验已经足够，或受信任的应用边界已经验证过快照时，才使用默认的结构校验模式。
- 使用 `onError` 记录稳定的 `TravelsPersistenceError.code`；针对具体条目的 `INVALID_HISTORY` 重放失败还会标出出错的 `entryIndex` 和重放 `direction`，而整图隔离失败会省略无法如实归因的字段。
- 如果录制时使用了自定义的 Mutative `strict` 或 `mark` 设置，通过 `replayOptions` 传入相同的值，使语义校验采用完全一致的重放规则。
- 在应用边界规范化 Map、Set、内置子类、自定义自有属性、访问器、不可枚举数据、自定义数组原型和非零的 `RegExp.lastIndex` 值；语义比较会将这类结构视为无法验证并拒绝。
- 在恢复后的 Travels 实例上配置 `enableAutoFreeze`；反序列化会有意避免冻结调用方拥有的快照对象。
- 为存储键保留命名空间，例如 `travels:<app>:<documentId>`。
- 如果持久化数据的体积是重要考量，在存储前压缩序列化后的快照，并在 `Travels.deserialize(...)` 之前解压。
- 如果应用数据包含 `bigint`、Date、Map 或 Set 值，在创建或更新 Travels 状态之前对其进行规范化。持久化编解码器可以在 Travels 之外恢复应用领域的集合，但传给 `createTravels(...)` 的状态必须仍是有限数字、时间戳、记录、稠密数组和其他受支持的 JSON 形态值。

## 外部参考 [#外部参考]

- Dexie.js 文档：https://dexie.org/docs/index
- Dexie.js API 参考：https://dexie.org/docs/API-Reference
- idb README 与 API：https://github.com/jakearchibald/idb#readme
- localForage README：https://github.com/localForage/localForage#readme
- localForage API 文档：https://github.com/localForage/localForage/blob/master/docs/api.md
- localspace README：https://github.com/unadlib/localspace#readme
- localspace API 参考：https://github.com/unadlib/localspace/blob/main/docs/api-reference.md
- Chrome Web SQL 弃用时间线：https://developer.chrome.com/blog/web-sql-deprecation-timeline-updated
