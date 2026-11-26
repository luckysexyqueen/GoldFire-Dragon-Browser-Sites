import { violetTexture } from './palace-violet-skin.mjs?v=even-violet';
import { createPhotoSurfaceMaterial } from './palace-photo-surface.mjs';

// 양발은 같은 해부학적 단면을 사용하고 각자 원본 사진에서 가져온 색상을 쓴다.
export async function loadFeet(THREE,loadTexture) {
  const asset=name=>new URL('./img/player/'+name+'?v=whole-feet',import.meta.url).href;
  const shape=fetch(asset('feet-shape.bin')).then(response=>{
    if (!response.ok) throw Error('발가락의 깊이를 불러올 수 없습니다.');
    return response.arrayBuffer();
  });
  const [buffer,photo]=await Promise.all([shape,loadTexture(asset('feet-color.webp'))]);
  const header=new DataView(buffer);
  const count=header.getUint32(0,true), length=header.getUint32(4,true);
  const uvStart=8+9*count+(count%2);
  if (!count || count>65535 || !length || length%3 || buffer.byteLength!==uvStart+4*count+2*length) {
    throw Error('발 표면 이미지의 크기가 일치하지 않습니다.');
  }
  const positions=new Int16Array(buffer,8,3*count);
  const normals=new Int8Array(buffer,8+6*count,3*count);
  const coords=new Uint16Array(buffer,uvStart,2*count);
  const indices=new Uint16Array(buffer,uvStart+4*count,length);
  const finish=violetTexture(photo,.91);
  const material=createPhotoSurfaceMaterial(THREE,finish);
  const feet={release() { if(finish!==photo)finish.dispose(); }};
  for (const side of ['Right','Left']) {
    const left=side==='Left', sign=left?-1:1;
    const geo=new THREE.BufferGeometry();
    const p=Float32Array.from(positions,(v,i)=>{
      if (i%3===0) return sign*v/100000;
      return v/100000;
    });
    const n=Float32Array.from(normals,(v,i)=>(i%3===0?sign:1)*v/127);
    const uv=Float32Array.from(coords,(v,i)=>v/65535+(left && i%2===1?.5:0));
    const face=indices.slice();
    if (left) for (let i=0;i<length;i+=3) [face[i+1],face[i+2]]=[face[i+2],face[i+1]];
    geo.setAttribute('position',new THREE.BufferAttribute(p,3));
    geo.setAttribute('normal',new THREE.BufferAttribute(n,3));
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geo.setIndex(new THREE.BufferAttribute(face,1));
    geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);
    mesh.name=side+'Foot-'+side+'Ankle';
    feet[side]=mesh;
  }
  return feet;
}
