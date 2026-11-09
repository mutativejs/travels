import type { Locale } from './locale';

type Feature = { title: string; text: string; cta: string; href: string };
type DocCard = { eyebrow: string; title: string; text: string; href: string; cta: string };

export type HomeContent = {
  release: { text: string; cta: string; href: string };
  hero: {
    eyebrow: string;
    line1: string;
    line2: string;
    description: string;
    primary: string;
    secondary: string;
    framework: string;
  };
  proofLabel: string;
  proof: { strong: string; text: string }[];
  features: { eyebrow: string; title: string; text: string; items: Feature[] };
  playground: { eyebrow: string; title: string; text: string };
  code: {
    eyebrow: string;
    line1: string;
    line2: string;
    text: string;
    checks: string[];
    link: string;
    href: string;
  };
  ownership: {
    eyebrow: string;
    title: string;
    text: string;
    cards: {
      tag: string;
      title: string;
      text: string;
      sr: string;
      nodes: [string, string, string];
      caption: string;
      link: string;
      href: string;
    }[];
  };
  useCases: {
    eyebrow: string;
    title: string;
    text: string;
    items: { title: string; text: string; tag: string }[];
  };
  docs: { eyebrow: string; title: string; text: string; cards: DocCard[]; cta: string };
  api: { title: string; text: string; cta: string };
  final: {
    eyebrow: string;
    line1: string;
    line2: string;
    text: string;
    primary: string;
    primaryHref: string;
    secondary: string;
    secondaryHref: string;
  };
  footer: {
    tagline: string;
    learn: string;
    integrate: string;
    project: string;
    quickStart: string;
    concepts: string;
    guides: string;
    playground: string;
    persistence: string;
    security: string;
    releases: string;
    license: string;
    backToTop: string;
  };
};

