import './style.css';
import React, { useCallback, useReducer, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, computed, h, reactive } from 'vue';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { action, autorun, makeAutoObservable, runInAction } from 'mobx';
import {
  createTravels,
  Travels,
  TravelsPersistenceError,
  TRAVELS_HISTORY_SCHEMA_VERSION,
  type Travels as TravelsInstance,
  type TravelsSerializedHistory,
  type Updater,
} from 'travels';
import { initPersistenceAdapters } from './persistence-adapters';

const text = (selector: string, value: string) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  element.textContent = value;
};

const packageTravels = createTravels({ ready: false, count: 0 });
packageTravels.setState((draft) => {
  draft.ready = true;
  draft.count = 1;
});
text(
  '[data-testid="package-ready"]',
  `esm-${packageTravels.getState().ready ? 'ready' : 'missing'}:${
    packageTravels.getState().count
  }`
);

type ReactCounterState = {
  count: number;
  history: string[];
};

type ReactFormState = {
  firstName: string;
  lastName: string;
  email: string;
};

const reactCounterTravels = createTravels<ReactCounterState>({
  count: 0,
  history: [],
});

const reactFormTravels = createTravels<ReactFormState>(
  {
    firstName: '',
    lastName: '',
    email: '',
  },
  { autoArchive: false }
);

function useTravel<S>(travels: TravelsInstance<S, false, boolean>) {
  const state = useSyncExternalStore(
    travels.subscribe.bind(travels),
    travels.getState.bind(travels),
    travels.getState.bind(travels)
  );
  const controls = travels.getControls();
  const setState = useCallback(
    (updater: Updater<S>) => {
      travels.setState(updater);
    },
    [travels]
  );

  return [state, setState, controls] as const;
}

function ReactCounter() {
  const [state, setState, controls] = useTravel(reactCounterTravels);

  return React.createElement(
    'div',
    { className: 'stack' },
    React.createElement(
      'p',
      { className: 'value', 'data-testid': 'react-count' },
      String(state.count)
    ),
    React.createElement(
      'p',
      { className: 'value', 'data-testid': 'react-history' },
      state.history.join(',')
    ),
    React.createElement(
      'div',
      { className: 'row' },
      React.createElement(
        'button',
        {
          'data-testid': 'react-add',
          onClick: () =>
            setState((draft) => {
              draft.count += 1;
              draft.history.push(`count:${draft.count}`);
            }),
        },
        'Add'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-back',
          disabled: !controls.canBack(),
          onClick: () => controls.back(),
        },
        'Back'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-forward',
          disabled: !controls.canForward(),
          onClick: () => controls.forward(),
        },
        'Forward'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-reset',
          onClick: () => controls.reset(),
        },
        'Reset'
      )
    )
  );
}

function ReactManualForm() {
  const [, forceRender] = useReducer((value: number) => value + 1, 0);
  const [state, setState, controls] = useTravel(reactFormTravels);
  const formValue = [
    state.firstName || '-',
    state.lastName || '-',
    state.email || '-',
  ].join('|');

  return React.createElement(
    'div',
    { className: 'stack' },
    React.createElement(
      'p',
      { className: 'value', 'data-testid': 'react-form-state' },
      formValue
    ),
    React.createElement(
      'p',
      { className: 'value', 'data-testid': 'react-form-can-archive' },
      String(reactFormTravels.canArchive())
    ),
    React.createElement(
      'div',
      { className: 'row' },
      React.createElement(
        'button',
        {
          'data-testid': 'react-form-first',
          onClick: () =>
            setState((draft) => {
              draft.firstName = 'John';
            }),
        },
        'First'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-form-last',
          onClick: () =>
            setState((draft) => {
              draft.lastName = 'Doe';
            }),
        },
        'Last'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-form-email',
          onClick: () =>
            setState((draft) => {
              draft.email = 'john@example.com';
            }),
        },
        'Email'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-form-archive',
          disabled: !reactFormTravels.canArchive(),
          onClick: () => {
            reactFormTravels.archive();
            forceRender();
          },
        },
        'Archive'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-form-back',
          disabled: !controls.canBack(),
          onClick: () => controls.back(),
        },
        'Back'
      ),
      React.createElement(
        'button',
        {
          'data-testid': 'react-form-forward',
          disabled: !controls.canForward(),
          onClick: () => controls.forward(),
        },
        'Forward'
      )
    )
  );
}

