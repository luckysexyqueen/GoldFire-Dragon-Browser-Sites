import {hall} from './palace-floor.mjs';
// 걷기 좌표는 +z가 궁전 쪽이고, 3차원 월드의 z축과 반대다.
export const CASTLE={floor:-.43,wallR:4.15,wallHalf:.61,landR:6.60,bridgeHalf:.81,bridgeEnd:11.20};
export const EXTERIOR_CAMERA={halfWidth:8.0,front:8.0,back:12.7,floor:-1.51,ceiling:9.2};
export const CASTLE_ASSETS=['stone','sky'].map(name=>new URL('./img/locations/floating-castle-'+name+'.webp?v=castle-gates',import.meta.url).href);
export const isCastle=place=>place==='courtyard'||place==='exterior';
export const CASTLE_SPAWNS={
  courtyard:{x:0,z:-1.15,yaw:180},
  exterior:{x:0,z:-10.25,yaw:0},
};
const PLAYER=.13;
export const ENTRY={radius:.407,shoulder:.80,hallZ:hall.back,yardZ:.245};
export function isInsideEntry(x,y){
  if(y<CASTLE.floor-.002 || Math.abs(x)>=ENTRY.radius)return false;
  const high=Math.max(0,y-CASTLE.floor-ENTRY.shoulder);
  return x*x+high*high<ENTRY.radius*ENTRY.radius;
}
export function nearMainEntry(place,x,z){
  return Math.abs(x)<.63 && ((place==='palace'&&z<-hall.back+.69) ||
    (place==='courtyard'&&z>-ENTRY.yardZ-.65&&z<-ENTRY.yardZ+.14));
}
export function stepAtMainEntry(place,x,z,dx,dz,open){
  if(open<.82 || (place!=='palace'&&place!=='courtyard'))return null;
  const inside=place==='palace', edge=inside?-ENTRY.hallZ:-ENTRY.yardZ, sign=inside?-1:1;
  const nx=x+dx,nz=z+dz;
  if(Math.abs(nx)>=ENTRY.radius-PLAYER || Math.abs(x)>ENTRY.radius ||
      sign*(z-edge)<-.51 || sign*(nz-edge)<-.42)return null;
  return sign*(nz-edge)>=0 ? {x:nx,z:nz-edge-(inside?ENTRY.yardZ:ENTRY.hallZ),place:inside?'courtyard':'palace',deltaZ:dz}
    : {x:nx,z:nz};
}
const rise=worldZ=>.72*Math.max(0,Math.min(1,(worldZ-7.50)/2.41));
export const castleFloor=(_x,z)=>CASTLE.floor+rise(-z);
const OBSTACLES=[
  {x:0,z:1.32,hx:1.26,hz:1.23},
  {x:0,z:-.11,hx:.46,hz:.10},
  {x:-1.47,z:.82,hx:.41,hz:.39},{x:1.47,z:.82,hx:.41,hz:.39},
  {x:-1.77,z:2.04,hx:.46,hz:.45},{x:1.77,z:2.04,hx:.46,hz:.45},
  {x:-.92,z:2.78,hx:.76,hz:.53},{x:.92,z:2.78,hx:.76,hz:.53},
  {x:-2.04,z:.00,hx:.42,hz:.38},{x:2.04,z:.00,hx:.42,hz:.38},
  {x:-.97,z:-4.09,hx:.38,hz:.37},{x:.97,z:-4.09,hx:.38,hz:.37},
  ...[.63,1.23,1.84,2.46,3.13,3.82,4.43,5.04,5.65].map(t=>({x:4.15*Math.sin(t),z:-4.15*Math.cos(t),hx:.37,hz:.37})),
  {x:-2.69,z:-1.28,hx:.35,hz:.33},{x:2.69,z:-1.28,hx:.35,hz:.33}
];
export function castleWalkable(x,z,clearance=PLAYER) {
  const {wallR,wallHalf,landR,bridgeHalf,bridgeEnd}=CASTLE;
  const r=Math.hypot(x,z),extra=Math.max(0,clearance-PLAYER);
  const onIsland=r<landR-.22-extra;
  const onBridge=z<=-5.78&&z>=-bridgeEnd+.18&&Math.abs(x)<bridgeHalf-.12-extra;
  const onOverlook=z<=-9.89&&z>=-bridgeEnd+.18&&Math.abs(x)<1.38-extra;
  if(!onIsland&&!onBridge&&!onOverlook)return false;
  if(Math.abs(r-wallR)<.38+extra && !(z<0&&Math.abs(x)<wallHalf-clearance))return false;
  return !OBSTACLES.some(o=>Math.abs(x-o.x)<o.hx+clearance&&Math.abs(z-o.z)<o.hz+clearance);
}
export function stepInCastle(x,z,dx,dz) {
  // 세분화해 이동키나 조이스틱의 한 프레임이 벽을 건너뛰지 못하게 한다.
  const slices=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.065));
  for(let i=0;i<slices;i++){
    if(castleWalkable(x+dx/slices,z))x+=dx/slices;
    if(castleWalkable(x,z+dz/slices))z+=dz/slices;
  }
  return {x,z};
}
export function crossedWallGate(x,z,next) {
  return Math.abs(x)<.46&&Math.abs(next.x)<.46&&
    ((z>=-4.17&&next.z< -4.17)||(z< -4.17&&next.z>=-4.17));
}
const passages=[
  {from:'courtyard',to:'exterior',x:0,z:-3.85,rx:.53,rz:.40,label:'성벽 문 · 성 밖으로 나가기',entry:{x:0,z:-4.61,yaw:180}},
  {from:'exterior',to:'courtyard',x:0,z:-4.50,rx:.53,rz:.39,label:'성벽 문 · 안뜰로 들어가기',entry:{x:0,z:-3.70,yaw:0}},
];
export function nearbyCastleGate(place,x,z) {
  return passages.find(g=>g.from===place&&Math.abs(x-g.x)<=g.rx&&Math.abs(z-g.z)<=g.rz)??null;
}
export function castleSkyUV(x,y,z){
  // 양쪽 렌더러가 같은 구면을 본다. 위쪽은 이미지 첫 줄이다.
  return [.5+Math.atan2(x,z)/(2*Math.PI),.5-Math.asin(Math.max(-1,Math.min(1,y/Math.hypot(x,y,z))))/Math.PI];
}

