'use client';

import {
  Box,
  Braces,
  Brush,
  Database,
  Eraser,
  ListOrdered,
  Redo2,
  Rotate3d,
  TimerReset,
  Undo2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createTravels, restoreTravels, Travels } from 'travels';
import type { Locale } from '@/lib/locale';
import { isEditableTarget, padStep, shortJson, toPointer, type DemoPatch } from './demo-utils';

type Color = 'blue' | 'orange' | 'violet' | 'mint' | 'amber' | 'slate';
type World = { columns: Record<string, Color[]> };
type Tool = 'build' | 'paint' | 'erase';
type Cell = { x: number; y: number };
type Stroke = { tool: Tool; color: Color; visited: Set<string>; changed: number };
type Panel = 'patches' | 'timeline';

const SIZE = 8;
const MAX_LEVEL = 5;
const HALF_W = 30;
const HALF_H = 15;
const LEVEL = 28;
const SLAB = 14;
const PAD = 18;
const ORIGIN_X = SIZE * HALF_W + PAD;
const ORIGIN_Y = MAX_LEVEL * LEVEL + HALF_H + PAD;
const VIEW_W = 2 * ORIGIN_X;
const VIEW_H = ORIGIN_Y + (2 * SIZE - 1) * HALF_H + SLAB + PAD;
const MAX_HISTORY = 100;
const COLUMN_LETTERS = 'ABCDEFGH';
const STORAGE_KEY = 'travels:playground:history';
const PREFERENCE_KEY = 'travels:playground:persist';
const COLUMN_KEY = new RegExp(`^x[0-${SIZE - 1}]y[0-${SIZE - 1}]$`);
/** Metadata for a stroke that is still pending; `archive()` relabels it. */
const PENDING = { label: 'Drawing…' };

const PALETTE: { id: Color; name: string; shades: [top: string, left: string, right: string] }[] = [
  { id: 'blue', name: 'Blue', shades: ['#7eaaff', '#3b7bf6', '#2a5fcf'] },
  { id: 'orange', name: 'Orange', shades: ['#ffb391', '#f0784c', '#cd5a31'] },
  { id: 'violet', name: 'Violet', shades: ['#bba9ff', '#8b6cf0', '#6b4fd2'] },
  { id: 'mint', name: 'Mint', shades: ['#86e6c4', '#2fbf8f', '#20946d'] },
  { id: 'amber', name: 'Amber', shades: ['#ffd98a', '#f2b63d', '#cf931c'] },
  { id: 'slate', name: 'Slate', shades: ['#a9b8cc', '#687c97', '#4c5d76'] },
];
const SHADES = Object.fromEntries(PALETTE.map((entry) => [entry.id, entry.shades])) as Record<
  Color,
  [string, string, string]
>;

const TOOLS: { id: Tool; name: string; key: string; icon: typeof Box }[] = [
  { id: 'build', name: 'Build', key: 'b', icon: Box },
  { id: 'paint', name: 'Paint', key: 'p', icon: Brush },
  { id: 'erase', name: 'Erase', key: 'e', icon: Eraser },
];

/** A small diorama: a lit tower, a rising staircase, a house, and trees. */
const INITIAL_WORLD: World = {
  columns: {
    x0y0: ['slate', 'slate', 'slate', 'amber'],
    x1y0: ['slate', 'slate', 'slate'],
    x0y1: ['slate', 'slate'],
    x2y0: ['slate', 'slate'],
    x0y2: ['slate'],
    x1y6: ['blue'],
    x2y6: ['blue', 'blue'],
    x3y6: ['blue', 'blue', 'blue'],
    x4y6: ['blue', 'blue', 'blue', 'orange'],
    x5y2: ['orange', 'violet'],
    x6y2: ['orange', 'violet', 'slate'],
    x5y3: ['orange', 'violet'],
    x6y3: ['orange', 'violet'],
    x2y3: ['mint', 'mint'],
    x3y2: ['mint'],
    x7y4: ['mint', 'mint'],
    x6y5: ['mint'],
  },
};
const HOME_CELL: Cell = { x: 3, y: 4 };

const toolNames = {
  en: { build: 'Build', paint: 'Paint', erase: 'Erase' },
  zh: { build: '建造', paint: '涂色', erase: '擦除' },
} as const;

const colorNames = {
  en: { blue: 'Blue', orange: 'Orange', violet: 'Violet', mint: 'Mint', amber: 'Amber', slate: 'Slate' },
  zh: { blue: '蓝色', orange: '橙色', violet: '紫色', mint: '薄荷绿', amber: '琥珀色', slate: '石板灰' },
} as const;

