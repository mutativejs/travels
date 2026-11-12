# 事务 (/travels/zh/llms.mdx/docs/guides/transactions/content.md)

当多个 Travels 操作构成一次逻辑编辑时，使用 `transaction()`。`batch()` 是它的别名，重载和行为完全相同。

## 一个逻辑撤销步骤 [#一个逻辑撤销步骤]

```ts
travels.transaction({ label: 'Move selection' }, () => {
  travels.setState((draft) => {
    draft.selection.x += 10;
  });
  travels.setState((draft) => {
    draft.selection.y += 20;
  });
  travels.setState((draft) => {
    draft.selection.updatedAt = Date.now();
  });
});
```

根事务会把自身的更新组合成一个历史条目。状态监听器和 devtools 在提交后只会收到一个最终的 `transaction` 事件，而不是每个内部步骤各收到一个临时的 `setState` 事件。

可以省略元数据，也可以把它作为第一个参数传入：

```ts
travels.transaction(() => {
  travels.setState(updatePosition);
  travels.setState(updateSelection);
});
```

## 原子回滚 [#原子回滚]

如果回调抛出异常，Travels 会回滚通过其 API 所做的更改，既不发布临时状态，也不发布回滚补偿事件。

```ts
try {
  travels.transaction(() => {
    travels.setState((draft) => { draft.saved = true; });
    validateDocument(travels.getState()); // Throws
    travels.setState((draft) => { draft.published = true; });
  });
} catch (error) {
  // saved and published retain their pre-transaction values.
}
```

在适当的情况下，失败会报告为 `TRANSACTION_FAILED`，底层错误可通过 `cause` 获取。`onError` 会在根事务稳定之后观察错误，因此永远不会看到嵌套事务尚未稳定的中间状态。

## 仅支持同步回调 [#仅支持同步回调]

不要传入异步函数，也不要让回调返回 Promise。请在开始事务之前等待网络和存储操作完成：

```ts
const payload = await preparePayload();

travels.transaction(() => {
  travels.setState((draft) => {
    draft.payload = payload;
  });
});
```

异步回调被拒绝时会触发回滚，并报告为异步回调失败。事务之所以能具备原子性的历史记录和观察者边界，前提正是它保持同步。

## 嵌套 [#嵌套]

在根事务提交之前，嵌套事务始终保持私有。观察者事件、devtools、分支丢弃通知和 `onError` 都以根事务稳定后的结果为准。

- 成功的嵌套工作会并入根操作。
- 在嵌套作用域中向上冒泡的失败只会报告一次。
- 完全在临时工作中创建并丢弃的重做分支，不会被当作外部可见的已丢弃历史记录上报。
- 提交后不要在观察者中同步修改时间线；应改为调度后续工作。

## 相互抵消的更新 [#相互抵消的更新]

如果事务修改了某个字段又将其恢复为原值，就可能成为空操作：不产生条目、不发布事件、不推进修订号，重做分支也保持原样。这与单次空操作的 `setState()` 一致。

如果事务还执行了导航、归档或重置，那么即使状态更新相互抵消，该时间线操作仍可能发布事件。在手动模式下，自身更新相互抵消的事务可能让更早的待处理变更继续保持待处理状态；其他成功的根事务则会把更早的待处理工作归档到自己的条目中。

## 可变模式边界 [#可变模式边界]

可变模式下的回滚只会为通过 Travels API 完成的写入重放反向补丁。直接写入实时对象的操作不在日志范围内，并能在回滚后保留：

```ts
const store = reactive({ saved: false, connection: 'online' });
const travels = createTravels(store, { mutable: true });

try {
  travels.transaction(() => {
    travels.setState((draft) => { draft.saved = true; });
    store.connection = 'offline'; // Outside Travels
    throw new Error('cancel');
  });
} catch {
  // store.saved is restored; store.connection remains "offline".
}
```

凡是必须共享事务边界的写入，都应通过 `setState()` 完成。直接挂在实时对象上的 MobX、Vue 或 Pinia 观察者能看到临时的原地写入，而 Travels 观察者只会看到根事务稳定后的事件。

## 选择事务还是手动归档 [#选择事务还是手动归档]

对于同步、原子、只需一个最终事件并支持回滚的操作，使用**事务**。如果更新是随时间逐步发生的，例如在一次拖拽期间、跨越多个字段事件，或直到应用定义的提交点，并且希望当前状态立即可见，则使用**手动归档模式**。