const en: HomeContent = {
  release: { text: 'Travels 3.0 is here', cta: 'See what’s new', href: '/docs/migration' },
  hero: {
    eyebrow: 'PATCH-BASED STATE HISTORY',
    line1: 'Every change.',
    line2: 'A way back.',
    description:
      'Durable undo/redo for modern applications. Keep compact history, write natural mutation-style updates, and integrate with the state tools you already use.',
    primary: 'Get started',
    secondary: 'View on GitHub',
    framework: 'Works with React · Vue · Zustand · MobX · Pinia · Vanilla JS',
  },
  proofLabel: 'Key capabilities',
  proof: [
    { strong: 'RFC 6902', text: 'JSON Patches' },
    { strong: 'Framework-agnostic', text: 'core' },
    { strong: 'TypeScript-first', text: 'API' },
    { strong: 'Storage-agnostic', text: 'persistence' },
  ],
  features: {
    eyebrow: 'WHY TRAVELS',
    title: 'A smaller history. A bigger editing experience.',
    text: 'Built for large state, small updates, long timelines, and histories that need to survive a reload—not just the current render.',
    items: [
      {
        title: 'Patch-based by design',
        text: 'Record forward and inverse JSON Patches instead of copying the whole state for every edit.',
        cta: 'Explore',
        href: '/docs/concepts/how-it-works',
      },
      {
        title: 'History worth keeping',
        text: 'Serialize state, patches, cursor, and metadata into one versioned, restorable snapshot.',
        cta: 'Explore',
        href: '/docs/persistence',
      },
      {
        title: 'Your framework, your store',
        text: 'Use immutable timelines or preserve reactive references with mutable mode and journals.',
        cta: 'Explore',
        href: '/docs/integrations',
      },
      {
        title: 'Predictable at the edges',
        text: 'Atomic transactions, typed errors, semantic restore validation, and explicit compatibility.',
        cta: 'Explore',
        href: '/docs/guides/transactions',
      },
    ],
  },
  playground: {
    eyebrow: 'TRY IT LIVE',
    title: 'Build it up. Take it back.',
    text: 'Every block below is a real Travels update, and a whole drag stroke is archived as one undoable step. Inspect the patches, scrub the timeline, then reload the page: the history is restored from this browser’s storage.',
  },
  code: {
    eyebrow: 'NATURAL UPDATES, PRECISE HISTORY',
    line1: 'Write like it’s mutable.',
    line2: 'Travel like it’s immutable.',
    text: 'Travels uses Mutative to turn familiar draft mutations into immutable state and reversible patches. No reducer boilerplate, no manual inverse operations.',
    checks: [
      'No-op updates stay out of history',
      'Metadata labels every meaningful edit',
      'Read-only controls fit any UI',
    ],
    link: 'Explore state updates',
    href: '/docs/guides/updating-state',
  },
  ownership: {
    eyebrow: 'ONE CORE, TWO OWNERSHIP MODELS',
    title: 'History that fits your architecture.',
    text: 'Let Travels own updates, or keep your existing store authoritative. The history contract stays explicit in both directions.',
    cards: [
      {
        tag: 'STATE-OWNING',
        title: 'createTravels()',
        text: 'Send updates through Travels and receive immutable states, patches, navigation, and controls.',
        sr: 'Updates flow from your code through Travels to your UI. back() and forward() go from your UI to Travels.',
        nodes: ['Your update', 'Travels', 'Your UI'],
        caption: 'back() · forward()',
        link: 'Own state with Travels',
        href: '/docs/getting-started/quick-start',
      },
      {
        tag: 'EXTERNALLY OWNED',
        title: 'createTravelJournal()',
        text: 'Record patches from an existing store or state machine, then delegate undo/redo through its commit path.',
        sr: 'Your store commits and records patches in the journal, which drives your UI. back() and forward() are delegated back through your store’s commit path.',
        nodes: ['Your store', 'Journal', 'Your UI'],
        caption: 'back() delegates to your store',
        link: 'Connect an external owner',
        href: '/docs/guides/controlled-journal',
      },
    ],
  },
  useCases: {
    eyebrow: 'MADE FOR MEANINGFUL EDITS',
    title: 'Give every interaction a way back.',
    text: 'From a single field to a complex canvas, make exploration feel safe.',
    items: [
      {
        title: 'Visual editors',
        text: 'Group complex canvas operations into atomic steps and keep long editing sessions compact.',
        tag: 'Canvas · Design tools · Whiteboards',
      },
      {
        title: 'Forms & builders',
        text: 'Choose when edits become undoable steps with manual archives and external form ownership.',
        tag: 'Forms · Page builders · Workflows',
      },
      {
        title: 'Local-first apps',
        text: 'Persist complete timelines, validate restored history, and recover intentionally from bad data.',
        tag: 'Offline drafts · IndexedDB · Sync',
      },
    ],
  },
  docs: {
    eyebrow: 'DOCUMENTATION FOR THE WHOLE JOURNEY',
    title: 'Start small. Understand every edge.',
    text: 'Practical guides, integration recipes, operational guardrails, and source-generated API reference.',
    cards: [
      {
        eyebrow: 'START HERE',
        title: 'Build your first timeline',
        text: 'Install Travels, record an edit, and connect undo/redo controls in minutes.',
        href: '/docs/getting-started/quick-start',
        cta: 'Read the guide',
      },
      {
        eyebrow: 'GO DEEPER',
        title: 'Design the right history',
        text: 'Learn archive modes, transactions, branching, mutable state, and external journals.',
        href: '/docs/guides/archive-mode',
        cta: 'Read the guide',
      },
      {
        eyebrow: 'SHIP WITH CONFIDENCE',
        title: 'Persist and restore safely',
        text: 'Add durable storage, migrations, corruption recovery, and integrity boundaries.',
        href: '/docs/persistence',
        cta: 'Read the guide',
      },
    ],
    cta: 'Read the guide',
  },
  api: {
    title: 'Need the exact signature?',
    text: 'Browse every exported function, interface, type alias, class, and variable.',
    cta: 'API Reference',
  },
  final: {
    eyebrow: 'MAKE YOUR NEXT EDIT REVERSIBLE',
    line1: 'Your users make mistakes.',
    line2: 'Your state doesn’t have to.',
    text: 'One small package. A complete history engine.',
    primary: 'Install Travels',
    primaryHref: '/docs/getting-started/installation',
    secondary: 'Browse documentation',
    secondaryHref: '/docs',
  },
  footer: {
    tagline: 'Patch-based state history for modern applications.',
    learn: 'Learn',
    integrate: 'Integrate',
    project: 'Project',
    quickStart: 'Quick Start',
    concepts: 'Core Concepts',
    guides: 'Guides',
    playground: 'Playground',
    persistence: 'Persistence',
    security: 'Security',
    releases: 'Releases',
    license: 'MIT licensed · Built with Fumadocs',
    backToTop: 'Back to top',
  },
};

