# 历史生命周期 (/zh/docs/concepts/history-lifecycle)

Travels 时间线中有两个相关但不同的概念：导航使用的**保留历史窗口**，以及 `reset()` 使用的**实例基线**。理解它们的生命周期，可以避免许多微妙的撤销/重做缺陷。

## 位置与条目 [#位置与条目]

位置 `0` 是当前保留窗口的起点。每个补丁条目代表一次通往下一位置的转换。如果保留了三个条目，就可以重建四个状态：窗口基线加上三次转换。

```ts
const travels = createTravels({ count: 0 }, { maxHistory: 3 });

for (let index = 0; index < 5; index += 1) {
  travels.setState((draft) => { draft.count += 1; });
}

travels.getState();        // { count: 5 }
travels.getPosition();     // 3
travels.getHistory().map((state) => state.count); // [2, 3, 4, 5]
```

最旧的转换已被裁剪，但当前状态仍然是 `5`，保留窗口从 `2` 开始。

## `maxHistory` [#maxhistory]

`maxHistory` 必须是非负整数。小数、`NaN` 与 `Infinity` 等无效值会被立即拒绝。

- 它统计的是补丁条目，而不是状态数量。
- 旧条目会被自动丢弃。
- 位置相对于保留窗口，因此不会超过该上限。
- `reset()` 仍然可以恢复最初的实例基线。
- 请有意设置上限；默认情况下，“无限”历史并不是安全的持久化策略。

当应用需要诊断时，`onWarning` 可以报告 `HISTORY_TRIMMED`。不要仅通过比较每次操作前后的位置来推断是否溢出；导航与 `rebase()` 也会改变位置。

## `reset()` [#reset]

`reset()` 会恢复到实例创建或恢复时捕获的基线，然后把时间线清空回该基线。

```ts
travels.reset();
console.log(travels.getPosition()); // 0
```

对于恢复得到的实例，基线是恢复操作捕获的、经过校验的起始时间线。之后改变基线的操作——例如 `rebase()`、`replaceStateWithoutHistory()`，或在暂停跟踪期间的更新——会影响后续 `reset()` 返回到哪里。

## `rebase()` [#rebase]

`rebase()` 会把当前状态设为新的初始基线，并丢弃所有保留的过去与未来条目。

```ts
travels.rebase();
// 现在，reset() 会回到这个新基线。
```

<Callout type="warn" title="Rebase 具有破坏性">
只有在旧时间线本就应该不可达时才使用 `rebase()`，例如接受服务器快照之后，或有意开始新的编辑会话时。它不等同于撤销到位置 `0`。
</Callout>

## 创建新分支 [#创建新分支]

调用 `back()` 之后，未来的条目仍可通过 `forward()` 访问，直到新的编辑被提交。那次编辑会丢弃重做分支，并在当前位置追加新条目。

```ts
const travels = createTravels({ value: 'A' });
travels.setState({ value: 'B' });
travels.setState({ value: 'C' });
travels.back();                  // 位置回到 B，C 可重做
travels.setState({ value: 'D' }); // C 被丢弃

travels.canForward(); // false
```

需要审计或清理时，使用 `onBranchDiscard({ position, discarded })`。该钩子在提交转换之后运行，无法否决它。

## 在不保留历史的情况下加载状态 [#在不保留历史的情况下加载状态]

`replaceStateWithoutHistory(updater)` 会应用一次更新、清空历史，并把结果设为新基线。它适合接受权威的远程快照，或替换文档而不让用户撤销回之前的文档。

`pauseTracking()` 与 `resumeTracking()` 则定义一个作用域：其中的更新会成为新基线，而普通时间线操作在此之后继续。参见[跟踪与替换](/zh/docs/guides/tracking-and-replacement)。

## 安全地读取历史 [#安全地读取历史]

- `getHistory()` 返回共享的、带缓存的只读数组，其中是只读状态视图。在渲染或度量当前时间线时使用它。
- `getHistorySnapshot()` 返回脱离原对象、由调用方拥有的状态。需要保留、排序、发送给 Worker 或修改结果时使用它。
- `getPatches()` 返回脱离原对象的、保留的补丁快照。
- `getControls().patches` 是带缓存的只读视图，在历史变化之前其身份保持稳定。

可变时间线可能与历史条目共享活动对象，因此旧的 `getHistory()` 结果可能反映之后的原地更新。当历史值必须保持不变时，脱离原对象的快照才是正确的工具。
