const ACTOR_SIZE = 24;
const INTERACTIVE_PADDING = 10;
const INTERACTIVE_SIZE = 44;
const EDGE_INSET = 10;
const TARGET_GAP = 8;

const clampAxis = (value, size) => {
  const min = EDGE_INSET;
  const max = size - (INTERACTIVE_SIZE - INTERACTIVE_PADDING);
  if (max < min) return Math.round((size - ACTOR_SIZE) / 2);
  return Math.min(max, Math.max(min, Math.round(value)));
};

export function clampPosition({ x, y }, { width, height }) {
  return { x: clampAxis(x, width), y: clampAxis(y, height) };
}

export function nearTarget(rect, viewport) {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const rooms = [
    { side: 'right', room: viewport.width - right },
    { side: 'bottom', room: viewport.height - bottom },
    { side: 'left', room: rect.x },
    { side: 'top', room: rect.y }
  ];
  const fitting = rooms.filter(({ room }) => room >= INTERACTIVE_SIZE + TARGET_GAP);
  const choices = fitting.length ? fitting : rooms;
  const { side } = choices.reduce((best, candidate) => candidate.room > best.room ? candidate : best);
  const centeredX = rect.x + rect.width / 2 - ACTOR_SIZE / 2;
  const centeredY = rect.y + rect.height / 2 - ACTOR_SIZE / 2;
  const position = {
    right: { x: right + TARGET_GAP + INTERACTIVE_PADDING, y: centeredY },
    bottom: { x: centeredX, y: bottom + TARGET_GAP + INTERACTIVE_PADDING },
    left: { x: rect.x - TARGET_GAP - (INTERACTIVE_SIZE - INTERACTIVE_PADDING), y: centeredY },
    top: { x: centeredX, y: rect.y - TARGET_GAP - (INTERACTIVE_SIZE - INTERACTIVE_PADDING) }
  }[side];
  return clampPosition(position, viewport);
}

export function nearestPoint(rect, origin) {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const dx = origin.x - center.x;
  const dy = origin.y - center.y;
  if (dx === 0 && dy === 0) {
    const edges = [
      { distance: rect.height / 2, point: { x: center.x, y: rect.y } },
      { distance: rect.width / 2, point: { x: rect.x, y: center.y } },
      { distance: rect.width / 2, point: { x: rect.x + rect.width, y: center.y } },
      { distance: rect.height / 2, point: { x: center.x, y: rect.y + rect.height } }
    ];
    return edges.reduce((best, edge) => edge.distance < best.distance ? edge : best).point;
  }
  const tx = dx === 0 ? Infinity : rect.width / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : rect.height / 2 / Math.abs(dy);
  const scale = Math.min(tx, ty);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

export function easeInOut(t) {
  const value = Math.min(1, Math.max(0, t));
  return value * value * (3 - 2 * value);
}
