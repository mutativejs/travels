# Zundo 未解决问题分析

基于 GitHub Issues (截至 2025年)

## 核心痛点分类

### 1. 性能优化问题

#### #209: Equality 函数的防抖需求
**问题**：
- 当前的 throttle/debounce 在 equality check **之后**执行
- Equality check 本身可能非常耗性能
- 用户希望能对 equality 函数本身进行防抖

**影响**：
- 大 state 对象的频繁比较会导致性能问题
- V1 版本有 `coolOffPeriod` 参数，V2 移除了

**Travels 的解决方案**：
- Travels 不依赖 equality check，使用 JSON Patch 自动捕获差异
- 无需手动配置 equality 函数
- 性能开销固定且可预测

---

### 2. 批量操作与原子性问题

#### #208: 共享 slices 的批量更新
**问题**：
- 使用共享 slice 时，一个复合操作会产生多个 undo 记录
- 例如：同时更新 `name` 和 `age`，会产生 2 个历史记录
- 用户希望将多个更新作为单一的原子操作

**当前 workaround**：
- 使用 debounce 函数限制更新频率
- 不够优雅，不是真正的批量

**pause/resume 的局限**：
- 无法在 slice 创建层面解决
- 需要在调用层手动控制

**Travels 的解决方案**：
```typescript
// 手动 archive 模式
const travels = createTravels(initialState, { autoArchive: false });

// 多次修改
travels.setState(d => { d.name = 'Alice'; });
travels.setState(d => { d.age = 30; });
travels.setState(d => { d.city = 'NYC'; });

// 一次性归档为单个历史记录
travels.archive(); // 只记录一个 undo 单位
```

---

### 3. 多 Store 支持问题

#### #201: 只对部分 slice 应用 temporal
**问题**：
- 用户希望只对某些 slice 启用 undo/redo
- 例如：`cats` slice 需要历史，`dogs` slice 不需要
- 当前不清楚如何选择性应用

**架构限制**：
- Zundo 的中间件是 store 级别的
- 难以细粒度控制

**Travels 的优势**：
- 完全独立的状态管理，不绑定特定框架
- 可以为不同模块创建独立的 travels 实例
```typescript
const catsTravel = createTravels(catsState);
const dogsState = { /* 普通 state，无历史 */ };
```

#### #46: 多 store 模型的支持（2022年的老问题）
**问题**：
- 如何在多个 Zustand store 之间实现 undo/redo
- 例如：`bearStore` 和 `honeyStore` 需要同步 undo

**维护者回复**：
- 当前只能分别包装每个 store
- 未来可能提供 `trackHistory(store1, store2)` 的 API

**问题持续时间**：2.5 年未解决

**Travels 的方案**：
```typescript
// 方案1: 合并为单一 state
const travels = createTravels({
  bears: bearState,
  honey: honeyState
});

// 方案2: 多个独立 travels，手动同步
const bearsTravel = createTravels(bearState);
const honeyTravel = createTravels(honeyState);

function globalUndo() {
  bearsTravel.back();
  honeyTravel.back();
}
```

---

### 4. Bug 与使用问题

#### #200: Undo 后 store 变为 undefined
**问题**：
- 调用 `undo()` 后，主 store 变成 `undefined`
- 没有 undo 时一切正常
- 配置缺失导致？

**状态**：无人回复，无解决方案

**可能原因**：
- State 初始化问题
- Temporal 配置错误
- 类型不匹配

**Travels 的稳定性**：
- 640 行核心代码，逻辑简单清晰
- 大量测试覆盖（3689 行测试代码）
- State 管理独立，不会影响外部

#### #161: 无法 undo 数组删除操作
**问题**：
- 数组：`[{id:1},{id:2},{id:3}]`
- 删除后：`[{id:1},{id:2}]`
- Undo 失败，无法恢复 `{id:3}`

**社区回复**：
- 需要使用不可变方法（如 `slice()`）
- 建议用 Immer

**根本问题**：
- 用户直接 mutate 数组（如 `splice`）
- Zustand 无法追踪这种变化
- Zundo 依赖 Zustand 的变化检测

**Travels 的优势**：
- 基于 Mutative，内置 Draft API
- 自动处理数组操作的不可变性
```typescript
travels.setState(draft => {
  draft.items.splice(2, 1); // Mutative 自动转为不可变操作
});
travels.back(); // 正确恢复
```

---

### 5. 功能缺失

#### #197: 记录 action 名称和参数
**问题**：
- 用户希望记录每个 action 的名称和参数
- 例如：`"increment, 1"` 或 `"setName, foo"`
- 现有中间件只能部分捕获

**需求场景**：
- 调试
- 审计日志
- 用户行为分析

**Zundo 的限制**：
- `wrapTemporal` 只能捕获 `_handleSet` 的新旧 state
- 无法获取原始 action 信息

