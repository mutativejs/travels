# 状态要求 (/zh/docs/concepts/state-requirements)

Travels 的持久化契约有意比 JavaScript 的对象模型更小。它不仅适用于当前状态，也适用于旧补丁中保留的值、补丁路径以及自定义历史元数据，而不只是传给 `createTravels()` 的那个对象。

## 推荐的持久化数据 [#推荐的持久化数据]

使用普通对象、稠密数组、字符串、除 `-0` 之外的有限数字、布尔值与 `null`。补丁路径必须是 Travels 可接受的 JSON Pointer 字符串，或由字符串与有限非负整数索引组成的稠密数组。

```ts
const state = {
  title: 'Draft',
  published: false,
  updatedAt: '2026-10-24T12:00:00.000Z',
  revision: 0,
  blocks: [{ id: 'intro', text: 'Hello' }],
};
```

持久化容器应当具有普通的可写、可枚举数据属性以及标准原型。避免访问器、隐藏属性、自定义自有属性、不可扩展容器、数组空洞与内置子类。启用 `enableAutoFreeze` 时，标准冻结容器可以被识别，但对于调用方创建的输入，它们并不是通用的持久化数据建议。

## 兼容性矩阵 [#兼容性矩阵]

| 值 | 运行时行为 | JSON 持久化 | 建议 |
| --- | --- | --- | --- |
| 普通对象 | 支持 | 支持 | 首选 |
| 稠密数组 | 支持 | 支持 | 首选 |
| 稀疏、扩展或子类化数组 | 受持久化校验限制或被拒绝 | 形状无法保留 | 规范化为稠密的普通数组 |
| 字符串、布尔值、`null` | 支持 | 支持 | 首选 |
| 除 `-0` 之外的有限数字 | 支持 | 支持 | 首选 |
| `NaN`、无穷大、`-0` | 部分内存路径支持 | 会变成 `null` 或 `0` | 先规范化 |
| `bigint` | 部分内存路径支持 | `JSON.stringify()` 会抛错 | 编码为字符串 |
| `undefined` | 可在内存中打补丁 | 对象中会被移除；数组语义不同 | 使用 `null` |
| `Date` | 可克隆，但不持久 | 经 JSON 后变成字符串 | 存时间戳或 ISO 字符串 |
| `Map` / `Set` | 两种运行时模式都会拒绝 | 快照边界会拒绝 | 使用记录或稠密数组 |
| 类实例或自定义/null 原型 | 不持久 | 原型与方法会丢失 | 存普通数据或 ID |
| 函数或 symbol | 不持久 | JSON 会丢弃 | 把行为留在状态之外 |
| 循环引用或共享引用身份 | 不持久 | 循环引用会失败；共享引用会被复制 | 规范化为 ID |
| DOM 节点、ref、observable 实体 | 不持久 | 无法序列化 | 放在 Travels 之外 |
| `WeakMap` / `WeakSet` | 不支持 | 无法序列化 | 放在 Travels 之外 |

原始类型根也可以使用，但可变模式无法原地修改原始值，会回退为不可变替换。如果根身份稳定性很重要，请把原始值包在对象里。

## 在边界处规范化集合 [#在边界处规范化集合]

```ts
type Item = { id: string; title: string };

type LegacyState = {
  itemsById: Map<string, Item>;
  selectedIds: Set<string>;
  updatedAt: Date;
};

function normalize(state: LegacyState) {
  return {
    itemsById: Object.fromEntries(state.itemsById),
    selectedIds: Array.from(state.selectedIds),
    updatedAt: state.updatedAt.toISOString(),
  };
}
```

把应用领域中的 Map、Set、Date 或类视图留在 Travels 之外，并从规范化后的状态推导它们。转换之后，不要重放旧的、针对特定集合的补丁历史；请重建权威的当前状态，规范化它，然后开始新的基线。

## 不安全的路径键 [#不安全的路径键]

Mutative 不会重放 `__proto__` 键下的更改，也不会重放存储在 `constructor` 键下的值内部的更改。Travels 会用 `UNSUPPORTED_STATE` 拒绝这类更新。记录历史之前，请先重命名这些键。根替换在可变模式与受控导航路径中有特殊处理；在实现原地补丁应用之前，请先阅读相关指南。

## 静态检查与运行时检查 [#静态检查与运行时检查]

### 用 `createPatchableTravels()` 强制持久化形状 [#用-createpatchabletravels-强制持久化形状]

```ts
import { createPatchableTravels, type JsonValue } from 'travels';

const initial = {
  title: 'Draft',
  blocks: [] as Array<{ id: string; text: string }>,
} satisfies JsonValue;

const travels = createPatchableTravels(initial);
```

`PatchableInput<T>` 会执行有限深度的、尽力而为的静态检查。TypeScript 无法证明每一个运行时属性：`number` 仍然包含 `NaN`、无穷大与 `-0`，宽泛的对象类型也会隐藏其内容。因此，严格工厂还会校验具体的初始值。

### 直接检查一个值 [#直接检查一个值]

```ts
import { findStateCompatibilityIssues } from 'travels';

const issues = findStateCompatibilityIssues(
  { createdAt: new Date(), selection: new Set(['a']) },
  { maxIssues: 20 }
);

for (const issue of issues) {
  console.warn(issue.code, issue.path, issue.message);
}
```

问题代码可以识别循环/共享引用、日期、函数、类实例、DOM 节点、Map/Set、bigint、非 JSON 数字、非标准数组/对象形状、弱集合、symbol 与 `undefined` 值。

### 在序列化之前或期间校验 [#在序列化之前或期间校验]

```ts
travels.assertPersistenceCompatible(); // Throws with path-specific diagnostics
const snapshot = travels.serialize({ strict: true });
```

`assertPersistenceCompatible()` 会检查当前状态、保留的补丁值与路径，以及元数据。`serialize({ strict: true })` 会拒绝任何无法通过文档化 JSON 契约往返的值。普通的 `serialize()` 仍然返回脱离原对象的数据，但它不会替你规范化仅存在于运行时的值。

## 开发期诊断 [#开发期诊断]

开发构建会扫描初始状态、变更后的状态，以及保留的补丁与元数据，以发现已知风险。`warnOnUnsupportedState: false` 控制这些警告；它既不会启用 Map/Set，也不会让无效持久化变得安全。`onWarning` 会收到结构化的警告代码，`onObserverError` 则隔离诊断或通知钩子抛出的失败。

生产包默认入口不会包含完整的开发扫描器。严格序列化、恢复校验、受控补丁校验与 Map/Set 拒绝等正确性边界仍然显式存在，而不是依赖控制台警告。
