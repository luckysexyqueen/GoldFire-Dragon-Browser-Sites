import { passageFloor } from './palace-passage.mjs?v=upper-door';
import { castleFloor, isCastle } from './palace-castle.mjs?v=castle-gates';
import { BED, bedroomFloor } from './palace-locations.mjs?v=canopy-room';
import { paintFaceMakeup } from './palace-face-makeup.mjs';
import { loadHipImages, hipMotion } from './palace-hips.mjs?v=strong-motion';
import { loadVolumeImages } from './palace-volume-images.mjs?v=axilla';
import { softMotion } from './palace-soft-body.mjs?v=strong-motion';
import { violetTexture } from './palace-violet-skin.mjs?v=even-violet';
import { loadBackHair } from './palace-hair.mjs?v=seamless-hime';
import { goldHairTexture } from './palace-gold-hair.mjs?v=bright-gold';
import { loadHands } from './palace-hands.mjs?v=even-violet';
import { loadFeet } from './palace-feet.mjs?v=even-violet';
import { hall, farClip, floorHeight, throneSeat } from "./palace-floor.mjs?v=throne-seat";

// 상자는 광선을 검사할 범위다. 실제 몸의 윤곽과 표면은 사진의 화소와 두께 이미지로 결정한다.
const volumeVertex = `
varying vec3 boxPoint;
void main() {
  boxPoint = position + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const volumeFragment = `
