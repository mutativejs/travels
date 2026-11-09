# 观察者与事件 (/zh/docs/guides/observers-and-events)

对于一次已提交的通知，`subscribe()` 与 `devtools` 选项会收到同一个 `TravelsEvent` 对象。观察者在状态、游标和历史记录稳定之后运行。

## 事件结构 [#事件结构]

```ts
const unsubscribe = travels.subscribe((event) => {
  console.log(event.type);
  console.log(event.state);
  console.log(event.patches);
  console.log(event.position);
  console.log(event.historyLength);
  console.log(event.metadata);
});
```

| 字段 | 含义 |
| --- | --- |
| `type` | 已提交操作的名称。 |
| `state` | 借用的当前状态视图。 |
| `patches` | 相对于上一次发布状态、仅属于该事件的正向/反向增量。 |
| `position` | 提交后的游标。 |
| `historyLength` | 保留的条目数量。 |
| `metadata` | 与该操作关联的可选元数据。 |

已知类型包括 `setState`、`recordPatches`、`archive`、`transaction`、`go`、`reset`、`rebase` 和 `replaceStateWithoutHistory`。`back()` 与 `forward()` 发布 `go`；受控的外部提交发布 `recordPatches`。

事件类型有意保持开放，以便次要版本添加操作。在应用的 `switch` 中应保留 `default` 分支，而不是用 `never` 断言穷尽性。

## 事件局部补丁 [#事件局部补丁]

`event.patches` 只描述该次通知的转换，并不是 `getPatches()` 返回的完整保留历史记录。

- 根事务会把内部步骤组合成一个最终增量。
- `archive()` 与 `rebase()` 可能在改变时间线控制的同时发布空的状态补丁。
- 补丁数据按需生成。
- 补丁容器、补丁组、操作以及数组路径都会被冻结。
- 正向与反向是彼此独立的克隆。

嵌套值和元数据会从状态与保留的历史记录中分离，但可以由处理同一事件的多个观察者共享。请把整个事件视为只读；一个观察者不得改变后续观察者看到的内容。

## 共享事件对象与借用状态 [#共享事件对象与借用状态]

每次通知都会创建一个浅冻结的事件对象，供监听器和 devtools 共享。`event.state` 是时间线使用的实时状态，其类型为 `ReadonlyState<S>`。

不要通过它写入。在不可变模式下，直接修改既可能绕过记录，也可能改变被保留补丁引用的对象。在可变模式下，应通过 Travels 写入，以保证补丁对和事务日志的正确性。

如果需要分离的完整保留历史快照，请使用 `getPatches()`；如果观察者需要自己拥有的状态值，请使用 `structuredClone()`。

## 重入变更 [#重入变更]

观察者同步调用会修改状态的 Travels API 时，这类调用会被拒绝，以防止嵌套转换混淆不同版本的事件：

```ts
travels.subscribe(() => {
  // Wrong: reentrant mutation.
  // travels.setState(updateDerivedField);

  // Right: schedule a later task when a follow-up is truly required.
  queueMicrotask(() => travels.setState(updateDerivedField));
});
```

读取操作仍然可用。请谨慎设计派生状态，避免后续更新造成无休止的通知循环。

## 观察者失败 [#观察者失败]

监听器抛出的异常会与其他观察者隔离，并且不会回滚已提交的转换。配置 `onObserverError` 可接收结构化的失败信息：

```ts
const travels = createTravels(initialState, {
  onObserverError({ source, error }) {
    reportError({ source, error });
  },
});
```

来源包括 `listener`、`devtools`、`onBranchDiscard`、`onError`、`onWarning` 和 `compatibilityCheck`。观察者返回的 Promise 不会被等待；被拒绝的 Promise 会被隔离，并通过同一路径上报。不要把观察者当作事务校验器——应在提交前完成校验。

## 外部 Store 的修订号 [#外部-store-的修订号]

`getRevision()` 是一个 O(1) 的单调递增令牌。每个已提交的订阅者事件都会使其前进一次，包括在状态引用未变时手动调用 `archive()` 和 `rebase()` 的情况。空操作更新和失败的事务不会推进它。

```ts
useSyncExternalStore(
  travels.subscribe,
  travels.getRevision,
  travels.getRevision
);
```

因此，修订号是 React 及其他外部 Store 绑定正确的失效信号。

## Devtools [#devtools]

```ts
const travels = createTravels(initialState, {
  devtools(event) {
    timelinePane.push({
      type: event.type,
      position: event.position,
      metadata: event.metadata,
    });
  },
});
```

Devtools 遵循与订阅者相同的提交后、共享视图和错误隔离规则。请保持 devtools 的工作轻量，避免同步修改时间线，并复制需要比事件存活更久的数据。
