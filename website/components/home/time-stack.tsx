'use client';

import { GitBranch, Pause, Play, Plus, Redo2, Undo2, Zap } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { createTravels, type TravelsBranchDiscardEvent } from 'travels';
import type { Locale } from '@/lib/locale';
import { describePatch, isEditableTarget, padStep } from './demo-utils';

type Hue = 'blue' | 'orange' | 'violet' | 'mint';
type ShapeKind = 'circle' | 'square' | 'pill';

type Shape = {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  size: number;
  hue: Hue;
};

type Board = {
  title: string;
  shapes: Shape[];
};

type Edit = {
  label: string;
  recipe: (draft: Board) => void;
};

type Ghost = {
  key: string;
  index: number;
  board: Board;
};

type AutoStep = 'edit' | 'back' | 'forward' | 'start' | 'end';

const zhTitles: Record<string, string> = {
  Untitled: '未命名',
  'Launch board': '发布看板',
  Moodboard: '情绪板',
  'Sprint plan': '冲刺计划',
  Roadmap: '路线图',
};

const zhKinds: Record<string, string> = {
  circle: '圆形',
  square: '方形',
  pill: '胶囊',
};

const zhEditLabels: Record<string, string> = {
  'Add a pill': '添加胶囊',
  'Move circle': '移动圆形',
  'Rename canvas': '重命名画布',
};

function localizeEditLabel(label: string, locale: Locale) {
  if (locale !== 'zh') return label;
  if (zhEditLabels[label]) return zhEditLabels[label];
  const match = label.match(/^(Add a|Remove|Move|Recolor|Grow|Shrink) ([a-z]+)$/);
  if (!match) return label;
  const kind = zhKinds[match[2]] ?? match[2];
  const verbs: Record<string, string> = {
    'Add a': '添加',
    Remove: '移除',
    Move: '移动',
    Recolor: '改色',
    Grow: '放大',
    Shrink: '缩小',
  };
  return `${verbs[match[1]]}${kind}`;
}

function localizeBoardTitle(title: string, locale: Locale) {
  return locale === 'zh' ? (zhTitles[title] ?? title) : title;
}

const uiCopy = {
  en: {
    historyStack: 'Travels history stack',
    interactiveDemo: 'interactive demo',
    windowStart: 'Window start',
    initialCanvas: 'Initial canvas',
    editIndex: (index: number) => `Edit ${index}`,
    lastEdit: 'the last edit',
    nextEdit: 'the next edit',
    discarded: 'Discarded',
    undo: 'Undo',
    redo: 'Redo',
    newEdit: 'Apply a new edit',
    pause: 'Pause demo',
    play: 'Play demo',
    historyPosition: 'History position',
    stepOf: (position: number, total: number, label: string) =>
      `Step ${position} of ${total}: ${label}`,
    delta: 'Only the delta',
    deltaDetail: (patch: number, snapshot: number) =>
      `${patch} B patch · ${snapshot} B snapshot`,
    baseline: 'Baseline state',
    baselineDetail: 'nothing left to undo',
    hint: 'Drag to orbit · click a layer to travel',
    noPatch: 'no patch — the baseline',
    redoDiscarded: (count: number) =>
      `Redo branch discarded · ${count} ${count === 1 ? 'step' : 'steps'}`,
    undid: (label: string) => `Undid ${label}`,
    redid: (label: string) => `Redid ${label}`,
    applied: (label: string) => `Applied ${label}`,
    traveledTo: (label: string) => `Traveled to ${label}`,
    announcement: (message: string, position: number, total: number) =>
      `${message}. Step ${position} of ${total}.`,
  },
  zh: {
    historyStack: 'Travels 历史堆栈',
    interactiveDemo: '交互演示',
    windowStart: '窗口起点',
    initialCanvas: '初始画布',
    editIndex: (index: number) => `编辑 ${index}`,
    lastEdit: '上一次编辑',
    nextEdit: '下一次编辑',
    discarded: '已丢弃',
    undo: '撤销',
    redo: '重做',
    newEdit: '应用一次新编辑',
    pause: '暂停演示',
    play: '播放演示',
    historyPosition: '历史位置',
    stepOf: (position: number, total: number, label: string) =>
      `第 ${position} 步，共 ${total} 步：${label}`,
    delta: '只保留增量',
    deltaDetail: (patch: number, snapshot: number) =>
      `${patch} B 补丁 · ${snapshot} B 快照`,
    baseline: '基线状态',
    baselineDetail: '没有可撤销的内容',
    hint: '拖动以旋转 · 点击图层以回溯',
    noPatch: '无补丁——当前为基线',
    redoDiscarded: (count: number) => `已丢弃重做分支 · ${count} 步`,
    undid: (label: string) => `已撤销「${label}」`,
    redid: (label: string) => `已重做「${label}」`,
    applied: (label: string) => `已应用「${label}」`,
    traveledTo: (label: string) => `已回溯到「${label}」`,
    announcement: (message: string, position: number, total: number) =>
      `${message}。第 ${position} 步，共 ${total} 步。`,
  },
} as const;