function localizeHistoryLabel(label: string, locale: Locale) {
  if (locale !== 'zh') return label;
  if (label === 'Starting scene') return '起始场景';
  if (label.startsWith('Edit ')) return `编辑 ${label.slice(5)}`;
  if (label === 'Drawing…') return '绘制中…';
  const match = label.match(/^(Place|Paint|Erase) (\d+) (block|blocks)$/);
  if (!match) return label;
  const verbs: Record<string, string> = { Place: '放置', Paint: '涂色', Erase: '擦除' };
  return `${verbs[match[1]]} ${match[2]} 个方块`;
}

const pgCopy = {
  en: {
    playground: 'Travels playground',
    tool: 'Tool',
    color: 'Block color',
    sceneRole: 'block builder',
    sceneAria: (blocks: number, tool: string) =>
      `Block builder, ${blocks} blocks. Current tool: ${tool}.`,
    help: 'Click or drag across the board. One drag is archived as one undo step.',
    helpKeys:
      'Keyboard: arrows move, Enter applies, Delete erases, B/P/E switch tools, 1–6 pick a color, R rotates.',
    undo: 'Undo',
    redo: 'Redo',
    historyPosition: 'Playground history position',
    rotate: 'Rotate view',
    rotateTitle: 'Rotate view (R) — view state, not history',
    reset: 'Reset playground',
    resetTitle: 'Reset to the starting scene',
    inspector: 'Inspector',
    patches: 'Patches',
    timeline: 'Timeline',
    baseline: 'baseline',
    ops: (count: number) => `${count} ${count === 1 ? 'op' : 'ops'}`,
    forwardDirection: (index: number) =>
      `patches[${index}] forward · redo replays these`,
    inverseDirection: (index: number) =>
      `inversePatches[${index}] inverse · undo applies these`,
    emptyForward: 'The starting scene has no incoming patch. Place a block to record one.',
    emptyInverse: 'Nothing to undo from here.',
    historySize: 'History size, measured live',
    ratioSmaller: (ratio: string) => `${ratio}× smaller`,
    ratioEven: 'about even so far',
    ratioSnapshots: 'snapshots lead for now',
    travelsBar: 'Travels · state + patches',
    snapshotsBar: 'Snapshot stack · every state',
    stepThis: (patch: string, snapshot: string) => (
      <>
        This step: <b>+{patch}</b> as patches · <b>+{snapshot}</b> as a snapshot
      </>
    ),
    eachStep: 'Each step adds the whole scene to a snapshot stack, but only the change to Travels.',
    meterNote: 'Snapshots can win while a scene is tiny; small edits to larger state widen the gap.',
    keepHistory: 'Keep history after reload',
    keptMemory: 'Kept in memory only',
    pendingSave: 'Waiting to save',
    saveFailed: 'Browser storage could not be updated. Keep this tab open to retain your changes.',
    saved: (bytes: string) => `${bytes} saved in this browser`,
    restored: (steps: number) => `Restored ${steps} ${steps === 1 ? 'step' : 'steps'} from your last visit`,
    invalidSaved: 'Saved history failed validation and was cleared',
    archiveAnnounce: (label: string) => `Archived ${label}`,
    undoAnnounce: (label: string) => `Undid ${label}`,
    redoAnnounce: (label: string) => `Redid ${label}`,
    travelAnnounce: (label: string) => `Traveled to ${label}`,
    resetAnnounce: 'Reset to the starting scene',
    cellAnnounce: (name: string, height: number) =>
      `${name}, ${height} ${height === 1 ? 'block' : 'blocks'}`,
    stepOf: (position: number, total: number, label: string) =>
      `Step ${position} of ${total}: ${label}`,
    announcement: (message: string, position: number, total: number) =>
      `${message}. Step ${position} of ${total}.`,
  },
  zh: {
    playground: 'Travels Playground',
    tool: '工具',
    color: '方块颜色',
    sceneRole: '方块搭建器',
    sceneAria: (blocks: number, tool: string) =>
      `方块搭建器，当前有 ${blocks} 个方块。当前工具：${tool}。`,
    help: '在棋盘上点击或拖动。一次完整的拖拽会被归档为一个撤销步骤。',
    helpKeys:
      '键盘：方向键移动，Enter 应用，Delete 擦除，B/P/E 切换工具，1–6 选择颜色，R 旋转。',
    undo: '撤销',
    redo: '重做',
    historyPosition: 'Playground 历史位置',
    rotate: '旋转视角',
    rotateTitle: '旋转视角（R）——只改变视图，不写入历史',
    reset: '重置 Playground',
    resetTitle: '重置到起始场景',
    inspector: '检查器',
    patches: '补丁',
    timeline: '时间线',
    baseline: '基线',
    ops: (count: number) => `${count} 个操作`,
    forwardDirection: (index: number) =>
      `patches[${index}] 正向 · 重做会重放这些操作`,
    inverseDirection: (index: number) =>
      `inversePatches[${index}] 反向 · 撤销会应用这些操作`,
    emptyForward: '起始场景没有入站补丁。放置一个方块即可记录一条。',
    emptyInverse: '从这里没有可撤销的内容。',
    historySize: '实时测量的历史体积',
    ratioSmaller: (ratio: string) => `小 ${ratio} 倍`,
    ratioEven: '目前大致持平',
    ratioSnapshots: '当前快照更小',
    travelsBar: 'Travels · 状态 + 补丁',
    snapshotsBar: '快照栈 · 每个状态',
    stepThis: (patch: string, snapshot: string) => (
      <>
        本步：补丁 <b>+{patch}</b> · 快照 <b>+{snapshot}</b>
      </>
    ),
    eachStep: '每一步都会把整个场景加入快照栈，但 Travels 只记录变化。',
    meterNote: '场景很小时，快照可能更小；状态越大、编辑越局部，差距就越明显。',
    keepHistory: '刷新后保留历史',
    keptMemory: '仅保存在内存中',
    pendingSave: '等待保存',
    saveFailed: '浏览器存储更新失败。请保持此页打开，以保留当前修改。',
    saved: (bytes: string) => `已在此浏览器中保存 ${bytes}`,
    restored: (steps: number) => `已从上次访问恢复 ${steps} 步`,
    invalidSaved: '保存的历史未通过校验，已清理',
    archiveAnnounce: (label: string) => `已归档「${label}」`,
    undoAnnounce: (label: string) => `已撤销「${label}」`,
    redoAnnounce: (label: string) => `已重做「${label}」`,
    travelAnnounce: (label: string) => `已回溯到「${label}」`,
    resetAnnounce: '已重置到起始场景',
    cellAnnounce: (name: string, height: number) =>
      `${name}，${height} 个方块`,
    stepOf: (position: number, total: number, label: string) =>
      `第 ${position} 步，共 ${total} 步：${label}`,
    announcement: (message: string, position: number, total: number) =>
      `${message}。第 ${position} 步，共 ${total} 步。`,
  },
} as const;

