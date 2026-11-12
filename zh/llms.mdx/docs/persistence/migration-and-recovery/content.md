# 迁移与恢复 (/travels/zh/llms.mdx/docs/persistence/migration-and-recovery/content.md)

持久化的历史记录属于应用数据，有自己的模式和信任边界。为应用的存储封装加上版本号，在校验前同步完成迁移，并针对每个文档明确“安全恢复”意味着什么。

## 迁移旧版快照 [#迁移旧版快照]

使用 `migrate` 将旧版结构转换为当前的 `TravelsSerializedHistory`，然后再交由 Travels 校验：

```ts
import {
  Travels,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type TravelsSerializedHistory,
} from 'travels';

type CurrentSnapshot = TravelsSerializedHistory<DocumentState>;

const snapshot = Travels.deserialize<DocumentState>(stored, {
  validation: 'semantic',
  migrate(input) {
    if (
      input &&
      typeof input === 'object' &&
      (input as { version?: unknown }).version === 0
    ) {
      const legacy = input as {
        state: DocumentState;
        history: CurrentSnapshot['patches'];
        cursor: number;
      };

      return {
        version: TRAVELS_HISTORY_SCHEMA_VERSION,
        state: legacy.state,
        patches: legacy.history,
        position: legacy.cursor,
      };
    }

    return input as CurrentSnapshot;
  },
});
```

迁移回调和函数形式的回退回调都是同步的。在调用 `deserialize()` 之前，先读取存储、拉取远程数据、解压字节并验证封装。回调若返回类 Promise 的结果，会以 `MIGRATION_FAILED` 或 `FALLBACK_FAILED` 失败；Travels 会捕获其拒绝，避免出现未处理的 Promise 拒绝。

## 借助已知安全的回退恢复 [#借助已知安全的回退恢复]

```ts
const snapshot = Travels.deserialize<DocumentState>(stored, {
  validation: 'semantic',
  fallback: createEmptySnapshot,
  onError(error) {
    if (error instanceof TravelsPersistenceError) {
      reportStorageIssue(error.code);
    }
  },
});
```

回退会在检测到解析、迁移或校验失败后运行。回退本身也要经过所选校验模式的检查。回退抛出异常或结果无效时，会报告 `FALLBACK_FAILED`。

如果每次恢复都需要一个全新的对象，使用函数形式的回退；不过恢复过程也会为已接受的快照状态创建独立副本。回退的构建应保持同步。

<Callout type="warn" title="回退不是完整性检查">
一段在内部可逆、但未经授权或并非预期的替代历史记录，仍是有效输入，不会触发回退。当这些属性很重要时，应在反序列化之前，在 Travels 之外验证签名、修订号、文档标识或校验和。
</Callout>

## 匹配重放选项 [#匹配重放选项]

如果录制历史记录时使用了自定义的 Mutative `strict` 或 `mark` 行为，在语义校验时提供相同的设置：

```ts
const snapshot = Travels.deserialize(stored, {
  validation: 'semantic',
  replayOptions: {
    strict: true,
    mark: customMark,
  },
});
```

语义重放不会启用可变重放或自动冻结；这些输出策略不会改变补丁的解释方式。自动冻结应改为在恢复后的实例上配置。反序列化不会冻结或修改调用方拥有的快照对象。

## 解读类型化错误 [#解读类型化错误]

```ts
try {
  const snapshot = Travels.deserialize(stored, { validation: 'semantic' });
  return restoreTravels(snapshot);
} catch (error) {
  if (error instanceof TravelsPersistenceError) {
    console.error(error.code);
    // entryIndex and direction may identify entry-specific replay failures.
  }
  throw error;
}
```

- `PARSE_ERROR`：输入不是有效的 JSON。
- `UNSUPPORTED_VERSION`：显式迁移该模式，或明确拒绝。
- `INVALID_SCHEMA`：快照字段、元数据或游标格式有误。
- `INVALID_PATCHES`：补丁形状、操作、路径或值无效。
- `INVALID_HISTORY`：可达条目无法一致地重放和反向应用。
- `MIGRATION_FAILED` / `FALLBACK_FAILED`：检查回调边界和 `cause`。

结构校验不会应用补丁，因此无法发现所有重放失败。对于未经验证的存储，语义校验就是损坏检测的边界。

## 设计恢复流程 [#设计恢复流程]

对于重要的离线文档：

1. 读取存储中的原始字节以及上一份已验证的快照。
2. 验证应用层封装、租户/文档标识以及单调递增的修订号。
3. 在 Travels 之外解码或解压。
4. 迁移到当前快照模式。
5. 对未经验证的输入执行语义校验。
6. 恢复到独立状态或显式的可变目标。
7. 如果任一步骤失败，恢复受信任的默认值或最近一次已知可用的快照，并报告稳定错误码。
8. 在隐私政策允许时保留有问题的载荷以供诊断；在用户或支持流程能够检查之前，不要立即用空白快照覆盖它。

## 集合迁移 [#集合迁移]

在规范化当前状态后，不要重放旧的 Map/Set 专用补丁历史。基于引用的集合路径和值无法作为通用 JSON Patch 可靠迁移。在 Travels 之外重建权威的当前状态，将其转换为受支持的普通对象和稠密数组，然后创建新的历史记录基线。

## 应用模式与 Travels 模式 [#应用模式与-travels-模式]

`TRAVELS_HISTORY_SCHEMA_VERSION` 表示历史记录封装的版本，而不是文档业务字段的版本。当需要迁移文档时，在外层存储记录中单独保留一个应用模式版本，并在创建或恢复 Travels 状态之前完成这些迁移。
