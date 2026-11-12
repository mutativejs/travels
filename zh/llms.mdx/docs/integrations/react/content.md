# React 集成 (/travels/zh/llms.mdx/docs/integrations/react/content.md)

React 与 Travels 默认的不可变模式天然契合。用 `useSyncExternalStore` 订阅，以 `getRevision()` 作为触发失效的快照，并在渲染期间读取当前状态或控制接口。

只需显示保留的步数时，在订阅回调中读取 `event.historyLength`。历史变更后，首次调用 `getHistory().length` 会重建历史状态，首次读取 `controls.patches` 会复制正反向补丁及其值。组件本来就要读取这些补丁时，可以顺便用 `controls.patches.patches.length` 取步数。

## 可复用的外部 Store Hook [#可复用的外部-store-hook]

```tsx
import { useSyncExternalStore } from 'react';
import { createTravels, type Updater } from 'travels';

type State = { count: number };

const travels = createTravels<State>({ count: 0 });

export function useCounterTravel() {
  useSyncExternalStore(
    travels.subscribe,
    travels.getRevision,
    travels.getRevision
  );

  return {
    state: travels.getState(),
    setState: travels.setState,
    controls: travels.getControls(),
  };
}

export function Counter() {
  const { state, setState, controls } = useCounterTravel();

  return (
    <div>
      <output>Count: {state.count}</output>
      <button onClick={() => setState((draft) => { draft.count += 1; })}>
        Increment
      </button>
      <button onClick={() => controls.back()} disabled={!controls.canBack()}>
        Undo
      </button>
      <button onClick={() => controls.forward()} disabled={!controls.canForward()}>
        Redo
      </button>
    </div>
  );
}
```

`getRevision()` 之所以重要，是因为 `archive()` 与 `rebase()` 可能改变时间线的控制接口，却不改变状态引用。如果快照只依赖对象标识，撤销与重做按钮的可用状态就不会更新。

## 由组件掌管的时间线 [#由组件掌管的时间线]

上面的示例创建了一条模块级共享时间线。如果每个组件实例都应拥有各自文档的历史，就为每个已挂载的所有者创建一次时间线，并保持其稳定：

```tsx
import { useEffect, useState, useSyncExternalStore } from 'react';

function useDocumentTravels(initialState: DocumentState) {
  const [travels] = useState(() => createTravels(initialState));

  useSyncExternalStore(
    travels.subscribe,
    travels.getRevision,
    travels.getRevision
  );

  useEffect(() => {
    return () => {
      // Flush persistence or release owner-level resources here.
    };
  }, [travels]);

  return travels;
}
```

不要在每次渲染时无条件调用 `createTravels()`。把 `initialState` 当作初始化输入；如果要加载另一份文档，应显式替换状态，或新建一个由新 key 标识的编辑器所有者，而不是在渲染期间静默重置历史。

## 恢复后的共享时间线 [#恢复后的共享时间线]

在 React 外部完成恢复，然后订阅恢复后的实例：

```tsx
const snapshot = Travels.deserialize<DocumentState>(stored, {
  validation: 'semantic',
});
const timeline = restoreTravels(snapshot);

function Editor() {
  useSyncExternalStore(
    timeline.subscribe,
    timeline.getRevision,
    timeline.getRevision
  );

  return <DocumentView state={timeline.getState()} controls={timeline.getControls()} />;
}
```

如需官方基于 Hook 的 API，或要处理恢复后的共享时间线，可使用 [`use-travel@3`](https://github.com/mutativejs/use-travel)。它的 `useTravelStore` 路径可以接受恢复后的 Travels 实例。

## 副作用与持久化 [#副作用与持久化]

把持久化订阅放在渲染路径之外。对异步写入做防抖，并在应用控制的关闭点完成这些写入：

```ts
useEffect(() => {
  const persistence = attachAutoSave(travels, saveSnapshot);
  return () => {
    void persistence.dispose();
  };
}, [travels]);
```

不要在渲染期间调用 `setState()`、`back()` 或其他时间线变更操作，也不要在 Travels 观察者中同步调用它们。事件处理器以及经过适当调度的 effect 或 task 能让转换保持有序。

## 服务端渲染 [#服务端渲染]

`useSyncExternalStore` 的第三个参数提供服务端快照。保持服务端与客户端初始时间线数据一致，以免出现水合不匹配。模块级时间线在服务端由整个应用共享；如果数据因请求而异，应在合适的请求或客户端边界上划定所有权，而不是让不同用户共享同一份文档。
