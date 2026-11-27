// 두 방의 좌표에서 앞(+z)은 왕좌에서 침실로 오르는 방향이다.
import { hall } from './palace-floor.mjs';
import { BEDROOM } from './palace-locations.mjs?v=upper-door';
import { shapes } from './palace-castle.mjs?v=upper-door';

export const PASSAGE={length:5.8,rise:1.24,halfWidth:1.17,height:1.62};
export const PASSAGE_CAMERA={halfWidth:PASSAGE.halfWidth-.024,front:PASSAGE.length+.12,back:.12,
  floor:hall.floor+.006,ceiling:hall.floor+PASSAGE.rise+PASSAGE.height-.015};
export const DOOR={
  lower:{half:.47,height:1.155,z:-hall.front,room:'palace',name:'침실 연결문'},
  upper:{half:.334,height:.998,z:BEDROOM.back,room:'bedroom',name:'왕좌의 방 연결문'}
};
const limit=(x,low,high)=>Math.min(high,Math.max(low,x));
const L=PASSAGE.length;
const LAND=.47, TREADS=20, MIDDLE=.46;
const rampY=z=>hall.floor+PASSAGE.rise*limit((z-LAND)/(L-2*LAND),0,1);
const tread=(L-2*LAND)/TREADS;
const riser=PASSAGE.rise/TREADS;
const stairsY=z=>hall.floor+riser*limit(Math.floor((z-LAND)/tread),0,TREADS);
export function passageFloor(x,z){
  const side=limit((Math.abs(x)-MIDDLE+.045)/.105,0,1);
  // 모서리를 조금 앞두고 보행 높이를 연속 보간한다. 실제 계단과 위치를 맞추면서 충돌은 만들지 않는다.
  const up=stairsY(z-.032),next=stairsY(z+.032);
  const t=(limit((z-LAND+.032)%tread,0,.064))/.064;
  const stairs=up+(next-up)*t;
  return rampY(z)+(stairs-rampY(z))*side;
}
export const passageOffset=place=>place==='palace'?[0,0,-hall.front]:place==='bedroom'?[0,-PASSAGE.rise,L+BEDROOM.back]:[0,0,0];
export const passageEntry={x:0,z:L*.5,yaw:0};
const edge=.13,pad=.105;
const clear=(x,side)=>Math.abs(x)<=DOOR[side].half-pad;
export function insideDoorAt(place,x,z) {
  if(place==='palace'&&z>hall.front-.67&&Math.abs(x)<.75)return 'lower';
  if(place==='bedroom'&&z<-BEDROOM.back+.62&&Math.abs(x)<.67)return 'upper';
  if(place==='passage'){
    if(z<.68&&Math.abs(x)<1.04)return 'lower';
    if(z>L-.68&&Math.abs(x)<1.04)return 'upper';
  }
  return null;
}
export function editionStep(place,x,z,dx,dz,base,doors) {
  const nx=x+dx,nz=z+dz;
  if(place==='palace'||place==='bedroom'){
    const upper=place==='bedroom', side=upper?'upper':'lower';
    const wall=upper?-BEDROOM.back:hall.front;
    const sign=upper?-1:1;
    const raw=base(x,z,dx,dz);
    if(sign*(nz-wall)<-.14)return raw;
    if(doors[side]<.77||!clear(nx,side)){
      return {...raw,z:sign*(z-wall)>-edge ? wall-sign*edge:raw.z};
    }
    // 경계까지 갈 때 원래 방의 제한을 문 안쪽 폭에서만 풀어 준다.
    if(sign*(nz-wall)>=0)
      return {x:nx,z:upper?L+nz-wall:nz-wall,place:'passage'};
    return {x:nx,z:nz};
  }
  if(place!=='passage')return base(x,z,dx,dz);
  let clampX=limit(nx,-PASSAGE.halfWidth+.19,PASSAGE.halfWidth-.19);
  // 열린 문 근처에서 직진하면 통과 폭으로만 조금씩 안내한다. 옆걸음은 가로채지 않는다.
  if(dz<0&&nz<.90&&doors.lower>.77)
    clampX*=Math.exp(-Math.abs(dz)*(Math.abs(dx)<Math.abs(dz)*.3?5.5:2.3));
  if(dz>0&&nz>L-.90&&doors.upper>.77)
    clampX*=Math.exp(-Math.abs(dz)*(Math.abs(dx)<Math.abs(dz)*.3?5.5:2.3));
  // 끝 벽의 모서리에서는 문틀 옆으로 걸어 나가지 않는다.
  if(nz<.145){
    if(doors.lower>=.77&&clear(clampX,'lower')){
      if(nz<=0)return {x:clampX,z:hall.front+nz,place:'palace'};
    } else return {x:clampX,z:.145};
  }
  if(nz>L-.145){
    if(doors.upper>=.77&&clear(clampX,'upper')){
      if(nz>=L)return {x:clampX,z:-BEDROOM.back+nz-L,place:'bedroom'};
    } else return {x:clampX,z:L-.145};
  }
  return {x:clampX,z:limit(nz,0,L)};
}