function ReactFixture() {
  return React.createElement(
    'div',
    { className: 'stack' },
    React.createElement(ReactCounter),
    React.createElement(ReactManualForm)
  );
}

createRoot(document.getElementById('react-root')!).render(
  React.createElement(ReactFixture)
);

type Todo = {
  text: string;
  done: boolean;
};

const pinia = createPinia();
setActivePinia(pinia);

const useTodosStore = defineStore('e2eTodos', () => {
  const state = reactive({
    items: [] as Todo[],
  });
  const travels = createTravels(state, {
    mutable: true,
    warnOnUnsupportedState: false,
  });
  const reference = travels.getState();
  const controls = travels.getControls();
  const referenceStable = computed(() => travels.getState() === reference);

  const addTodo = (label: string) => {
    travels.setState((draft) => {
      draft.items.push({ text: label, done: false });
    });
  };

  const toggleFirst = () => {
    travels.setState((draft) => {
      draft.items[0].done = !draft.items[0].done;
    });
  };

  return {
    state,
    controls,
    referenceStable,
    addTodo,
    toggleFirst,
    reset: travels.reset.bind(travels),
  };
});

const piniaApp = createApp({
  setup() {
    const store = useTodosStore();
    const itemsText = computed(() =>
      store.state.items.map((item) => `${item.text}:${item.done}`).join(',')
    );

    return () =>
      h('div', { class: 'stack' }, [
        h(
          'p',
          { class: 'value', 'data-testid': 'pinia-items' },
          itemsText.value
        ),
        h(
          'p',
          { class: 'value', 'data-testid': 'pinia-reference-stable' },
          String(store.referenceStable)
        ),
        h('div', { class: 'row' }, [
          h(
            'button',
            {
              'data-testid': 'pinia-add-walk',
              onClick: () => store.addTodo('Walk'),
            },
            'Add Walk'
          ),
          h(
            'button',
            {
              'data-testid': 'pinia-add-cook',
              onClick: () => store.addTodo('Cook'),
            },
            'Add Cook'
          ),
          h(
            'button',
            {
              'data-testid': 'pinia-toggle-first',
              onClick: () => store.toggleFirst(),
            },
            'Toggle First'
          ),
          h(
            'button',
            { 'data-testid': 'pinia-back', onClick: () => store.controls.back() },
            'Back'
          ),
          h(
            'button',
            {
              'data-testid': 'pinia-forward',
              onClick: () => store.controls.forward(),
            },
            'Forward'
          ),
          h(
            'button',
            { 'data-testid': 'pinia-reset', onClick: () => store.reset() },
            'Reset'
          ),
        ]),
      ]);
  },
});
piniaApp.use(pinia);
piniaApp.mount('#pinia-root');

type MobxStore = {
  todos: Todo[];
};

const mobxRoot = document.getElementById('mobx-root')!;
mobxRoot.innerHTML = `
  <div class="stack">
    <p class="value" data-testid="mobx-items"></p>
    <p class="value" data-testid="mobx-reference-stable"></p>
    <div class="row">
      <button data-testid="mobx-add-walk">Add Walk</button>
      <button data-testid="mobx-add-cook">Add Cook</button>
      <button data-testid="mobx-toggle-first">Toggle First</button>
      <button data-testid="mobx-back">Back</button>
      <button data-testid="mobx-forward">Forward</button>
      <button data-testid="mobx-reset">Reset</button>
    </div>
  </div>
`;

