import { goldHairTexture } from './palace-gold-hair.mjs?v=bright-gold';
import { createPhotoSurfaceMaterial } from './palace-photo-surface.mjs?v=bright-gold';

// 정수리부터 등까지 이어지는 머릿결의 단면과 원본 사진 좌표를 함께 읽는다.
function hairGeometry(THREE, bytes) {
  const counts = new DataView(bytes);
  const vertices = counts.getUint32(0, true);
  const indices = counts.getUint32(4, true);
  if (!vertices || vertices > 65535 || !indices || indices%3 || bytes.byteLength !== 8+vertices*32+indices*2) {
    throw Error('뒷머리 이미지의 입체 좌표를 읽을 수 없습니다.');
  }
  const geo = new THREE.BufferGeometry();
  let offset = 8;
  for (const [name, size] of [['position',3], ['normal',3], ['uv',2]]) {
    const values = new Float32Array(bytes,offset,vertices*size);
    geo.setAttribute(name,new THREE.BufferAttribute(values,size));
    offset += values.byteLength;
  }
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes,offset,indices),1));
  geo.computeBoundingSphere();
  return geo;
}

export async function loadBackHair(THREE, loadTexture) {
  const url = file => new URL('./img/player/'+file+'?v=seamless-hime',import.meta.url).href;
  const shape = fetch(url('hair-shape.bin')).then(response => {
    if (!response.ok) throw Error('뒷머리의 깊이 정보를 불러올 수 없습니다.');
    return response.arrayBuffer();
  });
  const [bytes,photo] = await Promise.all([shape,loadTexture(url('hair-color.webp'))]);
  const geometry = hairGeometry(THREE,bytes);
  const gold=goldHairTexture(photo,[[0,0,1,1,'full']]);
  const material = createPhotoSurfaceMaterial(THREE,gold,1);
  const hair = new THREE.Mesh(geometry,material);
  hair.name = 'Hair-Head';
  hair.userData.releaseGold=()=>{if(gold!==photo)gold.dispose();};
  hair.layers.set(1);
  return hair;
}
