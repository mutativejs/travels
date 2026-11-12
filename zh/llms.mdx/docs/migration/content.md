# 迁移指南 (/travels/zh/llms.mdx/docs/migration/content.md)

## 从 2.x 升级到 3.0 [#从-2x-升级到-30]

Travels 3 把状态所有权、外部 Journal、共享视图与持久化恢复拆分为各自独立的公开能力。

### 通过工厂函数创建时间线 [#通过工厂函数创建时间线]

`Travels` 不再可构造，仅作为 `Travels.deserialize()` 的命名空间保留。

```ts
// 2.x
const travels = new Travels(initialState, options);

// 3.0
const travels = createTravels(initialState, options);
```

`instanceof Travels` 不再可用：右侧现在是普通对象，因此该表达式会在运行时抛出 `TypeError`，在 TypeScript 中也无法通过编译。请改用 `isTravels()` 判断时间线是否拥有状态：

```ts
// 2.x
if (value instanceof Travels) value.back();

// 3.0
if (isTravels(value)) value.back();
```

时间线仍然是可扩展的普通对象，因此[进阶模式指南](/travels/zh/llms.mdx/docs/guides/advanced-patterns/content.md)中的方法包装写法依旧有效，`back()` 这类内部调用也仍会经过被包装的 `go()`。时间线的构造函数不是公开入口：调用 `new travels.constructor(...)` 会抛出 `INVALID_OPERATION`，而不会绕过工厂函数的校验。

如果希望初始状态在编译期就受持久的 JSON 形态状态契约约束、并在运行时立即校验，请使用 `createPatchableTravels()`。

### 只保留一个状态所有者 [#只保留一个状态所有者]

用 `createTravels()` 创建的时间线拥有状态，会暴露状态更新方法，但不提供 `recordPatches()`。用 `createTravelJournal()` 创建的时间线，其状态由外部持有，提供 `recordPatches()`、导航与重置，但不提供那些属于状态所有者的更新方法。

```ts
const journal = createTravelJournal(authoritativeState, {
  apply(transition) {
    authoritativeState = commitThroughOwner(transition.patches);
    return authoritativeState;
  },
});

journal.recordPatches(nextState, {
  patches,
  inversePatches,
  metadata: { label: 'External edit' },
});
```

请从普通 `TravelsOptions` 中移除 `controlledApply`。只与状态相关的方法不再出现在返回的 Journal 对象上，也不会再以“调用即抛错”的方法形式存在。与所有权绑定的选项现在会在运行时直接抛出错误：`apply` 只适用于 Journal 工厂函数，`mutable` 只适用于创建拥有状态的时间线的工厂函数。

手动归档能力也遵循同样的规则。只有当工厂函数接收到 `autoArchive: false` 时，`archive()` 与 `canArchive()` 才会存在；自动归档的时间线在运行时与 TypeScript 类型上都不再包含这两个方法，也不再保留一个只会发出警告的 `archive()` 方法。

Journal 的泛型现在采用与 `Travels` 相同的 `<S, F, A, P>` 顺序。大多数调用点会自行推断这些类型参数，无需改动。如果 v2 代码把补丁选项作为第三个参数显式传入，则需要在它之前插入归档模式：

```ts
// 2.x
type Journal = TravelJournal<State, false, StringPatchOptions>;

// 3.0
type Journal = TravelJournal<State, false, true, StringPatchOptions>;
```

Controls 类型不再携带自动冻结参数，因为没有任何成员用到它。请删除第二个类型参数：

```ts
// 2.x
type Controls = RebasableTravelsControls<State, false, StringPatchOptions>;

// 3.0
type Controls = RebasableTravelsControls<State, StringPatchOptions>;
```

`TravelsControls`、`ManualTravelsControls` 与 `RebasableManualTravelsControls` 也是如此。未被使用的辅助类型 `Value` 与 `InitialValue` 已被移除，请直接使用 `S` 或 `ReadonlyState<S>`。

### 从可变时间线中移除自动冻结 [#从可变时间线中移除自动冻结]

`createTravels()`、`createPatchableTravels()` 与 `restoreTravels()` 会拒绝同时传入 `enableAutoFreeze: true` 与 `mutable: true`，并抛出 `INVALID_OPTION`。可变模式会就地修改正在使用的状态对象；在 2.x 中，冻结每个产出的状态时，也会一并冻结它与该对象共享的部分，因此后续写入这些部分的更新会抛出 `TypeError`。请从可变时间线中移除 `enableAutoFreeze`：

```ts
// 2.x
const travels = new Travels(store, { mutable: true, enableAutoFreeze: true });

// 3.0
const travels = createTravels(store, { mutable: true });
```

