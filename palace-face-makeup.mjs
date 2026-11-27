const clamp=value=>Math.min(1,Math.max(0,value));
const smooth=(lo,hi,n)=>{
  const t=clamp((n-lo)/(hi-lo));return t*t*(3-2*t);
};
const lipOutline=[
 [87,192,192,192,192],[90,189.8,194.7,191.6,192.7],
 [94,187.6,197.0,190.4,193.8],[98,186.3,198.1,190.1,194.4],
 [102,187.0,198.8,190.5,194.6],[106,186.4,198.1,190.2,194.25],
 [110,187.5,196.9,190.7,193.6],[114,190.3,194.4,191.6,192.8],
 [116,192,192,192,192]
];
function section(x) {
  for(let i=1;i<lipOutline.length;i++){
    const a=lipOutline[i-1],b=lipOutline[i];
    if(x<=b[0]){
      const t=(x-a[0])/(b[0]-a[0]);
      return a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);
    }
  }
  return [192,192,192,192];
}
export function makeupPixel(r,g,b,x,y) {
  // 얼굴 사진에만 바르는 얇고 수평인 콧등·볼 홍조. 눈·입·머릿결은 선택 밖이다.
  if(y>=157&&y<=184&&x>=43&&x<=153){
    const skin=smooth(3,17,b-r)*smooth(2,12,b-g);
    const band=smooth(43,54,x)*(1-smooth(143,153,x))*
      smooth(157,165,y)*(1-smooth(174,184,y));
    const gloss=smooth(65,200,Math.max(r,g,b));
    const mix=.72*band*skin*(1-.82*gloss);
    if(mix>0)return [r+(131+.14*b-r)*mix,g+(31+.15*g-g)*mix,b+(69+.15*b-b)*mix];
  }
  // 실제 입술의 바깥 윤곽과 입 안쪽을 분리해 입 모양과 기존 광택을 보존한다.
  if(x<87||x>116||y<185||y>200)return null;
  const [upper,lower,insideTop,insideBottom]=section(x);
  const hull=smooth(upper-.65,upper+1.0,y)*(1-smooth(lower-.9,lower+.65,y));
  const mouth=smooth(insideTop-.34,insideTop+.56,y)*(1-smooth(insideBottom-.45,insideBottom+.44,y));
  const t=clamp(hull*(1-mouth)*.95);
  if(t<=0)return null;
  const shine=.22*smooth(42,142,Math.max(r,g,b))+
    .18*Math.exp(-((x-103)**2)/33-((y-196.1)**2)/1.6);
  return [r+(36+96*shine-r)*t,g+(86+132*shine-g)*t,b+(16+69*shine-b)*t];
}
export function paintFaceMakeup(texture,rect) {
  if(!rect||typeof texture?.image?.getContext!=='function')return;
  const c=texture.image,ctx=c.getContext('2d');
  const [x,y,w,h]=rect.map((v,i)=>Math.round(v*(i%2===0?c.width:c.height)));
  if(!ctx||w<1||h<1)return;
  const photo=ctx.getImageData(x,y,w,h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const k=4*(j*w+i);
    const result=makeupPixel(photo.data[k],photo.data[k+1],photo.data[k+2],(i+.5)*197/w,(j+.5)*251/h);
    if(result){photo.data[k]=result[0];photo.data[k+1]=result[1];photo.data[k+2]=result[2];}
  }
  ctx.putImageData(photo,x,y);
  texture.needsUpdate=true;
}
