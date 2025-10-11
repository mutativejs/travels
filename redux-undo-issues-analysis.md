# Redux-undo 未解决问题分析

基于 GitHub Issues (截至 2025年)

## 问题概览

- **总 Open Issues**: 15 个
- **最老的问题**: #150 (2017年3月，**8年未解决**)
- **维护状态**: 项目维护不活跃，最新 issue 是 2023年

---

## 核心痛点分类

### 1. 功能性 Bug（严重）

#### #306: Filter 功能完全失效 (2023年)
**问题**：
- `excludeAction()` 和 `includeAction()` 完全不工作
- 被排除的 actions 仍然会被记录到历史
- 多个用户确认遇到同样问题

**示例**：
```javascript
undoable(reducer, {
  filter: excludeAction(['increment2', 'decrement2'])
})
// 但 increment2 和 decrement2 仍然被记录
```

**影响**：
- 核心功能失效
- 用户无法控制哪些操作需要记录
- 无法排除不需要 undo 的操作（如日志、统计等）

**状态**：
- 报告于 2023年8月
- 多人确认
- **无人修复**

**Travels 的解决方案**：
```typescript
// Travels 通过手动 archive 模式完全控制
const travels = createTravels(state, { autoArchive: false });

// 只记录需要的操作
function criticalOperation() {
  travels.setState(draft => { /* 修改 */ });
  travels.archive(); // 显式记录
}

// 不重要的操作不调用 archive
function trivialOperation() {
  travels.setState(draft => { /* 修改 */ });
  // 不调用 archive，不会记录到历史
}
```

#### #291: groupByActionTypes 功能损坏 (2022年)
**问题**：
- `groupByActionTypes` 导致状态多次更新
- 应该只更新一次，但实际每个 action 都触发更新
- 代码逻辑错误

**当前实现（有 bug）**：
```javascript
export function groupByActionTypes(rawActions) {
  const actions = parseActions(rawActions)
  // 每次都返回不同的 action.type
  return (action) => actions.indexOf(action.type) >= 0 ? action.type : null
}
```

**应该的实现**：
```javascript
export function groupByActionTypes(rawActions) {
  const actions = parseActions(rawActions)
  // 同一组总是返回第一个 action type
  return (action) => actions.includes(action.type) ? actions[0] : null
}
```

**影响**：
- 批量操作功能失效
- 性能问题（不必要的更新）
- 历史记录混乱

**状态**：
- 2022年2月报告
- 作者愿意提 PR
- **至今未合并**

**Travels 的解决方案**：
```typescript
// 手动 archive 模式天然支持批量
const travels = createTravels(state, { autoArchive: false });

travels.setState(d => { d.a = 1; });
travels.setState(d => { d.b = 2; });
travels.setState(d => { d.c = 3; });
travels.archive(); // 三个操作作为一个历史单位
```

#### #272: 与 Redux Toolkit 不兼容 (2020年)
**问题**：
- 使用 RTK 的 `createSlice` 时行为不一致
- 第一个 action 有时失败
- 测试结果不可预测

**示例**：
```javascript
const slice = createSlice({
  name: 'counter',
  initialState: 0,
  reducers: {
    increment: state => state + 1
  }
});

const undoableReducer = undoable(slice.reducer);
// 行为不可预测
```

**根本原因**：
- redux-undo 假设 reducer 的某些内部实现
- RTK 的 Immer-based reducer 与 redux-undo 的假设冲突

**影响**：
- 无法与现代 Redux 生态集成
- RTK 是官方推荐的 Redux 方式
- 用户被迫放弃 redux-undo

**Travels 的优势**：
- 完全独立于 Redux/RTK
- 可以与任何状态管理方案配合
- 或者完全替代 Redux

---

### 2. 架构限制问题

#### #277: 动态添加 reducer 时初始化失败 (2020年)
**问题**：
- 使用 Reducer Manager 动态添加 reducer 时
- `undoable()` 返回初始 state 而非调用 reducer
- 无法实现动态 tabs，每个 tab 有独立的 undo 历史

