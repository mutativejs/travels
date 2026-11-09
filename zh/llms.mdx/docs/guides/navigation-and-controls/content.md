# 导航与控件 (/zh/docs/guides/navigation-and-controls)

## 撤销、重做与跳转 [#撤销重做与跳转]

```ts
travels.back();       // One entry
travels.back(3);      // Three entries
travels.forward();    // One entry
travels.forward(2);   // Two entries
travels.go(0);        // Retained window start
```

用 `canBack()` 和 `canForward()` 来禁用控件，而不是等用户点击后才发现已经到达边界。`getPosition()` 返回当前游标，`getHistory().length - 1` 表示保留窗口的末端。

`back()` 和 `forward()` 会把导航作为 `go` 事件发布。手动模式下待处理的变更会在导航成功时被隐式归档；Travels 3 只发布一个稳定后的 `go` 事件，而不会分别发布 `archive` 和 `go` 事件。

## `reset()` 与 `rebase()` 的区别 [#reset-与-rebase-的区别]

- `reset()` 回到当前实例的基线。
- `rebase()` 丢弃全部历史记录，并把当前状态设为新的基线。

两者都会修改时间线并通知观察者。它们的含义并非总是“回到最早保留的补丁”；在把它们作为产品操作暴露之前，请先阅读[历史记录生命周期](/zh/docs/concepts/history-lifecycle)。

## 面向组件的精简控件 [#面向组件的精简控件]

`getControls()` 返回一个缓存且冻结的接口对象，适合用于按钮、菜单和组件 props：

```tsx
const controls = travels.getControls();

function HistoryButtons() {
  useSyncExternalStore(travels.subscribe, travels.getRevision);

  return (
    <>
      <button disabled={!controls.canBack()} onClick={() => controls.back()}>Undo</button>
      <button disabled={!controls.canForward()} onClick={() => controls.forward()}>Redo</button>
      <span>{controls.position}</span>
    </>
  );
}
```

该接口对象包含导航、当前位置、只读的补丁与历史视图，以及 `rebase()`。手动时间线会暴露能感知手动模式的控制类型。`setState()` 等拥有状态的方法不在其中。

<Callout type="info" title="根据修订号重新渲染，而不只看状态引用">
`archive()` 和 `rebase()` 可能在不改变当前状态引用的情况下改变控件。每个已提交的订阅者事件都会让 `getRevision()` 推进一次，因此它才是 `useSyncExternalStore` 的正确快照。
</Callout>

## 共享视图与自有快照 [#共享视图与自有快照]

| API | 所有权 | 用途 |
| --- | --- | --- |
| `getHistory()` | 共享的缓存只读数组与状态视图 | 即时渲染与读取时间线 |
| `getHistorySnapshot()` | 与缓存分离、归调用方所有的状态 | 持有、排序、编辑、传递给 Worker |
| `getPatches()` | 与缓存分离的保留补丁数据 | 自有副本、自定义序列化、分析 |
| `controls.patches` | 共享的缓存只读视图 | 渲染时读取与 memo 依赖 |
| `getHistoryEntries()` | 带反向补丁和元数据的补丁条目 | 撤销菜单、devtools、审计视图 |

绝不要通过类型断言去掉只读限制来修改共享缓存。可变时间线还可能就地更新旧的共享历史视图；当某个历史值必须保持不变时，请使用与共享缓存分离的快照。

## 由元数据驱动的撤销菜单 [#由元数据驱动的撤销菜单]

```ts
const entries = travels.getHistoryEntries();
const current = travels.getPosition();
const previous = entries[current - 1];
const next = entries[current];

const undoLabel = previous?.metadata?.label ?? 'Undo';
const redoLabel = next?.metadata?.label ?? 'Redo';
```

元数据的索引与保留的补丁条目对齐。历史记录被裁剪时，被裁掉条目的标签也会一同消失；菜单文案应基于当前保留的条目生成，而不是另外维护一份没有边界限制的 UI 列表。
