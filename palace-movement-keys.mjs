export const DEFAULT_KEY_MODE='both';
export const KEY_MODE_STORAGE='goldfire.palace.move-keys';
const wasd=new Map([['KeyW',[0,1]],['KeyS',[0,-1]],['KeyA',[-1,0]],['KeyD',[1,0]]]);
const arrows=new Map([['ArrowUp',[0,1]],['ArrowDown',[0,-1]],['ArrowLeft',[-1,0]],['ArrowRight',[1,0]]]);
export function validateKeyMode(value){
  return value==='wasd'||value==='arrows'||value==='both'?value:DEFAULT_KEY_MODE;
}
export function movementDirection(code,mode){
  return (mode!=='arrows'?wasd.get(code):null)||(mode!=='wasd'?arrows.get(code):null);
}
export function movementAxes(codes,mode) {
  let side=0,forward=0;
  for(const code of codes){
    const direction=movementDirection(code,mode);
    if(!direction)continue;
    side+=direction[0];forward+=direction[1];
  }
  // 여러 키를 같은 방향으로 눌러도 한 방향의 속도가 빨라지지 않는다.
  side=Math.sign(side);forward=Math.sign(forward);
  const length=Math.max(1,Math.hypot(side,forward));
  return [side/length,forward/length];
}