**场景**：
```javascript
// 动态添加新 tab 的 reducer
reducerManager.add('newTab', undoable(tabReducer));
// 期望：tabReducer 被调用，返回 StateWithHistory
// 实际：直接返回 undoable 的初始 state
```

**根本原因**：
- redux-undo 在 reducer 包装层做初始化
- 与 Redux 的动态 reducer 机制不兼容

**Travels 的解决方案**：
```typescript
// 每个 tab 有独立的 travels 实例
const tabs = new Map<string, Travels>();

function addTab(tabId: string) {
  tabs.set(tabId, createTravels(initialTabState));
}

function removeTab(tabId: string) {
  tabs.delete(tabId);
}

// 灵活、简单、可控
```

#### #276: combineReducers 中的 undo/redo (2020年)
**问题**：
- 如何在 `combineReducers` 的多个 reducer 之间协调 undo
- 文档不清晰

**场景**：
```javascript
undoable(combineReducers({
  root: rootReducer,
  red1: red1,
  red2: red2,
  // ... 更多 reducers
}), {})
```

**困惑点**：
- 如何使用 `groupBy` 跨多个 reducer
- 如何协调不同 reducer 的历史

**Travels 的方案**：
```typescript
// 方案1: 统一管理
const travels = createTravels({
  root: rootState,
  red1: red1State,
  red2: red2State
});

// 方案2: 独立管理
const rootTravel = createTravels(rootState);
const red1Travel = createTravels(red1State);
// 按需协调
```

#### #179: 扁平化的 Redux 结构 (2017年，**8年未解决**)
**问题**：
- 用户希望避免嵌套的 `state.present.xxx` 结构
- 希望直接 `state.xxx` 访问，同时有 `state.past` 和 `state.future`

**期望结构**：
```javascript
// 当前（不喜欢）
{
  past: [...],
  present: { /* 实际状态 */ },
  future: [...]
}

// 期望（扁平）
{
  /* 实际状态属性 */,
  past: [...],
  future: [...]
}
```

**困难**：
- 命名冲突风险
- 性能问题
- 破坏性修改

**状态**：
- 2017年提出
- 讨论无结果
- **8年未解决**

**Travels 的优势**：
- 完全独立的 state 管理
- 不污染业务 state
```typescript
const travels = createTravels(businessState);
const state = travels.getState(); // 直接就是业务 state
const controls = travels.getControls(); // 历史控制独立
```

---

### 3. 功能缺失

#### #237: 保存前过滤 state 属性 (2019年)
**问题**：
- 某些 state 属性不应该被保存到历史
- 例如：临时的 UI 状态、选中项等
- 没有提供过滤机制

**期望功能**：
```javascript
undoable(reducer, {
  filterStateProps: (state) => ({
    ...state,
    selectedNode: null, // 不保存选中状态
    tempData: undefined  // 不保存临时数据
  })
})
```

**影响**：
- 历史记录包含不必要的数据
- 内存占用增加
- undo/redo 行为不符合预期

**Travels 的方案**：
```typescript
// 通过 partialize 选择要追踪的部分
const travels = createTravels(fullState);

travels.setState(draft => {
  draft.businessData = newData; // 会被追踪
  draft.selectedNode = node;    // 会被追踪
  draft.tempUI = temp;          // 会被追踪
});

// 或者分离状态管理
const businessTravel = createTravels(businessState);
const uiState = { /* 不需要历史 */ };
```

#### #233: 保存触发变化的 action (2019年)
**问题**：
- 历史记录只有 state，不知道是什么操作产生的
- 无法在 UI 中显示"删除了X"、"添加了Y"等描述
- 调试困难

**期望结构**：
```javascript
{
  past: [
    {
      state: { /* state */ },
      action: { type: 'ADD_TODO', payload: {...} }
    }
  ],
  present: { /* state */ },
  future: [...]
}
```

**维护者回应**：
- 不打算实现
- 建议自己在 reducer 中处理

