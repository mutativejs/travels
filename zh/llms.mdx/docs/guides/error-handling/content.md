# 错误处理 (/zh/docs/guides/error-handling)

Travels 将操作错误、持久化解码错误、非致命警告和观察者失败区分开来。应匹配稳定的 `code` 值，而不是生产环境中的错误消息文本。

## 操作错误 [#操作错误]

`TravelsError` 继承自 `Error`；`TravelsTypeError` 继承自 `TypeError`。两者都暴露稳定的 `code` 和可选的 `cause`。

```ts
import { TravelsError, TravelsTypeError } from 'travels';

try {
  travels.transaction(updateDocument);
} catch (error) {
  if (error instanceof TravelsError || error instanceof TravelsTypeError) {
    console.error(error.code, error.cause);
  }
  throw error;
}
```

常见错误码包括：

| 错误码 | 典型含义 |
| --- | --- |
| `ASYNC_CALLBACK` | 更新器或事务返回了异步工作。 |
| `INVALID_OPTION` | 工厂函数或恢复选项不兼容或格式错误。 |
| `INVALID_OPERATION` | 请求的操作在该能力或状态下不被允许。 |
| `UNSUPPORTED_STATE` | 状态或补丁路径违反了运行时状态契约。 |
| `PERSISTENCE_INCOMPATIBLE` | 状态、补丁、路径或元数据无法持久化。 |
| `HISTORY_REPLAY_FAILED` | 导航或重建期间无法应用某个保留的补丁。 |
| `TRANSACTION_FAILED` | 原子操作失败；请检查 `cause`。 |
| `REENTRANT_MUTATION` | 同步观察者或受控回调尝试了嵌套变更。 |
| `INVALID_PATCH_ENTRY` / `EMPTY_PATCH_ENTRY` | 受控补丁对格式错误或缺少所需操作。 |
| `UNCLONEABLE_PATCH_VALUE` | 受控补丁值无法安全分离。 |
| `CONTROLLED_JOURNAL_REQUIRED` | 该操作需要 Journal。 |
| `CONTROLLED_OPERATION_UNAVAILABLE` | 从 Journal 请求了拥有状态的能力。 |

核心操作失败会被包装，可通过 `onError` 处理，尤其是在协调嵌套事务时。如果 UI 必须同步处理某些操作的错误，请在操作周围保留本地 `try/catch`；不要以为钩子会取代抛出的错误。

## 持久化错误 [#持久化错误]

`TravelsPersistenceError` 涵盖解码、迁移和校验：

| 错误码 | 含义 |
| --- | --- |
| `PARSE_ERROR` | 无法解析 JSON 输入。 |
| `UNSUPPORTED_VERSION` | 不支持该快照模式版本。 |
| `INVALID_SCHEMA` | 快照字段、元数据或位置格式错误。 |
| `INVALID_PATCHES` | 补丁容器、操作、路径或值无效。 |
| `INVALID_HISTORY` | 语义重放或可逆性检查失败。 |
| `MIGRATION_FAILED` | 迁移回调失败，或返回了无效/异步的结果。 |
| `FALLBACK_FAILED` | 恢复失败，或产生了无效/异步的结果。 |

针对具体条目的语义失败还可能暴露 `entryIndex` 和 `direction`。参见[迁移与恢复](/zh/docs/persistence/migration-and-recovery)。

## 警告 [#警告]

`onWarning` 接收带有稳定错误码的非致命诊断信息：

```ts
const travels = createTravels(initialState, {
  onWarning({ code, message }) {
    diagnostics.log({ code, message });
  },
});
```

警告码包括 `HISTORY_DISABLED`、`HISTORY_DISCARDED`、`HISTORY_TRIMMED`、`INVALID_POSITION`、`MUTABLE_FALLBACK`、`MUTABLE_ROOT_REPLACEMENT`、`PERSISTENCE_COMPATIBILITY` 和 `POSITION_CLAMPED`。

未配置该钩子时，警告仅在开发环境写入控制台。禁用兼容性警告不会禁用运行时正确性检查。

## 观察者失败 [#观察者失败]

提交之后，由监听器、devtools、分支丢弃钩子、错误/警告钩子或兼容性检查抛出的错误，会在配置了 `onObserverError` 时路由到该钩子。这些错误不会中断其他观察者，也不会回滚已经提交的转换。

```ts
const travels = createTravels(initialState, {
  onObserverError({ source, error }) {
    reportError({ source, error });
  },
});
```

观察者的 Promise 不会被等待，但被拒绝的 Promise 会被隔离并上报。实际的异步副作用恢复仍由应用负责。

## 按边界恢复 [#按边界恢复]

- **调用方输入无效：** 在构建时间线之前修正选项或状态；不要带着部分初始化的所有者继续执行。
- **事务失败：** Travels 会回滚通过其 API 完成的写入。应用的副作用以及对可变 Store 的直接写入需要单独处理。
- **未经校验的持久化历史：** 在恢复前使用 `validation: 'semantic'` 和已知安全的 `fallback`。
- **受控入口：** 当所有者无法回滚已发布的变更时，在外部提交前调用 `assertTravelHistoryEntryRecordable()`。
- **受控 `apply` 失败：** Travels 不会推进自己的游标，但无法撤销外部所有者已经执行的副作用。
- **可变模式下的重放失败：** 失败补丁之前的写入可能会保留。恢复未经校验的快照前，应优先进行语义校验。

为保证完整性与防篡改，应在反序列化之前于 Travels 之外校验编码后的字节；仅凭重放一致性无法证明来源。