const mobxStore = makeAutoObservable<MobxStore>({
  todos: [],
});
const mobxTravels = createTravels(mobxStore, {
  mutable: true,
  warnOnUnsupportedState: false,
});
const mobxReference = mobxTravels.getState();
const mobxControls = mobxTravels.getControls();

const renderMobx = () => {
  text(
    '[data-testid="mobx-items"]',
    mobxStore.todos.map((todo) => `${todo.text}:${todo.done}`).join(',')
  );
  text(
    '[data-testid="mobx-reference-stable"]',
    String(mobxTravels.getState() === mobxReference)
  );
};

autorun(renderMobx);

document.querySelector('[data-testid="mobx-add-walk"]')!.addEventListener(
  'click',
  action(() => {
    mobxTravels.setState((draft) => {
      draft.todos.push({ text: 'Walk', done: false });
    });
  })
);
document.querySelector('[data-testid="mobx-add-cook"]')!.addEventListener(
  'click',
  action(() => {
    mobxTravels.setState((draft) => {
      draft.todos.push({ text: 'Cook', done: false });
    });
  })
);
document.querySelector('[data-testid="mobx-toggle-first"]')!.addEventListener(
  'click',
  action(() => {
    mobxTravels.setState((draft) => {
      draft.todos[0].done = !draft.todos[0].done;
    });
  })
);
document.querySelector('[data-testid="mobx-back"]')!.addEventListener(
  'click',
  () => runInAction(() => mobxControls.back())
);
document.querySelector('[data-testid="mobx-forward"]')!.addEventListener(
  'click',
  () => runInAction(() => mobxControls.forward())
);
document.querySelector('[data-testid="mobx-reset"]')!.addEventListener(
  'click',
  () => runInAction(() => mobxTravels.reset())
);

type PersistenceState = {
  title: string;
  blocks: Array<{ id: string; text: string }>;
};

const persistenceStorageKey = 'travels-e2e-browser-history';
const createPersistenceFallback =
  (): TravelsSerializedHistory<PersistenceState> => ({
    version: TRAVELS_HISTORY_SCHEMA_VERSION,
    state: { title: 'Draft', blocks: [] },
    patches: { patches: [], inversePatches: [] },
    position: 0,
  });
const persistenceRoot = document.getElementById('persistence-root')!;
persistenceRoot.innerHTML = `
  <div class="stack">
    <p class="value" data-testid="persistence-state"></p>
    <p class="value" data-testid="persistence-position"></p>
    <p class="value" data-testid="persistence-saved">unsaved</p>
    <div class="row">
      <button data-testid="persistence-add-block">Add Block</button>
      <button data-testid="persistence-publish">Publish</button>
      <button data-testid="persistence-save">Save</button>
      <button data-testid="persistence-back">Back</button>
      <button data-testid="persistence-forward">Forward</button>
      <button data-testid="persistence-clear">Clear Storage</button>
    </div>
  </div>
`;

const createPersistenceHistory = () => {
  const stored = localStorage.getItem(persistenceStorageKey);
  if (!stored) {
    return createTravels<PersistenceState>(
      createPersistenceFallback().state,
      { maxHistory: 20, warnOnUnsupportedState: false }
    );
  }

  const history = Travels.deserialize<PersistenceState>(stored, {
    validation: 'semantic',
    fallback: createPersistenceFallback,
    onError(error) {
      if (error instanceof TravelsPersistenceError) {
        text('[data-testid="persistence-saved"]', `fallback:${error.code}`);
      }
    },
  });
  return createTravels<PersistenceState>(history.state, {
    history,
    maxHistory: 20,
    strictInitialPatches: true,
    warnOnUnsupportedState: false,
  });
};

const persistenceTravels = createPersistenceHistory();
const persistenceControls = persistenceTravels.getControls();

