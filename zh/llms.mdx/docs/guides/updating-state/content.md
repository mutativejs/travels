# 更新状态 (/travels/zh/llms.mdx/docs/guides/updating-state/content.md)

拥有状态的时间线通过 `setState(updater, metadata?)` 接收更新。外部日志有意不提供这个方法，而是由状态所有者记录已经生成的补丁对。

## 草稿修改（推荐） [#草稿修改推荐]

```ts
travels.setState((draft) => {
  draft.document.title = 'Roadmap';
  draft.document.tags.push('planning');
});
```

Mutative 默认会把草稿函数的修改转换为不可变结果，并把正向和反向补丁交给 Travels。草稿修改通常能产生最精确的操作，并在可变模式下保留原地修改行为。

## 直接替换 [#直接替换]

```ts
travels.setState({
  document: { title: 'Roadmap', tags: ['planning'] },
});
```

如果确实有意替换根状态，可以直接传入值。在可变模式下，替换根状态可能需要回退到不可变路径，因此对于要求引用稳定的 Store，更推荐在草稿中做局部修改。

## 返回新状态的函数 [#返回新状态的函数]

```ts
travels.setState(() => ({
  document: { title: 'Roadmap', tags: ['planning'] },
}));
```

返回 `undefined` 的函数会被当作草稿函数，而不是要求把状态设为 `undefined`。如果 `undefined` 确实是下一个状态，并且应用能够接受随之而来的持久化后果，就直接传入 `undefined`。

## 同步边界 [#同步边界]

更新回调必须同步执行完毕。异步函数和类 Promise 的结果会被拒绝，以免后续异步代码在历史记录的转换过程之外修改状态。

```ts
// Wrong: the recipe escapes the timeline boundary.
travels.setState(async (draft) => {
  draft.title = await loadTitle();
});

// Right: await first, then commit synchronously.
const title = await loadTitle();
travels.setState((draft) => {
  draft.title = title;
});
```

## 元数据 [#元数据]

元数据用于标记条目，同时不会把产品层面的关注点混入文档状态：

```ts
travels.setState(
  (draft) => {
    draft.layers[0].name = 'Hero';
  },
  {
    label: 'Rename Layer',
    source: 'layers-panel',
    timestamp: Date.now(),
    userId: currentUser.id,
  }
);
```

用 `getMetadata()` 读取与当前位置对应的元数据，用 `getHistoryEntries()` 读取条目。观察者事件会暴露当前操作的元数据。当时间线会被序列化时，自定义值必须遵守与状态相同的持久化契约。

## 空操作更新 [#空操作更新]

不产生任何补丁的更新不会创建历史条目，不会发布订阅者事件，也不会推进 `getRevision()`：

```ts
travels.setState((draft) => {
  if (draft.completed) draft.completed = true;
});
```

这样，重复的表单通知和幂等操作就不会使历史记录膨胀。一次替换是否算作变更，由 Mutative 的值语义决定；用一个相等但不同的对象替换原值，仍然可能产生补丁。

## 读取状态，通过 Travels 写入 [#读取状态通过-travels-写入]

`getState()` 返回历史记录实际使用的当前状态对象，类型为 `S`，以便与 Store 互操作。请把它当作只读数据：

```ts
// Wrong: bypasses recording and can rewrite retained patch values.
travels.getState().title = 'Untracked';

// Right:
travels.setState((draft) => {
  draft.title = 'Tracked';
});
```

在不可变模式下启用 `enableAutoFreeze`，可以让意外修改直接失败。把值交给必须修改它的代码之前，先用 `structuredClone()` 复制一份。

## 提交前校验 [#提交前校验]

最简单的校验边界在更新函数内部，或者在调用更新函数之前。抛出异常可以阻止操作提交。如果你包装 `setState()` 来加入共享校验，需要同时转发更新函数和可选的元数据，保留草稿修改与返回新状态两种行为，并在历史记录必须保持不变时抛出异常，而不是静默返回。完整的包装器示例见[进阶模式](/travels/zh/llms.mdx/docs/guides/advanced-patterns/content.md)。