**Travels 的方案**：
```typescript
// 通过 subscribe 监听所有变化
travels.subscribe((state, patches, position) => {
  console.log('Patches:', patches);
  // patches 本身就是操作日志
  // [{ op: "replace", path: "/count", value: 1 }]
});

// 或者通过 onSave 回调
const travels = createTravels(state, {
  onSave: (pastState, currentState) => {
    logAction({
      from: pastState,
      to: currentState,
      timestamp: Date.now()
    });
  }
});
```

#### #172: Deep Merge 支持
**问题**：
- 希望像 persist 中间件一样支持 merge 选项
- 需要更新 zustand 核心

**状态**：简短描述，无进展

**Travels 的 mutable 模式**：
```typescript
// 支持原地修改（Vue/MobX）
const travels = createTravels(reactiveState, { mutable: true });
travels.setState(draft => {
  // 深度修改，保持响应性
  draft.nested.deep.value = 'new';
});
```

#### #152: 自定义函数应用 past/future states
**问题**：
- 希望提供自定义函数来应用历史状态
- 增强灵活性

**Travels 的扩展性**：
- 可以通过包装方法实现任意逻辑
```typescript
const originalBack = travels.back.bind(travels);
travels.back = function(amount) {
  // 自定义逻辑
  console.log('Before undo');
  originalBack(amount);
  console.log('After undo');
}
```

---

### 6. 文档与示例问题

#### #202: Next.js App Router 示例
**问题**：缺少 Next.js App Router 的完整示例

#### #179: 将 CodeSandbox 改为 StackBlitz
**问题**：文档示例使用 CodeSandbox，希望改为 StackBlitz

#### #177: 添加 helper hook 和文档
**问题**：需要更完善的文档和辅助 hooks

**Travels 的文档优势**：
- README 有完整的 API 文档
- 提供 React/Vue/Zustand 集成示例
- 有在线 demo

---

## 问题总结

### Zundo 的核心问题

1. **性能问题**：
   - Equality check 无法优化
   - 大 state 性能差

2. **批量操作难**：
   - 无优雅的批量 archive 方案
   - pause/resume 不够灵活

3. **多 store 支持弱**：
   - 2.5 年的老问题未解决
   - 无法跨 store 协调 undo

4. **Bug 存在**：
   - Undo 导致 store undefined
   - 数组操作 undo 失败

5. **功能缺失**：
   - 无法记录 action 元数据
   - 缺少 deep merge
   - 扩展性受限

6. **强绑定 Zustand**：
   - 所有问题都源于对 Zustand 的深度绑定
   - 难以适配其他场景

### Travels 如何解决这些问题

| Zundo 的问题 | Travels 的方案 |
|-------------|---------------|
| Equality check 性能差 | JSON Patch 自动捕获，无需比较 |
| 批量操作不优雅 | `autoArchive: false` + `archive()` |
| 多 store 支持弱 | 框架无关，灵活组合 |
| Store undefined bug | 独立状态管理，不影响外部 |
| 数组 undo 失败 | Mutative 自动处理不可变性 |
| 无法记录 action | Patches 本身就是操作日志 |
| 缺少 deep merge | Mutable 模式支持深度修改 |
| 扩展性受限 | 可包装任意方法，完全可控 |
| 强绑定框架 | 完全独立，可用于任何框架 |

### 统计数据

- **总 Open Issues**：15 个
- **最老的问题**：#46 (2022年8月，2.5年未解决)
- **性能相关**：2 个 (#209, #172)
- **架构限制**：3 个 (#208, #201, #46)
- **Bug**：2 个 (#200, #161)
- **功能请求**：3 个 (#197, #172, #152)
- **文档问题**：3 个 (#202, #179, #177)

### 深层次原因

Zundo 的大部分问题源于其**架构设计**：

1. **绑定 Zustand**：限制了灵活性
2. **依赖 Equality Check**：性能瓶颈
3. **中间件模式**：难以精细控制
4. **存储完整快照**（默认）：内存和性能问题

Travels 通过以下设计避免了这些问题：

1. **框架无关**：不绑定任何状态管理库
2. **JSON Patch**：高效且标准
3. **独立实例**：完全可控
4. **差异存储**：内存和性能优秀

---

## 建议

如果你的项目遇到以下情况，考虑从 Zundo 迁移到 Travels：

1. ✅ 大 state 对象，equality check 性能差
2. ✅ 需要批量操作作为单一 undo 单位
3. ✅ 多 store 场景，需要协调 undo
4. ✅ 遇到 undo 后 state 异常的 bug
5. ✅ 需要记录操作日志/审计
6. ✅ 需要持久化历史记录
7. ✅ 希望代码更简洁、维护成本更低

Travels 不是 Zundo 的替代品，而是**不同设计哲学**的体现：

- **Zundo**：Zustand 生态的专用中间件，轻量但受限
- **Travels**：通用的 undo/redo 核心库，功能完整且灵活
