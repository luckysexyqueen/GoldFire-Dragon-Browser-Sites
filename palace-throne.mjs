import { hall, entranceZ, stageCenter, decks, stairs } from './palace-floor.mjs';

// 원본 파노라마의 픽셀 경계를 입구 카메라에서 월드 좌표로 역투영한다.
const width=2048, height=682, horizon=416;
const pixelsPerRadian=width/(2*Math.PI);
const mirrored=outline=>outline.map(([x,y])=>[width-x,y]);
const chairHalf = [
  [1024,193],[1013,207],[1010,219],[1007,218],[1007,227],[997,215],[999,225],[983,209],[983,224],
  [989,232],[967,219],[970,232],[951,221],[957,237],[963,243],[931,233],[940,251],[946,257],
  [932,251],[935,260],[911,261],[919,276],[932,286],[925,285],[931,298],[893,291],[903,306],
  [920,321],[913,320],[923,331],[893,323],[907,340],[921,349],[902,346],[910,360],[922,368],
  [903,367],[912,377],[901,379],[901,389],[893,392],[890,405],[900,415],[893,427],[883,437],
  [879,451],[881,463],[884,467],[881,473],[887,478],[900,478],[906,474],[943,477],[961,475],
  [981,477],[1003,475],[1024,479]
];
const guard = [
  [798,253],[801,259],[805,256],[804,263],[810,262],[807,270],[806,278],[802,282],[809,284],
  [816,285],[823,291],[828,293],[830,297],[826,300],[833,303],[834,310],[841,315],[842,320],
  [846,322],[848,326],[846,331],[842,333],[844,337],[852,337],[853,340],[846,342],[846,397],
  [845,406],[838,406],[834,402],[822,403],[816,402],[816,393],[812,379],[810,363],[807,352],
  [804,351],[803,368],[799,381],[798,395],[805,401],[808,405],[802,407],[783,407],[779,405],
  [778,399],[778,388],[775,390],[772,385],[764,379],[752,367],[745,347],[738,320],[738,307],
  [744,304],[745,298],[753,294],[761,291],[770,294],[774,288],[783,284],[791,283],[790,279],
  [787,276],[787,266],[782,262],[790,264],[787,256],[793,260]
];
const plinth = [
  [769,405],[845,404],[846,408],[849,408],[849,415],[844,419],[843,433],[848,437],[848,446],
  [770,446],[769,438],[776,434],[777,419],[769,415]
];
const crystals = [
  [736,384],[765,409],[789,447],[793,414],[805,433],[812,457],[819,437],[833,439],[833,425],
  [846,432],[839,406],[851,413],[849,390],[863,402],[865,385],[860,356],[870,364],[866,334],
  [881,347],[902,385],[901,419],[895,451],[883,457],[867,463],[861,479],[835,488],[817,504],
  [780,509],[737,510],[716,502],[729,500],[707,482],[726,486],[713,469],[743,476],[716,444],
  [731,448],[761,473],[741,435],[732,411]
];
const stepOutline = [
  [839,441],[1209,441],[1211,447],[1221,449],[1221,461],[1230,464],[1230,474],[1241,477],[1242,492],
  [1250,498],[1251,511],[1262,516],[1264,524],[1272,526],[1272,531],[776,531],[776,526],[784,524],
  [786,516],[797,511],[798,498],[806,492],[807,477],[818,474],[818,464],[827,461],[827,449],
  [837,447]
];
const chair=[...chairHalf,...mirrored(chairHalf.slice(1,-1)).reverse()];
const uv=([x,y])=>[x/width,y/height];
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];

function blend(a,b,v) {
  const t=Math.min(1,Math.max(0,(v-a)/(b-a)));
  return t*t*(3-2*t);
}
function pointAtDepth([x,y],depth) {
  const bearing=(x-width/2)/pixelsPerRadian;
  const slope=Math.tan((horizon-y)/pixelsPerRadian)/Math.cos(bearing);
  const elevation=slope*depth;
  if (elevation<hall.floor+.002) depth=(hall.floor+.002)/slope;
  if (elevation>hall.ceiling-.004) depth=(hall.ceiling-.004)/slope;
  return [depth*Math.tan(bearing),depth*slope,-entranceZ-depth];
}
function sourcePixel([x,y,z]) {
  const depth=-z-entranceZ;
  return [width/2+Math.atan2(x,depth)*pixelsPerRadian,
    horizon-Math.atan2(y,Math.hypot(x,depth))*pixelsPerRadian];
}
function relief(THREE, outline, locate, front, back, edge, backing, trim, level=1) {
  const polygon=outline.map(([x,y])=>new THREE.Vector2(x,y));
  function face(a,b,c,n) {
    if (n>0) {
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      face(a,ab,ca,n-1); face(ab,b,bc,n-1); face(ca,bc,c,n-1); face(ab,bc,ca,n-1);
      return;
    }
    for (const p of [a,b,c]) vertex(front,locate(p,false),p);
    for (const p of [a,c,b]) vertex(back,locate(p,true),backing(p));
  }
  for (const [a,b,c] of THREE.ShapeUtils.triangulateShape(polygon,[])) face(outline[a],outline[b],outline[c],level);
  for (let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length];
    quad(edge,[locate(a,false),locate(b,false),locate(b,true),locate(a,true)],trim);
  }
}
function batch() { return {positions:[],uvs:[]}; }
function vertex(batch,position,pixel) {
  batch.positions.push(...position); batch.uvs.push(...uv(pixel));
}
function quad(batch,positions,pixels) {
  for (const i of [0,1,2,0,2,3]) vertex(batch,positions[i],pixels[i]);
}
function mesh(THREE,name,batch,material) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const object=new THREE.Mesh(geometry,material); object.name=name;
  return object;
}
const gilt=[[908,462],[940,462],[940,469],[908,469]];
const amethyst=[[865,413],[874,413],[873,424],[864,421]];
const bronze=[[749,330],[758,330],[757,343],[749,343]];
const stone=[[782,420],[814,420],[814,427],[782,427]];
const velvet=[[1000,435],[1048,435],[1048,447],[1000,447]];

