// 이동 좌표의 +z는 왕좌 쪽이며 Three.js 월드에서는 -z이다.
export const stageCenter = 1.08;
export const entranceZ = stageCenter-1.52;
export const throneSeat = { x: 0, z: 0.79, cushionY: -0.12, yaw: Math.PI };
export function canSitAtThrone(x, z) {
  return Math.abs(x - throneSeat.x) <= 0.49 && z >= 0.21 && z <= 0.72;
}
const hallHalfDepth = 2.60;
export const hall = { halfWidth: 2.65, front: stageCenter+hallHalfDepth, back: hallHalfDepth-stageCenter, floor: -0.43, ceiling: 1.12 };
export const farClip = Math.hypot(2*hall.halfWidth, hall.front+hall.back, hall.ceiling-hall.floor) + 1;
export const decks = [
  {radius:1.01,bottom:hall.floor,top:hall.floor+.021},
  {radius:.93,bottom:hall.floor+.021,top:hall.floor+.043},
  {radius:.85,bottom:hall.floor+.043,top:hall.floor+.064}
];
export const stageTop = decks[decks.length-1].top;
export const stairs = Array.from({length: 6}, (_, i) => ({
  halfWidth: 0.50 - i*0.021, near: 0.63 + i*0.052, far: 1.59 - i*0.041,
  bottom: stageTop + i*0.022, top: stageTop + (i+1)*0.022
}));

export function floorHeight(x, z) {
  for (let i=stairs.length-1; i>=0; i--) {
    const step = stairs[i];
    if (Math.abs(x) <= step.halfWidth && z >= step.near && z <= step.far) return step.top;
  }
  const r = Math.hypot(x,z-stageCenter);
  for (let i=decks.length-1; i>=0; i--) if (r <= decks[i].radius) return decks[i].top;
  return hall.floor;
}

// 좌석과 발끝의 실제 점유 범위에만 몸통 여유 폭을 더한다. 계단과 뒤쪽 바닥은 연결되어 있다.
const radius = 0.14;
const solid = [
  {halfWidth: 0.50 + radius, near: 0.85 - radius, far: 1.13 + radius},
  {halfWidth: 0.20 + radius, near: 0.63 - radius, far: 0.86 + radius}
];
function stopAtEdge(from, to, low, high) {
  if (from <= low && to > low) return low;
  if (from >= high && to < high) return high;
  return to;
}
export function moveOnFloor(x, z, dx, dz) {
  let nextX = Math.max(-hall.halfWidth+radius, Math.min(hall.halfWidth-radius, x+dx));
  let nextZ = Math.max(-hall.back+radius, Math.min(hall.front-radius, z+dz));
  for (const obstacle of solid) {
    if (z > obstacle.near && z < obstacle.far) nextX = stopAtEdge(x,nextX,-obstacle.halfWidth,obstacle.halfWidth);
  }
  for (const obstacle of solid) {
    if (Math.abs(nextX) < obstacle.halfWidth) nextZ = stopAtEdge(z,nextZ,obstacle.near,obstacle.far);
  }
  return {x:nextX, z:nextZ};
}
