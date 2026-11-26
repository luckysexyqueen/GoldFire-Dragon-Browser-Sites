// 색·깊이·사진 좌표가 모두 준비된 뒤 한 세트로 장면에 연결한다.
export async function loadVolumeImages(loadTexture, name, version, partBones) {
  const url=file=>new URL('./img/player/'+name+'-'+file+'?v='+version,import.meta.url).href;
  const regions=fetch(url('regions.json')).then(response=>{
    if (!response.ok) throw Error('아바타 사진 좌표를 읽을 수 없습니다.');
    return response.json();
  });
  const [data,color,depth]=await Promise.all([regions,loadTexture(url('color.webp')),loadTexture(url('depth.png'))]);
  const expected=Object.entries(partBones);
  if (!data.size?.every(n=>Number.isFinite(n) && n>0) || data.size.length!==2 ||
      data.parts?.length!==expected.length || !expected.every(([name,bone])=>data.parts.some(part=>
        part.name===name && part.bone===bone && part.rect?.length===4 && part.trunkProfile?.length===4 &&
        part.frontTransform?.length===4 && part.low?.length===3 && part.high?.length===3 &&
        part.high.every((n,i)=>Number.isFinite(n) && n>part.low[i]) &&
        (bone==='Body' || (data.bones?.[bone]?.length===3 && data.bones[bone].every(Number.isFinite)))))) {
    throw Error('아바타의 사진 단면 좌표가 올바르지 않습니다.');
  }
  return {data,color,depth};
}
