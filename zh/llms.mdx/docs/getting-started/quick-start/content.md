# 快速开始 (/zh/docs/getting-started/quick-start)

本指南会为一个文档编辑器构建一套小型历史记录。这套 API 同样适用于原生 JavaScript、TypeScript 以及各类框架集成。

## 1. 创建时间线 [#1-创建时间线]

传入初始状态，并可选地指定最多保留多少个补丁条目：

```ts
import { createTravels } from 'travels';

type DocumentState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

const travels = createTravels<DocumentState>(
  { title: 'Untitled', blocks: [] },
  { maxHistory: 100 }
);
```

初始状态是位置 `0` 处的基线。`maxHistory` 限制的是保留的转换数量，而不是 `getHistory()` 返回的状态数量；一个包含 100 个补丁的窗口最多可以暴露 101 个状态。

## 2. 记录一次编辑 [#2-记录一次编辑]

使用草稿函数可以获得最自然的更新写法：

```ts
travels.setState(
  (draft) => {
    draft.title = 'Product brief';
    draft.blocks.push({ id: 'intro', text: 'A reversible edit.' });
  },
  {
    label: 'Edit introduction',
    source: 'editor',
    timestamp: Date.now(),
  }
);
```

Travels 会提交一个不可变状态，保存正向与反向补丁，推进游标，并通知订阅者。元数据会附加到历史条目上，并包含在持久化快照中。

你也可以直接传入新值，或返回一个新状态。更新函数必须是同步的：

```ts
travels.setState({ title: 'A new title', blocks: [] });
travels.setState(() => ({ title: 'Another title', blocks: [] }));
```

不产生任何补丁的空操作不会创建历史条目，也不会发布事件。

## 3. 观察已提交的变更 [#3-观察已提交的变更]

订阅一次，并在所有者销毁时清理：

```ts
const unsubscribe = travels.subscribe(
  ({ type, state, position, historyLength, metadata }) => {
    console.log({ type, state, position, historyLength, metadata });
  }
);

// Later, when the editor is destroyed:
unsubscribe();
```

事件会在时间线提交之后发布。请将 `event.state`、`event.patches` 与 `event.metadata` 视为只读。不要在观察者中同步调用会修改状态的 Travels API；如需后续处理，请调度到之后的任务中执行。

## 4. 加入撤销、重做与导航 [#4-加入撤销重做与导航]

```ts
if (travels.canBack()) travels.back();
if (travels.canForward()) travels.forward();

travels.back(2);      // Move back two entries
travels.forward(2);   // Move forward two entries
travels.go(0);        // Jump to the retained window start
travels.reset();      // Restore the instance baseline and clear the timeline
```

如果 UI 组件只需要导航能力，而不应拿到完整的、拥有状态的实例，可以使用缓存的控制接口：

```ts
const controls = travels.getControls();

controls.back();
controls.forward();
console.log(controls.position, controls.canBack(), controls.canForward());
```

撤销之后再提交编辑，会丢弃重做分支。当应用需要感知这次清理时，使用 `onBranchDiscard`。

## 5. 把一次逻辑操作合并为一步 [#5-把一次逻辑操作合并为一步]

当多次更新应当成为一个撤销步骤，并且观察者只应看到最终结果时，使用事务：

```ts
travels.transaction({ label: 'Revise document' }, () => {
  travels.setState((draft) => {
    draft.blocks.push({ id: 'revision', text: 'First revision' });
  });
  travels.setState((draft) => {
    draft.title = 'Revised brief';
  });
});
```

`batch()` 是 `transaction()` 的别名。事务回调必须是同步的；如果执行失败，通过 Travels API 所做的更改会回滚。更多内容见[事务](/zh/docs/guides/transactions)。

## 6. 保存并恢复时间线 [#6-保存并恢复时间线]

```ts
import { restoreTravels, Travels } from 'travels';

const encoded = JSON.stringify(travels.serialize());
localStorage.setItem('travels:quick-start', encoded);

// During a later startup:
const stored = localStorage.getItem('travels:quick-start');
if (stored) {
  const snapshot = Travels.deserialize<DocumentState>(stored, {
    validation: 'semantic',
  });
  const restored = restoreTravels(snapshot, { maxHistory: 100 });
  console.log(restored.getState());
}
```

快照包含当前状态、保留的正向与反向补丁、位置、模式版本以及可选的元数据。`serialize()` 返回的是脱离原对象的数据；它本身不会写入存储，也不会调用 `JSON.stringify()`。

<Callout type="warn" title="对未经校验的存储使用语义校验">
结构校验是默认的快速路径，负责检查模式与补丁形状。语义校验还会双向重放可达的历史。对于浏览器存储，或其他尚未经过可信校验边界的输入，请使用语义校验。
</Callout>

## 7. 继续探索 [#7-继续探索]

<Cards>
  <Card title="接入 React 或其他框架" href="/zh/docs/integrations" />
  <Card title="选择自动或手动归档" href="/zh/docs/guides/archive-mode" />
  <Card title="构建生产级持久化适配器" href="/zh/docs/persistence/storage-adapters" />
  <Card title="查阅全部实例方法" href="/zh/docs/reference/instance-methods" />
</Cards>
