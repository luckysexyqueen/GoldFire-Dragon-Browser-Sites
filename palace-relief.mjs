import { createRoyalPatrol } from "./palace-npc.mjs?v=patrol-paths";
import { createPassage, PASSAGE_CAMERA, PASSAGE, passageFloor, DOOR } from './palace-passage.mjs?v=upper-door';
import { CASTLE_ASSETS, ENTRY, EXTERIOR_CAMERA, createCloudCastle, createPalaceGate, isCastle } from './palace-castle.mjs?v=main-entry';
import { createBedroomTextiles,TEXTILE_ASSETS } from './palace-bedroom-textiles.mjs?v=canopy-room';
import { BED_IMAGE, createBed } from './palace-bed.mjs?v=canopy-room';
import { BEDROOM, BEDROOM_SURFACES, bedroomSurface } from './palace-locations.mjs?v=upper-door';
import { createPlayer } from "./palace-player.mjs?v=upper-door";

import { hall, entranceZ, farClip } from './palace-floor.mjs';
import { createThrone } from './palace-throne.mjs?v=panoramic-hall';

// 바닥, 천장, 네 벽을 틈 없는 월드 좌표의 방으로 만들고 사진을 그 표면에 투영한다.
function createHall(THREE, photos) {
  const geometry=new THREE.BoxGeometry(2*hall.halfWidth,hall.ceiling-hall.floor,hall.front+hall.back);
  geometry.translate(0,(hall.ceiling+hall.floor)/2,(hall.back-hall.front)/2);
  const uniforms=Object.fromEntries(Object.entries(photos).map(([name,value])=>[name,{value}]));
  const material=new THREE.ShaderMaterial({
    uniforms, side:THREE.BackSide,
    vertexShader:`
      varying vec3 roomPoint;
      void main() {
        roomPoint=position+vec3(0.0,0.0,${entranceZ.toFixed(6)});
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D front, back, left, right, up, down;
      varying vec3 roomPoint;
      void main() {
        vec3 p=roomPoint, a=abs(p);
        if(p.z>${(ENTRY.hallZ+entranceZ-.004).toFixed(6)} && p.y>=${(hall.floor-.002).toFixed(5)}){
          float dy=max(0.0,p.y-${(hall.floor+ENTRY.shoulder).toFixed(5)});
          if(p.x*p.x+dy*dy<${(ENTRY.radius**2).toFixed(7)})discard;
        }
        if(p.z<${(-hall.front+entranceZ+.006).toFixed(6)} && abs(p.x)<${DOOR.lower.half.toFixed(5)}
          && p.y>=${(hall.floor-.002).toFixed(5)} && p.y<${(hall.floor+DOOR.lower.height).toFixed(5)})discard;
        vec4 color;
        if (a.x>=a.y && a.x>=a.z) {
          vec2 uv=0.5+0.5*vec2(sign(p.x)*p.z,-p.y)/a.x;
          if (p.x>0.0) color=texture2D(right,uv); else color=texture2D(left,uv);
        } else if (a.y>=a.z) {
          vec2 uv=0.5+0.5*vec2(p.x,-sign(p.y)*p.z)/a.y;
          if (p.y>0.0) color=texture2D(up,uv); else color=texture2D(down,uv);
        } else {
          vec2 uv=0.5+0.5*vec2(-sign(p.z)*p.x,-p.y)/a.z;
          if (p.z>0.0) color=texture2D(back,uv);
          else color=texture2D(front,uv);
        }
        gl_FragColor=color;
      }`
  });
  const shell=new THREE.Mesh(geometry,material);
  shell.name='PalaceHall';
  return shell;
}

