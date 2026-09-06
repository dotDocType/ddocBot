const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const add = (pixels, x, y) => {
  const point = [Math.round(x), Math.round(y)];
  if (point[0] >= 0 && point[0] < 24 && point[1] >= 0 && point[1] < 24) {
    pixels.set(`${point[0]},${point[1]}`, point);
  }
};

const line = (pixels, x1, y1, x2, y2) => {
  const steps = Math.max(Math.abs(Math.round(x2) - x1), Math.abs(Math.round(y2) - y1));
  for (let i = 0; i <= steps; i++) {
    const ratio = steps === 0 ? 0 : i / steps;
    add(pixels, x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio);
  }
};

const unfold = (origin, target, extension) => origin + (target - origin) * extension;

const normalizedAim = ({ x = 1, y = 0 } = {}) => {
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : { x: 1, y: 0 };
};

export function getLaserOrigin({ aim = { x: 1, y: 0 } } = {}) {
  const direction = normalizedAim(aim);
  const scale = 10 / Math.max(Math.abs(direction.x), Math.abs(direction.y));
  return [Math.round(12 + direction.x * scale), Math.round(12 + direction.y * scale)];
}

export function getPixels({ extension = 0, motion = 'rest', phase = 0, state = 'idle', aim = { x: 1, y: 0 } } = {}) {
  const amount = clamp(extension, 0, 1);
  const p = clamp(phase, 0, 1);
  const pixels = new Map();

  if (amount === 0) {
    for (let y = 7; y <= 16; y++) for (let x = 7; x <= 16; x++) add(pixels, x, y);
    return [...pixels.values()];
  }

  const successBounce = state === 'success' && p < .5 ? 2 : 0;
  const jump = motion === 'jump' ? Math.round(Math.sin(p * Math.PI) * 4) : 0;
  const hover = motion === 'hover' ? Math.round(Math.sin(p * Math.PI)) : 0;
  const headTop = 7 - successBounce - jump - hover;
  for (let y = headTop; y < headTop + 10; y++) {
    for (let x = 7; x <= 16; x++) {
      if (amount > .2 && y === headTop + 3 && (x === 10 || x === 14)) continue;
      add(pixels, x, y);
    }
  }

  const leftShoulder = [7, headTop + 7];
  const rightShoulder = [16, headTop + 7];
  let leftHand = [4, headTop + 10];
  let rightHand = [19, headTop + 10];
  let leftFoot = [9, headTop + 13];
  let rightFoot = [14, headTop + 13];

  if (motion === 'wave') {
    leftHand = [3, headTop + (p < .5 ? 1 : 3)];
  } else if (motion === 'tap') {
    rightHand = [20, headTop + (p < .5 ? 8 : 10)];
    leftFoot = [p < .5 ? 7 : 10, headTop + 13];
  } else if (motion === 'walk') {
    leftFoot = [p < .5 ? 7 : 10, headTop + 13];
    rightFoot = [p < .5 ? 13 : 16, headTop + 13];
  } else if (motion === 'fly') {
    leftHand = [3, headTop + 5];
    rightHand = [20, headTop + 5];
    leftFoot = [7, headTop + 11];
    rightFoot = [16, headTop + 11];
  } else if (motion === 'point') {
    const hand = getLaserOrigin({ aim });
    if (normalizedAim(aim).x < 0) leftHand = hand;
    else rightHand = hand;
  }

  if (state === 'success') {
    leftHand = [p < .5 ? 3 : 5, headTop + 1];
    rightHand = [p < .5 ? 20 : 18, headTop + 1];
  } else if (state === 'error') {
    const swap = p < .5;
    leftHand = [3, headTop + (swap ? 4 : 10)];
    rightHand = [20, headTop + (swap ? 10 : 4)];
  }

  if (motion === 'fly' && state !== 'success' && state !== 'error') {
    const drawBentLimb = (root, joint, end) => {
      const unfoldedJoint = [unfold(root[0], joint[0], amount), unfold(root[1], joint[1], amount)];
      const unfoldedEnd = [unfold(root[0], end[0], amount), unfold(root[1], end[1], amount)];
      line(pixels, ...root, ...unfoldedJoint);
      line(pixels, ...unfoldedJoint, ...unfoldedEnd);
    };
    drawBentLimb(leftShoulder, [5, headTop + 6], leftHand);
    drawBentLimb(rightShoulder, [18, headTop + 6], rightHand);
    drawBentLimb([10, headTop + 9], [8, headTop + 11], [6, headTop + 10]);
    drawBentLimb([13, headTop + 9], [15, headTop + 11], [17, headTop + 10]);
    return [...pixels.values()];
  }

  line(pixels, ...leftShoulder,
    unfold(leftShoulder[0], leftHand[0], amount),
    unfold(leftShoulder[1], leftHand[1], amount));
  line(pixels, ...rightShoulder,
    unfold(rightShoulder[0], rightHand[0], amount),
    unfold(rightShoulder[1], rightHand[1], amount));

  const leftHip = [10, headTop + 9];
  const rightHip = [13, headTop + 9];
  line(pixels, ...leftHip,
    unfold(leftHip[0], leftFoot[0], amount),
    unfold(leftHip[1], leftFoot[1], amount));
  line(pixels, ...rightHip,
    unfold(rightHip[0], rightFoot[0], amount),
    unfold(rightHip[1], rightFoot[1], amount));

  return [...pixels.values()];
}

export function drawBot(ctx, snapshot, color) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = color;
  for (const [x, y] of getPixels(snapshot)) ctx.fillRect(x, y, 1, 1);
}
