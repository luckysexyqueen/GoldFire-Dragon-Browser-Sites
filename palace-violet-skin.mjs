function ramp(lo,hi,x) {
  const t=Math.min(1,Math.max(0,(x-lo)/(hi-lo)));
  return t*t*(3-2*t);
}

// 원본의 유리질 보라색은 유지하고 작은 얼룩과 채널별로 튀는 하이라이트만 누른다.
export function violetTexture(texture, amount=1) {
  if (!texture?.image) return texture;
  const src=texture.image;
  const canvas=document.createElement('canvas'), smooth=document.createElement('canvas');
  canvas.width=smooth.width=src.width;
  canvas.height=smooth.height=src.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const soften=smooth.getContext('2d',{willReadFrequently:true});
  if(!ctx||!soften)return texture;
  ctx.drawImage(src,0,0);
  const result=ctx.getImageData(0,0,canvas.width,canvas.height);
  const a=result.data;
  // 알파가 있는 사진 가장자리와 아틀라스 내부의 검은 빈칸을 평균에 섞지 않는다.
  const filtered=soften.createImageData(canvas.width,canvas.height);
  for(let i=0;i<a.length;i+=4) {
    const r=a[i],g=a[i+1],blue=a[i+2];
    filtered.data[i]=r;filtered.data[i+1]=g;filtered.data[i+2]=blue;
    const signal=blue>=g*.94 && blue>=r*.69 ? ramp(9,23,Math.max(r,g,blue)) : 0;
    filtered.data[i+3]=Math.round(a[i+3]*signal);
  }
  soften.putImageData(filtered,0,0);
  const fineRadius=Math.max(.95,src.width*.0018);
  const pad=document.createElement('canvas');
  pad.width=src.width;pad.height=src.height;
  const field=pad.getContext('2d',{willReadFrequently:true});
  if(!field)return texture;
  function readBlur(radius){
    field.clearRect(0,0,pad.width,pad.height);
    field.filter='blur('+radius+'px)';
    field.drawImage(smooth,0,0);
    return field.getImageData(0,0,pad.width,pad.height).data;
  }
  const fine=readBlur(fineRadius), broad=readBlur(fineRadius*3.0);
  pad.width=pad.height=1;
  for(let i=0;i<a.length;i+=4) {
    const r=a[i],g=a[i+1],blue=a[i+2], peak=Math.max(r,g,blue);
    if(a[i+3]<24||peak<12||blue<g*.94||blue<r*.69)continue;
    const blur=fine[i+2],wide=broad[i+2];
    const valid=ramp(145,245,fine[i+3]),wideValid=ramp(150,248,broad[i+3]);
    const fineDetail=Math.abs(blue-blur), balance=Math.abs(blur-wide);
    // 피부 결에 해당하는 미세 얼룩과 작게 뭉친 어두운 점은 완화한다.
    // 넓은 조명과 반사 중심은 남기고 복근처럼 실제 형태에 있는 굵은 선은 낮은 강도로만 보정한다.
    const broadLight=ramp(109,200,blur);
    const highlight=ramp(35,102,peak-Math.max(fine[i],fine[i+1],blur))*ramp(159,241,peak);
    const edge=ramp(20,70,fineDetail);
    const fineMix=amount*valid*(.76-.43*edge-.29*highlight);
    const broadMix=amount*wideValid*(.44-.20*broadLight)*(1-.74*ramp(17,64,balance))*(1-.83*highlight);
    const chroma=amount*.28*(1-ramp(32,130,blue));
    const b=blue+fineMix*(blur-blue)+broadMix*(wide-blur);
    const rr=r+fineMix*(fine[i]-r)+broadMix*(broad[i]-fine[i]);
    const gg=g+fineMix*(fine[i+1]-g)+broadMix*(broad[i+1]-fine[i+1]);
    a[i]=rr+(b*.59+3-rr)*chroma+2.2*highlight;
    a[i+1]=gg+(b*.40+2-gg)*chroma;
    a[i+2]=b+4.4*highlight;
  }
  ctx.putImageData(result,0,0);
  smooth.width=smooth.height=1;
  const out=texture.clone();
  // Texture.clone shares its source on some Three versions; keep head textures separate.
  if(out.source && typeof out.source.constructor==='function') out.source=new out.source.constructor(canvas);
  else out.image=canvas;
  out.userData={...out.userData,violetSkin:true};
  out.needsUpdate=true;
  return out;
}