function createBedroom(THREE, photos) {
  const {halfWidth,front,back,floor,ceiling}=BEDROOM;
  const w=2*halfWidth,h=ceiling-floor,d=front+back;
  const geometry=new THREE.BoxGeometry(w,h,d);
  geometry.translate(0,(ceiling+floor)/2,(back-front)/2);
  const uniforms=Object.fromEntries(Object.entries(photos).map(([axis,photo])=>[axis,{value:photo}]));
  const mat=new THREE.ShaderMaterial({uniforms,side:THREE.BackSide,
    vertexShader:`
      varying vec3 point;
      void main() { point=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`
      varying vec3 point;
      uniform sampler2D front,back,left,right,up,down;
      void main() {
        vec3 p=point;
        if(p.z>${(BEDROOM.back-.006).toFixed(6)} && abs(p.x)<${DOOR.upper.half.toFixed(5)}
          && p.y>=${(BEDROOM.floor-.002).toFixed(5)} && p.y<${(BEDROOM.floor+DOOR.upper.height).toFixed(5)})discard;
        const float W=${w.toFixed(5)}, H=${h.toFixed(5)}, D=${d.toFixed(5)};
        const float top=${ceiling.toFixed(5)}, farWall=${front.toFixed(5)};
        const float nearWall=${back.toFixed(5)}, bottom=${floor.toFixed(5)};
        vec3 dist=vec3(abs(abs(p.x)-W*.5),min(abs(p.y-top),abs(p.y-bottom)),min(abs(p.z+farWall),abs(p.z-nearWall)));
        float v=(top-p.y)/H;
        if(dist.x<=dist.y&&dist.x<=dist.z) {
          if(p.x>0.0)gl_FragColor=texture2D(right,vec2((p.z+farWall)/D,v));
          else gl_FragColor=texture2D(left,vec2((nearWall-p.z)/D,v));
        } else if(dist.y<=dist.z) {
          vec2 uv=vec2(.5+p.x/W,(p.z+farWall)/D);
          if(p.y>0.5*(top+bottom))gl_FragColor=texture2D(up,uv);
          else gl_FragColor=texture2D(down,uv);
        } else {
          if(p.z>0.0)gl_FragColor=texture2D(back,vec2(.5-p.x/W,v));
          else gl_FragColor=texture2D(front,vec2(.5+p.x/W,v));
        }
      }`
  });
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.name='BedroomHall';mesh.visible=false;
  return mesh;
}

const vertexShader = `
varying mediump vec2 imageUV;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  imageUV = uv;
}`;
const fragmentShader = `
uniform sampler2D photo;
varying mediump vec2 imageUV;
void main() { gl_FragColor = texture2D(photo, imageUV); }`;

function createFollowCamera(THREE, furniture, bounds=hall) {
  const camera = new THREE.PerspectiveCamera(44, 1, 0.003, bounds===EXTERIOR_CAMERA ? 32 : farClip);
  camera.name = 'PlayerFollowCamera';
  camera.layers.enable(1);
  const target = new THREE.Vector3(), wallHit = new THREE.Vector3();
  const inset=0.024;
  const room = new THREE.Box3(
    new THREE.Vector3(-bounds.halfWidth+inset,bounds.floor+inset,-bounds.front+inset),
    new THREE.Vector3(bounds.halfWidth-inset,bounds.ceiling-inset,bounds.back-inset)
  );
  const furnitureBounds=new THREE.Box3();
  for (const part of furniture) furnitureBounds.expandByObject(part);
  const boundsHit = new THREE.Vector3();
  const probe = new THREE.Raycaster();
  const hits = [];
  let previousSide=null, bearingOffset=0;
  function clearance(yaw, elevation, distance) {
    const ray = probe.ray;
    ray.origin.copy(target);
    ray.direction.set(-Math.sin(yaw)*Math.cos(elevation), Math.sin(elevation), Math.cos(yaw)*Math.cos(elevation));
    if (ray.intersectBox(room, wallHit)) distance = Math.min(distance, target.distanceTo(wallHit));
    if (furnitureBounds.containsPoint(target) ||
        (ray.intersectBox(furnitureBounds,boundsHit) && target.distanceTo(boundsHit)<=distance+inset)) {
      probe.far = distance+0.022;
      hits.length = 0;
      probe.intersectObjects(furniture, false, hits);
      if (hits.length) distance = Math.min(distance, hits[0].distance-0.022);
    }
    return Math.max(0, distance);
  }
  return {
    camera,
    reset() { previousSide=null; },
    follow(player, yaw, pitch, front, distanceScale, seat, orbit, sleep=0) {
      const actor=player.actor;
      if (previousSide!==front) bearingOffset=-actor.rotation.y-yaw;
      previousSide=front;
      const heading=orbit ? -actor.rotation.y+orbit.yaw : yaw+bearingOffset;
      const followBearing=heading+(front?Math.PI:0);
      let bearing=followBearing;
      player.camera.getWorldPosition(target);
      const eyeHeight=0.19-.044*seat;
      if(sleep>0)target.lerp(new THREE.Vector3(actor.position.x,actor.position.y+.016,actor.position.z-.22),sleep);
      target.y-=eyeHeight*(1-sleep);
      target.x+=.026*seat*Math.sin(-actor.rotation.y);
      target.z-=.026*seat*Math.cos(-actor.rotation.y);
      const distance = Math.max(0.79, 0.41/camera.aspect)*distanceScale;
      // 기본 렌즈는 눈높이에 두고 드래그한 각도만큼 위·아래로 공전한다.
      const level=Math.asin(Math.min(1,eyeHeight/distance));
      const tilt=orbit ? orbit.pitch : -pitch;
      const pole=Math.PI/2-.012;
      let elevation=tilt>=0 ? level+(pole-level)*Math.min(1,tilt/(Math.PI/2))
                            : level+(pole+level)*Math.max(-1,tilt/(Math.PI/2));
      let length = clearance(bearing,elevation,distance);
      // 벽이나 등받이에 걸릴 때 사용자가 고른 높이에서 가까운 옆각을 먼저 찾는다.
      if (length<Math.min(distance,.43) && Math.abs(elevation)<1.1) {
        const sideLimit=seat ? 1.18 : 1.39;
        for (const offset of [.35,-.35,.7,-.7,1.05,-1.05,sideLimit,-sideLimit]) {
          const trialBearing=followBearing+offset;
          const free=clearance(trialBearing,elevation,distance);
          if (free>length+.018) {
            bearing=trialBearing;
            length=free;
          }
          if (length>=Math.min(distance,.52)) break;
        }
        // 높은 등받이가 양옆까지 가리면 어깨 너머로 볼 수 있는 가장 낮은 높이를 찾는다.
        if (seat && length<Math.min(distance,.52)) {
          const requested=elevation;
          for (const rise of [.25,.50,.75]) {
            const trialElevation=Math.min(pole,requested+rise*seat);
            for (const offset of [0,.9,-.9,1.09,-1.09]) {
              const trialBearing=followBearing+offset;
              const free=clearance(trialBearing,trialElevation,distance);
              if (free>length+.018) {
                bearing=trialBearing;
                elevation=trialElevation;
                length=free;
              }
              if (length>=Math.min(distance,.60)) break;
            }
            if (length>=Math.min(distance,.60)) break;
          }
        }
        length=clearance(bearing,elevation,distance);
      }
      probe.ray.at(length,camera.position);
      if(bounds===PASSAGE_CAMERA){
        const xyz=camera.position,z=-xyz.z;
        xyz.y=THREE.MathUtils.clamp(xyz.y,passageFloor(xyz.x,z)+.05,passageFloor(0,z)+PASSAGE.height-.11);
      }
      camera.lookAt(target);
    }
  };
}

export async function createPalaceRelief(canvas, makeRenderer) {
  const THREE = window.GoldFirePalaceThree;
  if (!THREE) throw Error('입체 엔진을 불러올 수 없습니다.');
  const renderer = makeRenderer ? makeRenderer({canvas}) :
    new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'low-power' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  const world = new THREE.Scene();
  const textures = new Set();
  let releasePlayer,royalPatrol;
  let closed = false;
  function release() {
    closed = true;
    royalPatrol?.dispose();
    world.traverse(object => {
      object.geometry?.dispose();
      if (!object.material) return;
      for (const material of [].concat(object.material)) {
        if (material.map) textures.add(material.map);
        material.dispose();
      }
    });
    releasePlayer?.();
    for (const texture of textures) texture.dispose();
    renderer.dispose();
  }
  try {
    if (!makeRenderer && !renderer.capabilities.isWebGL2 && !renderer.extensions.has('EXT_frag_depth')) {
      // 몸통 사진 안에서 실제 표면까지의 깊이를 쓸 수 없는 기기는 같은 단면을 소프트웨어로 그린다.
      throw Error('사진 표면의 깊이를 소프트웨어로 계산합니다.');
    }
    const loader = new THREE.TextureLoader();
    async function loadTexture(url) {
      const texture = await loader.loadAsync(url);
      if (closed) { texture.dispose(); throw Error('장면을 닫았습니다.'); }
      textures.add(texture);
      texture.flipY = false;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      return texture;
    }
    const roomFiles = {
      front: 'shell-front', right: 'shell-right', back: 'back',
      left: 'shell-left', up: 'up', down: 'down'
    };
    function palacePhoto(name) {
      return loadTexture(new URL('./img/palace/'+name+'.jpg?v=panoramic-hall',import.meta.url).href);
    }
    const loadRoom = Promise.all(Object.entries(roomFiles).map(async ([face,file])=>[face,await palacePhoto(file)]));
    const [entries,furnishing,player,stone,sky] = await Promise.all([
      loadRoom, palacePhoto('furnishing'), createPlayer(THREE,renderer,loadTexture), ...CASTLE_ASSETS.map(loadTexture)
    ]);
    releasePlayer=()=>player.release();
    const photos = Object.fromEntries(entries);
    const furniture = createThrone(THREE,()=>new THREE.ShaderMaterial({
      uniforms:{photo:{value:furnishing}},vertexShader,fragmentShader,side:THREE.DoubleSide
    }));
    const room=createHall(THREE,photos);
    const palaceGate=createPalaceGate(THREE,stone,{skyPhoto:sky});
    const passage=createPassage(THREE,stone,photos.back);
    world.add(passage.group);
    world.add(room,...furniture,palaceGate,player.actor);
    royalPatrol=await createRoyalPatrol(THREE,world);
    const palaceView=createFollowCamera(THREE,furniture), bedroomView=createFollowCamera(THREE,[],BEDROOM);
    let bedroom=null, bedroomLoad=null, bedParts=[], textiles=null, activePlace='palace';
    const exteriorView=createFollowCamera(THREE,[],EXTERIOR_CAMERA);
    const passageView=createFollowCamera(THREE,[],PASSAGE_CAMERA);
    let castle=null;
    function changePlace(place) {
      activePlace=place;
      if(isCastle(place)) {
        if(!castle){
          castle=createCloudCastle(THREE,stone,sky,photos.front);
          world.add(castle);
        }
        return;
      }
      if(place!=='bedroom'&&place!=='passage')return;
      if(!bedroomLoad) bedroomLoad=Promise.all([
        Promise.all(Object.keys(BEDROOM_SURFACES).map(async axis=>[axis,await loadTexture(bedroomSurface(axis))])),
        loadTexture(BED_IMAGE),
        Promise.all(TEXTILE_ASSETS.map(loadTexture))
      ]).then(([entries,bedPhoto,clothPhotos])=>{
        if(closed)return;
        const bedroomPhotos=Object.fromEntries(entries);
        bedroom=createBedroom(THREE,bedroomPhotos);
        passage.upstairsPhoto(bedroomPhotos.front);
        bedParts=createBed(THREE,bedPhoto);
        textiles=createBedroomTextiles(THREE,clothPhotos);
        world.add(bedroom,...bedParts,...textiles.pieces);
      }).catch(e=>{bedroomLoad=null;throw e;});
      return bedroomLoad;
    }
    return {
      release, changePlace,
      npcCadence:makeRenderer?105:40,
      get npcHeads(){return royalPatrol.heads;},
      get settling() { return player.settling; },
      get headingYaw() { return -player.actor.rotation.y; },
      draw(w, h, focal, yaw, pitch, leanX, leanY, floorX = 0, floorZ = entranceZ, gait, thirdPerson = false, front = false, distanceScale = 1, orbit) {
        if (!w || !h || renderer.getContext().isContextLost()) return false;
        const inBedroom=activePlace==='bedroom';
        const outside=isCastle(activePlace), inPassage=activePlace==='passage';
        if((inBedroom&&!bedroom)||(outside&&!castle))return false;
        room.visible=palaceGate.visible=activePlace==='palace';
        const entryAmount=gait?.mainEntry||0;
        if(room.visible)palaceGate.userData.setOpen(entryAmount);
        if(outside)castle.getObjectByName('CourtyardMainGate').userData.setOpen(entryAmount);
        passage.set(activePlace,gait?.doors??{lower:0,upper:0});
        if(bedroom)bedroom.visible=inBedroom;
        if(castle)castle.visible=outside;
        world.userData.activeRoom=activePlace;
        for(const item of furniture)item.visible=room.visible;
        for(const item of bedParts)item.visible=inBedroom;
        if(textiles){
          for(const item of textiles.pieces)item.visible=inBedroom;
          if(inBedroom)textiles.set(gait?.curtainAmount||0);
        }
        const followView=outside?exteriorView:inBedroom?bedroomView:inPassage?passageView:palaceView;
        const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3000000 / (w * h)));
        const width = Math.max(1, Math.round(w * ratio)), height = Math.max(1, Math.round(h * ratio));
        if (canvas.width !== width || canvas.height !== height) renderer.setSize(width, height, false);
        const camera = thirdPerson ? followView.camera : player.camera;
        const fov = thirdPerson ? followView.camera.fov : THREE.MathUtils.radToDeg(2 * Math.atan(h / (2 * focal)));
        const far=outside?32:farClip;
        if (camera.fov !== fov || camera.aspect !== w / h || camera.far!==far) {
          camera.far=far;
          camera.fov = fov;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        player.pose(yaw, pitch, leanX, leanY, floorX, floorZ, gait, thirdPerson);
        if (thirdPerson) followView.follow(player,yaw,pitch,front,distanceScale,gait?.seatAmount || 0,orbit,gait?.sleepAmount || 0);
        else followView.reset();
        royalPatrol.pose(activePlace,floorX,floorZ,gait,camera);
        renderer.render(world, camera);
        return !renderer.getContext().isContextLost();
      }
    };
  } catch (error) {
    release();
    throw error;
  }
}