uniform sampler2D frontPhoto, backPhoto, profilePhotos, thickness;
uniform vec4 rect, frontTransform, eyeMaskRect;
uniform vec4 profileRect;
uniform vec3 extents;
uniform vec3 shoulderOrigin;
uniform vec4 chestSpring;
uniform vec2 chestLift;
uniform float pixelX;
uniform float depthResidualX;
uniform float coreFlank;
uniform float violetSkin;
uniform float insideArmSkin;
uniform vec2 verticalRange;
uniform vec3 localEye;
uniform mat4 hitProjection;
varying vec3 boxPoint;
float chestEnvelope(vec2 p) {
  vec2 q=(vec2(abs(p.x),p.y)-vec2(.231,1.209))/vec2(.207,.217);
  float t=max(0.0,1.0-dot(q,q));
  return t*t;
}
vec3 mappedPoint(vec3 p) {
  if (any(notEqual(chestLift,vec2(0.0)))) {
    vec3 q=shoulderOrigin+p*extents;
    float k=1.0-smoothstep(-.33,-.13,q.z);
    float lift=q.x>=0.0?chestLift.x:chestLift.y;
    if(k>0.0) p.y-=lift*k*chestEnvelope(q.xy)/extents.y;
  }
  return p;
}
vec2 photoUV(vec3 p) {
  return rect.xy + rect.zw * vec2(1.0-p.x, 1.0-verticalRange.x-p.y*verticalRange.y);
}
vec3 depthAt(vec2 uv) {
  vec3 d=texture2D(thickness,uv).rgb;
  if (depthResidualX>0.0) d.rg+=(texture2D(thickness,uv+vec2(depthResidualX,0.0)).rg-.5)/255.0;
  if (any(notEqual(chestSpring,vec4(0.0)))) {
    vec2 xy=vec2(1.0-(uv.x-rect.x)/rect.z,(1.0-verticalRange.x-(uv.y-rect.y)/rect.w)/verticalRange.y)*extents.xy+shoulderOrigin.xy;
    vec2 spring=xy.x>=0.0?chestSpring.xy:chestSpring.zw;
    d.r=clamp(d.r+max(-.030,chestEnvelope(xy)*(spring.x+(xy.y-1.209)*spring.y))/extents.z,.003,max(.003,d.g-.001));
  }
  return d;
}
bool occupied(vec3 p) {
  vec3 d = depthAt(photoUV(mappedPoint(p)));
  return d.b > 0.48 && p.z >= d.r && p.z <= d.g;
}
void main() {
  vec3 direction = normalize(boxPoint - localEye);
  vec3 inv = 1.0 / mix(vec3(-0.00001),vec3(0.00001),step(vec3(0.0),direction));
  if (abs(direction.x)>0.00001) inv.x=1.0/direction.x;
  if (abs(direction.y)>0.00001) inv.y=1.0/direction.y;
  if (abs(direction.z)>0.00001) inv.z=1.0/direction.z;
  vec3 a = -localEye * inv, b = (1.0-localEye) * inv;
  vec3 lo = min(a,b), hi = max(a,b);
  float start = max(0.0, max(max(lo.x,lo.y),lo.z));
  float end = min(min(hi.x,hi.y),hi.z);
  if (end <= start) discard;
  float stride = (end-start)/40.0;
  float next = start + 0.000001;
  float previous = start;
  bool found = false;
  for (int i=0; i<=40; i++) {
    vec3 p = localEye + direction * next;
    if (occupied(p)) { found=true; break; }
    previous=next;
    next=min(end,next+stride);
  }
  if (!found) discard;
  for (int j=0; j<7; j++) {
    if (j==4 && depthResidualX==0.0) break;
    float middle=0.5*(next+previous);
    if (occupied(localEye+direction*middle)) next=middle; else previous=middle;
  }
  vec3 hit=clamp(localEye+direction*next,0.0,1.0);
  vec3 mappedHit=mappedPoint(hit);
  vec2 uv=photoUV(mappedHit);
  vec2 d=depthAt(uv).rg;
  float side=clamp((hit.z-d.r)/max(d.g-d.r,0.005),0.0,1.0);
  vec3 color=mix(texture2D(frontPhoto,frontTransform.xy+uv*frontTransform.zw).rgb,texture2D(backPhoto,uv).rgb,smoothstep(0.0,1.0,side));
  float sampleWidth=mix(4.0,7.0,violetSkin)*pixelX;
  vec2 gradient=(depthAt(uv-vec2(sampleWidth,0.0)).rg
                -depthAt(uv+vec2(sampleWidth,0.0)).rg)*rect.z*extents.z/(2.0*sampleWidth*extents.x);
  float blendPlane=violetSkin>.5?smoothstep(.30,.70,side):step(.5,side);
  float slope=mix(gradient.r,-gradient.g,blendPlane);
  vec3 viewDirection=normalize(-direction*extents);
  float confidence=smoothstep(0.08,0.62,length(viewDirection.xz));
  float viewX=viewDirection.x/max(length(viewDirection.xz),0.0001);
  float normalX=slope/sqrt(1.0+slope*slope);
  float coreWeight=coreFlank;
  if (coreFlank>.5 && shoulderOrigin.y>0.0) {
    vec3 p=shoulderOrigin+hit*extents;
    coreWeight*=1.0-smoothstep(1.005,1.15,p.y)*(1.0-smoothstep(-.10,.04,p.z));
  }
  float viewWeight=confidence*(0.28+0.64*smoothstep(0.62,0.96,abs(viewX)));
  float profileX=mix(normalX,viewX,viewWeight*(1.0-.55*coreWeight));
  float profileU=clamp(profileRect.x+hit.z*profileRect.z,0.0005,0.9995);
  vec2 profileUV=vec2(0.5*(profileU+step(profileX,-0.00001)),profileRect.y+mappedHit.y*profileRect.w);
  float profileWeight=violetSkin>.5?smoothstep(.19,.93,abs(profileX)):smoothstep(.25,.81,abs(profileX));
  if(coreFlank>.5 && shoulderOrigin.y>0.0) {
    vec3 p=shoulderOrigin+hit*extents;
    float absAnchor=(1.0-smoothstep(.080,.154,abs(p.x)))*smoothstep(.79,.88,p.y)
      *(1.0-smoothstep(1.08,1.166,p.y))*(1.0-smoothstep(.17,.47,side));
    profileWeight*=1.0-.85*absAnchor*(1.0-smoothstep(.83,1.0,abs(viewX)));
  }
  if (eyeMaskRect.z>0.0 && hit.y>.32 && hit.y<.57 && viewDirection.z<0.0) {
    // 사선에서는 같은 눈 위에 관자놀이의 피부색이 겹쳐 하트가 흐려지지 않게 한다.
    vec2 maskUV=eyeMaskRect.xy+(1.0-hit.xy)*eyeMaskRect.zw;
    float eye=texture2D(profilePhotos,maskUV).r;
    float oblique=smoothstep(.08,.42,abs(viewX))*(1.0-smoothstep(.87,.99,abs(viewX)));
    profileWeight*=1.0-eye*oblique*(1.0-smoothstep(.10,.45,side));
  }
  vec3 profileColor=texture2D(profilePhotos,profileUV).rgb;
  if(violetSkin>.5) {
    float valid=smoothstep(.038,.16,max(profileColor.r,max(profileColor.g,profileColor.b)));
    float planeValid=smoothstep(.062,.19,max(color.r,max(color.g,color.b)));
    profileWeight*=1.0-(1.0-valid)*planeValid*.82;
  }
  color=mix(color,profileColor,profileWeight);
  // 아래 사선에서 겹친 사진의 검은 배경 샘플만 보라색 음영으로 치환한다.
  if(coreFlank>.5 && shoulderOrigin.y>0.0 || insideArmSkin>.5) {
    vec3 p=shoulderOrigin+hit*extents;
    float ax=abs(p.x);
    float under=coreFlank>.5?smoothstep(.075,.121,ax)*(1.0-smoothstep(.346,.435,ax))
      *smoothstep(.915,.968,p.y)*(1.0-smoothstep(1.092,1.174,p.y))
      *(1.0-smoothstep(.065,.147,p.z)):0.0;
    float inner=insideArmSkin>.5?(.52+.29*profileWeight):0.0;
    float peak=max(color.r,max(color.g,color.b));
    float correction=max(under,inner)*(1.0-smoothstep(.103,.239,peak));
    color=mix(color,max(color,vec3(.112,.063,.218)),correction*.92);
  }

  // 사진의 반사를 살리면서 실제 표면 경사에 따라 가장자리를 부드럽게 어둡게 한다.
  vec2 vertical=(depthAt(uv-vec2(0.0,sampleWidth)).rg
                -depthAt(uv+vec2(0.0,sampleWidth)).rg)*rect.w*verticalRange.y*extents.z/(2.0*sampleWidth*extents.y);
  vec3 n=vec3(slope,mix(vertical.r,-vertical.g,blendPlane),mix(-1.0,1.0,blendPlane));
  vec3 normal=length(n)>.0001?normalize(n):viewDirection;
  if (coreFlank>.5 && shoulderOrigin.y>0.0) {
    vec3 p=shoulderOrigin+hit*extents;
    // At the back of the chest, baked white stripes can still suggest a flat diagonal
    // even after the surface is rounded. Soften only those high values as it turns side-on.
    float join=smoothstep(.212,.270,abs(p.x))*(1.0-smoothstep(.370,.429,abs(p.x)))
      *smoothstep(1.205,1.280,p.y)*(1.0-smoothstep(1.369,1.457,p.y))
      *smoothstep(-.400,-.281,p.z)*(1.0-smoothstep(-.061,.040,p.z));
    float brightest=max(color.r,max(color.g,color.b));
    float sheen=smoothstep(.36,.82,brightest)*join*profileWeight;
    color*=1.0-.52*sheen;
  }
  float facing=clamp(dot(normal,viewDirection),0.0,1.0);
  vec3 lit=color*(0.86+0.14*facing+0.045*normal.y);
  if (shoulderOrigin.y>0.0) {
    // 겹치는 두 두께 이미지의 법선이 바뀌어도, 연결부는 원본 사진의 같은 조명을 받는다.
    vec3 p=shoulderOrigin+hit*extents;
    float ax=abs(p.x);
    float fold=smoothstep(.118,.166,ax)*(1.0-smoothstep(.307,.363,ax))
        *smoothstep(1.292,1.352,p.y)*(1.0-smoothstep(1.502,1.525,p.y))
        *smoothstep(-.138,-.062,p.z)*(1.0-smoothstep(.056,.103,p.z));
    lit=mix(lit,color*(.94+.05*smoothstep(1.32,1.51,p.y)),fold);
  }
  if (coreWeight>0.0) {
    // 궁전의 높은 측면광이 실제 표면에서 반사되어 드래그하는 방향에 따라 옆구리 광택이 옮겨간다.
    vec3 lightDir=normalize(vec3(.56,.72,-.41));
    float gloss=pow(max(0.0,dot(normal,normalize(lightDir+viewDirection))),22.0);
    lit=mix(lit,lit*(.90+.16*max(0.0,dot(normal,lightDir)))+vec3(.12,.08,.15)*gloss,coreWeight);
  }
  gl_FragColor=vec4(lit,1.0);
  #ifdef WRITE_HIT_DEPTH
    vec4 clip=hitProjection*vec4(hit-0.5,1.0);
    if (clip.w<=0.0 || clip.z < -clip.w) discard;
    gl_FragDepthEXT=0.5*(clip.z/clip.w)+0.5;
  #endif
}`;

// 원본 사진의 지정된 좌표에만 같은 해상도의 보정 화소를 덧그린다.
function applyColorPatches(patches, atlas, textures) {
  if (!patches?.length || !atlas?.image) return;
  for (const [name, texture] of Object.entries(textures)) {
    if (!texture) continue;
    const tiles = patches.filter(tile => tile[0] === name);
    if (!tiles.length) continue;
    const canvas = document.createElement('canvas');
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(texture.image,0,0);
    for (const [,sx,sy,w,h,dx,dy] of tiles) {
      ctx.drawImage(atlas.image,sx,sy,w,h,dx,dy,w,h);
    }
    texture.image = canvas;
    texture.needsUpdate = true;
  }
}

export async function createPlayer(THREE, renderer, loadTexture) {
  const asset = (name, version='flank-shape') => new URL('./img/player/' + name + '?v=' + version, import.meta.url).href;
  const regions = fetch(asset('regions.json','shoulder-curve')).then(response => {
    if (!response.ok) throw Error('플레이어 이미지 영역을 읽을 수 없습니다.');
    return response.json();
  });
  const underlay = Promise.all([
    fetch(asset('limb-underlay.json','hands-feet')).then(response => {
      if (!response.ok) throw Error('손 뒤쪽의 피부 좌표를 읽을 수 없습니다.');
      return response.json();
    }),
    loadTexture(asset('limb-underlay.webp','hands-feet'))
  ]).catch(() => null);
  const upperBody=Promise.all([
    loadVolumeImages(loadTexture,'body','violet-shadows',{Torso:'Body'}),
    loadVolumeImages(loadTexture,'arms','violet-shadows',{RightUpperArm:'RightShoulder',LeftUpperArm:'LeftShoulder'})
  ]).catch(() => [null,null]);
  const [data, front, back, profiles, depth, hair, temples, hips, shoulderColors, [body,arms], hands, feet, skin] = await Promise.all([
    regions, loadTexture(asset('front.webp')), loadTexture(asset('back.webp')),
    loadTexture(asset('profiles.webp')), loadTexture(asset('thickness.png','shoulder-curve')),
    loadBackHair(THREE,loadTexture).catch(() => null),
    loadTexture(new URL('./img/player/temples.webp?v=front-eyes',import.meta.url).href),
    loadHipImages(loadTexture).catch(() => null),
    loadTexture(asset('shoulder-colors.webp','shoulder-curve')).catch(() => null),
    upperBody,
    loadHands(THREE,loadTexture).catch(() => null),
    loadFeet(THREE,loadTexture).catch(() => null),
    underlay
  ]);
  const trunkProfiles=body && hips ? null : await loadTexture(asset('trunk-profiles.webp'));
  applyColorPatches(data.shoulderPatches,shoulderColors,{
    front, back, profile:trunkProfiles, armProfile:profiles
  });
  const legProfiles=skin ? profiles.clone() : profiles;
  if (skin) applyColorPatches(skin[0].patches,skin[1],{
    front, legProfile:legProfiles, trunkProfile:trunkProfiles
  });
  // 보정 색상표는 위쪽에 양 측면, 아래쪽에 좌우 머리카락과 정면 눈의 경계를 담는다.
  const templeWidth=1728, templeHeight=576, insetRow=386;
  const [zMin,zMax,sole,height] = data.sideProjection;
  const dyed=[];
  const violet=(texture,strength)=>{
    const next=violetTexture(texture,strength);
    if(next && next!==texture)dyed.push(next);
    return next;
  };
  const bodyFront=violet(front,.69),bodyBack=violet(back,.86),bodyProfiles=violet(profiles,.90);
  const bodyLegs=legProfiles===profiles?bodyProfiles:violet(legProfiles,.94);
  const gradedTrunk=violet(trunkProfiles,.89);
  if(body)body.color=violet(body.color,1);
  if(arms)arms.color=violet(arms.color,1);
  if(hips)hips.color=violet(hips.color,.93);
  const golden=(texture,rects)=>{
    const next=goldHairTexture(texture,rects);
    if(next && next!==texture)dyed.push(next);
    return next;
  };
  const headParts=data.parts.filter(part=>part.head);
  const goldFront=golden(front,headParts.filter(part=>part.name==='Face'||part.name==='Hair')
    .map(part=>[...part.rect,part.name==='Face'?'fringe':'full']));
  if(goldFront!==front)paintFaceMakeup(goldFront,headParts.find(part=>part.name==='Face')?.rect);
  const goldBack=golden(back,headParts.map(part=>[...part.rect,'full']));
  const goldTemples=golden(temples,[[0,0,1,252/576,'warm']]);
  const goldLocks=golden(temples,[[0,0,1,254/576,'full'],[1/1728,385/576,203/1728,185/576,'full']]);
  const actor = new THREE.Group();
  actor.name = 'LocalPlayer';
  actor.rotation.order='YXZ';
  const rig = {};
  if (arms) for (const part of arms.data.parts) {
    data.bones[part.bone]=arms.data.bones[part.bone];
  }
  function attach(name, parent) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.fromArray(data.bones[name]);
    if (parent) pivot.position.sub(new THREE.Vector3().fromArray(data.bones[parent]));
    (parent ? rig[parent] : actor).add(pivot);
    rig[name] = pivot;
  }
  attach('Body'); attach('Head','Body'); attach('Eyes','Head');
  rig.Head.rotation.order = 'YXZ';
  const headRest = rig.Head.position.clone();
  const limbs=['Right','Left'].map(side => {
    attach(side+'Shoulder','Body'); attach(side+'Elbow',side+'Shoulder');
    attach(side+'Hip','Body'); attach(side+'Knee',side+'Hip'); attach(side+'Ankle',side+'Knee');
    return {shoulder:rig[side+'Shoulder'],elbow:rig[side+'Elbow'],hip:rig[side+'Hip'],knee:rig[side+'Knee'],ankle:rig[side+'Ankle']};
  });
  const scale = -hall.floor / data.bones.Eyes[1];
  // 사진에서 골반의 아랫면이 쿠션과 닿도록 실제 아바타의 축척을 반영한다.
  const pelvisBottom = hips?.data.bottom ?? data.parts.find(part => part.name === 'RightSeat').low[1];
  const seatedRootY = throneSeat.cushionY - pelvisBottom * scale;
  actor.scale.setScalar(scale);
  rig.Body.position.x -= data.bones.Eyes[0];
  const camera = new THREE.PerspectiveCamera(75,1,0.003,farClip);
  // 눈의 위치와 회전은 따르되 궁전의 가시 거리는 월드 단위로 유지한다.
  camera.scale.setScalar(1/scale);
  camera.name = 'PlayerEyeCamera';
  rig.Eyes.add(camera);
  const box = new THREE.BoxGeometry(1,1,1);
  const writeDepth = renderer.capabilities.isWebGL2 || renderer.extensions.has('EXT_frag_depth');
  function addVolume(part, bone, bottom=part.low[1], top=part.high[1], photos=null) {
    const low=part.low, high=part.high, fullHeight=high[1]-low[1];
    const extents = new THREE.Vector3(high[0]-low[0],top-bottom,high[2]-low[2]);
    const profileRect = part.trunkProfile ? new THREE.Vector4().fromArray(part.trunkProfile)
      : new THREE.Vector4((low[2]-zMin)/(zMax-zMin),sole-bottom/height,extents.z/(zMax-zMin),-extents.y/height);
    // 옆얼굴과 옆머리는 눈이 없는 측면 사진을 쓴다. 두 하트 눈의 원본은 얼굴 정면에만 있다.
    const curl=part.name==='RightLock'||part.name==='LeftLock';
    const frontTransform=new THREE.Vector4(0,0,1,1);
    if (photos) frontTransform.fromArray(part.frontTransform);
    if (curl) {
      const x=part.name==='RightLock' ? 2 : 104;
      frontTransform.set((x-part.rect[0]*data.size[0])/templeWidth,(insetRow-part.rect[1]*data.size[1])/templeHeight,
        data.size[0]/templeWidth,data.size[1]/templeHeight);
    }
    if (part.head) {
      profileRect.y*=1536/templeHeight;
      profileRect.w*=1536/templeHeight;
    }
    const eyeMaskRect=new THREE.Vector4(0,0,0,0);
    if (part.name==='Face') {
      eyeMaskRect.set(214/templeWidth,insetRow/templeHeight,part.rect[2]*data.size[0]/templeWidth,part.rect[3]*data.size[1]/templeHeight);
    }
    const allHair=curl||part.name==='Hair';
    const sidePhoto=part.head ? (allHair?goldLocks:goldTemples) : part.trunkProfile ? gradedTrunk : part.bone.endsWith('Hip') ? bodyLegs : bodyProfiles;
    const joinsShoulder=(body && photos===body) || part.name.endsWith('Chest') || bone.endsWith('Shoulder');
    const uniforms = {
      frontPhoto:{value:photos?.color ?? (curl ? goldLocks : part.head ? goldFront : bodyFront)}, frontTransform:{value:frontTransform}, eyeMaskRect:{value:eyeMaskRect},
      backPhoto:{value:photos?.color ?? (part.head ? goldBack : bodyBack)}, profilePhotos:{value:photos?.color ?? sidePhoto}, thickness:{value:photos?.depth ?? depth},
      profileRect:{value:profileRect},
      violetSkin:{value:part.head?0:1},
      insideArmSkin:{value:(part.name.endsWith('Arm')||bone.endsWith('Elbow'))?1:0},
      chestSpring:{value:new THREE.Vector4()},
      chestLift:{value:new THREE.Vector2()},
      depthResidualX:{value:part.depthResidualOffset?.[0] || 0},
      shoulderOrigin:{value:joinsShoulder ? new THREE.Vector3(low[0],bottom,low[2]) : new THREE.Vector3()},
      extents:{value:extents}, pixelX:{value:1/(photos?.data.size[0] ?? data.size[0])}, coreFlank:{value:part.name==='Torso' ? 1 : 0},
      rect:{value:new THREE.Vector4().fromArray(part.rect)},
      verticalRange:{value:new THREE.Vector2((bottom-low[1])/fullHeight,(top-bottom)/fullHeight)},
      localEye:{value:new THREE.Vector3()}, hitProjection:{value:new THREE.Matrix4()}
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader:volumeVertex, fragmentShader:volumeFragment,
      defines:writeDepth ? {WRITE_HIT_DEPTH:1} : {}, extensions:{fragDepth:writeDepth},
      side:THREE.BackSide
    });
    const volume = new THREE.Mesh(box,mat);
    volume.name = part.name + '-' + bone;
    volume.scale.copy(extents);
    volume.position.set((low[0]+high[0])/2,(top+bottom)/2,(low[2]+high[2])/2)
      .sub(new THREE.Vector3().fromArray(data.bones[bone]));
    if (part.head) volume.layers.set(1);
    rig[bone].add(volume);
    volume.onBeforeRender = (_renderer,_world,view) => {
      view.getWorldPosition(uniforms.localEye.value);
      volume.worldToLocal(uniforms.localEye.value).addScalar(0.5);
      uniforms.hitProjection.value.multiplyMatrices(view.projectionMatrix,view.matrixWorldInverse).multiply(volume.matrixWorld);
    };
    return volume;
  }
  if (hair) {
    // 좌표 원점은 발바닥이다. 머리 관절에 묶어도 원래 자세에서 같은 위치를 차지한다.
    hair.position.copy(headRest).negate();
    rig.Head.add(hair);
  }
  // 흉골에서 복부까지 이어진 단일 표면을 몸통 관절에 고정한다.
  let softChest;
  if (body) {
    const trunk=body.data.parts[0];
    const volume=addVolume(trunk,trunk.bone,trunk.low[1],trunk.high[1],body);
    const response=volume.material.uniforms.chestSpring.value,lift=volume.material.uniforms.chestLift.value;
    softChest=softMotion('chest',(i,bounce,lag,seat)=>{
      const free=1-.78*seat;
      response.setComponent(2*i,(.031*bounce+.038*lag)*free);
      response.setComponent(2*i+1,.172*bounce*free);
      lift.setComponent(i,.052*bounce*free);
    });
  }
  for (const part of data.parts) {
    if (body && (part.name==='Torso' || part.name==='RightChest' || part.name==='LeftChest')) continue;
    if (hair && part.name === 'Hair') continue;
    if (hips && (part.name==='RightSeat' || part.name==='LeftSeat')) continue;
    const side=part.name.startsWith('Right')?'Right':'Left';
    const y=joint=>data.bones[side+joint][1];
    // 겹치는 관절 가장자리에도 원래 사진의 같은 화소를 쓴다.
    if (part.bone.endsWith('Shoulder')) {
      if (arms) {
        const upper=arms.data.parts.find(arm=>arm.bone===part.bone);
        addVolume(upper,upper.bone,upper.low[1],upper.high[1],arms);
      } else addVolume(part,part.bone,y('Elbow')-.014);
      addVolume(part,side+'Elbow',hands?.cutY ?? part.low[1],y('Elbow')+.014);
    } else if (part.bone.endsWith('Hip')) {
      addVolume(part,part.bone,y('Knee')-.018);
      addVolume(part,side+'Knee',y('Ankle')-.012,y('Knee')+.018);
      if (feet) rig[side+'Ankle'].add(feet[side]);
      else addVolume(part,side+'Ankle',part.low[1],y('Ankle')+.012);
    } else addVolume(part,part.bone);
  }
  hands?.attach(rig,data.bones);
  const softHips=hips && hipMotion(hips.data.parts.map(part=>
    addVolume(part,part.bone,part.low[1],part.high[1],hips)),pelvisBottom);
  let bodyYaw=0, lastX=0, lastZ=0;
  const seatedLook=new THREE.Quaternion(), eyeAngles=new THREE.Euler(0,0,0,'YXZ');
  return {
    actor,camera,
    release() { hair?.userData.releaseGold?.(); for(const texture of dyed)texture.dispose(); hands?.release?.();feet?.release?.(); },
    get settling() { return !!(softHips?.settling || softChest?.settling); },
    pose(yaw,pitch,leanX,leanY,x,z,gait,thirdPerson=false) {
      const seat = gait?.seatAmount || 0, sleep=gait?.sleepAmount||0;
      softHips?.pose(gait,seat);
      softChest?.pose(gait,seat);
      const standingY = gait?.seatActive ? gait.standHeight : gait?.location==='bedroom' ? bedroomFloor(x,z) : isCastle(gait?.location) ? castleFloor(x,z) : gait?.location==='passage' ? passageFloor(x,z) : floorHeight(x,z);
      const normalHeight=THREE.MathUtils.lerp(standingY,seatedRootY,seat);
      actor.position.set(x,THREE.MathUtils.lerp(normalHeight,BED.top+.111,sleep),-z);
      const walking = x!==lastX || z!==lastZ;
      let glance=0;
      if (gait?.seatActive) {
        bodyYaw=gait.seatYaw;
        if (!thirdPerson) glance=THREE.MathUtils.clamp(Math.atan2(Math.sin(yaw-bodyYaw),Math.cos(yaw-bodyYaw)),-1.28,1.28);
      } else if (walking || gait?.recenter) bodyYaw=yaw;
      else if (!thirdPerson) {
        const turning=Math.atan2(Math.sin(yaw-bodyYaw),Math.cos(yaw-bodyYaw));
        glance=THREE.MathUtils.clamp(turning,-0.95,0.95);
        bodyYaw=yaw-glance;
      }
      lastX=x; lastZ=z;
      const baseYaw=(gait?.sleeping ? gait.sleepStartYaw : bodyYaw)??bodyYaw;
      const turnToPillow=Math.atan2(Math.sin(Math.PI-baseYaw),Math.cos(Math.PI-baseYaw));
      actor.rotation.y=-(baseYaw+turnToPillow*sleep);
      actor.rotation.x=Math.PI*.5*sleep;
      rig.Head.position.copy(headRest);
      if (!thirdPerson && !gait?.sleeping) {
        const leanForward=0.16*Math.pow(Math.max(0,-Math.sin(pitch)),2);
        rig.Head.position.x+=leanX/scale+leanForward*Math.sin(glance);
        rig.Head.position.y+=leanY/scale;
        rig.Head.position.z-=leanForward*Math.cos(glance);
      }
      rig.Head.rotation.y=-glance*(1-sleep);
      rig.Head.rotation.x=thirdPerson ? 0 : pitch*(1-sleep);
      // 왕좌에 앉은 목의 동작과 독립적으로 시선은 양옆과 뒤까지 돌릴 수 있다.
      camera.quaternion.identity();
      if (gait?.seatActive && !thirdPerson) {
        eyeAngles.set(pitch,bodyYaw-yaw,0,'YXZ');
        seatedLook.setFromEuler(eyeAngles);
        camera.quaternion.copy(rig.Head.quaternion).invert().multiply(seatedLook);
      }
      const step=gait?.moving && !gait.seatActive ? Math.sin(gait.distance*2*Math.PI/0.31) : 0;
      for (const [i,limb] of limbs.entries()) {
        const sign=i===0?1:-1;
        const swing=sign*step;
        const forward=swing*(gait?.forward||0),side=swing*(gait?.side||0);
        limb.hip.rotation.set(0.32*forward+1.49*seat,-sign*.13*seat,-0.18*side+sign*.12*seat);
        limb.knee.rotation.x=-0.32*Math.max(0,forward)-1.64*seat;
        limb.ankle.rotation.x=-0.12*forward+.13*seat;
        limb.shoulder.rotation.set(-0.23*forward+.22*seat,0,0.09*side+sign*.07*seat);
        limb.elbow.rotation.x=0.14*Math.max(0,-forward)+.76*seat;
        limb.shoulder.rotation.x-=.13*sleep;
        limb.elbow.rotation.x+=.12*sleep;
        limb.hip.rotation.x-=.16*sleep;
        limb.ankle.rotation.x-=.09*sleep;
      }
      hands?.pose(gait,seat);
    }
  };
}