const MAX_HISTORY = 12;
const WINDOW_BEFORE = 4;
const WINDOW_AFTER = 3;
const AUTOPLAY_MS = 2300;
const BASE_TILT = 57;
const BASE_SPIN = -41;
const HUES: Hue[] = ['blue', 'orange', 'violet', 'mint'];
const KINDS: ShapeKind[] = ['circle', 'square', 'pill'];
const TITLES = ['Launch board', 'Moodboard', 'Sprint plan', 'Roadmap'];
const EDIT_CYCLE = ['move', 'recolor', 'add', 'resize', 'move', 'rename'] as const;
const AUTOPLAY: AutoStep[] = [
  'edit',
  'back',
  'back',
  'back',
  'forward',
  'edit',
  'start',
  'end',
  'edit',
  'back',
  'forward',
  'edit',
];

const INITIAL_BOARD: Board = {
  title: 'Untitled',
  shapes: [
    { id: 's1', kind: 'circle', x: 30, y: 50, size: 22, hue: 'blue' },
    { id: 's2', kind: 'square', x: 68, y: 62, size: 19, hue: 'orange' },
  ],
};

const OPENING_EDITS: Edit[] = [
  {
    label: 'Add a pill',
    recipe: (draft) => {
      draft.shapes.push({ id: 's3', kind: 'pill', x: 60, y: 36, size: 16, hue: 'violet' });
    },
  },
  {
    label: 'Move circle',
    recipe: (draft) => {
      draft.shapes[0].x = 34;
      draft.shapes[0].y = 66;
    },
  },
  {
    label: 'Rename canvas',
    recipe: (draft) => {
      draft.title = 'Launch board';
    },
  },
];

/** Integer hash in [0, 1): deterministic on every JavaScript engine. */
function hash(seed: number) {
  let value = Math.imul(seed + 1, 2654435761) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 2246822519) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) / 4294967296;
}

function between(min: number, max: number, seed: number) {
  return min + Math.round(hash(seed) * (max - min));
}

