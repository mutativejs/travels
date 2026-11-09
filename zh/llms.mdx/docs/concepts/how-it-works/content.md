# Travels 如何工作 (/zh/docs/concepts/how-it-works)

Travels 把每次有效更新转换为一次不可变状态转换，外加两组补丁：一组向前推进，另一组恢复之前的状态。这些转换按顺序保留下来，就构成了历史。

## 五个核心术语 [#五个核心术语]

| 术语 | 含义 |
| --- | --- |
| **状态（State）** | 时间线当前位置上的应用数据。 |
| **草稿（Draft）** | 传给 `setState()` 更新函数的、可直接修改的草稿对象。 |
| **补丁（Patches）** | 描述一次转换的 JSON Patch 操作，以及它们的反向操作。 |
| **位置（Position）** | 保留历史窗口中的游标；`0` 是该窗口的基线。 |
| **归档（Archive）** | 把待处理的更改提交为一个历史条目的动作。 |

## 一次编辑，两个方向 [#一次编辑两个方向]

考虑下面这个状态与更新：

```ts
const travels = createTravels({ title: 'Draft', views: 0 });

travels.setState((draft) => {
  draft.title = 'Published';
  draft.views += 1;
});
```

从概念上说，Travels 会保留这样一组正向条目：

```json
[
  { "op": "replace", "path": "/title", "value": "Published" },
  { "op": "replace", "path": "/views", "value": 1 }
]
```

它还会保留把状态恢复为 `{ title: 'Draft', views: 0 }` 所需的反向条目。`back()` 应用反向操作；`forward()` 重新应用正向操作。使用 `setState()` 时，这两组补丁都不需要你手写。

```text
Baseline ── edit A ── edit B ── edit C
   0          1          2          3
                         ▲
                      position
```

向后移动只会改变游标与状态；在下一次提交编辑创建分支之前，未来的条目不会被销毁。

## 默认为不可变模式 [#默认为不可变模式]

在默认模式下，Travels 通过 Mutative 生成新的不可变状态。未发生变化的分支可以进行结构共享。请把 `getState()`、`getHistory()` 以及观察者事件返回的值视为只读：直接写入会绕过补丁记录，还可能修改补丁值所保留的对象。

在不可变模式下启用 `enableAutoFreeze: true`，可以让意外写入在开发阶段直接失败。如果需要由调用方拥有的历史数组，请使用 `getHistorySnapshot()`，不要修改共享的 `getHistory()` 缓存。

## 面向引用稳定 Store 的可变模式 [#面向引用稳定-store-的可变模式]

设置 `mutable: true` 后，Travels 会把补丁直接应用回原对象，因此 MobX、Vue、Pinia 或自定义代理可以继续观察同一个引用。它仍然会为导航与持久化生成正向和反向补丁。

根替换与原始类型根可能需要回退到不可变方式。`enableAutoFreeze` 不能与可变模式同时使用。[可变模式指南](/zh/docs/guides/mutable-mode)解释了每种操作在对象身份上的行为。

## 自动归档与手动归档 [#自动归档与手动归档]

启用 `autoArchive: true` 时，每次有效的 `setState()` 都会创建一个条目。启用 `autoArchive: false` 时，状态更新会保持待处理，直到调用 `archive()`，或执行某个会隐式归档的操作。

```ts
const travels = createTravels({ x: 0, y: 0 }, { autoArchive: false });

travels.setState((draft) => { draft.x = 10; });
travels.setState((draft) => { draft.y = 20; });
travels.archive({ label: 'Move object' }); // One undo step
```

根级 `transaction()` 也会把多次更新合并在一起，但它还会对 Travels 观察者隐藏中间状态，并在失败时回滚由 Travels 跟踪的更改。

## 分支与重做边界 [#分支与重做边界]

```text
Initial ── A ── B ── C
              ▲
             back()
              │
              └── D   // A committed D discards redo entry C
```

`onBranchDiscard` 会收到这次转换所移除的条目。事务只报告根事务开始之前可见的重做条目，而不包括在临时工作中创建又完全丢弃的分支。

## 保留窗口与真实基线 [#保留窗口与真实基线]

随着时间线向前推进，`maxHistory` 会丢弃旧补丁。游标相对于保留窗口，因此它的上限就是该限制。即使更早的条目已经被裁剪，`reset()` 仍然可以恢复实例的真实基线。

`rebase()` 不一样：它会主动丢弃全部过去与未来的历史，并把当前状态设为新基线。参见[历史生命周期](/zh/docs/concepts/history-lifecycle)。

## 持久化保存了什么 [#持久化保存了什么]

`serialize()` 会创建一个带版本的值，其中包含：

- 当前状态；
- 正向与反向补丁组；
- 当前位置；
- 可选的历史元数据；
- Travels 历史模式版本。

`Travels.deserialize()` 会校验这个值，`restoreTravels()` 会以原子方式从它重建时间线。不需要单独对齐状态与历史。