const columnKey = (x: number, y: number) => `x${x}y${y}`;
const cellName = ({ x, y }: Cell) => `${COLUMN_LETTERS[x]}${y + 1}`;

/** World column → view coordinates for a quarter-turn rotation. */
function toView(x: number, y: number, turn: number): [number, number] {
  switch (turn) {
    case 1:
      return [SIZE - 1 - y, x];
    case 2:
      return [SIZE - 1 - x, SIZE - 1 - y];
    case 3:
      return [y, SIZE - 1 - x];
    default:
      return [x, y];
  }
}

function fromView(gx: number, gy: number, turn: number): Cell {
  switch (turn) {
    case 1:
      return { x: gy, y: SIZE - 1 - gx };
    case 2:
      return { x: SIZE - 1 - gx, y: SIZE - 1 - gy };
    case 3:
      return { x: SIZE - 1 - gy, y: gx };
    default:
      return { x: gx, y: gy };
  }
}

function project(gx: number, gy: number): [number, number] {
  return [ORIGIN_X + (gx - gy) * HALF_W, ORIGIN_Y + (gx + gy) * HALF_H];
}

function points(...pairs: [number, number][]) {
  return pairs.map(([px, py]) => `${px},${py}`).join(' ');
}

function cubeFaces(gx: number, gy: number, level: number) {
  const [cx, cy] = project(gx, gy);
  const top = cy - (level + 1) * LEVEL;
  const base = cy - level * LEVEL;
  return {
    top: points([cx, top - HALF_H], [cx + HALF_W, top], [cx, top + HALF_H], [cx - HALF_W, top]),
    left: points([cx - HALF_W, top], [cx, top + HALF_H], [cx, base + HALF_H], [cx - HALF_W, base]),
    right: points([cx, top + HALF_H], [cx + HALF_W, top], [cx + HALF_W, base], [cx, base + HALF_H]),
  };
}

function tilePoints(gx: number, gy: number) {
  const [cx, cy] = project(gx, gy);
  return points([cx, cy - HALF_H], [cx + HALF_W, cy], [cx, cy + HALF_H], [cx - HALF_W, cy]);
}

const BOARD = (() => {
  const top: [number, number] = [ORIGIN_X, ORIGIN_Y - HALF_H];
  const right: [number, number] = [ORIGIN_X + SIZE * HALF_W, ORIGIN_Y + (SIZE - 1) * HALF_H];
  const bottom: [number, number] = [ORIGIN_X, ORIGIN_Y + (2 * SIZE - 1) * HALF_H];
  const left: [number, number] = [ORIGIN_X - SIZE * HALF_W, ORIGIN_Y + (SIZE - 1) * HALF_H];
  const drop = ([px, py]: [number, number]): [number, number] => [px, py + SLAB];
  return {
    surface: points(top, right, bottom, left),
    left: points(left, bottom, drop(bottom), drop(left)),
    right: points(bottom, right, drop(right), drop(bottom)),
  };
})();

