# 故障排查 (/zh/docs/resources/troubleshooting)

用以下各节判断问题究竟属于状态所有权、历史记录写入、重放、持久化，还是 UI 绑定。稳定的错误码与警告码见[错误处理](/zh/docs/guides/error-handling)。

## 更新没有出现在历史记录中 [#更新没有出现在历史记录中]

按顺序检查以下情况：

1. **值是否真的发生了变化？** 空操作补丁组不会创建条目，也不会发布事件。
2. **是否设置了 `autoArchive: false`？** 待处理的更新需要调用 `archive()`，或执行会隐式归档它们的操作。
3. **追踪是否已暂停？** 请在 `finally` 块中恢复追踪。
4. **你是否通过 Travels 写入？** 直接对 `getState()` 的返回值、MobX/Vue Store 或其他所有者赋值不会被记录。
5. **是否使用了 Journal？** 请用所有者提供的精确补丁对调用 `recordPatches()`；Journal 有意不提供 `setState()`。
6. **更新函数是否抛出异常或返回了 Promise？** 请保持回调同步，并在调用前等待数据就绪。

用 `getRevision()` 确认是否发生了已提交事件，用 `subscribe()` 检查事件类型。

## 撤销或重做按钮没有更新 [#撤销或重做按钮没有更新]

仅靠状态引用不足以刷新控件。`archive()` 与 `rebase()` 可以在不替换状态的情况下改变时间线。

- 在 React 中，使用 `useSyncExternalStore(travels.subscribe, travels.getRevision)` 订阅。
- 在其他 Store 中，每次已提交事件后同步 `getRevision()` 或相关的控件状态。
- 确认订阅没有被提前销毁。
- 不要在每次组件渲染时新建时间线。

参见[导航与控件](/zh/docs/guides/navigation-and-controls)。

## `instanceof Travels` 失败或抛出异常 [#instanceof-travels-失败或抛出异常]

导出的 `Travels` 值是持久化命名空间，在 Travels 3 中不是构造函数。请用 `createTravels()` 创建实例，并用 `isTravels(value)` 检测。Journal 不是拥有状态的 Travels 实例，该类型守卫会返回 `false`。

## 恢复快照时抛出异常 [#恢复快照时抛出异常]

- 先解析存储内容，再假定其结构；`Travels.deserialize()` 接受 JSON 字符串或已解析的对象。
- 对未经校验的输入使用 `validation: 'semantic'`，以便在恢复时检测出无效重放。
- 如果记录时自定义了 `strict` 与 `mark`，请通过 `replayOptions` 传入匹配的设置。
- 在校验前迁移旧的应用数据结构与历史记录结构。
- 检查 `TravelsPersistenceError.code`，以及存在时的 `entryIndex` 与 `direction`。
- 为有意的启动恢复提供已知安全的 `fallback`。

在 v3 中不要传入单独的 `history`、`initialPatches` 或 `initialPosition` 选项。请把完整快照传给 `restoreTravels()`。

## JSON 持久化会丢失值 [#json-持久化会丢失值]

JSON 无法保留 `undefined`、`bigint`、`NaN`、无穷大、`-0`、原型、Map/Set、循环引用或共享对象标识。部分值会抛出异常，其他值则会被静默转换或丢弃。

运行：

```ts
travels.assertPersistenceCompatible();
const snapshot = travels.serialize({ strict: true });
```

然后检查报告中给出的路径，并按照[状态要求](/zh/docs/concepts/state-requirements)规范化该值。注意，不兼容的值在离开当前状态后仍可能保留在旧补丁中。

## 可变 Store 丢失根引用或根引用意外变化 [#可变-store-丢失根引用或根引用意外变化]

检查操作是否替换了根、使用了原始类型根，或通过根替换补丁进行导航。优先使用局部草稿修改。恢复时，把被观察的对象作为 `target` 传入，并设置 `mutable: true`：

```ts
restoreTravels(snapshot, { mutable: true, target: store });
```

不要把可变模式与 `enableAutoFreeze` 一起使用。完整的操作行为见[各操作的行为表](/zh/docs/guides/mutable-mode#behavior-by-operation)。

## 事务没有回滚全部内容 [#事务没有回滚全部内容]

Travels 会回滚通过自身 API 完成的写入。它无法回滚对可变 Store 的直接赋值、网络请求、DOM 变更、存储写入或其他外部副作用。

把每一次可撤销的状态写入都放进 `setState()`，保持回调同步，并在提交成功后处理外部副作用，或采用单独的补偿策略。直接挂到可变状态上的框架观察者也可能看到临时写入，而 Travels 的观察者看不到。

## 观察者错误或重入变更 [#观察者错误或重入变更]

观察者在提交后运行。它们无法否决或安全地变更同一次转换。把后续工作安排到之后的任务中，并避免循环。使用 `onObserverError` 隔离监听器或 devtools 的故障；观察者异常不会回滚已经提交的状态。

## Journal 的历史记录与所有者不一致 [#journal-的历史记录与所有者不一致]

- 记录同一次转换提交后的精确状态，以及精确的正向/反向补丁对。
- 不要在 Travels 内部重复执行更新函数。
- 不要把 `apply` 触发的导航记录为新的编辑。
- 让 `apply` 同步执行，并返回实际提交的状态。
- 就地应用补丁时，显式处理根替换。
- 当所有者无法回滚已发布的提交时，用 `assertTravelHistoryEntryRecordable()` 预检。

Travels 会校验补丁结构，但有意不重新生成补丁来证明所有者的转换。这一对应关系由适配器负责。

## 网站需要 Markdown 或 LLM 版本 [#网站需要-markdown-或-llm-版本]

每个文档页面都可通过页面上的复制/查看控件获取 Markdown。站点还导出 `/llms.txt` 与 `/llms-full.txt`，用于文档发现与全文消费。这些路由描述的是文档站点，不会改变 Travels 的运行时行为。

## 仍未解决 [#仍未解决]

对照一个可运行的[示例](/zh/docs/resources/examples)，然后提交 [GitHub issue](https://github.com/mutativejs/travels/issues)，附上最小复现、Travels 与 Mutative 版本、运行时/浏览器信息、稳定的错误码，以及能展示该问题的最小状态/补丁载荷。提交前请移除密钥与私密用户数据。