**Travels 的优势**：
- JSON Patch 本身就包含操作信息
```typescript
travels.subscribe((state, patches, position) => {
  console.log('Operations:', patches);
  // [
  //   { op: "add", path: "/todos/0", value: {...} },
  //   { op: "remove", path: "/todos/1" }
  // ]

  // 可以轻松生成描述
  const description = patches.map(p =>
    p.op === 'add' ? `添加了 ${p.path}` :
    p.op === 'remove' ? `删除了 ${p.path}` :
    `修改了 ${p.path}`
  ).join(', ');
});
```

#### #150: Undo/Redo 副作用 (2017年，**8年未解决**)
**问题**：
- 某些操作有副作用（API 调用、文件操作等）
- Undo 时需要回滚副作用
- Redux-undo 不支持

**示例场景**：
```javascript
// 创建资源
dispatch(createResource())
  → API POST /resources
  → state.resources.push(newResource)

// Undo 时应该：
undo()
  → 删除 state 中的 resource ✅
  → 调用 API DELETE /resources/:id ❌ 不支持
```

**社区兴趣**：
- 11 个 👍
- 多人讨论
- **8年未实现**

**复杂度**：
- 需要跟踪副作用
- 需要定义逆向副作用
- 架构复杂度大幅增加

**Travels 的方案**：
```typescript
// 方案1: 在业务层处理
async function createResource() {
  const resource = await api.createResource();

  travels.setState(draft => {
    draft.resources.push(resource);
  });

  // 保存副作用信息
  sideEffectsMap.set(travels.getPosition(), {
    undo: () => api.deleteResource(resource.id)
  });
}

// 自定义 undo
const originalBack = travels.back.bind(travels);
travels.back = async function() {
  const currentPos = travels.getPosition();
  const sideEffect = sideEffectsMap.get(currentPos);

  if (sideEffect?.undo) {
    await sideEffect.undo();
  }

  originalBack();
};

// 方案2: 使用 onSave 回调
const travels = createTravels(state, {
  onSave: (pastState, currentState) => {
    // 记录副作用
    if (currentState.resources.length > pastState.resources.length) {
      const newResource = currentState.resources[currentState.resources.length - 1];
      registerSideEffect('undo', () => api.delete(newResource.id));
    }
  }
});
```

---

### 4. 文档与维护问题

#### #281: 异步 filter 支持 (2021年)
**问题**：
- 用户希望 filter 可以是异步函数
- 例如：检查权限后决定是否记录

**状态**：无回复

#### #278: 示例无法运行 (2020年)
**问题**：官方的 `todos-with-undo` 示例代码无法运行

**状态**：无修复

#### #254: 缺少 initial state 示例
**问题**：缺少如何正确设置初始状态的文档

#### #253: 缺少与其他库的对比
**问题**：
- 需要对比 redux-undo 与其他类似库
- 标记为 "good first issue"

**状态**：
- 2019年提出
- **6年未完成**

---

## 问题严重性分级

### 🔴 严重问题（阻碍使用）

1. **#306: Filter 完全失效** - 核心功能不可用
2. **#272: RTK 不兼容** - 无法与现代 Redux 集成
3. **#291: groupBy 损坏** - 批量操作失效

### 🟡 架构限制（设计缺陷）

4. **#179: 扁平结构（8年）** - 强制嵌套结构
5. **#277: 动态 reducer 失败** - 不支持动态场景
6. **#276: combineReducers 混乱** - 多 reducer 协调困难

### 🟢 功能缺失（需要增强）

7. **#150: 副作用（8年）** - 无法处理副作用
8. **#237: 状态过滤** - 无法过滤不需要的属性
9. **#233: Action 记录** - 缺少操作元数据

### ⚪ 维护问题

10. **示例损坏、文档缺失、无人维护**

---

## 项目维护状态分析

### 时间线

- **2015年**: 项目创建
- **2017年**: #150, #179 提出，至今未解决
- **2019-2020年**: 多个功能请求，无响应
- **2022年**: #291 发现严重 bug，有 PR，未合并
- **2023年**: #306 报告核心功能失效
- **2024-2025年**: **无新 issue，无更新**