const vertex=`varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment=`uniform sampler2D photo;varying vec2 st;void main(){gl_FragColor=texture2D(photo,st);}`;
function material(THREE,photo) {
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{photo:{value:photo}},vertexShader:vertex,fragmentShader:fragment});
}
const purple=1,gold=2,stone=3,dark=6,amber=7,walkway=8;
export function createPassage(THREE,photo,hallPhoto) {
  const mat=material(THREE,photo);
  const group=new THREE.Group(), corridor=shapes();
  function combineDoor(side,surfaceZ,y) {
    const {half:r,height:h}=DOOR[side];
    const tower=shapes(), trim=shapes(), leaves=[];
    // 3D 문틀은 기존 갈색 양문 위치와 치수를 그대로 쓴다.
    for(const sign of [-1,1]){
      tower.box(sign*(r+.043),y,surfaceZ,.12,h+.035,.19,side==='upper'?dark:purple);
      trim.box(sign*(r+.012),y,surfaceZ,.036,h+.03,.212,gold);
      const model=shapes();
      model.box(r*.512,0,0,r*1.022,h,.038,side==='upper'?walkway:purple);
      for(const face of [-1,1]){
        const z=face*.024;
        for(const panel of [.14,.53]){
          model.box(r*.49,panel*h,z,r*.72,h*.285,.015,dark);
          for(const p of [-1,1])model.box(r*(.49+p*.37),panel*h,z,.012,h*.286,.024,gold);
          for(const hy of [panel*h,panel*h+h*.286])model.box(r*.49,hy,z,r*.76,.012,.023,gold);
        }
        model.box(r*.79,h*.48,z,r*.08,h*.045,.042,gold);
        model.box(r*.97,0,z,.013,h,.015,gold);
      }
      const pivot=new THREE.Group();pivot.position.set(sign*r,y,surfaceZ);
      const mesh=model.mesh(THREE,mat,side+'DoorLeaf');
      if(sign===1)mesh.rotation.y=Math.PI;
      pivot.add(mesh);group.add(pivot);leaves.push({pivot,sign});
    }
    tower.box(0,y+h,surfaceZ,r*2+.22,.121,.20,side==='upper'?dark:purple);
    trim.box(0,y+h+.011,surfaceZ,r*2+.15,.034,.237,gold);
    trim.box(0,y+.002,surfaceZ,r*2,.023,.29,gold);
    trim.box(0,y+h+.073,surfaceZ,.17,.055,.229,gold);
    group.add(tower.mesh(THREE,mat,side+'DoorFrame'),trim.mesh(THREE,mat,side+'GoldDoorTrim'));
    return (open)=>{for(const {pivot,sign} of leaves)pivot.rotation.y=-sign*open*1.54*(side==='upper'?-1:1);};
  }

  const lower=combineDoor('lower',0,hall.floor),upper=combineDoor('upper',-L,passageFloor(0,L));
  const width=PASSAGE.halfWidth, high=PASSAGE.height, N=20;
  const stairWidth=width-MIDDLE;
  for(const sign of [-1,1]){
    const x=sign*(MIDDLE+stairWidth*.5);
    corridor.box(x,hall.floor-.068,-LAND*.5,stairWidth,.068,LAND,stone);
    corridor.box(x,hall.floor+PASSAGE.rise-.068,-L+LAND*.5,stairWidth,.068,LAND,stone);
    for(let i=0;i<TREADS;i++){
      const a=LAND+tread*i,b=a+tread, y=hall.floor+riser*i;
      corridor.box(x,y-riser,-(a+b)*.5,stairWidth,riser,tread,stone);
      if(i>0) {
        const py=y-.012,z=-a+.002, xl=x-stairWidth*.5,xr=x+stairWidth*.5;
        corridor.quad([xl,py,z],[xr,py,z],[xr,y,z],[xl,y,z],gold,2);
      }
    }
  }
  const bounds=[...new Set([0,LAND,L-LAND,L,...Array.from({length:N-1},(_,i)=>L*(i+1)/N)])].sort((a,b)=>a-b);
  for(let i=0;i<bounds.length-1;i++){
    const a=bounds[i],b=bounds[i+1],ay=rampY(a),by=rampY(b);
    corridor.quad([-MIDDLE,ay,-a],[MIDDLE,ay,-a],[MIDDLE,by,-b],[-MIDDLE,by,-b],walkway,2+i%2);
    corridor.quad([-width,ay+high,-a],[width,ay+high,-a],[width,by+high,-b],[-width,by+high,-b],purple,1);
    for(const sign of [-1,1]){
      const x=sign*width;
      corridor.quad([x,ay-.093,-a],[x,by-.093,-b],[x,by+high,-b],[x,ay+high,-a],purple,i%4===0?3:2);
      corridor.quad([x-sign*.014,ay+.077,-a],[x-sign*.014,by+.077,-b],[x-sign*.014,by+.107,-b],[x-sign*.014,ay+.107,-a],gold,2);
      if(i%4===2){
        corridor.box(x-sign*.056,(ay+by)*.5,-(a+b)*.5,.112,high,.140,purple);
        corridor.box(x-sign*.13,(ay+by)*.5+.79,-(a+b)*.5,.142,.055,.149,gold);
        corridor.box(x-sign*.13,(ay+by)*.5+.84,-(a+b)*.5,.081,.129,.10,amber);
        corridor.box(x-sign*.145,(ay+by)*.5+.96,-(a+b)*.5,.099,.028,.116,gold);
        corridor.box(x-sign*.141,(ay+by)*.5+.58,-(a+b)*.5,.13,.061,.145,gold);
        corridor.box(x-sign*.132,(ay+by)*.5+.642,-(a+b)*.5,.068,.081,.081,amber);
      }
    }
  }
  // 따뜻한 빛이 돌아가는 금빛 샹들리에. 소프트웨어 렌더러에서도 광택과 밝기를 유지한다.
  for(const z of [.72,2.04,3.40,4.76,5.48]){
    const y=passageFloor(0,z)+high;
    corridor.ring(0,-z,y-.02,y+.004,.121,.126,gold,12);
    corridor.ring(0,-z,y-.15,y-.012,.021,.021,gold,10);
    corridor.ring(0,-z,y-.25,y-.15,.105,.021,gold,12);
    corridor.ring(0,-z,y-.273,y-.231,.215,.215,gold,16);
    corridor.ring(0,-z,y-.291,y-.273,.156,.208,gold,16);
    corridor.ring(0,-z,y-.354,y-.291,.024,.092,gold,12);
    for(let i=0;i<6;i++){
      const a=Math.PI/3*i,x=.175*Math.sin(a),w=-z+.175*Math.cos(a);
      corridor.box(x,y-.237,w,.046,.047,.046,gold);
      corridor.box(x,y-.19,w,.031,.053,.033,amber);
      corridor.ring(x,w,y-.137,y-.096,.026,.006,amber,7);
    }
  }
  for(const [n,side] of [[0,'lower'],[L,'upper']]){
    const y=passageFloor(0,n);
    for(const sign of [-1,1]){
      const widthOuter=width-DOOR[side].half;
      corridor.box(sign*(widthOuter*.5+DOOR[side].half),y,-n,.012+widthOuter,high,.055,purple);
    }
    corridor.box(0,y+DOOR[side].height,-n,DOOR[side].half*2,high-DOOR[side].height,.053,purple);
  }
  group.add(corridor.mesh(THREE,mat,'RoyalPassage'));
  function peek(texture,w,h,y,z,name){
    const geometry=new THREE.PlaneGeometry(w,h);geometry.translate(0,y+h/2,z);
    const uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,.20+.60*uv.getX(i),.12+.76*(1-uv.getY(i)));
    const mesh=new THREE.Mesh(geometry,material(THREE,texture));mesh.name=name;
    group.add(mesh);return mesh;
  }
  const bottom=peek(hallPhoto,2.5,1.56,hall.floor-.03,.47,'PalaceLandingPreview');
  let top;
  return {
    group,
    upstairsPhoto(photo){if(!top)top=peek(photo,2,1.38,passageFloor(0,L)-.02,-L-.47,'BedroomLandingPreview');},
    set(place,doors){
      group.visible=place==='palace'||place==='bedroom'||place==='passage';
      if(!group.visible)return;
      group.position.set(...passageOffset(place));
      bottom.visible=place!=='palace';
      if(top)top.visible=place!=='bedroom';
      lower(doors.lower);upper(doors.upper);
    }
  };
}