function createWorldTimeline() {
  return createTravels<World>(structuredClone(INITIAL_WORLD), {
    autoArchive: false,
    maxHistory: MAX_HISTORY,
    onWarning: () => undefined,
  });
}

/** Whether a restored state is a block scene this page can draw. */
function isWorld(value: unknown): value is World {
  if (typeof value !== 'object' || value === null) return false;
  const columns = (value as { columns?: unknown }).columns;
  if (typeof columns !== 'object' || columns === null || Array.isArray(columns)) return false;
  return Object.entries(columns).every(
    ([key, stack]) =>
      COLUMN_KEY.test(key) &&
      Array.isArray(stack) &&
      stack.length > 0 &&
      stack.length <= MAX_LEVEL &&
      stack.every((color) => typeof color === 'string' && Object.hasOwn(SHADES, color))
  );
}

/**
 * Restore a saved timeline. Semantic validation replays every entry in both
 * directions, and every restored state must still be a drawable scene.
 */
function restoreWorldTimeline(raw: string) {
  const snapshot = Travels.deserialize<World>(raw, { validation: 'semantic' });
  const restored = restoreTravels(snapshot, {
    autoArchive: false,
    maxHistory: MAX_HISTORY,
    onWarning: () => undefined,
  });
  if (!restored.getHistory().every(isWorld)) {
    throw new Error('The saved playground history is not a block scene.');
  }
  return restored;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function byteLength(value: unknown) {
  return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
}

function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function strokeLabel(stroke: Stroke) {
  const verb = stroke.tool === 'build' ? 'Place' : stroke.tool === 'paint' ? 'Paint' : 'Erase';
  return `${verb} ${stroke.changed} ${stroke.changed === 1 ? 'block' : 'blocks'}`;
}

function cellFromPoint(clientX: number, clientY: number): Cell | null {
  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest<SVGElement>('[data-x]');
  if (!target) return null;
  return { x: Number(target.dataset.x), y: Number(target.dataset.y) };
}

function OperationList({ operations, empty }: { operations: readonly DemoPatch[]; empty: string }) {
  if (operations.length === 0) return <p className="pg-empty">{empty}</p>;
  return (
    <ol className="pg-ops">
      {operations.map((operation, index) => (
        <li key={index}>
          <span className={`pg-op pg-op-${operation.op}`}>{operation.op}</span>
          <code className="pg-path">{toPointer(operation.path)}</code>
          {operation.op !== 'remove' && (
            <code className="pg-value">{shortJson(operation.value, 26)}</code>
          )}
        </li>
      ))}
    </ol>
  );
}

export function PatchPlayground({ locale = 'en' }: { locale?: Locale }) {
  const text = pgCopy[locale];
  const [travels, setTravels] = useState(createWorldTimeline);
  const [persist, setPersist] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [lastWrite, setLastWrite] = useState<{ snapshot: string | null; ok: boolean } | null>(null);
  const [notice, setNotice] = useState<{ text: string; revision: number } | null>(null);
  const subscribe = useCallback(
    (notify: () => void) => travels.subscribe(() => notify()),
    [travels]
  );
  const revision = useSyncExternalStore(subscribe, travels.getRevision, travels.getRevision);

  const [tool, setTool] = useState<Tool>('build');
  const [color, setColor] = useState<Color>('orange');
  const [turn, setTurn] = useState(0);
  const [target, setTarget] = useState<Cell | null>(null);
  const [panel, setPanel] = useState<Panel>('patches');
  const [announcement, setAnnouncement] = useState('');
  const [modifierKey, setModifierKey] = useState('⌘');

  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLOListElement>(null);
  const stroke = useRef<Stroke | null>(null);
  const inView = useRef(false);
  const helpId = useId();
  const tabsId = useId();

  const view = useMemo(() => {
    const world = travels.getState();
    const history = travels.getHistory();
    const position = travels.getPosition();
    const metadata = travels.getMetadata();
    const patches = travels.getPatches();
    const serialized = JSON.stringify(travels.serialize());
    const persistedBytes = byteLength(serialized);
    const snapshotBytes = byteLength(history);
    return {
      world,
      history,
      position,
      metadata,
      patches,
      serialized,
      persistedBytes,
      snapshotBytes,
      revision,
    };
  }, [travels, revision]);

  const { world, history, position, metadata, patches, serialized, persistedBytes, snapshotBytes } =
    view;
  const last = history.length - 1;
  const labelFor = useCallback(
    (index: number) => {
      const label = index === 0 ? 'Starting scene' : metadata[index - 1]?.label ?? `Edit ${index}`;
      return localizeHistoryLabel(label, locale);
    },
    [locale, metadata]
  );

  const announce = useCallback(
    (message: string) => {
      setAnnouncement(
        text.announcement(message, travels.getPosition(), travels.getHistory().length - 1)
      );
    },
    [text, travels]
  );

  /** Apply one tool to one column as a pending, not yet archived, change. */
  const applyTool = useCallback(
    (nextTool: Tool, nextColor: Color, { x, y }: Cell) => {
      const key = columnKey(x, y);
      const stack = travels.getState().columns[key] ?? [];
      if (nextTool === 'build') {
        if (stack.length >= MAX_LEVEL) return false;
        travels.setState((draft) => {
          const column = draft.columns[key];
          if (column) column.push(nextColor);
          else draft.columns[key] = [nextColor];
        }, PENDING);
        return true;
      }
      if (stack.length === 0) return false;
      const top = stack.length - 1;
      if (nextTool === 'paint') {
        if (stack[top] === nextColor) return false;
        travels.setState((draft) => {
          draft.columns[key][top] = nextColor;
        }, PENDING);
        return true;
      }
      travels.setState((draft) => {
        if (top === 0) delete draft.columns[key];
        else draft.columns[key].pop();
      }, PENDING);
      return true;
    },
    [travels]
  );

  const extendStroke = useCallback(
    (cell: Cell) => {
      const current = stroke.current;
      if (!current) return;
      const key = columnKey(cell.x, cell.y);
      if (current.visited.has(key)) return;
      current.visited.add(key);
      if (applyTool(current.tool, current.color, cell)) current.changed += 1;
    },
    [applyTool]
  );

  /** Archive everything the stroke changed as a single undoable step. */
  const endStroke = useCallback(() => {
    const current = stroke.current;
    stroke.current = null;
    if (!current || current.changed === 0 || !travels.canArchive()) return;
    const label = strokeLabel(current);
    travels.archive({ label });
    announce(text.archiveAnnounce(localizeHistoryLabel(label, locale)));
  }, [announce, locale, text, travels]);

  const runStroke = useCallback(
    (cell: Cell, strokeTool = tool) => {
      stroke.current = { tool: strokeTool, color, visited: new Set(), changed: 0 };
      extendStroke(cell);
      endStroke();
    },
    [color, endStroke, extendStroke, tool]
  );

  const undo = useCallback(() => {
    if (stroke.current || !travels.canBack()) return;
    const label = labelFor(travels.getPosition());
    travels.back();
    announce(text.undoAnnounce(label));
  }, [announce, labelFor, text, travels]);

  const redo = useCallback(() => {
    if (stroke.current || !travels.canForward()) return;
    travels.forward();
    announce(text.redoAnnounce(labelFor(travels.getPosition())));
  }, [announce, labelFor, text, travels]);

  const travelTo = useCallback(
    (index: number) => {
      if (stroke.current || index === travels.getPosition()) return;
      travels.go(index);
      announce(text.travelAnnounce(labelFor(index)));
    },
    [announce, labelFor, text, travels]
  );

  const reset = useCallback(() => {
    if (stroke.current) return;
    setTravels(createWorldTimeline());
    setNotice(null);
    setAnnouncement(text.announcement(text.resetAnnounce, 0, 0));
  }, [text]);

  useEffect(() => {
    if (!/mac|iphone|ipad/i.test(navigator.platform)) setModifierKey('Ctrl');
  }, []);

  // Bring back the visitor's previous session before anything is saved.
  useEffect(() => {
    if (readStorage(PREFERENCE_KEY) === 'off') {
      setPersist(false);
    } else {
      const raw = readStorage(STORAGE_KEY);
      if (raw) {
        try {
          const timeline = restoreWorldTimeline(raw);
          const steps = timeline.getHistory().length - 1;
          setTravels(timeline);
          setNotice({
            text: text.restored(steps),
            revision: timeline.getRevision(),
          });
        } catch {
          writeStorage(STORAGE_KEY, null);
          setNotice({
            text: text.invalidSaved,
            revision: travels.getRevision(),
          });
        }
      }
    }
    setStorageReady(true);
  }, [text]);

  // Save each committed timeline; a pending stroke is saved once archived.
  useEffect(() => {
    if (!storageReady || stroke.current) return;
    const snapshot = persist ? serialized : null;
    const historyWritten = writeStorage(STORAGE_KEY, snapshot);
    const preferenceWritten = writeStorage(PREFERENCE_KEY, persist ? null : 'off');
    setLastWrite({ snapshot, ok: historyWritten && preferenceWritten });
  }, [persist, serialized, storageReady]);

  function storageMessage() {
    if (lastWrite?.snapshot !== (persist ? serialized : null)) return text.pendingSave;
    if (!lastWrite.ok) return text.saveFailed;
    if (!persist) return text.keptMemory;
    return notice?.revision === revision ? notice.text : text.saved(formatBytes(persistedBytes));
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting && entry.intersectionRatio > 0.35;
      },
      { threshold: [0, 0.35, 0.7] }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Undo shortcuts belong to the playground while it is on screen. The
  // capture phase lets it claim them before the hero demo sees them.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!inView.current || event.defaultPrevented || event.altKey) return;
      if (!(event.metaKey || event.ctrlKey) || isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [redo, undo]);

  useEffect(() => {
    window.addEventListener('pointerup', endStroke);
    window.addEventListener('pointercancel', endStroke);
    return () => {
      window.removeEventListener('pointerup', endStroke);
      window.removeEventListener('pointercancel', endStroke);
    };
  }, [endStroke]);

  // Keep the current timeline entry visible without scrolling the page.
  useEffect(() => {
    const list = timelineRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !current) return;
    const { offsetTop, offsetHeight } = current;
    if (offsetTop < list.scrollTop) list.scrollTop = offsetTop - 6;
    else if (offsetTop + offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = offsetTop + offsetHeight - list.clientHeight + 6;
    }
  }, [panel, position, last]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    event.preventDefault();
    stroke.current = { tool, color, visited: new Set(), changed: 0 };
    extendStroke(cell);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (stroke.current) {
      if (cell) extendStroke(cell);
      return;
    }
    setTarget((previous) =>
      previous?.x === cell?.x && previous?.y === cell?.y ? previous : cell
    );
  };

  const onSceneKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const cursor = target ?? HOME_CELL;
    const moves: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    const key = event.key;
    if (key in moves) {
      event.preventDefault();
      const [gx, gy] = toView(cursor.x, cursor.y, turn);
      const [dx, dy] = moves[key];
      const next = fromView(
        Math.max(0, Math.min(SIZE - 1, gx + dx)),
        Math.max(0, Math.min(SIZE - 1, gy + dy)),
        turn
      );
      setTarget(next);
      const height = travels.getState().columns[columnKey(next.x, next.y)]?.length ?? 0;
      setAnnouncement(text.cellAnnounce(cellName(next), height));
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      setTarget(cursor);
      runStroke(cursor);
    } else if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      setTarget(cursor);
      runStroke(cursor, 'erase');
    } else if (key.toLowerCase() === 'r') {
      event.preventDefault();
      setTurn((value) => (value + 1) % 4);
    } else {
      const shortcut = TOOLS.find((entry) => entry.key === key.toLowerCase());
      const swatch = PALETTE[Number(key) - 1];
      if (shortcut) setTool(shortcut.id);
      else if (swatch && /^[1-6]$/.test(key)) setColor(swatch.id);
    }
  };

  const cells = useMemo(() => {
    const list: { x: number; y: number; gx: number; gy: number; stack: Color[] }[] = [];
    for (let x = 0; x < SIZE; x += 1) {
      for (let y = 0; y < SIZE; y += 1) {
        const [gx, gy] = toView(x, y, turn);
        list.push({ x, y, gx, gy, stack: world.columns[columnKey(x, y)] ?? [] });
      }
    }
    return list.sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx);
  }, [turn, world]);

  const forward = position > 0 ? patches.patches[position - 1] ?? [] : [];
  const inverse = position > 0 ? patches.inversePatches[position - 1] ?? [] : [];
  const stepPatchBytes = position > 0 ? byteLength([forward, inverse]) : 0;
  const stepSnapshotBytes = byteLength(world);
  const largest = Math.max(persistedBytes, snapshotBytes, 1);
  const ratio = snapshotBytes / Math.max(persistedBytes, 1);
  const blockCount = Object.values(world.columns).reduce((total, stack) => total + stack.length, 0);
  const showDots = history.length <= 32;

  return (
    <div ref={rootRef} className="pg-workbench" role="group" aria-label={text.playground}>
      <div className="pg-stage">
        <div className="pg-toolbar">
          <div className="pg-segmented" role="radiogroup" aria-label={text.tool}>
            {TOOLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={tool === entry.id}
                className="pg-tool"
                onClick={() => setTool(entry.id)}
                title={`${toolNames[locale][entry.id]} (${entry.key.toUpperCase()})`}
              >
                <entry.icon size={15} /> {toolNames[locale][entry.id]}
              </button>
            ))}
          </div>
          <div className="pg-swatches" role="radiogroup" aria-label={text.color}>
            {PALETTE.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={color === entry.id}
                aria-label={colorNames[locale][entry.id]}
                title={`${colorNames[locale][entry.id]} (${index + 1})`}
                className="pg-swatch"
                style={{ '--swatch': entry.shades[1], '--swatch-top': entry.shades[0] } as CSSProperties}
                onClick={() => setColor(entry.id)}
              />
            ))}
          </div>
        </div>

        <div
          className="pg-scene"
          tabIndex={0}
          role="application"
          aria-roledescription={text.sceneRole}
          aria-label={text.sceneAria(blockCount, toolNames[locale][tool])}
          aria-describedby={helpId}
          onKeyDown={onSceneKeyDown}
          onFocus={() => setTarget((value) => value ?? HOME_CELL)}
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className={`pg-svg is-${tool}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={() => {
              if (!stroke.current) setTarget(null);
            }}
            aria-hidden="true"
          >
            <polygon className="pg-board-left" points={BOARD.left} />
            <polygon className="pg-board-right" points={BOARD.right} />
            <polygon className="pg-board" points={BOARD.surface} />
            {cells.map((cell) => (
              <polygon
                key={`tile-${cell.x}-${cell.y}`}
                className={`pg-tile${target?.x === cell.x && target?.y === cell.y ? ' is-target' : ''}`}
                points={tilePoints(cell.gx, cell.gy)}
                data-x={cell.x}
                data-y={cell.y}
              />
            ))}
            {cells.map((cell) => {
              const isTarget = target?.x === cell.x && target?.y === cell.y;
              const height = cell.stack.length;
              return (
                <g key={`column-${cell.x}-${cell.y}`} data-x={cell.x} data-y={cell.y}>
                  {cell.stack.map((blockColor, level) => {
                    const faces = cubeFaces(cell.gx, cell.gy, level);
                    const [top, left, right] = SHADES[blockColor];
                    const isTop = level === height - 1;
                    const previewPaint = isTarget && isTop && tool === 'paint';
                    const shades = previewPaint ? SHADES[color] : [top, left, right];
                    return (
                      <g
                        key={`${cell.x}-${cell.y}-${level}`}
                        className={`pg-block${isTarget && isTop && tool !== 'build' ? ` is-${tool}-target` : ''}`}
                      >
                        <polygon points={faces.left} fill={shades[1]} />
                        <polygon points={faces.right} fill={shades[2]} />
                        <polygon points={faces.top} fill={shades[0]} />
                      </g>
                    );
                  })}
                  {isTarget && tool === 'build' && height < MAX_LEVEL && (
                    <g className="pg-ghost">
                      {(() => {
                        const faces = cubeFaces(cell.gx, cell.gy, height);
                        return (
                          <>
                            <polygon points={faces.left} fill={SHADES[color][1]} />
                            <polygon points={faces.right} fill={SHADES[color][2]} />
                            <polygon points={faces.top} fill={SHADES[color][0]} />
                          </>
                        );
                      })()}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {target && (
            <span className="pg-cursor-label" aria-hidden="true">
              {cellName(target)} · {world.columns[columnKey(target.x, target.y)]?.length ?? 0}/{MAX_LEVEL}
            </span>
          )}
        </div>

        <p id={helpId} className="pg-help">
          {text.help}
          <span className="pg-help-keys"> {text.helpKeys}</span>
        </p>

        <div className="pg-controls">
          <button
            type="button"
            className="pg-button"
            onClick={undo}
            disabled={position === 0}
            aria-label={text.undo}
            title={`${text.undo} (${modifierKey}+Z)`}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="pg-button"
            onClick={redo}
            disabled={position === last}
            aria-label={text.redo}
            title={modifierKey === '⌘' ? `${text.redo} (⇧⌘Z)` : `${text.redo} (Ctrl+Y)`}
          >
            <Redo2 size={16} />
          </button>
          <div className="pg-scrubber" style={{ '--progress': last > 0 ? position / last : 1 } as CSSProperties}>
            <span className="pg-track" aria-hidden="true">
              <span className="pg-track-fill" />
              {showDots &&
                history.map((_, index) => (
                  <span
                    key={index}
                    className={`pg-dot${index === position ? ' is-current' : index > position ? ' is-future' : ''}`}
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
              aria-valuetext={text.stepOf(position, last, labelFor(position))}
              onChange={(event) => travelTo(Number(event.currentTarget.value))}
            />
          </div>
          <span className="pg-readout" aria-hidden="true">
            {padStep(position)}/{padStep(last)}
          </span>
          <button
            type="button"
            className="pg-button"
            onClick={() => setTurn((value) => (value + 1) % 4)}
            aria-label={text.rotate}
            title={text.rotateTitle}
          >
            <Rotate3d size={16} />
          </button>
          <button
            type="button"
            className="pg-button"
            onClick={reset}
            disabled={last === 0 && position === 0}
            aria-label={text.reset}
            title={text.resetTitle}
          >
            <TimerReset size={16} />
          </button>
        </div>
      </div>

      <div className="pg-inspector">
        <div className="pg-tabs" role="tablist" aria-label={text.inspector}>
          {(
            [
              { id: 'patches', name: text.patches, icon: Braces },
              { id: 'timeline', name: text.timeline, icon: ListOrdered },
            ] as const
          ).map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`${tabsId}-${entry.id}-tab`}
              aria-selected={panel === entry.id}
              aria-controls={`${tabsId}-${entry.id}`}
              tabIndex={panel === entry.id ? 0 : -1}
              className="pg-tab"
              onClick={() => setPanel(entry.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  const next = panel === 'patches' ? 'timeline' : 'patches';
                  setPanel(next);
                  document.getElementById(`${tabsId}-${next}-tab`)?.focus();
                }
              }}
            >
              <entry.icon size={15} /> {entry.name}
              {entry.id === 'timeline' && <span className="pg-count">{last}</span>}
            </button>
          ))}
        </div>

        {panel === 'patches' ? (
          <div
            className="pg-panel"
            role="tabpanel"
            id={`${tabsId}-patches`}
            aria-labelledby={`${tabsId}-patches-tab`}
          >
            <div className="pg-entry">
              <span className="pg-entry-step">{padStep(position)}</span>
              <span className="pg-entry-label">{labelFor(position)}</span>
              <span className="pg-entry-meta">
                {position > 0 ? text.ops(forward.length) : text.baseline}
              </span>
            </div>
            <p className="pg-direction">
              <code>patches[{Math.max(position - 1, 0)}]</code> {locale === 'zh' ? '正向 · 重做会重放这些操作' : 'forward · redo replays these'}
            </p>
            <OperationList
              operations={forward}
              empty={text.emptyForward}
            />
            <p className="pg-direction">
              <code>inversePatches[{Math.max(position - 1, 0)}]</code> {locale === 'zh' ? '反向 · 撤销会应用这些操作' : 'inverse · undo applies these'}
            </p>
            <OperationList operations={inverse} empty={text.emptyInverse} />
          </div>
        ) : (
          <div
            className="pg-panel"
            role="tabpanel"
            id={`${tabsId}-timeline`}
            aria-labelledby={`${tabsId}-timeline-tab`}
          >
            <ol ref={timelineRef} className="pg-timeline">
              {history.map((_, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className={`pg-step${index === position ? ' is-current' : index > position ? ' is-future' : ''}`}
                    aria-current={index === position ? 'step' : undefined}
                    onClick={() => travelTo(index)}
                  >
                    <span className="pg-step-index">{padStep(index)}</span>
                    <span className="pg-step-label">{labelFor(index)}</span>
                    <span className="pg-step-meta">
                      {index === 0
                        ? text.baseline
                        : text.ops(patches.patches[index - 1]?.length ?? 0)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="pg-meter" aria-label={text.historySize}>
          <div className="pg-meter-heading">
            <span>{text.historySize}</span>
            <strong className={ratio < 1.05 ? 'is-behind' : undefined}>
              {ratio >= 1.05
                ? text.ratioSmaller(ratio.toFixed(1))
                : ratio > 0.95
                  ? text.ratioEven
                  : text.ratioSnapshots}
            </strong>
          </div>
          <div className="pg-bar-row">
            <span>{text.travelsBar}</span>
            <b>{formatBytes(persistedBytes)}</b>
          </div>
          <span className="pg-bar">
            <span className="pg-bar-fill is-patches" style={{ '--w': persistedBytes / largest } as CSSProperties} />
          </span>
          <div className="pg-bar-row">
            <span>{text.snapshotsBar}</span>
            <b>{formatBytes(snapshotBytes)}</b>
          </div>
          <span className="pg-bar">
            <span className="pg-bar-fill is-snapshots" style={{ '--w': snapshotBytes / largest } as CSSProperties} />
          </span>
          <p className="pg-meter-step">
            {position > 0 ? (
              text.stepThis(formatBytes(stepPatchBytes), formatBytes(stepSnapshotBytes))
            ) : (
              <>{text.eachStep}</>
            )}
          </p>
          <p className="pg-meter-note">
            <code>JSON.stringify(travels.serialize())</code>{' '}
            {locale === 'zh' ? '与' : 'versus every state in'}{' '}
            <code>getHistory()</code>
            {locale === 'zh' ? ' 中的每个状态对比。' : '.'} {text.meterNote}
          </p>
        </div>

        <div className="pg-persist">
          <button
            type="button"
            role="switch"
            aria-checked={persist}
            className="pg-switch"
            onClick={() => setPersist((value) => !value)}
          >
            <span className="pg-switch-track" aria-hidden="true">
              <span className="pg-switch-thumb" />
            </span>
            {text.keepHistory}
          </button>
          <span className="pg-persist-status">
            <Database size={14} aria-hidden="true" />
            {storageMessage()}
          </span>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