const zh: HomeContent = {
  release: { text: 'Travels 3.0 已发布', cta: '查看新变化', href: '/zh/docs/migration' },
  hero: {
    eyebrow: '基于补丁的状态历史',
    line1: '每一次改动，',
    line2: '都可撤销。',
    description:
      '为现代应用打造的持久化撤销/重做。保留紧凑历史，用熟悉的草稿写法编写更新，并直接接入你正在使用的状态工具。',
    primary: '开始使用',
    secondary: '在 GitHub 查看',
    framework: '适用于 React · Vue · Zustand · MobX · Pinia · 原生 JavaScript',
  },
  proofLabel: '核心能力',
  proof: [
    { strong: 'RFC 6902', text: 'JSON Patch' },
    { strong: '框架无关', text: '核心' },
    { strong: 'TypeScript 优先', text: 'API' },
    { strong: '存储无关', text: '持久化' },
  ],
  features: {
    eyebrow: '为什么选择 TRAVELS',
    title: '历史更小，编辑更省心。',
    text: '为大规模状态、小步更新、长时间线，以及需要在刷新后依然存在——而不只是撑过当前渲染——的历史而构建。',
    items: [
      {
        title: '补丁驱动的设计',
        text: '记录正向与反向 JSON Patch，而不是为每次编辑复制整个状态。',
        cta: '深入了解',
        href: '/zh/docs/concepts/how-it-works',
      },
      {
        title: '值得保留的历史',
        text: '把状态、补丁、游标与元数据序列化为一个带版本、可恢复的快照。',
        cta: '深入了解',
        href: '/zh/docs/persistence',
      },
      {
        title: '你的框架，你的 Store',
        text: '使用不可变时间线，或通过可变模式与日志保留响应式引用。',
        cta: '深入了解',
        href: '/zh/docs/integrations',
      },
      {
        title: '边界行为可预测',
        text: '原子事务、类型化错误、语义恢复校验，以及清晰的兼容性边界。',
        cta: '深入了解',
        href: '/zh/docs/guides/transactions',
      },
    ],
  },
  playground: {
    eyebrow: '在线试用',
    title: '搭起来，再退回去。',
    text: '下面的每个方块都是一次真实的 Travels 更新，而完整的一笔操作会被归档为一个可撤销步骤。查看补丁、拖动时间线，然后刷新页面：历史会从当前浏览器的存储中恢复。',
  },
  code: {
    eyebrow: '自然的更新，精确的历史',
    line1: '像可变状态一样编写。',
    line2: '像不可变状态一样回溯。',
    text: 'Travels 借助 Mutative，把熟悉的草稿修改转换为不可变状态和可逆补丁。无需 reducer 样板代码，也无需手写逆操作。',
    checks: [
      '空操作不会进入历史',
      '元数据为每次有意义的编辑打上标签',
      '只读控制接口适配任意 UI',
    ],
    link: '探索状态更新',
    href: '/zh/docs/guides/updating-state',
  },
  ownership: {
    eyebrow: '一个核心，两种所有权模型',
    title: '契合你架构的历史记录。',
    text: '让 Travels 负责更新，或让现有 Store 继续作为权威数据源。两种模式下，历史契约都保持明确。',
    cards: [
      {
        tag: '状态自有',
        title: 'createTravels()',
        text: '通过 Travels 发送更新，获得不可变状态、补丁、导航与控制能力。',
        sr: '更新从你的代码流经 Travels 到达界面。back() 与 forward() 则从界面回到 Travels。',
        nodes: ['你的更新', 'Travels', '你的界面'],
        caption: 'back() · forward()',
        link: '用 Travels 掌管状态',
        href: '/zh/docs/getting-started/quick-start',
      },
      {
        tag: '外部所有',
        title: 'createTravelJournal()',
        text: '记录来自现有 Store 或状态机的补丁，再通过其提交路径委托撤销/重做。',
        sr: '你的 Store 提交更新并把补丁记录到日志，日志再驱动界面。back() 与 forward() 通过 Store 的提交路径委托执行。',
        nodes: ['你的 Store', '日志', '你的界面'],
        caption: 'back() 委托给 Store',
        link: '接入外部状态所有者',
        href: '/zh/docs/guides/controlled-journal',
      },
    ],
  },
  useCases: {
    eyebrow: '为有意义的编辑而设计',
    title: '让每一次交互都可撤销。',
    text: '从一个字段到复杂画布，让用户放心尝试。',
    items: [
      {
        title: '可视化编辑器',
        text: '把复杂的画布操作合并为原子步骤，在长时间编辑中保持历史紧凑。',
        tag: '画布 · 设计工具 · 白板',
      },
      {
        title: '表单与搭建器',
        text: '通过手动归档和外部表单所有权，决定何时把编辑变成可撤销步骤。',
        tag: '表单 · 页面搭建 · 工作流',
      },
      {
        title: '本地优先应用',
        text: '持久化完整时间线，校验恢复的历史，并在坏数据面前有意识地恢复。',
        tag: '离线草稿 · IndexedDB · 同步',
      },
    ],
  },
  docs: {
    eyebrow: '覆盖完整使用流程的文档',
    title: '从小处开始，理解每个边界。',
    text: '实用指南、集成方案、运维保障，以及由源码生成的 API 参考。',
    cards: [
      {
        eyebrow: '从这里开始',
        title: '构建你的第一条时间线',
        text: '安装 Travels，记录一次编辑，几分钟内接入撤销/重做控件。',
        href: '/zh/docs/getting-started/quick-start',
        cta: '阅读指南',
      },
      {
        eyebrow: '深入理解',
        title: '设计合适的历史模型',
        text: '了解归档模式、事务、分支、可变状态与外部日志。',
        href: '/zh/docs/guides/archive-mode',
        cta: '阅读指南',
      },
      {
        eyebrow: '放心交付',
        title: '安全地持久化与恢复',
        text: '加入可靠存储、迁移、损坏恢复与完整性边界。',
        href: '/zh/docs/persistence',
        cta: '阅读指南',
      },
    ],
    cta: '阅读指南',
  },
  api: {
    title: '需要精确签名？',
    text: '浏览每个导出的函数、接口、类型别名、类与变量。',
    cta: 'API 参考',
  },
  final: {
    eyebrow: '让下一次编辑可撤销',
    line1: '改动可撤销，',
    line2: '编辑更自由。',
    text: '一个小巧的包。一套完整的历史引擎。',
    primary: '安装 Travels',
    primaryHref: '/zh/docs/getting-started/installation',
    secondary: '浏览文档',
    secondaryHref: '/zh/docs',
  },
  footer: {
    tagline: '为现代应用打造的基于补丁的状态历史。',
    learn: '学习',
    integrate: '集成',
    project: '项目',
    quickStart: '快速开始',
    concepts: '核心概念',
    guides: '指南',
    playground: 'Playground',
    persistence: '持久化',
    security: '安全',
    releases: '发布记录',
    license: 'MIT 许可 · 由 Fumadocs 构建',
    backToTop: '回到顶部',
  },
};

export const homeContent: Record<Locale, HomeContent> = { en, zh };
