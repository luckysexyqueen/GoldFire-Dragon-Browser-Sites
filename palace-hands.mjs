import { violetTexture } from './palace-violet-skin.mjs?v=even-violet';
import { createPhotoSurfaceMaterial } from './palace-photo-surface.mjs';

const cutY = .840;
const wristX = .3568;
const wristZ = -.0682;

function readHand(bytes) {
  if (bytes.byteLength<8) throw Error('손 이미지의 입체 좌표를 읽을 수 없습니다.');
  const header=new DataView(bytes);
  const count=header.getUint32(0,true), faces=header.getUint32(4,true);
  if (!count || count>32767 || !faces || bytes.byteLength!==8+6*count+6*faces) {
    throw Error('손 이미지의 입체 좌표를 읽을 수 없습니다.');
  }
  const points=new Int16Array(bytes,8,3*count);
  const indices=new Uint16Array(bytes,8+6*count,3*faces);
  return {points,indices,count};
}

function handGeometry(THREE,{points,indices,count},side) {
  const sign=side==='Right'?1:-1;
  const positions=new Float32Array(3*count);
  const normals=new Float32Array(3*count);
  for (let i=0;i<positions.length;i++) positions[i]=points[i]*.00001*(i%3===0?sign:1);
  const faceSide=new Uint8Array(indices.length/3);
  for (let f=0;f<indices.length;f+=3) {
    const a=3*indices[f],b=3*indices[f+1],c=3*indices[f+2];
    const bx=positions[b]-positions[a],by=positions[b+1]-positions[a+1],bz=positions[b+2]-positions[a+2];
    const cx=positions[c]-positions[a],cy=positions[c+1]-positions[a+1],cz=positions[c+2]-positions[a+2];
    const nx=sign*(by*cz-bz*cy),ny=sign*(bz*cx-bx*cz),nz=sign*(bx*cy-by*cx);
    faceSide[f/3]=sign*nx<0?1:0;
    for (const p of [a,b,c]) {
      normals[p]+=nx; normals[p+1]+=ny; normals[p+2]+=nz;
    }
  }
  // 같은 표면 정점의 법선을 공유한 뒤 손등과 손바닥의 사진 좌표만 나눈다.
  const pos=[],norm=[],uv=[],faces=[],map=new Map();
  for (let f=0;f<indices.length;f+=3) {
    const panel=faceSide[f/3];
    for (const j of (sign>0?[0,1,2]:[0,2,1])) {
      const i=indices[f+j], key=i+count*panel;
      if (!map.has(key)) {
        map.set(key,pos.length/3);
        const at=3*i,x=positions[at],y=positions[at+1],z=positions[at+2];
        const nx=normals[at],ny=normals[at+1],nz=normals[at+2],length=Math.hypot(nx,ny,nz)||1;
        pos.push(x,y,z); norm.push(nx/length,ny/length,nz/length);
        const u=Math.min(.997,Math.max(.003,(z+wristZ+.163)/.159));
        const v=Math.min(.997,Math.max(.003,(y+cutY-.653)/.212));
        uv.push(.5*(panel+u),.5*((sign>0?0:1)+v));
      }
      faces.push(map.get(key));
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(faces);
  geometry.computeBoundingSphere();
  return geometry;
}

export async function loadHands(THREE,loadTexture) {
  const url=name=>new URL('./img/player/'+name+'?v=digits',import.meta.url).href;
  const [shape,photo]=await Promise.all([
    fetch(url('hands-shape.bin')).then(response=>{
      if (!response.ok) throw Error('손가락의 깊이 정보를 불러올 수 없습니다.');
      return response.arrayBuffer();
    }).then(readHand),
    loadTexture(url('hands-color.webp'))
  ]);
  const finish=violetTexture(photo,.91);
  const material=createPhotoSurfaceMaterial(THREE,finish);
  const limbs=[];
  return {
    cutY,
    release() { if(finish!==photo)finish.dispose(); },
    attach(rig,bones) {
      for (const side of ['Right','Left']) {
        const sign=side==='Right'?1:-1;
        const elbow=rig[side+'Elbow'], shoulder=rig[side+'Shoulder'];
        const wrist=new THREE.Group();
        wrist.name=side+'Wrist';
        wrist.position.set(sign*wristX,cutY,wristZ).sub(new THREE.Vector3().fromArray(bones[side+'Elbow']));
        const mesh=new THREE.Mesh(handGeometry(THREE,shape,side),material);
        mesh.name=side+'Hand';
        wrist.add(mesh);
        elbow.add(wrist);
        rig[wrist.name]=wrist;
        limbs.push({sign,shoulder,elbow,wrist});
      }
    },
    pose(gait,seat) {
      const step=gait?.moving && !gait.seatActive ? Math.sin(gait.distance*2*Math.PI/.31) : 0;
      for (const {sign,shoulder,elbow,wrist} of limbs) {
        const swing=sign*step*(gait?.forward||0);
        // 손을 체형 바깥에 두고 옆걸음의 안쪽 회전만 작게 제한한다.
        const baseZ=sign*.09*step*(gait?.side||0);
        const clearance=.087+.017*Math.abs(baseZ/.09)+.006*seat;
        shoulder.rotation.z=sign*clearance+.32*baseZ;
        elbow.rotation.z=sign*(.072-.019*seat);
        wrist.rotation.set(.045*swing-.10*seat,sign*(.07+.06*seat),-sign*(.05-.02*seat));
      }
    }
  };
}