const renderPersistence = () => {
  const state = persistenceTravels.getState();
  text(
    '[data-testid="persistence-state"]',
    `${state.title}|${state.blocks.map((block) => block.text).join(',')}`
  );
  text(
    '[data-testid="persistence-position"]',
    String(persistenceTravels.getPosition())
  );
};

persistenceTravels.subscribe(renderPersistence);
renderPersistence();

document
  .querySelector('[data-testid="persistence-add-block"]')!
  .addEventListener('click', () => {
    persistenceTravels.setState((draft) => {
      const index = draft.blocks.length + 1;
      draft.blocks.push({ id: String(index), text: `Block ${index}` });
    });
    text('[data-testid="persistence-saved"]', 'unsaved');
  });
document
  .querySelector('[data-testid="persistence-publish"]')!
  .addEventListener('click', () => {
    persistenceTravels.setState((draft) => {
      draft.title = 'Published';
    });
    text('[data-testid="persistence-saved"]', 'unsaved');
  });
document
  .querySelector('[data-testid="persistence-save"]')!
  .addEventListener('click', () => {
    localStorage.setItem(
      persistenceStorageKey,
      JSON.stringify(persistenceTravels.serialize())
    );
    text('[data-testid="persistence-saved"]', 'saved');
  });
document
  .querySelector('[data-testid="persistence-back"]')!
  .addEventListener('click', () => persistenceControls.back());
document
  .querySelector('[data-testid="persistence-forward"]')!
  .addEventListener('click', () => persistenceControls.forward());
document
  .querySelector('[data-testid="persistence-clear"]')!
  .addEventListener('click', () => {
    localStorage.removeItem(persistenceStorageKey);
    text('[data-testid="persistence-saved"]', 'cleared');
  });

const maxHistoryRoot = document.getElementById('max-history-root')!;
maxHistoryRoot.innerHTML = `
  <div class="stack">
    <p class="value" data-testid="max-count"></p>
    <p class="value" data-testid="max-position"></p>
    <p class="value" data-testid="max-history"></p>
    <p class="value" data-testid="max-can-forward"></p>
    <div class="row">
      <button data-testid="max-step">Step</button>
      <button data-testid="max-back">Back</button>
      <button data-testid="max-forward">Forward</button>
      <button data-testid="max-branch">Branch</button>
      <button data-testid="max-reset">Reset</button>
    </div>
  </div>
`;

const maxHistoryTravels = createTravels(
  { count: 0 },
  { maxHistory: 3, warnOnUnsupportedState: false }
);
const maxHistoryControls = maxHistoryTravels.getControls();

const renderMaxHistory = () => {
  text('[data-testid="max-count"]', String(maxHistoryTravels.getState().count));
  text('[data-testid="max-position"]', String(maxHistoryTravels.getPosition()));
  text(
    '[data-testid="max-history"]',
    maxHistoryTravels
      .getHistory()
      .map((state) => state.count)
      .join(',')
  );
  text('[data-testid="max-can-forward"]', String(maxHistoryTravels.canForward()));
};

maxHistoryTravels.subscribe(renderMaxHistory);
renderMaxHistory();

document.querySelector('[data-testid="max-step"]')!.addEventListener('click', () => {
  maxHistoryTravels.setState((draft) => {
    draft.count += 1;
  });
});
document.querySelector('[data-testid="max-back"]')!.addEventListener('click', () => {
  maxHistoryControls.back();
});
document
  .querySelector('[data-testid="max-forward"]')!
  .addEventListener('click', () => {
    maxHistoryControls.forward();
  });
document
  .querySelector('[data-testid="max-branch"]')!
  .addEventListener('click', () => {
    maxHistoryTravels.setState((draft) => {
      draft.count *= 10;
    });
  });
document.querySelector('[data-testid="max-reset"]')!.addEventListener('click', () => {
  maxHistoryControls.reset();
});

initPersistenceAdapters();