当 `enableAutoFreeze` 为字面量 `true` 时，即使 `mutable` 声明为 `boolean` 类型，TypeScript 也会针对这对组合报错。而在运行时计算得出的冻结标志，会在创建时间线时被拒绝。

### 将共享视图视为只读 [#将共享视图视为只读]

`getHistory()` 现在在实例接口与 `TravelsControls` 控制接口上都返回 `readonly ReadonlyState<S>[]`，因此共享数组及其元素在 TypeScript 中均为只读。`TravelsControls` 的属性与方法均为只读，控制对象在任何构建下都处于冻结状态。观察者事件以借用的 `ReadonlyState<S>` 视图暴露状态，以 `ReadonlyTravelPatches` 暴露补丁；其惰性生成的补丁容器、分组、操作与数组路径同样会被冻结。

```ts
const visible = travels.getControls().getHistory(); // readonly ReadonlyState<State>[]
const owned = travels.getHistorySnapshot(); // State[]; detached and mutable
```

`controls.patches` 现在是一个带缓存的、已冻结的 `ReadonlyTravelPatches` 视图，而不再在每次读取时重新深拷贝。在历史发生变化之前，它始终保持同一个引用。此前会修改返回对象的代码，必须先通过 `travels.getPatches()` 复制一份。

补丁操作的值可能包含嵌套对象，因此观察者仍应把整个事件视为只读。若需要一份与内部状态解耦、归调用方所有的已保留历史快照，请使用 `getPatches()`。

### 通过单一校验路径恢复 [#通过单一校验路径恢复]

移除不携带状态的 `TravelsHistory` 输入类型，以及 `history`、`initialPatches`、`initialPosition` 与 `strictInitialPatches`。请使用 `Travels.deserialize()` 解码已存储的输入，并原子地恢复完整快照：

```ts
const history = Travels.deserialize<State>(stored, {
  validation: 'semantic',
  fallback: emptySnapshot,
});

const travels = restoreTravels(history);
```

格式错误的快照现在会抛出错误，而不再被丢弃。如果确实希望进行容错恢复，请使用 `Travels.deserialize(..., { fallback })`。

独立的 `deserializeTravelsHistory()` 导出与 `Travels.deserialize()` 功能重复，已被移除；请用相同的参数调用 `Travels.deserialize()`。

`restoreTravels()` 会保留 `snapshot.state` 的一份独立副本，绝不会修改原快照或被复用的回退快照。如果可变集成把历史挂到了某个正在使用的可观察 Store 上，就必须把该 Store 指定为恢复目标：

```ts
// 2.x
const travels = new Travels(store, {
  mutable: true,
  history: Travels.deserialize(stored),
});

// 3.0
const travels = restoreTravels(Travels.deserialize(stored), {
  mutable: true,
  target: store,
});
```

Travels 会用快照状态就地覆盖 `target`，因此 Store 不再需要预先填入与恢复后历史一致的数据。

### 升级官方绑定 [#升级官方绑定]

`use-travel@3` 通过 `createTravels()` 创建由组件拥有的时间线。对于需要恢复的共享时间线，请在 React 之外完成恢复，再把实例传给 `useTravelStore()`：

```ts
const snapshot = Travels.deserialize<State>(stored);
const timeline = restoreTravels(snapshot);

function Editor() {
  const [state, setState, controls] = useTravelStore(timeline);
  // ...
}
```

`zustand-travel@3` 通过其专属的 `snapshot` 选项恢复一份完整的序列化历史，同时 Zustand 仍是状态所有者。拥有状态的 `Travels` 实例会被有意拒绝。初始化函数依然用于定义 action，快照则提供数据基线：

```ts
const snapshot = Travels.deserialize<State>(stored);

const useStore = create<State & Actions>()(
  travel(
    (set) => ({
      ...defaultState,
      updateTitle: (title) =>
        set((state) => {
          state.title = title;
        }),
    }),
    { snapshot }
  )
);
```

`use-travel@3` 要求 `travels@^3.0.0`，而 `zustand-travel@3` 要求 `travels@^3.0.1`；安装 `travels@^3.0.1` 可同时满足两者。请先发布或安装核心包的大版本，再逐个升级绑定。这样能让工厂函数重载、`restoreTravels()` 边界、只读共享视图以及返回的控制对象都遵循同一份带版本号的契约，而不必让它们的行为取决于 peer 依赖的解析结果。

### 导航在单个事件中归档待处理改动 [#导航在单个事件中归档待处理改动]