### 结论

**Redux-undo 实质上已经停止维护**：

1. ✅ 最后一次 release：v1.1.0 (2023年)
2. ❌ 8年前的 issue 未解决
3. ❌ 严重 bug 无人修复
4. ❌ 与现代工具链不兼容
5. ❌ 功能请求无响应

---

## Travels 如何解决这些问题

| Redux-undo 的问题 | Travels 的解决方案 |
|------------------|------------------|
| Filter 失效 | 手动 archive 完全控制 |
| groupBy 损坏 | 自动/手动 archive 模式 |
| RTK 不兼容 | 框架无关，可配合任何方案 |
| 动态 reducer 失败 | 独立实例，灵活创建销毁 |
| combineReducers 混乱 | 统一或分离管理，自由选择 |
| 扁平结构不支持 | State 完全独立，不嵌套 |
| 无法过滤属性 | Partialize 或分离状态 |
| 缺少 action 信息 | JSON Patch 包含操作信息 |
| 副作用不支持 | 扩展性强，可自定义 |
| 维护停滞 | 活跃维护，持续更新 |

---

## 核心差异总结

### Redux-undo 的根本问题

1. **强绑定 Redux**：
   - 必须用 Redux
   - 必须包装 reducer
   - 与 RTK 等现代工具冲突

2. **架构僵化**：
   - 强制的嵌套结构（`state.present`）
   - 无法处理动态场景
   - 扩展性差

3. **功能不完整**：
   - Filter 失效
   - GroupBy 损坏
   - 缺少元数据
   - 不支持副作用

4. **停止维护**：
   - 8年前的问题未解决
   - 严重 bug 无人修复
   - 示例代码损坏

### Travels 的优势

1. **完全独立**：
   - 不绑定任何框架
   - 可替代或配合 Redux
   - 与任何工具兼容

2. **架构灵活**：
   - State 不嵌套
   - 支持动态场景
   - 高度可扩展

3. **功能完整**：
   - 自动/手动 archive
   - JSON Patch 元数据
   - Mutable 模式
   - 持久化友好

4. **活跃维护**：
   - 持续更新
   - 完善的测试（3689行）
   - 详细的文档

---

## 迁移建议

### 如果你正在用 Redux-undo，遇到以下情况应考虑迁移：

1. ✅ Filter 功能不工作（#306）
2. ✅ 使用 Redux Toolkit（#272）
3. ✅ 需要批量操作（#291）
4. ✅ 需要动态 reducer（#277）
5. ✅ 需要扁平的 state 结构（#179）
6. ✅ 需要记录操作元数据（#233）
7. ✅ 需要处理副作用（#150）
8. ✅ 项目需要长期维护

### 迁移路径

**选项1: 完全替代 Redux**
```typescript
// 之前
const store = createStore(
  undoable(combineReducers({ ... }))
);

// 之后
const travels = createTravels(initialState);
// 使用 travels 替代 Redux
```

**选项2: 配合 Redux**
```typescript
// Redux 管理业务状态
const reduxStore = configureStore({ ... });

// Travels 管理历史
const travels = createTravels(reduxStore.getState());

reduxStore.subscribe(() => {
  const newState = reduxStore.getState();
  travels.setState(newState);
});
```

**选项3: 渐进式迁移**
```typescript
// 新功能用 Travels
const newFeatureTravel = createTravels(newFeatureState);

// 老功能继续用 redux-undo（暂时）
const oldStore = createStore(undoable(oldReducer));

// 逐步替换
```

---

## 结论

Redux-undo 已经是一个**停止维护的遗留项目**：

- 核心功能失效
- 与现代工具不兼容
- 8年前的问题未解决
- 架构僵化，扩展性差

Travels 提供了一个**现代化、灵活、功能完整**的替代方案：

- 框架无关
- 性能优秀
- 功能丰富
- 活跃维护

如果你的项目依赖 redux-undo，现在是考虑迁移的时候了。
