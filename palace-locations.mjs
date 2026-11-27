export const ROOM_NAMES={palace:'궁전',bedroom:'마도여왕님의 침실',courtyard:'성 안뜰',exterior:'성 밖 전망대',passage:'침실 연결 통로'};
export const BEDROOM={halfWidth:1.49,front:1.16,back:1.5,floor:-.43,ceiling:.88,spawnZ:-.57};
export const BEDROOM_SURFACES={
  front:'bedroom-wall-textiles',left:'bedroom-left',right:'bedroom-right',back:'bedroom-upper-wall',
  up:'bedroom-up',down:'bedroom-down'
};
export function bedroomSurface(name) {
  const file=BEDROOM_SURFACES[name];
  return new URL('./img/locations/'+file+'.webp?v=bedroom-360',import.meta.url).href;
}
const {halfWidth,front,back,floor,ceiling}=BEDROOM;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// 첫 번째 값이 u, 두 번째 값이 이미지 위쪽부터 증가하는 v다.
export function roomUv(axis,positive,x,y,z) {
  const wide=2*halfWidth,deep=front+back,high=ceiling-floor;
  const vertical=(ceiling-y)/high;
  if(axis===0)return [positive?(z+front)/deep:(back-z)/deep,vertical];
  if(axis===1)return [.5+x/wide,(z+front)/deep];
  return [.5+(positive?-x:x)/wide,vertical];
}
export const BED={halfWidth:.51,near:.285,far:.994,top:-.204,sleepZ:.436};
const ramp=(x,a,b)=>{
  const t=clamp((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
};
export function bedroomFloor(x,z) {
  const side=1-ramp(Math.abs(x),BED.halfWidth-.023,BED.halfWidth+.071);
  const foot=ramp(z,BED.near-.073,BED.near+.025);
  const head=1-ramp(z,BED.far-.04,BED.far+.006);
  return floor+(BED.top-floor)*side*foot*head;
}
export function canRestOnBed(x,z) {
  return Math.abs(x)<BED.halfWidth+.14&&z>=BED.near-.152&&z<=BED.far+.02;
}
export function stepInBedroom(x,z,dx,dz) {
  let nx=clamp(x+dx,-halfWidth+.13,halfWidth-.13),nz=clamp(z+dz,-back+.13,front-.13);
  // 발치와 양옆으로 올라갈 수 있지만 머리판은 가로지를 수 없다.
  const board=BED.far-.040;
  if(Math.abs(nx)<BED.halfWidth+.025 && z<=board && nz>board)nz=board;
  return {x:nx,z:nz};
}