当 `autoArchive` 为 `false` 时，若存在待处理改动，导航会把这些改动作为导航过程的一部分进行归档。2.x 会先发出 `archive` 事件，再发出 `go` 事件；3.0 则先暂存待处理条目，等导航成功后才提交，并且只发出一个 `go` 事件，`getRevision()` 也只前进一次，不可变模式与可变模式都是如此。此前只在 `archive` 事件上做持久化的监听器，应改为在每个提交事件上持久化：

```ts
// 2.x
travels.subscribe(({ type }) => {
  if (type === 'archive') save(travels.serialize());
});

// 3.0
travels.subscribe(() => save(travels.serialize()));
```

### 将 Mutative 升级到 2 [#将-mutative-升级到-2]

Travels 3 将 `mutative@^2.0.0` 作为 peer 依赖。请随 Travels 一同升级：

```sh
npm install travels@3 mutative@2
```

Mutative 2 保留了 Travels 所用的 API，Travels 无需更改任何选项。Mutative 1.x 的补丁无法正确撤销某些更新，例如在一次草稿更新中先缩短又加长的数组，撤销后会留下空洞；又如元素从 `0` 变为 `-0`，撤销后仍为 `-0`。Mutative 2 能记录这两种情况。

以下 Mutative 2 的运行时变更会经由 Travels 影响到应用，请检查你的构建：

