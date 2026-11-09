# Vue 集成 (/zh/docs/integrations/vue)

Vue 支持 Travels 的两种所有权模式。如果能接受替换状态，就使用不可变模式搭配 ref；如果时间线必须更新组件所观察的同一个 `reactive()` 对象，则使用可变模式。

## 不可变组合式函数 [#不可变组合式函数]

```ts
import { readonly, ref, shallowRef } from 'vue';
import { createTravels, type TravelsOptions, type Updater } from 'travels';

export function useTravel<S>(initialState: S) {
  const travels = createTravels(initialState);
  const state = shallowRef(travels.getState());
  const revision = ref(travels.getRevision());

  const unsubscribe = travels.subscribe(({ state: nextState }) => {
    state.value = nextState as any;
    revision.value = travels.getRevision();
  });

  return {
    state: readonly(state),
    revision: readonly(revision),
    setState: travels.setState,
    controls: travels.getControls(),
    dispose: unsubscribe,
  };
}
```

`shallowRef` 适合处理不可变的根替换，能避免把状态再深度包裹进一层响应式。`revision` 则让组件能感知仅涉及控制接口的变化，例如 `archive()` 和 `rebase()`。

当时间线的作用域限于组件时，在组合式函数所属组件卸载时调用 `dispose()`。应用级共享时间线则可以放在专门的 Store 模块中，并为其指定明确的所有者。

## 可变的响应式状态 [#可变的响应式状态]

如果替换响应式对象的引用会破坏你的 Store 设计，就把同一个对象传给 Travels：

```ts
import { reactive } from 'vue';
import { createTravels } from 'travels';

const state = reactive({
  items: [] as Array<{ id: string; text: string }>,
});

const travels = createTravels(state, { mutable: true });

function addItem(text: string) {
  travels.setState((draft) => {
    draft.items.push({ id: crypto.randomUUID(), text });
  });
}

function undo() {
  travels.back(); // Mutates state in place
}
```

组件继续读取 `state`；Travels 针对同一个对象记录并应用补丁。不要将可变模式与 `enableAutoFreeze` 一起使用。

## 恢复到响应式状态 [#恢复到响应式状态]

```ts
import { restoreTravels, Travels } from 'travels';

const snapshot = Travels.deserialize<typeof state>(stored, {
  validation: 'semantic',
});

const travels = restoreTravels(snapshot, {
  mutable: true,
  target: state,
});

console.log(travels.getState() === state); // true
```

`target` 要求启用可变模式，并且根必须是兼容的对象或数组。Travels 会用快照状态的分离副本就地覆盖它，让活动对象与恢复后的历史记录保持一致。

## 变更与事务注意事项 [#变更与事务注意事项]

直接绑定到可变状态的 Vue 侦听器可能在事务期间观察到临时写入，而 Travels 订阅者只会看到落定后的根事务。直接给 `state` 赋值会绕过 Travels，也不会被回滚。所有可撤销的写入都应通过 `travels.setState()` 完成。

完整 Store 示例见 [MobX 与 Pinia](/zh/docs/integrations/mobx-pinia)，你也可以浏览 [Vue 源码示例](https://github.com/mutativejs/travels/blob/main/examples/vue.ts)。
