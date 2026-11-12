# 示例 (/travels/zh/llms.mdx/docs/resources/examples/content.md)

仓库中包含一些小示例，它们会实际调用公开 API，同时不会用演示框架掩盖集成边界。你可以把它们与本文档中的专题指南配合使用。

## 核心示例 [#核心示例]

| 示例 | 演示内容 |
| --- | --- |
| [基础用法](https://github.com/mutativejs/travels/blob/main/examples/basic.ts) | 创建时间线、更新状态、导航并订阅。 |
| [手动归档](https://github.com/mutativejs/travels/blob/main/examples/manual-archive.ts) | 把待处理的更新归组为应用定义的撤销步骤。 |
| [持久化](https://github.com/mutativejs/travels/blob/main/examples/persistence.ts) | 序列化、反序列化并恢复带版本号的时间线。 |
| [本地优先持久化](https://github.com/mutativejs/travels/blob/main/examples/local-first-persistence.ts) | 围绕已存储快照构建的持久化编辑流程。 |
| [持久化适配器](https://github.com/mutativejs/travels/blob/main/examples/persistence-adapters.ts) | 面向存储的适配器模式与恢复。 |

## 框架集成 [#框架集成]

| 示例 | 框架或模式 |
| --- | --- |
| [React 集成](https://github.com/mutativejs/travels/blob/main/examples/react-integration.tsx) | `useSyncExternalStore`、修订号、状态与控制接口。 |
| [Vue 集成](https://github.com/mutativejs/travels/blob/main/examples/vue.ts) | Vue 状态绑定与撤销/重做。 |
| [Zustand 集成](https://github.com/mutativejs/travels/blob/main/examples/zustand.ts) | 与 Store 同步的不可变时间线。 |
| [MobX 集成](https://github.com/mutativejs/travels/blob/main/examples/mobx.ts) | 引用稳定的可变历史记录。 |
| [Pinia 集成](https://github.com/mutativejs/travels/blob/main/examples/pinia.ts) | 使用可变 Travels 状态的 setup store。 |

## 编辑类应用 [#编辑类应用]

- [表单搭建器](https://github.com/mutativejs/travels/blob/main/examples/form-builder.ts)：围绕结构化表单编辑的手动历史记录边界。
- [画布编辑器](https://github.com/mutativejs/travels/blob/main/examples/canvas-editor.ts)：分组的可视化操作与由元数据驱动的历史记录。
- [Vite 应用](https://github.com/mutativejs/travels/tree/main/examples/travels-vite)：该包在浏览器中的可运行使用示例。

你也可以在 CodeSandbox 上试用 [Travels Counter Demo](https://codesandbox.io/p/sandbox/travels-vanilla-ts-wzdd62)。

## 运行仓库检查 [#运行仓库检查]

在仓库根目录执行：

```bash
corepack enable
pnpm install
pnpm run test:examples
pnpm run test:types
pnpm run test
```

这些示例已纳入 TypeScript 示例检查。改编某个示例时，应保留核心不变量：单一的权威更新路径、同步的时间线回调、只读共享视图，以及对未经校验的持久化历史记录进行语义校验。

## 相关文档 [#相关文档]

<Cards>
  <Card title="快速开始" href="/travels/zh/llms.mdx/docs/getting-started/quick-start/content.md" />
  <Card title="框架集成" href="/travels/zh/llms.mdx/docs/integrations/content.md" />
  <Card title="存储适配器" href="/travels/zh/llms.mdx/docs/persistence/storage-adapters/content.md" />
  <Card title="参与贡献" href="/travels/zh/llms.mdx/docs/resources/contributing/content.md" />
</Cards>
