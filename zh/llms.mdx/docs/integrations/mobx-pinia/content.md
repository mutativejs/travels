# MobX 与 Pinia (/zh/docs/integrations/mobx-pinia)

MobX 与 Pinia 通常观察一个稳定的对象，而不期待不可变的根替换。用 `mutable: true` 创建 Travels，并传入组件所观察的同一个对象。

## MobX [#mobx]

```ts
import { autorun, makeAutoObservable } from 'mobx';
import { createTravels } from 'travels';

type Todo = { id: string; title: string; done: boolean };

const store = makeAutoObservable({
  todos: [] as Todo[],
});

const travels = createTravels(store, { mutable: true });

const dispose = autorun(() => {
  console.log('Visible todos:', store.todos.length);
});

function addTodo(title: string) {
  travels.setState((draft) => {
    draft.todos.push({ id: crypto.randomUUID(), title, done: false });
  });
}

function toggleTodo(id: string) {
  travels.setState((draft) => {
    const todo = draft.todos.find((item) => item.id === id);
    if (todo) todo.done = !todo.done;
  }, { label: 'Toggle Todo' });
}
```

对于普通的草稿更新，`store` 与 `travels.getState()` 仍是同一个引用。`back()` 与 `forward()` 会把补丁应用到该对象上，因此 MobX reaction 会继续运行。

## Pinia Setup Store [#pinia-setup-store]

```ts
import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { createTravels } from 'travels';

export const useTodosStore = defineStore('todos', () => {
  const state = reactive({
    items: [] as Array<{ id: string; text: string; done: boolean }>,
  });

  const travels = createTravels(state, {
    mutable: true,
    maxHistory: 100,
  });
  const controls = travels.getControls();

  function addTodo(text: string) {
    travels.setState((draft) => {
      draft.items.push({ id: crypto.randomUUID(), text, done: false });
    });
  }

  function undo() {
    if (travels.canBack()) travels.back();
  }

  function redo() {
    if (travels.canForward()) travels.forward();
  }

  return { state, addTodo, undo, redo, travels, controls };
});
```

应暴露 action，而不是让组件直接给 `state` 赋值。对于不进入历史的字段，直接写入 Pinia 或 MobX 可能是合适的，但这些写入对撤销和事务回滚都不可见。

## 恢复到活动 Store [#恢复到活动-store]

```ts
const snapshot = Travels.deserialize<typeof state>(stored, {
  validation: 'semantic',
});

const restored = restoreTravels(snapshot, {
  mutable: true,
  target: state,
});
```

恢复目标会被快照状态的分离副本就地覆盖。快照仍然可以复用，绝不会被当作活动 Store 对象本身使用。

## 对象身份与根替换 [#对象身份与根替换]

优先对草稿做局部修改。原始类型根、显式根替换以及某些重置或导航场景可能需要回退到不可变方式。如果你的集成依赖严格的引用相等性，参见[可变模式操作表](/zh/docs/guides/mutable-mode#各操作的行为)。

不要在可变模式下启用 `enableAutoFreeze`。即使 MobX 或 Vue 能够观察 `Map` 和 `Set`，Travels 仍然不支持它们；先规范化集合，再传给 Travels。

## 事务与观察者 [#事务与观察者]

事务只会把通过 Travels 完成的写入记入日志。直接修改 `store` 的内容在回滚后仍然保留。直接附加到对象上的框架观察者能看到临时变更，而 Travels 监听器只会看到一次最终落定的根事件。把副作用和直接写入放在原子文档更新之外，或为它们另行制定恢复策略。