function rearPoint(front,zBack) {
  // 뒷면도 같은 입구 광선 위에서 닫아 장식의 옆면이 정면 윤곽 밖으로 튀어나오지 않게 한다.
  const depth=-front[2]-entranceZ;
  let scale=(-zBack-entranceZ)/depth;
  if (front[1]>0) scale=Math.min(scale,(hall.ceiling-.001)/front[1]);
  if (front[1]<0) scale=Math.min(scale,(hall.floor+.0005)/front[1]);
  return [front[0]*scale,front[1]*scale,-entranceZ-depth*scale];
}
function chairPoint(pixel,rear) {
  const [x,y]=pixel;
  const advance=blend(426.2,455.2,y);
  const arm=blend(75,108,Math.abs(x-1024))*blend(358,389,y);
  const depth=1.45-.285*Math.max(advance,arm);
  const point=pointAtDepth(pixel,depth);
  return rear?rearPoint(point,-1.135):point;
}
function solid(zBack,depthAt) {
  return (p,rear)=>{
    const q=pointAtDepth(p,depthAt(p));
    return rear?rearPoint(q,zBack):q;
  };
}
// 무대 위에서 원본에 가려진 윗면에는 같은 사진의 앞쪽 대리석을 쓴다.
function floorPixel(pos) {
  const p=sourcePixel(pos);
  if (p[1]>=532 || Math.abs(p[0]-1024)>330) return p;
  const t=blend(511,532,p[1]);
  return [p[0],p[1]*t+(1-t)*(554+.10*(p[0]-1024)*Math.sin(p[0]/78))];
}
// 같은 계단을 받치는 면과 표면 장식에는 처음 보는 각도에서 같은 사진 좌표를 쓴다.
function stepFace(batch,corners,under) {
  const [a,b,,d]=corners;
  const across=Math.max(1,Math.ceil(Math.hypot(...a.map((v,i)=>v-b[i]))/.055));
  const along=Math.max(1,Math.ceil(Math.hypot(...a.map((v,i)=>v-d[i]))/.055));
  const point=(u,v)=>a.map((n,i)=>n+(b[i]-n)*u+(d[i]-n)*v);
  for (let j=0;j<along;j++) for (let i=0;i<across;i++) {
    const coords=[[i/across,j/along],[(i+1)/across,j/along],[(i+1)/across,(j+1)/along],[i/across,(j+1)/along]];
    const positions=coords.map(([u,v])=>point(u,v));
    const center=sourcePixel(point((i+.5)/across,(j+.5)/along));
    const show=center[1]>=475 && Math.abs(center[0]-1024)<251;
    quad(batch,positions,show?positions.map(sourcePixel):under);
  }
}
function floorPoint(pixel) {
  const [x,y]=pixel,ang=(x-width/2)/pixelsPerRadian;
  const slope=Math.tan((horizon-y)/pixelsPerRadian);
  // 각도별로 실제 계단과 원형 바닥 중 눈에서 가장 가까운 교차점을 고른다.
  let distance=hall.floor/slope;
  for (const d of decks) {
    const r=d.top/slope,xx=r*Math.sin(ang),zz=entranceZ+r*Math.cos(ang);
    if (r>0 && Math.hypot(xx,zz-stageCenter)<=d.radius) distance=Math.min(distance,r);
  }
  for (const s of stairs) {
    const r=s.top/slope,xx=r*Math.sin(ang),zz=entranceZ+r*Math.cos(ang);
    if (r>0 && Math.abs(xx)<=s.halfWidth && zz>=s.near && zz<=s.far) distance=Math.min(distance,r);
    const edge=(s.near-entranceZ)/Math.cos(ang),elev=edge*slope;
    if (Math.abs(edge*Math.sin(ang))<=s.halfWidth && elev>=s.bottom && elev<=s.top) distance=Math.min(distance,edge);
  }
  // 사진 속 상단의 양옆 금제 날개는 주 계단 밖으로 솟은 장식이다.
  const wingDepth=1.64-.32*blend(441,486,y);
  distance=Math.min(distance,wingDepth/Math.cos(ang));
  return [(distance-.008)*Math.sin(ang),(distance-.008)*slope,-entranceZ-(distance-.008)*Math.cos(ang)];
}
export function createThrone(THREE,materialFor) {
  const face=batch(),back=batch(),rim=batch(),guards=batch(),steps=batch(),stage=batch();
  relief(THREE,chair,chairPoint,face,back,rim,
    ([x,y])=>[1024+(x-1024)*.55,294+(y-194)*.39],gilt,2);
  for (const side of [false,true]) {
    const outline=p=>side?mirrored(p):p;
    relief(THREE,outline(guard),solid(-1.22,([x,y])=>{
      const shield=blend(295,316,y)*(1-blend(357,382,y))*blend(16,62,Math.abs(Math.abs(x-1024)-210));
      return 1.57-.09*shield;
    }),guards,guards,rim,([x,y])=>[764+(x%23)*.48,315+(y-254)*.18],bronze,1);
    relief(THREE,outline(plinth),solid(-1.24,()=>1.54),
      guards,guards,rim,([x,y])=>[781+x%26,416+(y-403)*.42],stone,1);
    relief(THREE,outline(crystals),solid(-1.16,([x,y])=>{
      return 1.46-.18*blend(378,490,y)-.04*Math.cos(x*.075);
    }),face,back,rim,([x,y])=>[864+(x%18)*.65,404+(y-333)*.12],amethyst,1);
  }

  // 계단과 원반의 실측 면을 먼저 채운다. 좌석 뒤에서도 갈라진 틈이 보이지 않는다.
  for (const s of stairs) {
    const x=s.halfWidth,n=-s.near,f=-s.far;
    const corners=[[-x,s.top,n],[x,s.top,n],[x,s.top,f],[-x,s.top,f]];
    stepFace(steps,corners,velvet);
    for (let k=0;k<4;k++) {
      const a=corners[k],b=corners[(k+1)%4];
      stepFace(steps,[[a[0],s.bottom,a[2]],[b[0],s.bottom,b[2]],b,a],k%2?gilt:velvet);
    }
  }
  for (const [i,d] of decks.entries()) {
    const inner=decks[i+1]?.radius || 0;
    const radialSteps=Math.max(1,Math.ceil((d.radius-inner)/.029));
    for (let j=0;j<96;j++) {
      const a=j*2*Math.PI/96,b=(j+1)*2*Math.PI/96;
      const point=(ang,r,y)=>[r*Math.sin(ang),y,-stageCenter+r*Math.cos(ang)];
      for (let k=0;k<radialSteps;k++) {
        const r=inner+(d.radius-inner)*k/radialSteps,rr=inner+(d.radius-inner)*(k+1)/radialSteps;
        const top=[point(a,r,d.top),point(b,r,d.top),point(b,rr,d.top),point(a,rr,d.top)];
        quad(stage,top,top.map(floorPixel));
      }
      const wall=[point(a,d.radius,d.bottom),point(b,d.radius,d.bottom),point(b,d.radius,d.top),point(a,d.radius,d.top)];
      quad(stage,wall,wall.map(floorPixel));
    }
  }
  // 실제 단의 상면과 앞면에만 사진 속 러너와 금장 몰딩을 맞춘다.
  // 좌석 아래 가려진 부분을 다시 투영하면 옆에서 등받이가 바닥에 복제된다.
  const visibleStep=[...stepOutline.slice(1),stepOutline[0],
    [882,441],[880,459],[882,475],[1166,475],[1168,459],[1166,441]];
  function paintStep(a,b,c,level) {
    if (level && Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(c[0]-b[0],c[1]-b[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))>13) {
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      paintStep(a,ab,ca,level-1);paintStep(ab,b,bc,level-1);
      paintStep(ca,bc,c,level-1);paintStep(ab,bc,ca,level-1);
    } else for(const p of [a,b,c]) vertex(steps,floorPoint(p),p);
  }
  const shape=visibleStep.map(([x,y])=>new THREE.Vector2(x,y));
  for(const [i,j,k] of THREE.ShapeUtils.triangulateShape(shape,[])) paintStep(visibleStep[i],visibleStep[j],visibleStep[k],5);
  const mat=materialFor('furnishing');
  return [mesh(THREE,'ThroneFront',face,mat),mesh(THREE,'ThroneBack',back,mat),
    mesh(THREE,'ThroneEdges',rim,mat),mesh(THREE,'RoyalGuardians',guards,mat),
    mesh(THREE,'PalaceStairs',steps,mat),mesh(THREE,'RoundStage',stage,mat)];
}