const P=0,D=1,G=2,S=3,R=4,T=5,N=6,L=7,W=8;
const TAU=2*Math.PI;
const root=CASTLE.floor;
const dot=(x,z,a,r)=>[x+Math.sin(a)*r,z+Math.cos(a)*r];
export function shapes(){
  const xyz=[],uv=[];
  function polygon(pts,tile,light=2,layout) {
    const tex=layout??(pts.length===4?[[.025,.975],[.975,.975],[.975,.025],[.025,.025]]:[[.5,.10],[.04,.94],[.96,.94]]);
    for(let j=1;j<pts.length-1;j++){
      for(const i of [0,j,j+1]){
        xyz.push(...pts[i]);uv.push((tile+tex[i][0])/9,(light+tex[i][1])/4);
      }
    }
  }
  const quad=(a,b,c,d,t,l,tex)=>polygon([a,b,c,d],t,l,tex);
  function box(x,y,z,w,h,d,t,rot=0) {
    const cos=Math.cos(rot),sin=Math.sin(rot);
    const pt=(a,b,c)=>[x+a*cos+c*sin,y+b,z+c*cos-a*sin];
    const a=pt(-w/2,0,-d/2),b=pt(w/2,0,-d/2),c=pt(w/2,0,d/2),e=pt(-w/2,0,d/2);
    const f=pt(-w/2,h,-d/2),g=pt(w/2,h,-d/2),i=pt(w/2,h,d/2),j=pt(-w/2,h,d/2);
    quad(e,c,i,j,t,2);quad(b,a,f,g,t,1);quad(a,e,j,f,t,1);quad(c,b,g,i,t,0);quad(j,i,g,f,t,3);
    quad(a,b,c,e,t,0);
  }
  function ring(x,z,lo,hi,r0,r1,t,n=12,skip=()=>false) {
    for(let i=0;i<n;i++){
      const a=TAU*i/n,b=TAU*(i+1)/n,m=(a+b)/2;
      if(skip(m))continue;
      const [x0,z0]=dot(x,z,a,r0),[x1,z1]=dot(x,z,b,r0);
      const [x2,z2]=dot(x,z,b,r1),[x3,z3]=dot(x,z,a,r1);
      const light=Math.max(0,Math.min(3,Math.round(1.45+1.35*Math.cos(m+.46))));
      quad([x0,lo,z0],[x1,lo,z1],[x2,hi,z2],[x3,hi,z3],t,light);
    }
  }
  function disk(x,y,z,inner,outer,t,segments=48) {
    for(let i=0;i<segments;i++){
      const a=TAU*i/segments,b=TAU*(i+1)/segments;
      const [x0,z0]=dot(x,z,a,inner),[x1,z1]=dot(x,z,b,inner);
      const [x2,z2]=dot(x,z,b,outer),[x3,z3]=dot(x,z,a,outer);
      if(inner>.001)quad([x0,y,z0],[x1,y,z1],[x2,y,z2],[x3,y,z3],t,2);
      else polygon([[x,y,z],[x2,y,z2],[x3,y,z3]],t,2);
    }
  }
  function arch(x,y,z,r,shoulder,depth,{blocked=false,stone=P,gold=G}={}) {
    const thick=Math.min(.155,r*.32);
    const z0=z-depth/2,z1=z+depth/2;
    if(blocked) {
      // 안쪽은 어두운 실제 문짝이다. 바깥 성벽의 아치는 비워 둔다.
      box(x,y,z,r*2,shoulder,depth*.70,N);
      for(let i=0;i<12;i++){
        const a=Math.PI*i/12,b=Math.PI*(i+1)/12;
        polygon([[x,y+shoulder,z1],[x+r*Math.cos(a),y+shoulder+r*Math.sin(a),z1],[x+r*Math.cos(b),y+shoulder+r*Math.sin(b),z1]],N,2);
      }
      for(const sign of [-1,1])for(let i=1;i<4;i++)box(x+sign*i*r/4,y+.025,z1+.004,.015,shoulder*.95,.013,D);
      for(const sign of [-1,1])box(x+sign*.055,y+shoulder*.51,z1+.027,.035,.095,.04,G);
    }
    for(const sign of [-1,1]){
      box(x+sign*(r+thick*.65),y,z,thick*1.3,shoulder,depth,stone);
      box(x+sign*(r+thick*.24),y,z1+.017,thick*.34,shoulder,.06,gold);
      box(x+sign*(r+thick*.24),y,z0-.017,thick*.34,shoulder,.06,gold);
    }
    for(let i=0;i<16;i++){
      const a=Math.PI*i/16,b=Math.PI*(i+1)/16;
      const pos=(angle,rad,face)=>[x+rad*Math.cos(angle),y+shoulder+rad*Math.sin(angle),face];
      quad(pos(a,r,z1),pos(b,r,z1),pos(b,r+thick,z1),pos(a,r+thick,z1),gold,i<8?3:2);
      quad(pos(b,r,z0),pos(a,r,z0),pos(a,r+thick,z0),pos(b,r+thick,z0),gold,2);
      quad(pos(a,r,z0),pos(b,r,z0),pos(b,r,z1),pos(a,r,z1),stone,0);
    }
  }
  function tower(x,z,r,h,roof=0){
    const y=root, top=y+h,n=10;
    ring(x,z,y,top,r,r,P,n);
    ring(x,z,y,y+.07,r*1.09,r*1.09,G,n);
    ring(x,z,top-.17,top-.10,r,r*1.14,D,n);
    ring(x,z,top-.10,top-.026,r*1.14,r*1.14,G,n);
    ring(x,z,top-.026,top+.04,r*1.14,r*1.14,D,n);
    if(roof){
      ring(x,z,top+.03,top+roof*.30,r*1.16,r*.69,T,n);
      ring(x,z,top+roof*.30,top+roof*.91,r*.69,r*.10,T,n);
      ring(x,z,top+roof*.91,top+roof,r*.10,r*.02,T,n);
      ring(x,z,top+roof-.025,top+roof+.055,.043,.037,G,8);
      ring(x,z,top+roof+.055,top+roof+.21,.032,.001,G,8);
    } else {
      disk(x,top+.040,z,0,r*1.13,D,10);
      for(let j=0;j<10;j++){const a=TAU*(j+.5)/10,[bx,bz]=dot(x,z,a,r*.99);box(bx,top+.040,bz,r*.38,.126,r*.37,G,a);}
    }
    if(h>.67){
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
        const [wx,wz]=dot(x,z,a,r+.007);
        box(wx,top-.51,wz,r*.29,.31,.041,N,a);
        box(wx,top-.19,wz,r*.34,.024,.041,G,a);
        if(h>1.86)box(wx,top-1.16,wz,r*.27,.29,.04,L,a);
      }
    }
  }
  function roof(x,y,z,w,d,h) {
    const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2];
    const first=[x,y+h,z-d/2],last=[x,y+h,z+d/2];
    quad(e,a,first,last,T,2);quad(b,c,last,first,T,0);
    polygon([a,b,first],D,1);polygon([c,e,last],D,2);
    box(x,y+h-.014,z,.041,.051,d+.045,G);
  }
  function mesh(THREE,material,name) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const result=new THREE.Mesh(geo,material);result.name=name;return result;
  }
  return {box,ring,disk,quad,arch,tower,roof,mesh};
}
const vert=`varying vec2 st; void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const frag=`uniform sampler2D photo;varying vec2 st;void main(){gl_FragColor=texture2D(photo,st);}`;
function rockAtlas(THREE,photo) {
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{photo:{value:photo}},vertexShader:vert,fragmentShader:frag});
}
export function createPalaceGate(THREE,photo,{yard=false,hallPhoto,skyPhoto}={}) {
  const group=new THREE.Group(), g=shapes(), mat=rockAtlas(THREE,photo);
  const {radius:r,shoulder:h}=ENTRY;
  group.position.z=yard?ENTRY.yardZ:ENTRY.hallZ;
  group.name=yard?'CourtyardMainGate':'PalaceMainGate';
  g.arch(0,root,0,r,h,.18,{stone:D});
  g.box(0,root+.003,0,2*r+.09,.016,.25,G);
  group.add(g.mesh(THREE,mat,'MainGateFrame'));
  const doors=[];
  for(const sign of [-1,1]){
    const limb=shapes();
    limb.box(r*.506,0,0,r*1.014,h,.048,D);
    for(const face of [-1,1]){
      const z=.028*face;
      for(let segment=0;segment<12;segment++){
        const x=r*segment/12,n=r*(segment+1)/12;
        const lift=x=>Math.sqrt(Math.max(0,r*r-(r-x)**2));
        limb.quad([x,h-.008,z],[n,h-.008,z],[n,h+lift(n),z],[x,h+lift(x),z],D,face===1?2:1);
      }
      for(const top of [.20,.44,.68]){
        limb.box(r*.50,top,z,r*.83,.023,.024,G);
      }
      for(let segment=1;segment<=4;segment++)
        limb.box(r*.185*segment,.025,z,.013,h-.04,.012,P);
      limb.box(r*.80,h*.56,z,r*.101,.074,.045,G);
    }
    const pivot=new THREE.Group();pivot.position.set(sign*r,root,0);
    const door=limb.mesh(THREE,mat,'MainGateLeaf');
    if(sign>0)door.rotation.y=Math.PI;
    pivot.add(door); group.add(pivot); doors.push({pivot,sign});
  }
  let sight;
  if(yard&&hallPhoto){
    const geo=new THREE.PlaneGeometry(r*2+.055,h+r+.02);geo.translate(0,root+(h+r+.02)*.5,-.087);
    const uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,.10+.80*uv.getX(i),.06+.86*(1-uv.getY(i)));
    sight=new THREE.Mesh(geo,rockAtlas(THREE,hallPhoto));group.add(sight);
  } else {
    // 앞쪽 볕과 안뜰의 돌길이 문 뒤로 이어져 보이는 실제 현관 공간이다.
    const path=shapes();
    for(let n=0;n<7;n++){
      const z=.11+n*.53;
      path.box(0,root-.035,z+.22,1.04,.034,.53,W);
      path.box(-.94,root-.041,z+.22,.84,.04,.53,S);
      path.box(.94,root-.041,z+.22,.84,.04,.53,S);
    }
    const wallZ=3.63;
    for(const sign of [-1,1]){
      path.box(sign*1.22,root,wallZ,1.42,.98,.19,D);
      path.box(sign*1.22,root+.97,wallZ,1.42,.075,.25,G);
      path.tower(sign*.86,wallZ,.32,1.29,0);
    }
    path.arch(0,root,wallZ,.46,.66,.26,{stone:P});
    sight=new THREE.Group();
    sight.add(path.mesh(THREE,mat,'CourtyardThroughGate'));
    if(skyPhoto){
      const geo=new THREE.PlaneGeometry(17,10);
      geo.translate(0,2.8,7.3);
      const uv=geo.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setXY(i,.22+.56*uv.getX(i),.16+.66*(1-uv.getY(i)));
      sight.add(new THREE.Mesh(geo,rockAtlas(THREE,skyPhoto)));
    }
    group.add(sight);
  }
  group.userData.setOpen=value=>{
    for(const {pivot,sign} of doors)pivot.rotation.y=-sign*value*1.52;
    if(sight)sight.visible=value>.015;
  };
  group.userData.setOpen(0);
  return group;
}
export function createCloudCastle(THREE,stone,sky,hallPhoto) {
  const mat=rockAtlas(THREE,stone);
  const terrain=shapes(), walls=shapes(), palace=shapes();
  const r=CASTLE.landR;
  for(let i=0;i<9;i++)terrain.disk(0,root,0,r*i/9,r*(i+1)/9,(i===8)?W:S,48);
  terrain.ring(0,0,root-.11,root,r,r,G,48);
  terrain.ring(0,0,root-.29,root-.11,r-.07,r,W,48);
  terrain.ring(0,0,root-1.65,root-.29,r*.77,r-.07,R,48);
  terrain.ring(0,0,root-2.59,root-1.65,r*.41,r*.77,R,48);
  terrain.ring(0,0,root-2.94,root-2.59,.03,r*.41,R,48);
  for(let i=0;i<26;i++){
    const a=TAU*i/26;
    const [x,z]=dot(0,0,a,6.44);
    if(Math.abs(x)>.92||z<0)terrain.box(x,root+.004,z,.18,.19,.18,D,a);
    if(Math.abs(x)>.82||z<0){
      const [u,v]=dot(0,0,a+TAU/52,6.43);terrain.box(u,root+.06,v,1.34,.041,.07,G,a+TAU/52);
    }
  }
  for(let i=0;i<10;i++)terrain.box(0,root+.001,.27+i*.565,1.25,.011,.564,W);
  const bridgeStart=5.64,bridgeEnd=10.15;
  for(let i=0;i<17;i++){
    const z=bridgeStart+(bridgeEnd-bridgeStart)*i/17,n=bridgeStart+(bridgeEnd-bridgeStart)*(i+1)/17;
    const y=root+rise(z)+.010,j=root+rise(n)+.010;
    terrain.quad([-.82,y,z],[.82,y,z],[.82,j,n],[-.82,j,n],S,2);
    for(const sign of [-1,1]){
      const x=sign*.81;
      terrain.quad([x,y-.12,z],[x,j-.12,n],[x,j+.185,n],[x,y+.185,z],D,2);
      terrain.quad([x-.046,y+.192,z],[x+.046,y+.192,z],[x+.046,j+.192,n],[x-.046,j+.192,n],G,3);
      if(i%2===0)terrain.box(x,y,z,.168,.315,.17,P);
    }
  }
  const ledge=root+rise(10.59);
  terrain.box(0,ledge-.20,10.59,3.04,.209,1.31,P);
  terrain.box(0,ledge+.009,10.59,3.04,.025,1.31,W);
  terrain.box(0,ledge+.035,11.21,3.04,.27,.11,D);
  terrain.box(0,ledge+.304,11.21,3.04,.034,.14,G);
  for(const sign of [-1,1]) {
    terrain.box(sign*1.51,ledge+.023,10.59,.11,.28,1.31,D);
    terrain.box(sign*1.51,ledge+.30,10.59,.14,.035,1.31,G);
    terrain.box(sign*1.176,ledge+.023,9.975,.62,.28,.087,D);
    terrain.box(sign*1.176,ledge+.292,9.975,.62,.041,.116,G);
  }
  const RING=CASTLE.wallR;
  const gap=a=>Math.min(a,TAU-a)<.164;
  for(const off of [-.21,.21]) {
    walls.ring(0,0,root,root+1.01,RING+off,RING+off,D,48,gap);
    walls.ring(0,0,root+.17,root+.204,RING+off+(off>0?.018:-.018),RING+off+(off>0?.018:-.018),G,48,gap);
    walls.ring(0,0,root+.93,root+.987,RING+off+(off>0?.024:-.024),RING+off+(off>0?.024:-.024),G,48,gap);
  }
  for(let i=0;i<96;i++){
    const a=TAU*(i+.5)/96;if(gap(a))continue;
    const [x,z]=dot(0,0,a,RING);
    walls.box(x,root+.959,z,.28,.066,.447,G,a);
    walls.box(x,root+1.024,z,.144,.133,.244,G,a);
    if(i%5===0){
      const [ix,iz]=dot(0,0,a,RING-.216);
      walls.box(ix,root+.256,iz,.115,.41,.038,N,a);
    }
  }
  for(const a of [.63,1.23,1.84,2.46,3.13,3.82,4.43,5.04,5.65]){
    const [x,z]=dot(0,0,a,RING);walls.tower(x,z,.37,1.22,0);
  }
  for(const sign of [-1,1]) walls.tower(sign*.97,4.09,.365,1.48,0);
  walls.arch(0,root,4.135,CASTLE.wallHalf,.73,.48,{stone:P});
  walls.box(0,root+1.355,4.105,1.78,.19,.51,D);
  walls.box(0,root+1.52,4.105,1.81,.045,.57,G);
  for(let i=-3;i<=3;i++)walls.box(i*.235,root+1.56,4.28,.134,.15,.175,G);
  palace.box(0,root,-1.32,2.52,2.20,2.44,P);
  palace.roof(0,root+2.17,-1.32,2.67,2.62,1.01);
  palace.box(0,root,-.042,1.52,1.39,.12,D);
  palace.roof(0,root+1.38,-.05,1.58,.58,.61);
  palace.box(0,root+.105,-1.32,2.58,.051,2.50,G);
  palace.box(0,root+1.54,-1.32,2.58,.045,2.50,G);
  for(const sign of [-1,1]){
    palace.tower(sign*1.47,-.82,.41,2.11,1.06);
    palace.tower(sign*1.77,-2.04,.46,2.89,1.19);
    palace.tower(sign*.92,-2.78,.48,2.56,.93);
    palace.tower(sign*2.04,0,.39,1.21,.64);
    palace.box(sign*.91,root+.70,-.094,.13,.54,.037,L);
    palace.box(sign*.91,root+1.25,-.091,.18,.03,.043,G);
  }
  palace.tower(0,-1.91,.41,3.58,1.54);
  for(let i=-3;i<=3;i++){
    if(!i)continue;
    palace.box(i*.32,root+.73,-2.559,.102,.57,.028,L);
    palace.box(i*.32,root+1.53,-2.559,.098,.32,.027,N);
  }
  for(const sign of [-1,1]){
    const x=sign*2.69,z=1.28;
    palace.box(x,root,z,.67,.15,.64,D);
    palace.box(x,root+.15,z,.53,.045,.50,G);
    palace.ring(x,z,root+.20,root+.35,.28,.23,P,12);
    palace.disk(x,root+.353,z,0,.233,N,12);
    palace.ring(x,z,root+.22,root+.70,.065,.042,G,10);
    palace.ring(x,z,root+.65,root+.84,.12,.048,G,10);
  }
  const scenery=new THREE.Group();
  const skyGeometry=new THREE.SphereGeometry(46,28,18);
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{sky:{value:sky}},
    vertexShader:`varying vec3 ray;void main(){ray=position;vec4 q=viewMatrix*vec4(position,0.0);gl_Position=projectionMatrix*vec4(q.xyz,1.0);gl_Position.z=gl_Position.w*.99998;}`,
    fragmentShader:`uniform sampler2D sky;varying vec3 ray;void main(){vec3 n=normalize(ray);vec2 st=vec2(.5+atan(n.x,n.z)/6.2831853,.5-asin(clamp(n.y,-1.0,1.0))/3.1415927);gl_FragColor=texture2D(sky,st);}`
  });
  const dome=new THREE.Mesh(skyGeometry,skyMat);dome.name='CastleSky';dome.frustumCulled=false;dome.renderOrder=-100;
  scenery.add(dome,terrain.mesh(THREE,mat,'CastleIsland'),walls.mesh(THREE,mat,'CastleWall'),palace.mesh(THREE,mat,'CastlePalace'));
  scenery.add(createPalaceGate(THREE,stone,{yard:true,hallPhoto}));
  scenery.name='CloudCastle';scenery.visible=false;
  return scenery;
}