function planEdit(board: Board, step: number): Edit {
  const kind = EDIT_CYCLE[step % EDIT_CYCLE.length];
  const count = board.shapes.length;
  const index = Math.floor(hash(step) * Math.max(count, 1));
  const shape = board.shapes[index];

  if (!shape || (kind === 'add' && count < 5)) {
    const added: Shape = {
      id: `s${step + 10}`,
      kind: KINDS[step % KINDS.length],
      x: between(24, 76, step + 11),
      y: between(32, 74, step + 23),
      size: between(14, 21, step + 37),
      hue: HUES[(step + 1) % HUES.length],
    };
    return {
      label: `Add a ${added.kind}`,
      recipe: (draft) => {
        draft.shapes.push(added);
      },
    };
  }

  switch (kind) {
    case 'add':
      return {
        label: `Remove ${shape.kind}`,
        recipe: (draft) => {
          draft.shapes.splice(index, 1);
        },
      };
    case 'move': {
      const x = between(24, 76, step + 5);
      const y = between(32, 74, step + 9);
      return {
        label: `Move ${shape.kind}`,
        recipe: (draft) => {
          draft.shapes[index].x = x;
          draft.shapes[index].y = y;
        },
      };
    }
    case 'recolor': {
      const hue = HUES[(HUES.indexOf(shape.hue) + 1) % HUES.length];
      return {
        label: `Recolor ${shape.kind}`,
        recipe: (draft) => {
          draft.shapes[index].hue = hue;
        },
      };
    }
    case 'resize': {
      const size = shape.size > 18 ? shape.size - 6 : shape.size + 6;
      return {
        label: `${size > shape.size ? 'Grow' : 'Shrink'} ${shape.kind}`,
        recipe: (draft) => {
          draft.shapes[index].size = size;
        },
      };
    }
    default: {
      const titles = TITLES.filter((title) => title !== board.title);
      const title = titles[step % titles.length];
      return {
        label: 'Rename canvas',
        recipe: (draft) => {
          draft.title = title;
        },
      };
    }
  }
}

function createBoardTimeline(onDiscard: (event: TravelsBranchDiscardEvent) => void) {
  const travels = createTravels<Board>(structuredClone(INITIAL_BOARD), {
    maxHistory: MAX_HISTORY,
    onBranchDiscard: onDiscard,
    // The demo trims and branches on purpose; keep the console quiet.
    onWarning: () => undefined,
  });
  for (const edit of OPENING_EDITS) travels.setState(edit.recipe, { label: edit.label });
  return travels;
}

function byteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function BoardShape({ shape }: { shape: Shape }) {
  return (
    <span
      className="ts-shape"
      data-kind={shape.kind}
      data-hue={shape.hue}
      style={{ '--x': shape.x, '--y': shape.y, '--s': shape.size } as CSSProperties}
    >
      <i style={{ '--k': 0 } as CSSProperties} />
      <i style={{ '--k': 1 } as CSSProperties} />
      <i style={{ '--k': 2 } as CSSProperties} />
      <i style={{ '--k': 3 } as CSSProperties} />
    </span>
  );
}

function Plate({
  board,
  index,
  label,
  status,
  fade,
  locale,
  onSelect,
  ghost = false,
}: {
  board: Board;
  index: number;
  label: string;
  status: 'past' | 'current' | 'future';
  fade: number;
  locale: Locale;
  onSelect?: () => void;
  ghost?: boolean;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`ts-plate is-${status}${ghost ? ' is-ghost' : ''}`}
      style={{ '--i': index, '--fade': fade } as CSSProperties}
      onClick={onSelect}
      title={ghost ? undefined : `${padStep(index)} · ${label}`}
    >
      <span className="ts-plate-slab" />
      <span className="ts-plate-face">
        <span className="ts-plate-title">{localizeBoardTitle(board.title, locale)}</span>
        <span className="ts-plate-step">
          {padStep(index)} · {label}
        </span>
        {board.shapes.map((shape) => (
          <BoardShape key={shape.id} shape={shape} />
        ))}
      </span>
    </button>
  );
}

