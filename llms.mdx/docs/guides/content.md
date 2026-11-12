# History Guides (/travels/llms.mdx/docs/guides/content.md)

These guides explain the behavior that matters after the first undo button works. Start with updates and navigation, then choose the archive and ownership models that match your application.

## Everyday operations [#everyday-operations]

<Cards>
  <Card title="Updating State" href="/travels/llms.mdx/docs/guides/updating-state/content.md" description="Draft recipes, replacement values, metadata, synchronous boundaries, and no-op updates." />
  <Card title="Navigation and Controls" href="/travels/llms.mdx/docs/guides/navigation-and-controls/content.md" description="Undo, redo, jumps, revisions, history views, and narrow UI controls." />
  <Card title="Archive Mode" href="/travels/llms.mdx/docs/guides/archive-mode/content.md" description="Choose when pending changes become undoable entries." />
  <Card title="Transactions" href="/travels/llms.mdx/docs/guides/transactions/content.md" description="Atomic multi-step edits, nesting, rollback, and observer semantics." />
</Cards>

## Ownership and lifecycle [#ownership-and-lifecycle]

<Cards>
  <Card title="Tracking and Replacement" href="/travels/llms.mdx/docs/guides/tracking-and-replacement/content.md" description="Pause history, accept remote state, and establish a new baseline." />
  <Card title="Mutable Mode" href="/travels/llms.mdx/docs/guides/mutable-mode/content.md" description="Keep reactive object references stable without losing patches." />
  <Card title="Controlled Journal" href="/travels/llms.mdx/docs/guides/controlled-journal/content.md" description="Record history for an external state owner through its commit path." />
</Cards>

## Production behavior [#production-behavior]

<Cards>
  <Card title="Observers and Events" href="/travels/llms.mdx/docs/guides/observers-and-events/content.md" description="Committed event envelopes, read-only views, devtools, and error isolation." />
  <Card title="Error Handling" href="/travels/llms.mdx/docs/guides/error-handling/content.md" description="Stable error codes, warnings, observer failures, and recovery boundaries." />
  <Card title="Advanced Patterns" href="/travels/llms.mdx/docs/guides/advanced-patterns/content.md" description="Validation, permissions, metadata, logging, and composable wrappers." />
</Cards>
