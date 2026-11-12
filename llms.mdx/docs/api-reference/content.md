# API Reference (/travels/llms.mdx/docs/api-reference/content.md)

This reference is generated from the published Travels package used by the website examples during the website build, so signatures, overloads, return capabilities, and source links match that release.

<Callout type="info" title="Looking for guidance?">
Start with [Configuration Options](/travels/llms.mdx/docs/reference/options/content.md) or [Instance Methods](/travels/llms.mdx/docs/reference/instance-methods/content.md) for task-oriented explanations. Use this section when you need the exact type or overload.
</Callout>

## Browse by export kind [#browse-by-export-kind]

<Cards>
  <Card title="Functions" href="/travels/llms.mdx/docs/api-reference/functions/createTravels/content.md" description="Factories, restore functions, type guards, and validation helpers." />
  <Card title="Classes" href="/travels/llms.mdx/docs/api-reference/classes/TravelsError/content.md" description="Operation, type, and persistence error classes." />
  <Card title="Interfaces" href="/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md" description="Read-only controls and manual control surfaces." />
  <Card title="Type Aliases" href="/travels/llms.mdx/docs/api-reference/type-aliases/TravelsOptions/content.md" description="Timeline capabilities, events, snapshots, options, patches, and JSON types." />
  <Card title="Variables" href="/travels/llms.mdx/docs/api-reference/variables/Travels/content.md" description="The persistence namespace and history schema version." />
</Cards>

## Most-used exports [#most-used-exports]

| Export | Kind | Purpose |
| --- | --- | --- |
| [`createTravels()`](/travels/llms.mdx/docs/api-reference/functions/createTravels/content.md) | Function | Create a state-owning timeline. |
| [`createPatchableTravels()`](/travels/llms.mdx/docs/api-reference/functions/createPatchableTravels/content.md) | Function | Create a timeline with durable-input constraints. |
| [`createTravelJournal()`](/travels/llms.mdx/docs/api-reference/functions/createTravelJournal/content.md) | Function | Create an externally owned controlled journal. |
| [`restoreTravels()`](/travels/llms.mdx/docs/api-reference/functions/restoreTravels/content.md) | Function | Restore one complete state-owning snapshot. |
| [`restoreTravelJournal()`](/travels/llms.mdx/docs/api-reference/functions/restoreTravelJournal/content.md) | Function | Restore one complete controlled journal snapshot. |
| [`Travels`](/travels/llms.mdx/docs/api-reference/variables/Travels/content.md) | Namespace value | Decode persisted input with `Travels.deserialize()`. |
| [`TravelsOptions`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelsOptions/content.md) | Type | Configure history, ownership, Mutative behavior, and hooks. |
| [`TravelsEvent`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelsEvent/content.md) | Type | Consume committed subscriber and devtools events. |
| [`TravelsSerializedHistory`](/travels/llms.mdx/docs/api-reference/type-aliases/TravelsSerializedHistory/content.md) | Type | Store and migrate versioned snapshots. |
| [`TravelsControls`](/travels/llms.mdx/docs/api-reference/interfaces/TravelsControls/content.md) | Interface | Expose read-only navigation and history controls. |
| [`TravelsPersistenceError`](/travels/llms.mdx/docs/api-reference/classes/TravelsPersistenceError/content.md) | Class | Handle stable persistence failure codes. |
| [`TRAVELS_HISTORY_SCHEMA_VERSION`](/travels/llms.mdx/docs/api-reference/variables/TRAVELS_HISTORY_SCHEMA_VERSION/content.md) | Variable | Construct and migrate current-schema snapshots. |

## Reference conventions [#reference-conventions]

- “Defined in” links point to the exact source revision used to generate the page.
- Read-only return objects are capabilities, not constructor-based class instances.
- `Travels` the exported value is a persistence namespace; `Travels<...>` the type describes a state-owning timeline.
- Event names are open to future minor releases; keep a `default` branch in application switches.
- Patch and state views described as read-only must not be cast and mutated. Use the corresponding detached snapshot API.
