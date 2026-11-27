import { softMotion } from './palace-soft-body.mjs?v=strong-motion';
import { loadVolumeImages } from './palace-volume-images.mjs?v=axilla';

export async function loadHipImages(loadTexture) {
  const images=await loadVolumeImages(loadTexture,'hips','round-hips',{RightSeat:'Body',LeftSeat:'Body'});
  if (!Number.isFinite(images.data.bottom)) throw Error('골반 높이를 읽을 수 없습니다.');
  return images;
}


export function hipMotion(volumes,bottom) {
  const sides=volumes.map(mesh=>({mesh,center:mesh.position.clone(),size:mesh.scale.clone()}));
  return softMotion('hips',(i,bounce,lag,seat)=>{
    const {mesh,center,size}=sides[i];
    const stretch=(1-.10*seat)*(1+.092*bounce*(1-.76*seat));
    const radial=1/Math.sqrt(stretch);
    mesh.scale.set(size.x*radial,size.y*stretch,size.z*radial);
    mesh.material.uniforms.extents.value.copy(mesh.scale);
    mesh.position.set(center.x+Math.sign(center.x)*.009*bounce*(1-seat),bottom+(center.y-bottom)*stretch+.033*bounce,
                      center.z+.031*lag*(1-.58*seat));
  });
}
