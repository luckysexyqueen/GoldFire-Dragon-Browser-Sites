import { DOOR } from './palace-passage.mjs?v=upper-door';
import { isCastle, isInsideEntry, castleSkyUV } from './palace-castle.mjs?v=main-entry';
import { BEDROOM } from './palace-locations.mjs?v=canopy-room';
import { chestOffset, chestVertical } from './palace-soft-body.mjs?v=strong-motion';
import { hall, entranceZ } from './palace-floor.mjs';
import { createPalaceRelief } from './palace-relief.mjs?v=patrol-paths';

const clamp = (n,lo,hi) => Math.min(hi,Math.max(lo,n));
function smooth(a,b,x) {
  const t=clamp((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
}
function depthByte(bytes,index,residual) {
  return bytes[index]+(residual ? bytes[index+residual]/255-.5 : 0);
}

// 움직이는 동안에도 사진에 기록된 윤곽의 양 끝에서 앞면과 뒷면이 둥글게 만난다.
function bodySurfaces(uniforms, read) {
  const param = name => uniforms[name].value;
  const depth = read(param('thickness'));
  const residual = 4*Math.round(param('depthResidualX')*depth.w);
  const rect = param('rect'), section = param('verticalRange'), profile = param('profileRect');
  const size = param('extents');
  const roundedJoin = param('shoulderOrigin').y>0;
  const wholeTrunk = roundedJoin && param('coreFlank')>0;
  // 드래그·보행 중 간이 표면에서도 어깨 곡선에 여러 단면을 둔다.
  const rings = clamp(Math.ceil(size.y * (roundedJoin ? 116 : 78)), 10, wholeTrunk ? 96 : roundedJoin ? 76 : 64);
  const around = wholeTrunk ? 112 : roundedJoin ? 56 : 40;
  const left = Math.ceil(rect.x * depth.w - .5);
  const right = Math.floor((rect.x + rect.z) * depth.w - .5);
  const strips = [];
  for (let j = 0; j <= rings; j++) {
    const y = j / rings;
    const v = rect.y + rect.w * (1-section.x-y*section.y);
    const row = clamp(Math.floor(v*depth.h), 0, depth.h-1) * depth.w;
    let a = left, b = right;
    while (a <= b && depth.bytes[4*(row+a)+2] < 122) a++;
    while (b >= a && depth.bytes[4*(row+b)+2] < 122) b--;
    if (a > b) continue;
    const ring = [];
    for (let k = 0; k < around; k++) {
      const angle = 2*Math.PI*k/around;
      let fraction=.5-.5*Math.cos(angle);
      if (wholeTrunk) {
        // 양 가슴과 갈비뼈를 한 단면으로 그리되 흉골 중앙에도 충분한 표본을 둔다.
        const across=1-Math.abs(1-2*k/around);
        fraction=across-.75*Math.sin(4*Math.PI*across)/(4*Math.PI);
      }
      const column = a + (b-a)*fraction;
      const uv = (column+.5)/depth.w;
      const sample = roundedJoin ? Math.floor(column) : Math.round(column);
      const pos = 4*(row+sample), nextPos = 4*(row+Math.min(b,sample+1));
      const blend = roundedJoin ? column-sample : 0;
      const firstNear=depthByte(depth.bytes,pos,residual), firstFar=depthByte(depth.bytes,pos+1,residual);
      const near = (firstNear+blend*(depthByte(depth.bytes,nextPos,residual)-firstNear))/255;
      const far = (firstFar+blend*(depthByte(depth.bytes,nextPos+1,residual)-firstFar))/255;
      const seam = k === 0 || k === around/2;
      const z = seam ? (near+far)*.5 : k < around/2 ? far : near;
      ring.push([1-(uv-rect.x)/rect.z-.5,y-.5,z-.5,uv,v,seam?0:k>=around/2?1:0]);
    }
    strips.push(ring);
  }
  if (!strips.length) return [];
  const textures = ['frontPhoto','backPhoto','profilePhotos'].map(key=>read(param(key)));
  const batches = textures.map(() => ({points:[],indices:[]}));
  const frontUV=param('frontTransform');
  function add(vertex, side, front) {
    if (side === 0) {
      if (!front) return vertex;
      const [x,y,z,u,v,spring]=vertex;
      return [x,y,z,frontUV.x+u*frontUV.z,frontUV.y+v*frontUV.w,spring];
    }
    const [x,y,z,,,spring] = vertex;
    const u = (clamp(profile.x+(z+.5)*profile.z,.0005,.9995)+(side<0?1:0))*.5;
    return [x,y,z,u,profile.y+(y+.5)*profile.w,spring];
  }
  for (let k = 0; k < around; k++) {
    const next = (k+1)%around, nx = Math.cos(2*Math.PI*(k+.5)/around);
    const side = Math.abs(nx) > .80 ? Math.sign(nx) : 0;
    const out = batches[side ? 2 : k < around/2 ? 1 : 0];
    const start = out.points.length;
    for (const ring of strips) out.points.push(add(ring[k],side,k>=around/2),add(ring[next],side,k>=around/2));
    for (let j = 1; j < strips.length; j++) {
      const i = start+2*(j-1);
      out.indices.push(i,i+1,i+3,i,i+3,i+2);
    }
  }
  // 분할된 관절의 절단면도 닫아 팔꿈치나 무릎을 굽혔을 때 속이 비지 않게 한다.
  const cap = batches[2];
  for (const ring of [strips[0],strips[strips.length-1]]) {
    for (let k = 1; k < around-1; k++) {
      const side = k < around/4 || k > 3*around/4 ? 1 : -1;
      const i = cap.points.length;
      cap.points.push(add(ring[0],side),add(ring[k],side),add(ring[k+1],side));
      cap.indices.push(i,i+1,i+2);
    }
  }
  return batches.map((b,i)=>{
    const shape=batch(b.points,b.indices,textures[i]);
    if(wholeTrunk)shape.spring={origin:param('shoulderOrigin'),size,spring:param('chestSpring'),lift:param('chestLift')};
    return shape;
  });
}

function batch(points,indices,texture) {
  const vertices=points.map(([x,y,z,u,v,spring=0])=>({x,y,z,u,v,spring,vx:0,vy:0,w:0,sx:0,sy:0,q:0,uq:0,vq:0}));
  return {vertices, indices, texture};
}

function surface(geometry,texture,hairSheen,goldShine=0) {
  const pos=geometry.attributes.position, uv=geometry.attributes.uv;
  if (hairSheen) {
    const points=Array.from({length:pos.count},(_,i)=>[pos.getX(i),pos.getY(i),pos.getZ(i),uv.getX(i),uv.getY(i)]);
    const result=batch(points,geometry.index.array,texture);
    result.normals=geometry.attributes.normal.array;
    result.goldShine=goldShine;
    return result;
  }
  const points=[], indices=[], seen=new Map();
  for (let i=0;i<(geometry.index?.count??pos.count);i++) {
    const k=geometry.index?geometry.index.getX(i):i;
    const row=[pos.getX(k),pos.getY(k),pos.getZ(k),uv.getX(k),uv.getY(k)];
    const key=row.join(',');
    if (!seen.has(key)) {seen.set(key,points.length);points.push(row);}
    indices.push(seen.get(key));
  }
  return batch(points,indices,texture);
}

function pixelIndex(tex,u,v) {
  return clamp((u*tex.w)|0,0,tex.w-1)+clamp((v*tex.h)|0,0,tex.h-1)*tex.w;
}

// 피부 사진은 단면의 사선에서 인접 화소를 섞어 모자이크 같은 경계를 줄인다.
function skinSample(tex,u,v,target) {
  const x=clamp(u*tex.w-.5,0,tex.w-1),y=clamp(v*tex.h-.5,0,tex.h-1);
  const i=x|0,j=y|0,a=x-i,b=y-j;
  const p=4*(j*tex.w+i),q=p+(i+1<tex.w?4:0),r=p+(j+1<tex.h?4*tex.w:0),s=r+q-p;
  const data=tex.bytes;
  for(let c=0;c<3;c++) target[c]=(data[p+c]*(1-a)+data[q+c]*a)*(1-b)+(data[r+c]*(1-a)+data[s+c]*a)*b;
}

function paintRoom(buffer,depth,width,height,camera,faces) {
  const m=camera.matrixWorld.elements, p=camera.projectionMatrix.elements;
  const x=m[12],y=m[13],z=m[14];
  const step=2/(width*p[0]), ax=m[0]*step,ay=m[1]*step,az=m[2]*step;
  const firstX=(1/width-1)/p[0];
  for (let j=0;j<height;j++) {
    const cy=(1-(2*j+1)/height)/p[5];
    let rx=firstX*m[0]+cy*m[4]-m[8], ry=firstX*m[1]+cy*m[5]-m[9], rz=firstX*m[2]+cy*m[6]-m[10];
    for (let i=0;i<width;i++,rx+=ax,ry+=ay,rz+=az) {
      const tx=rx===0?Infinity:((rx>0?hall.halfWidth:-hall.halfWidth)-x)/rx;
      const ty=ry===0?Infinity:((ry>0?hall.ceiling:hall.floor)-y)/ry;
      const tz=rz===0?Infinity:((rz>0?hall.back:-hall.front)-z)/rz;
      const dist=Math.min(tx,ty,tz);
      const px=x+rx*dist,py=y+ry*dist,pz=z+rz*dist+entranceZ;
      const k=j*width+i;
      if(tz<=tx&&tz<=ty&&rz>0&&isInsideEntry(px,py)){
        buffer[k]=0xff403049;continue;
      }
      if(tz<=tx&&tz<=ty&&rz<0&&Math.abs(px)<DOOR.lower.half&&py>=hall.floor&&py<hall.floor+DOOR.lower.height){
        buffer[k]=0xff2a1820;continue;
      }
      if(dist>0)depth[k]=1/dist;
      const sx=Math.abs(px),sy=Math.abs(py),sz=Math.abs(pz);
      let tex,u,v;
      if (sx>=sy && sx>=sz) {
        tex=px>0?faces.right:faces.left;u=(px>0?pz:-pz)/sx;v=-py/sx;
      } else if (sy>=sz) {
        tex=py>0?faces.up:faces.down;u=px/sy;v=(py>0?-pz:pz)/sy;
      } else {
        tex=pz>0?faces.back:faces.front;u=(pz>0?-px:px)/sz;v=-py/sz;
      }
      buffer[j*width+i]=tex.pixels[pixelIndex(tex,.5+u*.5,.5+v*.5)];
    }
  }
}

function paintBedroom(buffer,depth,w,h,camera,faces) {
  const {halfWidth,front,back,floor,ceiling}=BEDROOM;
  const m=camera.matrixWorld.elements,p=camera.projectionMatrix.elements;
  const x=m[12],y=m[13],z=m[14];
  const step=2/(w*p[0]),ax=m[0]*step,ay=m[1]*step,az=m[2]*step;
  const firstX=(1/w-1)/p[0],wide=2*halfWidth,deep=front+back,high=ceiling-floor;
  for(let j=0;j<h;j++){
    const cy=(1-(2*j+1)/h)/p[5];
    let rx=firstX*m[0]+cy*m[4]-m[8],ry=firstX*m[1]+cy*m[5]-m[9],rz=firstX*m[2]+cy*m[6]-m[10];
    for(let i=0;i<w;i++,rx+=ax,ry+=ay,rz+=az){
      const tx=rx===0?Infinity:((rx>0?halfWidth:-halfWidth)-x)/rx;
      const ty=ry===0?Infinity:((ry>0?ceiling:floor)-y)/ry;
      const tz=rz===0?Infinity:((rz>0?back:-front)-z)/rz;
      const t=Math.min(tx,ty,tz);
      const X=x+rx*t,Y=y+ry*t,Z=z+rz*t;
      const k=j*w+i;
      if(tz<=tx&&tz<=ty&&rz>0&&Math.abs(X)<DOOR.upper.half&&Y>=floor&&Y<floor+DOOR.upper.height){
        buffer[k]=0xff2a1820;continue;
      }
      if(t>0)depth[k]=1/t;
      let tex,u,v;
      if(tx<=ty&&tx<=tz){
        tex=rx>0?faces.right:faces.left;u=rx>0?(Z+front)/deep:(back-Z)/deep;v=(ceiling-Y)/high;
      } else if(ty<=tz){
        tex=ry>0?faces.up:faces.down;u=.5+X/wide;v=(Z+front)/deep;
      } else {
        tex=rz>0?faces.back:faces.front;u=.5+(rz>0?-X:X)/wide;v=(ceiling-Y)/high;
      }
      buffer[j*w+i]=tex.pixels[pixelIndex(tex,u,v)];
    }
  }
}

// 원근 보정한 UV와 깊이를 함께 보간하여 팔, 다리, 방패, 의자가 실제 거리에 따라 서로 가린다.
function raster(a,b,c,image,depth,width,height,tex,channels,details) {
  const minX=Math.max(0,Math.ceil(Math.min(a.sx,b.sx,c.sx)-.5)),maxX=Math.min(width-1,Math.floor(Math.max(a.sx,b.sx,c.sx)-.5));
  const minY=Math.max(0,Math.ceil(Math.min(a.sy,b.sy,c.sy)-.5)),maxY=Math.min(height-1,Math.floor(Math.max(a.sy,b.sy,c.sy)-.5));
  if (minX>maxX || minY>maxY) return;
  const bx=b.sx-a.sx,by=b.sy-a.sy,cx=c.sx-a.sx,cy=c.sy-a.sy,det=bx*cy-by*cx;
  if (Math.abs(det)<1e-8 || (channels && det>0)) return;
  const ub=cy/det, vb=-cx/det, uc=-by/det, vc=bx/det;
  const qb=b.q-a.q,qc=c.q-a.q,utb=b.uq-a.uq,utc=c.uq-a.uq,vtb=b.vq-a.vq,vtc=c.vq-a.vq;
  const lightB=channels ? b.lq-a.lq : 0, lightC=channels ? c.lq-a.lq : 0;
  const sm=(value,min,max)=>{const t=clamp((value-min)/(max-min),0,1);return t*t*(3-2*t);};
  const pxB=details?b.xq-a.xq:0, pxC=details?c.xq-a.xq:0;
  const pyB=details?b.yq-a.yq:0, pyC=details?c.yq-a.yq:0;
  const pzB=details?b.zq-a.zq:0, pzC=details?c.zq-a.zq:0;
  for (let y=minY;y<=maxY;y++) {
    let mb=(minX+.5-a.sx)*ub+(y+.5-a.sy)*vb,mc=(minX+.5-a.sx)*uc+(y+.5-a.sy)*vc;
    for (let x=minX;x<=maxX;x++,mb+=ub,mc+=uc) {
      if (mb < -1e-8 || mc < -1e-8 || mb+mc > 1.00000001) continue;
      const k=y*width+x,q=a.q+qb*mb+qc*mc;
      if (q<=depth[k]) continue;
      const u=(a.uq+utb*mb+utc*mc)/q,v=(a.vq+vtb*mb+vtc*mc)/q;
      const pixel=pixelIndex(tex,u,v);
      if (channels) {
        const light=(a.lq+lightB*mb+lightC*mc)/q;
        for (let channel=0;channel<3;channel++) channels[4*k+channel]=tex.bytes[4*pixel+channel]*light;
        channels[4*k+3]=255;
      } else if(details) {
        const {rect,tile,layer,art}=details, dst=4*k, src=4*pixel;
        const xx=((a.xq+pxB*mb+pxC*mc)/q-rect.x)/rect.z;
        const yy=(rect.y-(a.yq+pyB*mb+pyC*mc)/q)/rect.w;
        const zz=layer.z*(a.zq+pzB*mb+pzC*mc)/q;
        if(xx>0&&xx<1&&yy>0&&yy<1&&zz>layer.x) {
          const at=4*pixelIndex(art,(tile.x+.005+.99*xx)/3,(tile.y+.005+.99*yy)/3);
          const w=art.bytes[at+3]/255*sm(Math.min(xx,1-xx),0,.06)*sm(Math.min(yy,1-yy),0,.05)*sm(zz,layer.x,layer.y);
          for(let c=0;c<3;c++)details.channels[dst+c]=tex.bytes[src+c]*(1-w)+art.bytes[at+c]*w;
          details.channels[dst+3]=255;
        } else image[k]=tex.pixels[pixel];
      } else image[k]=tex.pixels[pixel];
      depth[k]=q;
    }
  }
}

const lampLength=Math.hypot(-.48,.70,.52);
const hairLamp={x:-.48/lampLength,y:.70/lampLength,z:.52/lampLength};

function drawBatch(item,matrix,projection,frame,depth,width,height,near,channels) {
  const {vertices,indices,texture}=item;
  const m=matrix.elements,fx=width*.5*projection[0],fy=-height*.5*projection[5];
  const rgb=item.normals ? channels : null;
  const details=item.details; if(details)details.channels=channels;
  function project(v) {
    v.q=1/v.w;
    if (rgb) v.lq=v.light*v.q; v.sx=width*.5+v.vx*v.q*fx;v.sy=height*.5+v.vy*v.q*fy;
    v.uq=v.u*v.q;v.vq=v.v*v.q;
    if(details){v.xq=v.x*v.q;v.yq=v.y*v.q;v.zq=v.z*v.q;}
    return v;
  }
  function cut(a,b) {
    const t=(near-a.w)/(b.w-a.w);
    return project({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,vx:a.vx+(b.vx-a.vx)*t,vy:a.vy+(b.vy-a.vy)*t,w:near,
      u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t,light:rgb ? a.light+(b.light-a.light)*t : 1});
  }
  const scale=rgb ? 1/Math.hypot(m[0],m[1],m[2]) : 1;
  const soft=item.spring;
  const active=soft&&(soft.spring.x||soft.spring.y||soft.spring.z||soft.spring.w);
  let normalIndex=0;
  for (const v of vertices) {
    let localY=v.y,localZ=v.z;
    if(active&&v.spring) {
      const x=soft.origin.x+(v.x+.5)*soft.size.x,y=soft.origin.y+(v.y+.5)*soft.size.y;
      const a=soft.spring;
      const z=soft.origin.z+(v.z+.5)*soft.size.z;
      localY+=chestVertical(x,y,z,x>=0?soft.lift.x:soft.lift.y)/soft.size.y;
      localZ=Math.max(-.497,v.z+chestOffset(x,y,x>=0?a.x:a.z,x>=0?a.y:a.w)/soft.size.z);
    }
    v.vx=m[0]*v.x+m[4]*localY+m[8]*localZ+m[12];
    v.vy=m[1]*v.x+m[5]*localY+m[9]*localZ+m[13];
    v.w=-(m[2]*v.x+m[6]*localY+m[10]*localZ+m[14]);
    if (rgb) {
      // 머리 관절은 균일한 축척을 쓴다. 입체 렌더러와 같은 법선과 광원으로 금발의 반사를 계산한다.
      const x=item.normals[normalIndex++],y=item.normals[normalIndex++],z=item.normals[normalIndex++];
      const nx=(m[0]*x+m[4]*y+m[8]*z)*scale,ny=(m[1]*x+m[5]*y+m[9]*z)*scale,nz=(m[2]*x+m[6]*y+m[10]*z)*scale;
      const invView=1/Math.max(.00001,Math.hypot(v.vx,v.vy,v.w));
      const hx=hairLamp.x-v.vx*invView,hy=hairLamp.y-v.vy*invView,hz=hairLamp.z+v.w*invView;
      const gloss=Math.max(0,(nx*hx+ny*hy+nz*hz)/Math.max(.00001,Math.hypot(hx,hy,hz)));
      v.light=.79+.24*Math.max(0,nx*hairLamp.x+ny*hairLamp.y+nz*hairLamp.z)
        +.18*gloss**14+(item.goldShine||0)*(.055+.20*gloss**24);
    }
    if (v.w>=near) project(v);
  }
  for (let i=0;i<indices.length;i+=3) {
    const a=vertices[indices[i]],b=vertices[indices[i+1]],c=vertices[indices[i+2]];
    if (a.w>=near&&b.w>=near&&c.w>=near) raster(a,b,c,frame,depth,width,height,texture,rgb,details);
    else if (a.w>=near||b.w>=near||c.w>=near) {
      const polygon=[];let prev=c;
      for (const cur of [a,b,c]) {
        if ((cur.w>=near)!==(prev.w>=near)) polygon.push(cut(prev,cur));
        if (cur.w>=near) polygon.push(cur);
        prev=cur;
      }
      for (let j=2;j<polygon.length;j++) raster(polygon[0],polygon[j-1],polygon[j],frame,depth,width,height,texture,rgb,details);
    }
  }
}

// 멈춘 화면에서는 단면 메시 대신 실제 두께장 안에서 광선이 만나는 첫 화소를 찾는다.
function paintVolume(uniforms, read, matrix, inverse, projection, buffer, depths, width, height, near,rowStart,rowEnd) {
  const param=name=>uniforms[name].value;
  const r=param('rect'),section=param('verticalRange'),profile=param('profileRect'),ext=param('extents');
  const frontUV=param('frontTransform'), eyeMask=param('eyeMaskRect');
  const shoulder=param('shoulderOrigin');
  const front=read(param('frontPhoto')),back=read(param('backPhoto')),sides=read(param('profilePhotos')),shape=read(param('thickness'));
  const m=matrix.elements,inv=inverse.copy(matrix).invert().elements;
  const fx=width*.5*projection[0],fy=-height*.5*projection[5];
  let minX=width,maxX=0,minY=height,maxY=0,cross=0;
  for (const x of [-.5,.5]) for (const y of [-.5,.5]) for (const z of [-.5,.5]) {
    const w=-(m[2]*x+m[6]*y+m[10]*z+m[14]);
    if (w<near) {cross++;continue;}
    const sx=width*.5+(m[0]*x+m[4]*y+m[8]*z+m[12])*fx/w;
    const sy=height*.5+(m[1]*x+m[5]*y+m[9]*z+m[13])*fy/w;
    minX=Math.min(minX,sx);maxX=Math.max(maxX,sx);
    minY=Math.min(minY,sy);maxY=Math.max(maxY,sy);
  }
  if (cross===8) return;
  const x0=cross?0:clamp(Math.ceil(minX-.5),0,width), x1=cross?width:clamp(Math.ceil(maxX-.5),0,width);
  const y0=cross?rowStart:clamp(Math.ceil(minY-.5),rowStart,rowEnd), y1=cross?rowEnd:clamp(Math.ceil(maxY-.5),rowStart,rowEnd);
  const ox=inv[12]+.5,oy=inv[13]+.5,oz=inv[14]+.5, dx=inv[0]/fx,dy=inv[1]/fx,dz=inv[2]/fx;
  const vx=(x0+.5-width*.5)/fx, du=-r.z,dv=-r.w*section.y;
  const baseU=r.x+r.z+ox*du,baseV=r.y+r.w*(1-section.x)+oy*dv;
  const rgb=shape.bytes,out=buffer;
  const residual=4*Math.round(param('depthResidualX')*shape.w);
  const violet=front.violetSkin||back.violetSkin||sides.violetSkin;
  const sampleWidth=(violet?7:4)*param('pixelX'), gradientFactor=r.z*ext.z/(510*sampleWidth*ext.x);
  const verticalGradient=r.w*section.y*ext.z/(510*sampleWidth*ext.y);
  const innerArm=param('insideArmSkin')>.5;
  const core=param('coreFlank'), spring=param('chestSpring'), lift=param('chestLift');
  const active=spring.x||spring.y||spring.z||spring.w;
  const sf=new Float32Array(3),sb=new Float32Array(3),ss=new Float32Array(3);
  const projectedV=(u,v,z)=>{
    if(!active)return v;
    const x=shoulder.x+(1-(u-r.x)/r.z)*ext.x,y=shoulder.y+(1-section.x-(v-r.y)/r.w)/section.y*ext.y;
    const raise=chestVertical(x,y,shoulder.z+z*ext.z,x>=0?lift.x:lift.y);
    return v-raise*dv/ext.y;
  };
  const depthNear=(index,u,v)=>{
    const frontDepth=depthByte(rgb,index,residual);
    if(!active)return frontDepth;
    const px=shoulder.x+(1-(u-r.x)/r.z)*ext.x,py=shoulder.y+(1-section.x-(v-r.y)/r.w)/section.y*ext.y;
    const shift=chestOffset(px,py,px>=0?spring.x:spring.z,px>=0?spring.y:spring.w);
    return clamp(frontDepth+255*shift/ext.z,.765,Math.max(.765,depthByte(rgb,index+1,residual)-.255));
  };
  const lamp=Math.hypot(.56,.72,.41),lx=.56/lamp,ly=.72/lamp,lz=-.41/lamp;
  for (let y=y0;y<y1;y++) {
    const vy=(y+.5-height*.5)/fy;
    let rx=vx*inv[0]+vy*inv[4]-inv[8],ry=vx*inv[1]+vy*inv[5]-inv[9],rz=vx*inv[2]+vy*inv[6]-inv[10];
    for (let x=x0;x<x1;x++,rx+=dx,ry+=dy,rz+=dz) {
      const ix=1/(rx||1e-12),iy=1/(ry||1e-12),iz=1/(rz||1e-12);
      const k=y*width+x;
      const t0=Math.max(near,(rx>0?-ox:1-ox)*ix,(ry>0?-oy:1-oy)*iy,(rz>0?-oz:1-oz)*iz);
      const end=Math.min((rx>0?1-ox:-ox)*ix,(ry>0?1-oy:-oy)*iy,(rz>0?1-oz:-oz)*iz,1/depths[k]);
      if (end<=t0) continue;
      const stride=(end-t0)/40;
      const uRate=rx*du,vRate=ry*dv;
      let t=t0,hit=false,lower=t0;
      for (let i=0;i<=40;i++,t+=stride) {
        const u=baseU+t*uRate,z=oz+rz*t,v=projectedV(u,baseV+t*vRate,z),id=4*pixelIndex(shape,u,v);
        if (rgb[id+2]>=122 && z*255>=depthNear(id,u,v) && z*255<=depthByte(rgb,id+1,residual)) {hit=true;break;}
        lower=t;
      }
      if (!hit) continue;
      for (let j=0;j<(residual ? 7 : 4);j++) {
        const mid=.5*(lower+t),u=baseU+mid*uRate,z=oz+rz*mid,v=projectedV(u,baseV+mid*vRate,z),id=4*pixelIndex(shape,u,v);
        if (rgb[id+2]>=122 && z*255>=depthNear(id,u,v) && z*255<=depthByte(rgb,id+1,residual)) t=mid;else lower=mid;
      }
      const u=baseU+t*uRate,hz=clamp(oz+t*rz,0,1),v=projectedV(u,baseV+t*vRate,hz);
      const a=4*pixelIndex(shape,u,v),nearZ=depthNear(a,u,v);
      const slice=clamp((hz*255-nearZ)/Math.max(1.275,depthByte(rgb,a+1,residual)-nearZ),0,1);
      const plane=smooth(0,1,slice), branch=violet?smooth(.30,.70,slice):+(slice>=.5);
      const ix0=4*pixelIndex(shape,u-sampleWidth,v),ix1=4*pixelIndex(shape,u+sampleWidth,v);
      const slope=gradientFactor*((1-branch)*(depthByte(rgb,ix0,residual)-depthByte(rgb,ix1,residual))-
        branch*(depthByte(rgb,ix0+1,residual)-depthByte(rgb,ix1+1,residual)));
      const horizontal=Math.hypot(rx*ext.x,rz*ext.z), rayLength=Math.hypot(horizontal,ry*ext.y);
      const viewX=-rx*ext.x/Math.max(1e-7,horizontal);
      const hitY=oy+t*ry;
      let coreWeight=core;
      if (core && shoulder.y>0) {
        coreWeight*=1-smooth(1.005,1.15,shoulder.y+hitY*ext.y)*(1-smooth(-.10,.04,shoulder.z+hz*ext.z));
      }
      const blend=smooth(.08,.62,horizontal/rayLength)*(.28+.64*smooth(.62,.96,Math.abs(viewX)))*(1-.55*coreWeight);
      const profileX=(1-blend)*slope/Math.hypot(1,slope)+blend*viewX;
      let side=violet?smooth(.19,.93,Math.abs(profileX)):smooth(.25,.81,Math.abs(profileX));
      if(core && shoulder.y>0) {
        const px=shoulder.x+(ox+t*rx)*ext.x,py=shoulder.y+hitY*ext.y;
        const anchor=(1-smooth(.080,.154,Math.abs(px)))*smooth(.79,.88,py)*
          (1-smooth(1.08,1.166,py))*(1-smooth(.17,.47,slice));
        side*=1-.85*anchor*(1-smooth(.83,1,Math.abs(viewX)));
      }
      if (eyeMask.z>0 && hitY>.32 && hitY<.57 && rz>0) {
        const mu=eyeMask.x+(1-ox-t*rx)*eyeMask.z,mv=eyeMask.y+(1-hitY)*eyeMask.w;
        const coverage=sides.bytes[4*pixelIndex(sides,mu,mv)]/255;
        const oblique=smooth(.08,.42,Math.abs(viewX))*(1-smooth(.87,.99,Math.abs(viewX)));
        side*=1-coverage*oblique*(1-smooth(.10,.45,slice));
      }
      const su=.5*(clamp(profile.x+hz*profile.z,.0005,.9995)+(profileX<-.00001?1:0));
      const sv=profile.y+clamp((v-r.y-r.w*(1-section.x))/dv,0,1)*profile.w;
      const f=4*pixelIndex(front,frontUV.x+u*frontUV.z,frontUV.y+v*frontUV.w),b=4*pixelIndex(back,u,v),s=4*pixelIndex(sides,su,sv);
      if(violet) {
        const maxSide=Math.max(sides.bytes[s],sides.bytes[s+1],sides.bytes[s+2]);
        const maxFace=Math.max(
          front.bytes[f]*(1-plane)+back.bytes[b]*plane,
          front.bytes[f+1]*(1-plane)+back.bytes[b+1]*plane,
          front.bytes[f+2]*(1-plane)+back.bytes[b+2]*plane);
        side*=1-.82*(1-smooth(9.7,40.8,maxSide))*smooth(15.8,48.5,maxFace);
      }
      const frontWeight=(1-side)*(1-plane),backWeight=(1-side)*plane;
      const iy0=4*pixelIndex(shape,u,v-sampleWidth),iy1=4*pixelIndex(shape,u,v+sampleWidth);
      const vertical=verticalGradient*((1-branch)*(depthByte(rgb,iy0,residual)-depthByte(rgb,iy1,residual))-
        branch*(depthByte(rgb,iy0+1,residual)-depthByte(rgb,iy1+1,residual)));
      const nzLocal=2*branch-1,norm=Math.max(.0001,Math.hypot(slope,vertical,nzLocal));
      const facing=clamp(-(slope*rx*ext.x+vertical*ry*ext.y+nzLocal*rz*ext.z)/(norm*rayLength),0,1);
      let light=.86+.14*facing+.045*vertical/norm, gloss=0;
      if (shoulder.y>0) {
        const ax=Math.abs(shoulder.x+(ox+t*rx)*ext.x);
        const py=shoulder.y+hitY*ext.y, pz=shoulder.z+hz*ext.z;
        const fold=smooth(.118,.166,ax)*(1-smooth(.307,.363,ax))
          *smooth(1.292,1.352,py)*(1-smooth(1.502,1.525,py))
          *smooth(-.138,-.062,pz)*(1-smooth(.056,.103,pz));
        light+=fold*(.94+.05*smooth(1.32,1.51,py)-light);
      }
      if (coreWeight) {
        const nx=slope/norm,ny=vertical/norm,nz=nzLocal/norm;
        const hx=lx-rx*ext.x/rayLength,hy=ly-ry*ext.y/rayLength,hz=lz-rz*ext.z/rayLength;
        light*=1+coreWeight*(-.10+.16*Math.max(0,nx*lx+ny*ly+nz*lz));
        gloss=coreWeight*255*Math.max(0,(nx*hx+ny*hy+nz*hz)/Math.max(1e-6,Math.hypot(hx,hy,hz)))**22;
      }
      const o=k*4;
      if(violet) {
        if(frontWeight>.001) skinSample(front,frontUV.x+u*frontUV.z,frontUV.y+v*frontUV.w,sf);
        if(backWeight>.001) skinSample(back,u,v,sb);
        if(side>.001) skinSample(sides,su,sv,ss);
        if(core || innerArm) {
          const ax=Math.abs(shoulder.x+(ox+t*rx)*ext.x),py=shoulder.y+hitY*ext.y,pz=shoulder.z+hz*ext.z;
          const under=core?smooth(.075,.121,ax)*(1-smooth(.346,.435,ax))
            *smooth(.915,.968,py)*(1-smooth(1.092,1.174,py))*(1-smooth(.065,.147,pz)):0;
          const amount=Math.max(under,innerArm?.52+.29*side:0);
          const vr=sf[0]*frontWeight+sb[0]*backWeight+ss[0]*side;
          const vg=sf[1]*frontWeight+sb[1]*backWeight+ss[1]*side;
          const vb=sf[2]*frontWeight+sb[2]*backWeight+ss[2]*side;
          const fix=.92*amount*(1-smooth(26.3,60.9,Math.max(vr,vg,vb)));
          out[o]=light*(vr+Math.max(0,28.56-vr)*fix);
          out[o+1]=light*(vg+Math.max(0,16.06-vg)*fix);
          out[o+2]=light*(vb+Math.max(0,55.59-vb)*fix);
        } else for(let c=0;c<3;c++)out[o+c]=light*(sf[c]*frontWeight+sb[c]*backWeight+ss[c]*side);
      } else for(let c=0;c<3;c++)out[o+c]=light*(front.bytes[f+c]*frontWeight+back.bytes[b+c]*backWeight+sides.bytes[s+c]*side);
      if (coreWeight) {out[o]+=.12*gloss; out[o+1]+=.08*gloss; out[o+2]+=.15*gloss;}
      depths[k]=1/t;
    }
  }
}

function paintCastleSky(frame,w,h,camera,texture) {
  const m=camera.matrixWorld.elements,p=camera.projectionMatrix.elements;
  for(let y=0;y<h;y+=2){
    const sy=(1-2*(y+.5)/h)/p[5];
    const ax=sy*m[4]-m[8],ay=sy*m[5]-m[9],az=sy*m[6]-m[10];
    for(let x=0;x<w;x+=2){
      const sx=(2*(x+.5)/w-1)/p[0];
      const [u,v]=castleSkyUV(ax+sx*m[0],ay+sx*m[1],az+sx*m[2]);
      const pixel=texture.pixels[pixelIndex(texture,u,v)];
      const k=y*w+x;
      frame[k]=pixel;
      if(x+1<w)frame[k+1]=pixel;
      if(y+1<h){
        frame[k+w]=pixel;
        if(x+1<w)frame[k+w+1]=pixel;
      }
    }
  }
}

function detailInputs(uniforms,art){
  return {rect:uniforms.rect.value,tile:uniforms.tile.value,layer:uniforms.layer.value,art};
}

function canvasRenderer({canvas}) {
  let target=canvas, ctx=target.getContext('2d',{alpha:false});
  if (!ctx) {
    // 이미 다른 문맥을 획득한 캔버스는 종류를 바꿀 수 없다.
    target=document.createElement('canvas');target.setAttribute('aria-hidden','true');
    Object.assign(target.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'1',pointerEvents:'none'});
    ctx=target.getContext('2d',{alpha:false});canvas.after(target);
  }
  if (!ctx) throw Error('궁전의 화면을 그릴 수 없습니다.');
  const images=new WeakMap(),surfaces=new WeakMap(),mv=new window.GoldFirePalaceThree.Matrix4();
  const inverse=new window.GoldFirePalaceThree.Matrix4();
  let data,frame,depth,faces,bedroomFaces,w=0,h=0,sourceW=0,sourceH=0,refineTimer=0;
  function read(texture) {
    if (images.has(texture)) return images.get(texture);
    const source=texture.image;
    const scale=Math.min(1,1536/Math.max(source.width,source.height));
    const scratch=document.createElement('canvas');
    scratch.width=Math.max(1,Math.round(source.width*scale));scratch.height=Math.max(1,Math.round(source.height*scale));
    const g=scratch.getContext('2d',{willReadFrequently:true});
    g.drawImage(source,0,0,scratch.width,scratch.height);
    const bytes=g.getImageData(0,0,scratch.width,scratch.height).data;
    const tex={bytes,pixels:new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),w:scratch.width,h:scratch.height,violetSkin:!!texture.userData?.violetSkin};
    scratch.width=scratch.height=1;
    images.set(texture,tex);return tex;
  }
  function draw(world,camera,refined) {
    const budget=refined?880000:245000;
    const scale=Math.min(1,Math.sqrt(budget/(sourceW*sourceH)));
    const nw=Math.max(1,Math.round(sourceW*scale)),nh=Math.max(1,Math.round(sourceH*scale));
    if (w!==nw||h!==nh||!data) {
      w=nw;h=nh;
      data=ctx.createImageData(w,h);frame=new Uint32Array(data.data.buffer);depth=new Float32Array(w*h);
    }
    world.updateMatrixWorld(true);camera.updateWorldMatrix(true,false);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    if (!faces) {
      const uniforms=world.getObjectByName('PalaceHall').material.uniforms;
      faces=Object.fromEntries(Object.entries(uniforms).map(([name,u])=>[name,read(u.value)]));
    }
    depth.fill(0);
    if(world.userData.activeRoom==='bedroom') {
      if(!bedroomFaces){
        const uniforms=world.getObjectByName('BedroomHall').material.uniforms;
        bedroomFaces=Object.fromEntries(Object.entries(uniforms).map(([k,u])=>[k,read(u.value)]));
      }
      paintBedroom(frame,depth,w,h,camera,bedroomFaces);
    } else if(isCastle(world.userData.activeRoom)) {
      paintCastleSky(frame,w,h,camera,read(world.getObjectByName('CastleSky').material.uniforms.sky.value));
    } else if(world.userData.activeRoom==='passage')frame.fill(0xff231623);
    else paintRoom(frame,depth,w,h,camera,faces);
    const volumes=[];
    world.traverseVisible(object=>{
      if (!object.isMesh||(object.name==='PalaceHall'||object.name==='BedroomHall'||object.name==='CastleSky')||!camera.layers.test(object.layers)||!object.material.visible) return;
      const uniforms=object.material.uniforms;
      mv.multiplyMatrices(camera.matrixWorldInverse,object.matrixWorld);
      if (uniforms.thickness && (refined || uniforms.eyeMaskRect.value.z>0)) {
        volumes.push({uniforms,matrix:mv.clone()});
        return;
      }
      let batches=surfaces.get(object);
      if (!batches) {
        batches=uniforms.thickness?bodySurfaces(uniforms,read):[surface(object.geometry,read(uniforms.photo.value),object.material.userData.hairSheen,object.material.userData.goldShine)];
        surfaces.set(object,batches);
      }
      if(uniforms.details?.value.image?.complete&&!batches[0].details)
        batches[0].details=detailInputs(uniforms,read(uniforms.details.value));
      for (const shape of batches) drawBatch(shape,mv,camera.projectionMatrix.elements,frame,depth,w,h,camera.near,data.data);
    });
    function present() {
      if (target.width!==w) target.width=w;
      if (target.height!==h) target.height=h;
      ctx.putImageData(data,0,0);
    }
    if (!refined || !volumes.length) {
      // 움직이는 동안에도 얼굴 한 부위에는 실제로 보이는 표면의 사진 좌표를 쓴다.
      for (const part of volumes) {
        paintVolume(part.uniforms,read,part.matrix,inverse,camera.projectionMatrix.elements,
          data.data,depth,w,h,camera.near,0,h);
      }
      present();
      return;
    }
    // 관절의 고해상도 광선 계산을 조금씩 나누어 새 조이스틱 입력을 즉시 받을 수 있게 한다.
    let index=0,row=0;
    function refine() {
      if (document.hidden) return;
      const end=performance.now()+10;
      while (index<volumes.length) {
        const part=volumes[index],next=Math.min(h,row+12);
        paintVolume(part.uniforms,read,part.matrix,inverse,camera.projectionMatrix.elements,
          data.data,depth,w,h,camera.near,row,next);
        row=next;
        if (row===h) {row=0;index++;}
        if (index<volumes.length && performance.now()>=end) {refineTimer=setTimeout(refine,0);return;}
      }
      present();
    }
    refine();
  }
  const state={isContextLost:()=>false};
  return {
    capabilities:{isWebGL2:false},extensions:{has:()=>false},getContext:()=>state,
    setSize(width,height) {sourceW=width;sourceH=height;},
    render(world,camera) {
      if (!sourceW||!sourceH) {sourceW=canvas.width;sourceH=canvas.height;}
      clearTimeout(refineTimer);
      draw(world,camera,false);
      refineTimer=setTimeout(()=>{if (!document.hidden) draw(world,camera,true);},180);
    },
    dispose() {
      clearTimeout(refineTimer);
      if (target!==canvas) target.remove();
      data=frame=depth=faces=bedroomFaces=null;
    }
  };
}

export function createPalaceFallback(canvas) {
  return createPalaceRelief(canvas,canvasRenderer);
}
