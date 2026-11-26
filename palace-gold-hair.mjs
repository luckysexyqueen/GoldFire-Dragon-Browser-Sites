const clamp=x=>Math.max(0,Math.min(1,x));
function ramp(a,b,x) {const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
function fringeLine(x) {
  // The central fringe ends above the eyes; skin, red irises and lashes stay in the original atlas.
  const samples=[[.00,.392],[.12,.480],[.27,.507],[.50,.480],[.72,.474],[.87,.491],[1,.419]];
  for(let i=1;i<samples.length;i++){
    const [b,y]=samples[i],[a,z]=samples[i-1];
    if(x<=b)return z+(y-z)*(x-a)/(b-a);
  }
  return 0;
}
export function goldTones(r,g,b,t=1) {
  const lum=.42*r+.43*g+.15*b;
  if(lum<7 || !t)return [r,g,b];
  // A violet shadow should become darker gold, not an extra yellow highlight.
  const chroma=1-clamp((lum-176)/98);
  const light=ramp(15,175,lum),glint=ramp(155,237,lum);
  const R=Math.min(255,lum*(1.32+.16*light)+2);
  const G=Math.min(255,lum*(.99+.21*light)+1);
  const B=Math.min(255,lum*(.40+.42*glint)+1);
  const w=t*(.84+.12*chroma);
  return [r+(R-r)*w,g+(G-g)*w,b+(B-b)*w];
}
export function goldHairTexture(texture,rects) {
  if(!texture?.image)return texture;
  const src=texture.image,canvas=document.createElement('canvas');
  canvas.width=src.width;canvas.height=src.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return texture;
  ctx.drawImage(src,0,0);
  for(const [u,v,w,h,kind] of rects) {
    const W=canvas.width,H=canvas.height;
    const x=Math.max(0,Math.round(u*W)),y=Math.max(0,Math.round(v*H));
    const rw=Math.min(W-x,Math.round(w*W)),rh=Math.min(H-y,Math.round(h*H));
    if(rw<1||rh<1)continue;
    const patch=ctx.getImageData(x,y,rw,rh),data=patch.data;
    for(let j=0;j<rh;j++)for(let k=0;k<rw;k++){
      const i=(j*rw+k)*4, R=data[i],G=data[i+1],B=data[i+2];
      if(data[i+3]<16)continue;
      const warm=ramp(2,17,R-B)*ramp(1,12,G-B);
      let weight=1;
      if(kind==='warm')weight=warm;
      if(kind==='fringe'){
        const tx=(k+.5)/rw,ty=(j+.5)/rh;
        // Soften at the fringe outline rather than changing any skin below it.
        const line=fringeLine(tx);
        weight=(1-ramp(line-.013,line+.008,ty))*(.84+.16*warm);
      }
      if(weight<.006)continue;
      const [r,g,b]=goldTones(R,G,B,weight);
      data[i]=r;data[i+1]=g;data[i+2]=b;
    }
    ctx.putImageData(patch,x,y);
  }
  const out=texture.clone();
  if(out.source&&typeof out.source.constructor==='function')out.source=new out.source.constructor(canvas);
  else out.image=canvas;
  out.needsUpdate=true;
  return out;
}
