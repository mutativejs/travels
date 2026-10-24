# API Reference (/docs/api-reference)

This reference is generated from the repository’s current `src/index.ts` during the website build, so signatures, overloads, return capabilities, and source links stay aligned with the package.

<Callout type="info" title="Looking for guidance?">
Start with [Configuration Options](/docs/reference/options) or [Instance Methods](/docs/reference/instance-methods) for task-oriented explanations. Use this section when you need the exact type or overload.
</Callout>

## Browse by export kind [#browse-by-export-kind]

<Cards>
  <Card title="Functions" href="/docs/api-reference/functions/createTravels" description="Factories, restore functions, type guards, and validation helpers." />
  <Card title="Classes" href="/docs/api-reference/classes/TravelsError" description="Operation, type, and persistence error classes." />
  <Card title="Interfaces" href="/docs/api-reference/interfaces/TravelsControls" description="Read-only controls and manual control surfaces." />
  <Card title="Type Aliases" href="/docs/api-reference/type-aliases/TravelsOptions" description="Timeline capabilities, events, snapshots, options, patches, and JSON types." />
  <Card title="Variables" href="/docs/api-reference/variables/Travels" description="The persistence namespace and history schema version." />
</Cards>

## Most-used exports [#most-used-exports]

| Export | Kind | Purpose |
| --- | --- | --- |
| [`createTravels()`](/docs/api-reference/functions/createTravels) | Function | Create a state-owning timeline. |
| [`createPatchableTravels()`](/docs/api-reference/functions/createPatchableTravels) | Function | Create a timeline with durable-input constraints. |
| [`createTravelJournal()`](/docs/api-reference/functions/createTravelJournal) | Function | Create an externally owned controlled journal. |
| [`restoreTravels()`](/docs/api-reference/functions/restoreTravels) | Function | Restore one complete state-owning snapshot. |
| [`restoreTravelJournal()`](/docs/api-reference/functions/restoreTravelJournal) | Function | Restore one complete controlled journal snapshot. |
| [`Travels`](/docs/api-reference/variables/Travels) | Namespace value | Decode persisted input with `Travels.deserialize()`. |
| [`TravelsOptions`](/docs/api-reference/type-aliases/TravelsOptions) | Type | Configure history, ownership, Mutative behavior, and hooks. |
| [`TravelsEvent`](/docs/api-reference/type-aliases/TravelsEvent) | Type | Consume committed subscriber and devtools events. |
| [`TravelsSerializedHistory`](/docs/api-reference/type-aliases/TravelsSerializedHistory) | Type | Store and migrate versioned snapshots. |
| [`TravelsControls`](/docs/api-reference/interfaces/TravelsControls) | Interface | Expose read-only navigation and history controls. |
| [`TravelsPersistenceError`](/docs/api-reference/classes/TravelsPersistenceError) | Class | Handle stable persistence failure codes. |
| [`TRAVELS_HISTORY_SCHEMA_VERSION`](/docs/api-reference/variables/TRAVELS_HISTORY_SCHEMA_VERSION) | Variable | Construct and migrate current-schema snapshots. |

## Reference conventions [#reference-conventions]

- “Defined in” links point to the exact source revision used to generate the page.
- Read-only return objects are capabilities, not constructor-based class instances.
- `Travels` the exported value is a persistence namespace; `Travels<...>` the type describes a state-owning timeline.
- Event names are open to future minor releases; keep a `default` branch in application switches.
- Patch and state views described as read-only must not be cast and mutated. Use the corresponding detached snapshot API.
