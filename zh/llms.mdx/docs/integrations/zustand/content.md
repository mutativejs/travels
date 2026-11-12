# Zustand 集成 (/travels/zh/llms.mdx/docs/integrations/zustand/content.md)

对于新的 Zustand 应用，官方中间件 [`zustand-travel@3`](https://github.com/mutativejs/zustand-travel) 是最直接的集成方式。当你需要独立的历史所有者或自定义持久化编排时，核心 API 仍然很有用。

## 官方中间件 [#官方中间件]

```ts
import { create } from 'zustand';
import { travel } from 'zustand-travel';
import { Travels } from 'travels';

type State = { title: string; count: number };
type Actions = {
  updateTitle: (title: string) => void;
  increment: () => void;
};

const snapshot = Travels.deserialize<State>(stored, {
  validation: 'semantic',
});

const useStore = create<State & Actions>()(
  travel(
    (set) => ({
      title: 'Untitled',
      count: 0,
      updateTitle: (title) =>
        set((state) => {
          state.title = title;
        }),
      increment: () =>
        set((state) => {
          state.count += 1;
        }),
    }),
    { snapshot }
  )
);
```

可选的 `snapshot` 提供一份完整恢复后的历史记录。不要同时传入拥有状态的 `Travels` 实例；时间线集成由绑定负责。初始化函数用于定义 action，快照数据则提供恢复后的基线。

不需要恢复时，省略 `snapshot`，由初始化函数定义起始状态。关于该绑定返回的控制接口与 Hook API，参见该绑定自己的文档。

## 直接集成核心 API [#直接集成核心-api]

一个简单的手动适配器就能把不可变的 Travels 状态镜像到 Zustand：

```ts
import { create } from 'zustand';
import { createTravels, type Updater } from 'travels';

type State = { count: number };
const travels = createTravels<State>({ count: 0 });

type Store = State & {
  setState: (updater: Updater<State>) => void;
  controls: ReturnType<typeof travels.getControls>;
};

const useStore = create<Store>((set) => ({
  ...travels.getState(),
  setState: (updater) => {
    travels.setState(updater);
    set(travels.getState());
  },
  controls: travels.getControls(),
}));

const unsubscribe = travels.subscribe(({ state }) => {
  useStore.setState(state);
});
```

该订阅还会同步撤销、重做、重置以及其他导航操作。让订阅一直保留到 Store 生命周期结束，或随应用 Store 一起释放。

对于手动 `archive()`、`rebase()` 这类仅涉及控制接口的更新，如果组件会读取 `controls.canBack()` 或 `controls.position`，且不会因其他原因重新渲染，也应把 `getRevision()` 一并镜像到 Store 中。

## 单一权威更新路径 [#单一权威更新路径]

不要让一个 action 独立写入两个 Store，从而制造出彼此不一致的状态。要么让更新都经过 Travels，并镜像它已提交的状态；要么让 Zustand 保持权威，并使用官方绑定或 Journal。

如果独立表单或 Store 的所有者之后可能修改这些对象，就不要把仍然活动的可变引用未经克隆直接传给不可变 Travels。在集成边界上使用分离副本。