export function TimeStack({ locale = 'en' }: { locale?: Locale }) {
  const text = uiCopy[locale];
  const discardHandler = useRef<(event: TravelsBranchDiscardEvent) => void>(() => undefined);
  const [travels] = useState(() =>
    createBoardTimeline((event) => discardHandler.current(event))
  );
  const subscribe = useCallback(
    (notify: () => void) => travels.subscribe(() => notify()),
    [travels]
  );
  const revision = useSyncExternalStore(subscribe, travels.getRevision, travels.getRevision);

  const view = useMemo(() => {
    const history = travels.getHistory() as readonly Board[];
    const position = travels.getPosition();
    const metadata = travels.getMetadata();
    const { patches } = travels.getPatches();
    return { history, position, metadata, patches, revision };
  }, [travels, revision]);

  const { history, position, metadata, patches } = view;
  const last = history.length - 1;
  const [playing, setPlaying] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [modifierKey, setModifierKey] = useState('⌘');
  const [shifted, setShifted] = useState(false);
  const [trimmed, setTrimmed] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const editCounter = useRef(0);
  const autoIndex = useRef(0);
  const inView = useRef(false);
  const timers = useRef<number[]>([]);

  const labelFor = useCallback(
    (index: number) => {
      if (index === 0) return trimmed ? text.windowStart : text.initialCanvas;
      const label = metadata[index - 1]?.label;
      return label ? localizeEditLabel(label, locale) : text.editIndex(index);
    },
    [locale, metadata, text, trimmed]
  );

  const later = useCallback((callback: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((timer) => timer !== id);
      callback();
    }, delay);
    timers.current.push(id);
  }, []);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
      timers.current = [];
    },
    []
  );

  useEffect(() => {
    discardHandler.current = (event) => {
      const count = event.discarded.length;
      setToast(text.redoDiscarded(count));
      later(() => setToast(null), 2400);
    };
  }, [later, text]);

  const applyEdit = useCallback(() => {
    const before = travels.getHistory() as readonly Board[];
    const from = travels.getPosition();
    const futures = before.slice(from + 1);
    const edit = planEdit(travels.getState(), editCounter.current++);
    travels.setState(edit.recipe, { label: edit.label });

    if (futures.length > 0) {
      const stamp = travels.getRevision();
      setGhosts(
        futures.map((board, offset) => ({
          key: `${stamp}-${offset}`,
          index: from + 1 + offset,
          board,
        }))
      );
      later(() => setGhosts([]), 950);
    } else if (travels.getHistory().length === before.length) {
      // maxHistory dropped the oldest entry: replay the stack sliding down.
      setTrimmed(true);
      setShifted(true);
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => setShifted(false))
      );
    }
    return edit.label;
  }, [later, travels]);

  const undo = useCallback(() => {
    if (!travels.canBack()) return null;
    const label = travels.getMetadata()[travels.getPosition() - 1]?.label;
    travels.back();
    return label ? localizeEditLabel(label, locale) : text.lastEdit;
  }, [locale, text, travels]);

  const redo = useCallback(() => {
    if (!travels.canForward()) return null;
    const label = travels.getMetadata()[travels.getPosition()]?.label;
    travels.forward();
    return label ? localizeEditLabel(label, locale) : text.nextEdit;
  }, [locale, text, travels]);

  const announcePosition = useCallback(
    (message: string) => {
      const total = travels.getHistory().length - 1;
      setAnnouncement(text.announcement(message, travels.getPosition(), total));
    },
    [text, travels]
  );

  const takeControl = useCallback(() => setPlaying(false), []);

  const handleUndo = useCallback(() => {
    takeControl();
    const label = undo();
    if (label) announcePosition(text.undid(label));
  }, [announcePosition, takeControl, text, undo]);

  const handleRedo = useCallback(() => {
    takeControl();
    const label = redo();
    if (label) announcePosition(text.redid(label));
  }, [announcePosition, redo, takeControl, text]);

  const handleEdit = useCallback(() => {
    takeControl();
    announcePosition(text.applied(applyEdit()));
  }, [announcePosition, applyEdit, takeControl, text]);

  const travelTo = useCallback(
    (target: number) => {
      takeControl();
      if (target === travels.getPosition()) return;
      travels.go(target);
      announcePosition(text.traveledTo(labelFor(target)));
    },
    [announcePosition, labelFor, takeControl, text, travels]
  );

  // Autoplay a short choreography unless the visitor prefers reduced motion,
  // and show the undo shortcut of the visitor's platform.
  useEffect(() => {
    if (!/mac|iphone|ipad/i.test(navigator.platform)) setModifierKey('Ctrl');
    if (!prefersReducedMotion()) setPlaying(true);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting && entry.intersectionRatio > 0.3;
      },
      { threshold: [0, 0.3, 0.6] }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (!inView.current || document.hidden) return;
      const step = AUTOPLAY[autoIndex.current % AUTOPLAY.length];
      autoIndex.current += 1;
      if (step === 'edit') applyEdit();
      else if (step === 'back') undo();
      else if (step === 'forward') redo();
      else if (step === 'start') travels.go(0);
      else travels.go(travels.getHistory().length - 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [applyEdit, playing, redo, travels, undo]);

  // ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y) travel the stack while it is on screen.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!inView.current || event.defaultPrevented || event.altKey) return;
      if (!(event.metaKey || event.ctrlKey) || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo]);

  // Pointer parallax and drag-to-orbit, written straight to CSS variables.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduced = prefersReducedMotion();
    const target = { tilt: 0, spin: 0 };
    const current = { tilt: 0, spin: 0 };
    let orbit = 0;
    let frame = 0;
    let drag: { x: number; orbit: number; id: number; active: boolean } | null = null;

    const write = () => {
      stage.style.setProperty('--ts-tilt', `${(BASE_TILT + current.tilt).toFixed(2)}deg`);
      stage.style.setProperty('--ts-spin', `${(BASE_SPIN + current.spin + orbit).toFixed(2)}deg`);
    };
    const tick = () => {
      current.tilt += (target.tilt - current.tilt) * 0.1;
      current.spin += (target.spin - current.spin) * 0.1;
      write();
      const settled =
        Math.abs(target.tilt - current.tilt) < 0.01 && Math.abs(target.spin - current.spin) < 0.01;
      frame = settled ? 0 : window.requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (reduced) {
        current.tilt = target.tilt;
        current.spin = target.spin;
        write();
      } else if (!frame) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (drag) {
        const delta = event.clientX - drag.x;
        if (!drag.active && Math.abs(delta) > 5) {
          drag.active = true;
          stage.setPointerCapture(drag.id);
          stage.classList.add('is-dragging');
        }
        if (drag.active) {
          orbit = Math.max(-55, Math.min(55, drag.orbit + delta * 0.32));
          schedule();
        }
        return;
      }
      if (event.pointerType !== 'mouse' || reduced) return;
      target.spin = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
      target.tilt = ((event.clientY - rect.top) / rect.height - 0.5) * -8;
      schedule();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      drag = { x: event.clientX, orbit, id: event.pointerId, active: false };
    };
    const endDrag = () => {
      if (drag?.active) {
        stage.classList.remove('is-dragging');
        if (stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id);
      }
      drag = null;
    };
    const onPointerLeave = () => {
      target.tilt = 0;
      target.spin = 0;
      schedule();
    };
    const onDoubleClick = () => {
      orbit = 0;
      schedule();
    };

    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', onPointerLeave);
    stage.addEventListener('dblclick', onDoubleClick);
    return () => {
      window.cancelAnimationFrame(frame);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerup', endDrag);
      stage.removeEventListener('pointercancel', endDrag);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('dblclick', onDoubleClick);
    };
  }, []);

  const start = Math.max(0, position - WINDOW_BEFORE);
  const end = Math.min(last, position + WINDOW_AFTER);
  const indices = [];
  for (let index = start; index <= end; index += 1) indices.push(index);
  const center = (start + Math.max(end, position + 1)) / 2;

  const forward = position > 0 ? patches[position - 1] ?? [] : [];
  const patchBytes = position > 0 ? byteLength(forward) : 0;
  const snapshotBytes = byteLength(history[position]);
  const firstOp = forward[0];
  const extraOps = Math.max(0, forward.length - 1);
  const currentLabel = labelFor(position);
  const progress = last > 0 ? position / last : 1;

  return (
    <div
      ref={rootRef}
      className="time-stack"
      role="group"
      aria-roledescription={text.interactiveDemo}
      aria-label={text.historyStack}
    >
      <div
        ref={stageRef}
        className={`ts-stage${shifted ? ' is-shifted' : ''}`}
        style={{ '--ts-center': center } as CSSProperties}
      >
        <div className="ts-world" aria-hidden="true">
          <div className="ts-lift">
            <span className="ts-ground" style={{ '--i': start } as CSSProperties} />
            {indices.map((index) => {
              const status = index === position ? 'current' : index < position ? 'past' : 'future';
              const fade =
                status === 'current'
                  ? 1
                  : status === 'past'
                    ? Math.max(0.42, 1 - (position - index) * 0.16)
                    : 0.9;
              return (
                <Plate
                  key={index}
                  board={history[index]}
                  index={index}
                  label={labelFor(index)}
                  locale={locale}
                  status={status}
                  fade={fade}
                  onSelect={() => travelTo(index)}
                />
              );
            })}
            {ghosts.map((ghost) => (
              <Plate
                key={ghost.key}
                board={ghost.board}
                index={ghost.index}
                label={text.discarded}
                locale={locale}
                status="future"
                fade={0.9}
                ghost
              />
            ))}
          </div>
        </div>

        <div className="ts-chip" aria-hidden="true">
          <span className="ts-chip-icon">
            <Zap size={15} />
          </span>
          {position > 0 ? (
            <span>
              <strong>{text.delta}</strong>
              <small>
                {text.deltaDetail(patchBytes, snapshotBytes)}
              </small>
            </span>
          ) : (
            <span>
              <strong>{text.baseline}</strong>
              <small>{text.baselineDetail}</small>
            </span>
          )}
        </div>

        {toast && (
          <div className="ts-toast" aria-hidden="true">
            <GitBranch size={14} /> {toast}
          </div>
        )}

        <p className="ts-hint" aria-hidden="true">
          {text.hint}
        </p>
      </div>

      <div className="ts-hud">
        <div className="ts-controls">
          <button
            type="button"
            className="ts-button"
            onClick={handleUndo}
            disabled={position === 0}
            aria-label={text.undo}
            title={`${text.undo} (${modifierKey}+Z)`}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="ts-button"
            onClick={handleRedo}
            disabled={position === last}
            aria-label={text.redo}
            title={`${text.redo} (${modifierKey === '⌘' ? '⇧⌘' : 'Ctrl+'}${modifierKey === '⌘' ? 'Z' : 'Y'})`}
          >
            <Redo2 size={16} />
          </button>
          <div className="ts-scrubber" style={{ '--progress': progress } as CSSProperties}>
            <span className="ts-track" aria-hidden="true">
              <span className="ts-track-fill" />
              {history.map((_, index) => (
                <span
                  key={index}
                  className={`ts-dot${index === position ? ' is-current' : index > position ? ' is-future' : ''}`}
                  style={{ '--at': last > 0 ? index / last : 1 } as CSSProperties}
                />
              ))}
            </span>
            <input
              type="range"
              min={0}
              max={last}
              step={1}
              value={position}
              aria-label={text.historyPosition}
              aria-valuetext={text.stepOf(position, last, currentLabel)}
              onChange={(event) => travelTo(Number(event.currentTarget.value))}
            />
          </div>
          <span className="ts-readout" aria-hidden="true">
            {padStep(position)}/{padStep(last)}
          </span>
          <button
            type="button"
            className="ts-button ts-button-accent"
            onClick={handleEdit}
            aria-label={text.newEdit}
            title={text.newEdit}
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="ts-button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? text.pause : text.play}
            aria-pressed={playing}
            title={playing ? text.pause : text.play}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
        <div className="ts-status">
          <span className="ts-current">
            <span className="ts-current-label">{currentLabel}</span>
            <code className="ts-op">
              {firstOp ? describePatch(firstOp) : text.noPatch}
              {extraOps > 0 && <span className="ts-op-more"> +{extraOps}</span>}
            </code>
          </span>
          <span className="ts-keys" aria-hidden="true">
            <kbd>{modifierKey === '⌘' ? '⌘Z' : 'Ctrl Z'}</kbd>
            <kbd>{modifierKey === '⌘' ? '⇧⌘Z' : 'Ctrl Y'}</kbd>
          </span>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