- Mutative 2 的构建目标为 ES2018。对于支持 `Proxy` 但不支持 ES2018 语法的引擎，需要转译 `mutative`。
- Mutative 通过读取 `process.env.NODE_ENV` 来选择开发版或生产版构建。请在每个 bundle 中都定义该变量，包括面向 Node.js 的 bundle。若要在不使用打包器的情况下加载 ES 模块，请把 `mutative` 映射到 `mutative/dist/mutative.esm.production.min.mjs`，或用 Travels 的 UMD 构建搭配 Mutative 的 UMD 构建。
- Mutative 2 的补丁直接以“下一状态”中的对象作为值，而不再存深拷贝。因此在不可变模式下，从 `getState()` 读到的对象同时也是已保留历史的一部分，在 Travels 之外修改它会改变重做时重放的内容。请把状态视为只读，或启用 `enableAutoFreeze` 让这类修改抛出错误。可变模式不受影响，因为它存储的是与状态解耦的补丁值。
- Mutative 的生产版构建抛出的是 `Minified Mutative error #<code>`，而不是完整错误信息。在生产环境中请匹配错误码，而非错误文本。
- 如果你自己的代码也会调用 Mutative，请查阅其 [v1 到 v2 迁移指南](https://mutative.js.org/docs/advanced-guides/migration-v2)。

### 更新观察者与运行时兼容性 [#更新观察者与运行时兼容性]

订阅者与 devtools 都应使用 `TravelsEvent`。已废弃的 `TravelsDevtoolsEvent` 别名，以及基于监听器参数个数的 `LEGACY_SUBSCRIBER` 警告都已被移除。使用位置参数的监听器必须改写为接收单个事件对象。

Travels 3 要求 Node.js 22 或更高版本，并已在 Node.js 22 与 24 上测试。

## 从 Redux-undo 迁移 [#从-redux-undo-迁移]

Redux-undo 存储完整的状态快照，Travels 存储的是 JSON Patch 条目。

1. 保留现有的 reducer 或状态更新函数，作为状态变更的来源。
2. 用 reducer 的状态创建一个 Travels 实例。
3. 把 `UNDO` / `REDO` 的 dispatch 替换为 `travels.back()` / `travels.forward()`。
4. 撤销菜单的文案使用 `metadata` 标签。
5. 使用 `travels.serialize()` 进行持久化，而不再存储整个 Redux-undo 历史对象。

对于状态较小、只需短期本地历史的场景，快照栈仍可能更合适。当序列化后的历史体积成为关键因素时，Travels 的优势最为明显。

## 从 Zundo 迁移 [#从-zundo-迁移]

Zundo 直接集成到 Zustand Store 中。你可以把 Travels 当作独立的历史引擎使用：

1. 继续用 Zustand 作为 UI Store。
2. 在 Store 的 action 中调用 `travels.setState(...)`。
3. 在状态变更后，把 `travels.getState()` 同步回 Zustand。
4. 需要持久化历史时，使用 `Travels.deserialize(...)` 与 `restoreTravels(...)`。

参见 [`examples/zustand.ts`](https://github.com/mutativejs/travels/blob/main/examples/zustand.ts)。

## 从 use-travel 迁移 [#从-use-travel-迁移]

`use-travel` 是 React Hook 的封装。当你需要与框架无关的控制能力、持久化适配器、元数据或自定义 Store 集成时，请直接使用 Travels。

1. 创建 `const travels = createTravels(initialState)`。
2. 使用 `useSyncExternalStore(travels.subscribe, travels.getRevision)` 订阅，并在渲染过程中读取 `travels.getState()`。
3. 把 `travels.getControls()` 暴露给组件。
4. 页面重新加载时使用 `serialize()` / `Travels.deserialize()`。

参见 [`examples/react-integration.tsx`](https://github.com/mutativejs/travels/blob/main/examples/react-integration.tsx)。

## 从位置参数订阅回调迁移 [#从位置参数订阅回调迁移]

订阅者现在收到的事件对象与 `devtools` hook 相同，都是 `TravelsEvent`。请用事件解构替换位置参数的回调形参：

```ts
// Before
travels.subscribe((state, patches, position, historyLength) => {
  render(state, position);
});

// After
travels.subscribe(
  ({ type, state, patches, position, historyLength, metadata }) => {
    render(state, position);
  }
);
```

对于同一次通知，所有观察者共享同一个浅冻结的事件对象。其 `patches` 属性仍是仅属于该事件的增量，并按需惰性生成；补丁容器、分组、操作与数组路径都会被冻结。顶层元数据在首次访问时被克隆并冻结。嵌套的补丁值与元数据仅属于该事件，但由该事件的所有观察者共享，请将它们视为只读。需要完整的已保留历史时，请调用 `travels.getPatches()`。`TravelsDevtoolsEvent` 在 2.x 中已是废弃别名，3.0 中已被移除。忽略参数的回调（例如外部 Store 的失效通知函数）可以保持不变。

## 从 Map/Set 状态迁移 [#从-mapset-状态迁移]

Travels 不再支持在不可变状态或可变状态中使用 Map 或 Set。初始状态与更新会立即失败，恢复的状态或补丁载荷若包含集合，也会在结构校验阶段被拒绝。请在创建或更新 Travels 实例之前先把集合规范化：

```ts
type Item = { id: string; title: string };

type LegacyState = {
  itemsById: Map<string, Item>;
  selectedIds: Set<string>;
};

type TravelsState = {
  itemsById: Record<string, Item>;
  selectedIds: string[];
};

declare const legacyState: LegacyState;

const normalizeState = (state: LegacyState): TravelsState => ({
  itemsById: Object.fromEntries(state.itemsById),
  selectedIds: Array.from(state.selectedIds),
});

const travels = createTravels(normalizeState(legacyState));
```

对于键不是字符串或键为对象的 Map，请先改用稳定的字符串 ID，再进行转换。应用所需的 Map/Set 视图应保留在 Travels 之外，并由规范化后的状态派生。

不要重放由 Map/Set 变更生成的旧补丁历史。这类历史可能包含集合专属的值，或包含非 JSON 的路径定位符，其引用同一性无法可靠迁移。请在 Travels 之外解码旧记录，还原出该记录权威的当前状态，再对该状态做规范化，并建立新的历史基线。持久化编解码器可以在应用领域的集合类型与存储格式之间转换，但传给 Travels 的输出必须仍符合受支持的 JSON 形态契约。

## 持久化迁移 [#持久化迁移]

早期手写的持久化通常保存 `{ state, patches, position }`。可以用 `migrate` 转换：

Travels 3 只有一条恢复路径。请把 `Travels.deserialize(...)` 的完整结果传给 `restoreTravels()`；原有的 `history`、`initialPatches`、`initialPosition` 与 `strictInitialPatches` 选项已不存在。格式错误的快照会抛出错误，而不再静默地从空时间线开始。

```ts
const history = Travels.deserialize<State>(stored, {
  validation: 'semantic',
});

const travels = restoreTravels(history);
```

迁移回调与函数形式的回退回调都必须同步返回。请先完成异步的存储或网络操作，再调用 `Travels.deserialize(...)`；返回 Promise 类结果的回调会以 `MIGRATION_FAILED` 或 `FALLBACK_FAILED` 被拒绝，而且不会留下未处理的 rejection。

```ts
type CurrentSnapshot = TravelsSerializedHistory<TravelsState>;

const history = Travels.deserialize<TravelsState>(stored, {
  validation: 'semantic',
  migrate(snapshot) {
    if (snapshot && typeof snapshot === 'object' && !('version' in snapshot)) {
      const legacy = snapshot as Omit<CurrentSnapshot, 'version'>;

      return {
        version: 1,
        state: legacy.state,
        patches: legacy.patches,
        position: legacy.position,
      };
    }

    return snapshot as CurrentSnapshot;
  },
});
```
