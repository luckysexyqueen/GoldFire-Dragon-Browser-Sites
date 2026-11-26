// 보라 갑각과 금장, 흰 러플을 작은 실루엣에서도 구별할 수 있는 왕실 인물 메시.
export const NPC_PALETTE=[
 '#171420','#281d3e','#3c2857','#614386','#b88b44','#f0c975','#b7adc9','#ece6f0',
 '#f5d0bd','#d79d8f','#532475','#dd6df9','#fff6f7','#5e2639','#9776b6','#524768','#8794b2','#c9b2c6'
];
export const [ink,shadow,shell,violet,gold,shine,silver,lace,skin,skinShade,iris,gem,white,mouth,lavender,graphite,steel,blush]=NPC_PALETTE.map((_,i)=>i);
export function npcAtlas(THREE,doc=document){
  const c=doc.createElement('canvas'),q=24;c.width=q*NPC_PALETTE.length;c.height=q*5;
  const g=c.getContext('2d');
  for(let i=0;i<NPC_PALETTE.length;i++){
    const n=Number.parseInt(NPC_PALETTE[i].slice(1),16),channel=[n>>16,n>>8&255,n&255];
    for(let j=0;j<5;j++){
      const base=[.54,.72,.89,1,1.18][j],spec=(i===1||i===2||i===4||i===6)?7:1.8;
      const grad=g.createLinearGradient(i*q,j*q,(i+1)*q,(j+1)*q);
      for(const [offset,k] of [[0,0],[.29,.43],[.52,1],[.71,.22],[1,0]])
        grad.addColorStop(offset,'rgb('+channel.map(x=>Math.min(255,Math.round(x*base+spec*k))).join(',')+')');
      g.fillStyle=grad;g.fillRect(i*q,j*q,q,q);
    }
  }
  const t=new THREE.CanvasTexture(c);t.flipY=false;t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;return t;
}
const vs=`varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fs=`uniform sampler2D photo;varying vec2 st;void main(){gl_FragColor=texture2D(photo,st);}`;
// 각 관절의 로컬 좌표에 설정화의 표면을 입힌다. 실루엣과 움직임은 입체 메시가 유지한다.
function detailSurface(THREE,base,details,rect,index,depth,back=false){
  if(!details)return base;
  return new THREE.ShaderMaterial({
    side:THREE.DoubleSide,
    uniforms:{photo:base.uniforms.photo,details:{value:details},rect:{value:new THREE.Vector4(...rect)},
      tile:{value:new THREE.Vector2(index%3,Math.floor(index/3))},layer:{value:new THREE.Vector3(...depth,back?-1:1)}},
    vertexShader:`varying vec2 st;varying vec3 p;void main(){st=uv;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D photo,details;uniform vec4 rect;uniform vec2 tile;uniform vec3 layer;
      varying vec2 st;varying vec3 p;
      void main(){
        vec4 base=texture2D(photo,st);
        vec2 xy=vec2((p.x-rect.x)/rect.z,(rect.y-p.y)/rect.w);
        float inside=smoothstep(0.0,.06,xy.x)*smoothstep(0.0,.06,1.0-xy.x)*
          smoothstep(0.0,.05,xy.y)*smoothstep(0.0,.05,1.0-xy.y);
        vec2 atlasUV=(tile+mix(vec2(.005),vec2(.995),clamp(xy,0.0,1.0)))/3.0;
        vec4 art=texture2D(details,atlasUV);
        float wrap=smoothstep(layer.x,layer.y,layer.z*p.z);
        gl_FragColor=vec4(mix(base.rgb,art.rgb,art.a*inside*wrap),1.0);
      }`,
  });
}
function painter(THREE,mat){
  const pos=[],uv=[];
  const p=new THREE.Vector3(),n=new THREE.Vector3(),scale=new THREE.Vector3(),rot=new THREE.Euler();
  function put(v,t,col,shade){
    pos.push(v[0]??v.x,v[1]??v.y,v[2]??v.z);
    uv.push((col+.06+.88*t[0])/NPC_PALETTE.length,(shade+.05+.90*t[1])/5);
  }
  function mesh(geometry,x,y,z,sx,sy,sz,col,rx=0,ry=0,rz=0,band=0){
    const P=geometry.attributes.position,N=geometry.attributes.normal,U=geometry.attributes.uv,I=geometry.index;
    rot.set(rx,ry,rz);scale.set(sx,sy,sz);
    for(let i=0;i<(I?.count??P.count);i+=3){
      for(let j=0;j<3;j++){
        const k=I?I.getX(i+j):i+j;
        p.fromBufferAttribute(P,k).multiply(scale).applyEuler(rot);
        n.fromBufferAttribute(N,k).applyEuler(rot);
        p.x+=x;p.y+=y;p.z+=z;
        const shade=Math.min(4,Math.max(0,Math.round(2.05+2.08*(-.33*n.x+.59*n.y+.72*n.z)+band)));
        put(p,[U.getX(k),1-U.getY(k)],col,shade);
      }
    }
    geometry.dispose();
  }
  const egg=(x,y,z,rx,ry,rz,c,lean=0,detail=10)=>mesh(new THREE.SphereGeometry(1,detail,Math.max(5,detail*.60|0)),x,y,z,rx,ry,rz,c,0,0,lean);
  const box=(x,y,z,w,h,d,c,rx=0,ry=0,rz=0)=>mesh(new THREE.BoxGeometry(1,1,1),x,y,z,w,h,d,c,rx,ry,rz);
  const cylinder=(x,y,z,rTop,rBottom,h,c,ry=0,rx=0,rz=0,segs=9)=>mesh(new THREE.CylinderGeometry(rTop,rBottom,h,segs,1),x,y,z,1,1,1,c,rx,ry,rz);
  function tube(points,r,c,sides=6){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    mesh(new THREE.TubeGeometry(curve,Math.max(5,points.length*3),r,sides,false),0,0,0,1,1,1,c);
  }
  function tip(a,b,width,c){
    const [x,y,z]=a,[X,Y,Z]=b,len=Math.hypot(X-x,Y-y,Z-z);
    if(len<1e-4)return;
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(X-x,Y-y,Z-z).normalize());
    const e=new THREE.Euler().setFromQuaternion(q);
    mesh(new THREE.ConeGeometry(width,len,7,1),(x+X)/2,(y+Y)/2,(z+Z)/2,1,1,1,c,e.x,e.y,e.z);
  }
  function sheet(pts,col,shade=3){
    const U=pts.length===4?[[0,1],[1,1],[1,0],[0,0]]:[[.5,0],[0,1],[1,1]];
    for(let j=1;j<pts.length-1;j++)for(const k of [0,j,j+1])put(pts[k],U[k]??[.6,.3],col,shade);
  }
  const diamond=(x,y,z,r,c)=>mesh(new THREE.OctahedronGeometry(r,0),x,y,z,.76,1,.43,c);
  function done(group,name='',surface=mat){
    if(!pos.length)return;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const o=new THREE.Mesh(g,surface);o.name=name;group.add(o);pos.length=0;uv.length=0;return o;
  }
  return {egg,box,cylinder,mesh,tube,tip,sheet,diamond,done};
}

function face(THREE,b,royal,textured,head,surface){
  const {egg,tube,sheet,tip,diamond}=b;
  const w=royal?.105:.115;
  if(textured){
    // 얼굴을 한 표면으로 만들어 설정화의 눈·입과 별개 메시가 겹치지 않게 한다.
    const geo=new THREE.SphereGeometry(1,38,26);
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const jaw=1-.27*Math.max(0,-y)**.72;
      const front=Math.max(0,z);
      const ridge=.076*Math.exp(-((x/.24)**2)-(((y+.38)/.25)**2))*front;
      p.setXYZ(i,x*jaw,y,z+ridge);
    }
    geo.computeVertexNormals();
    b.mesh(geo,0,.010,.012,w,.148,.117,skin);
  }else{
    egg(0,.027,.005,w,.145,.110,skin,0,14);
    egg(0,-.056,.012,w*.86,.078,.098,skin,0,12);
    egg(0,-.083,.060,w*.62,.058,.049,skin,0,12);
    egg(0,-.038,.112,.017,.019,.017,skin,0,9);
  }
  for(const s of [-1,1]){
    const ox=s*.051, z=.124;
    const eyeY=royal?.028:.024,ww=royal?.040:.035,hh=royal?.019:.013;
    const E=(x,y)=>[ox+x,eyeY+y+s*x*.14,z-Math.abs(ox+x)*.29];
    if(!textured){
    sheet([E(-ww,-hh*.35),E(0,-hh),E(ww,.001),E(0,hh)],ink,3);
    sheet([E(-ww*.90,-hh*.28),E(0,-hh*.75),E(ww*.83,.001),E(0,hh*.68)].map(([x,y,z])=>[x,y,z+.0035]),white,3);
    egg(ox,eyeY,z-.013,.016,hh*.91,.010,iris,0,12);
    egg(ox,eyeY,z-.0035,.006,hh*.77,.0035,gem,0,9);
    egg(ox,eyeY,z-.001,.0027,hh*.69,.002,ink,0,8);
    egg(ox-.004,eyeY+.006,z+.000,.0047,.0047,.002,white,0,8);
    tube([E(-ww,.005),E(-ww*.4,hh*.87),E(ww*.27,hh*.86),E(ww,.003)].map(([x,y,z])=>[x,y,z+.006]),royal?.0042:.0047,ink,5);
    tube([[ox-ww*.69,eyeY+.035,z-.031],[ox,eyeY+.043,z-.020],[ox+ww*.7,eyeY+.040,z-.029]],royal?.0039:.007,ink,5);
    }
    egg(s*w*.96,-.020,-.004,.029,.047,.025,skin,s*.50,8);
    tip([s*w,-.015,.004],[s*(w+.060),.044,-.010],.025,skin);
    egg(s*(w+.013),-.042,.010,.011,.013,.007,gold,0,8);
    if(!textured && royal){
      egg(s*.071,-.022,.090,.022,.010,.006,blush,0,9);
    }else if(!textured){
      for(let i=0;i<2;i++)sheet([[s*.071,-.025-i*.017,.090],[s*.110,-.017-i*.012,.051],[s*.097,-.034-i*.018,.069]],shell,1);
    }
  }
  const mw=royal?.030:.029;
  if(!textured)tube([[-mw,-.074,.104],[0,-.078,.111],[mw,-.069,.105]],royal?.0051:.0045,mouth,5);
  if(!royal&&!textured){
    tip([0,-.118,.094],[0,-.148,.071],.023,ink);
    sheet([[-.032,-.103,.097],[.034,-.102,.098],[0,-.141,.082]],ink,2);
  }
  b.done(head,'HumanFaceAndCrest',surface([-.134,.166,.268,.318],0,[.034,.080]));
  egg(0,.091,-.045,w*1.17,.103,.127,shadow,0,13);
  if(textured&&!royal){
    // 원본처럼 정수리에서 옆으로 쓸어 넘긴 짙은 앞머리 실루엣.
    for(let j=0;j<5;j++){
      const x=(j-2)*.034;
      const trail=[[x*.70,.161,.041],[x*.82-.007,.154,.089],[x-.012,.127,.111],[x-.029,.101-(j===2?.012:0),.115]];
      tube(trail,.021,j===3?shell:shadow,8);
      tip(trail[2],[x-.038,.085-(j===2?.008:0),.110],.016,shadow);
      tube(trail.slice(0,3).map(([a,y,z])=>[a-.005,y+.002,z+.018]),.003,j%2?shell:violet,5);
    }
  }
  for(let i=0;i<(textured?0:royal+5);i++){
    const x=(i-(royal?2.5:2))* .039,v=Math.abs(x);
    const start=[x*.47,.159-v*.13,.030],mid=[x*.97,.107-v*.52,.105],end=[x*1.42+(royal?-.016:.026),.069-v*.25,.121-v*.42];
    tube([start,mid,end],.027-v*.10, i%3?shadow:shell,6);
    tip(mid,end,.031-v*.10,shadow);
  }
  for(const s of [-1,1]){
    tube([[s*.082,.118,.072],[s*.118,.039,.065],[s*.118,-.086,.032],[s*.126,royal?-.164:-.131,-.047]],.029,shadow,6);
    for(let j=0;j<5;j++){
      const x=s*(.035+j*.025);
      const centers=[[x*.8,.150-j*.009,-.060],[x,.176-j*.009,-.136],[s*(.129+j*.023),.109-j*.017,-.224],[s*(.175+j*.021),-.035-j*.043,-.276]];
      tube(centers,.039-j*.004,j===0?shell:shadow,7);
      tube(centers.map(([x,y,z])=>[x+s*.005,y+.015,z+.004]),.0055,violet,5);
      tube(centers.slice(0,3).map(([x,y,z])=>[x-s*.006,y+.020,z+.010]),.0027,lavender,5);
      tip(centers[2],[s*(.199+j*.023),-.099-j*.046,-.304],.025-j*.003,shadow);
    }
  }
  if(royal){
    for(let i=0;i<11;i++){
      const a=Math.PI*i/10;
      egg(Math.cos(a)*.123,.074+Math.sin(a)*.126,-.022,.024,.030,.032,lace,(a-Math.PI*.50)*.75,8);
    }
    tube([[-.092,.127,.066],[-.057,.166,.081],[0,.183,.086],[.057,.166,.081],[.092,.127,.066]],.009,gold,6);
    for(const x of [-.065,-.033,0,.033,.065])tip([x,.168+(.065-Math.abs(x))*.14,.086],[x,.190+(.065-Math.abs(x))*.37,.083],.009,x===0?shine:gold);
    diamond(0,.193,.092,.026,gem);
    for(const s of [-1,1]){
      sheet([[s*.105,.053,.061],[s*.158,.094,.021],[s*.158,.012,.034]],violet,3);
      sheet([[s*.111,.054,.052],[s*.159,.022,.031],[s*.162,-.051,.003],[s*.125,-.032,.025]],shell,3);
      diamond(s*.112,.055,.066,.012,gem);
    }
  }
}

function torso(THREE,root,mat,royal,surface){
  const b=painter(THREE,mat),{egg,box,tip,sheet,tube,diamond,cylinder}=b;
  const ww=royal?.198:.256;
  egg(0,.842,0,royal?.180:.194,.150,.117,shadow);
  egg(0,1.064,0,ww*.88,.243,.116,shadow);
  egg(0,1.252,-.005,ww,.185,.140,shell,0,13);
  cylinder(0,1.402,0,.082,.111,.12,shadow);
  cylinder(0,1.418,0,.092,.096,.016,gold);
  egg(0,1.453,.006,.064,.067,.061,skin);
  if(!royal){
    for(const s of [-1,1]){
      egg(s*.107,1.258,.110,.128,.108,.062,shadow,s*.18,16);
      for(let j=0;j<3;j++)egg(s*.063,1.157-j*.076,.114,.073-j*.008,.049,.061,shell,s*.17,13);
    }
  }else{
    // 흉갑의 앞면은 한 장의 둥근 입체 셸로 만든다. 옆 가장자리는 몸통 안으로 매끈하게 들어간다.
    egg(0,1.241,.085,.173,.096,.138,shell,0,36);
    // 코르셋의 교차 끈과 중앙 흰 패널.
    sheet([[-.045,1.119,.143],[.045,1.119,.143],[.031,.947,.140],[-.029,.947,.140]],lace,3);
    for(let j=0;j<4;j++){
      const y=1.115-.042*j,w=.046-j*.004;
      tube([[-w,y,.148],[w,y-.032,.148]],.0055,shadow,5);
      tube([[w,y,.149],[-w,y-.032,.149]],.0055,shadow,5);
    }
  }
  const z=.131;
  for(const s of [-1,1]){
    for(let i=0;i<3;i++){
      const y=1.17-i*.075;
      sheet([[s*.008,y+.070,z+.015],[s*ww*(1-i*.072),y+.053,z-.046],[s*ww*(.84-i*.049),y-.003,z-.053],[s*.018,y-.027,z+.014]],i%2?shell:shadow,3);
    }
    const arc=[[s*.014,1.319,z+.008],[s*.137,1.327,z+.01],[s*(ww-.020),1.346,z-.014],[s*(ww+.019),1.337,z-.062]];
    tube(arc,.012,gold,6);
    if(!royal)for(let a=0;a<7;a++){
      const f=a/6;
      const x=s*(ww-.075+f*.162);
      tip([x,1.345-.069*f,-.047+f*.011],[x+s*(.048+f*.026),1.403-f*.021,-.078+f*.030],.029,a%2?lace:silver);
    } else {
      for(let a=0;a<5;a++)egg(s*(ww-.028+a*.014),1.318-a*.019,.066+a*.012,.026,.024,.022,lace,s*.40,8);
      for(let i=0;i<3;i++)sheet([[s*.034,1.14-i*.065,z+.036],[s*.118,1.14-i*.065,z+.009],[s*.037,1.105-i*.065,z+.029]],lavender,3);
    }
  }
  diamond(0,royal?1.333:1.283,royal?.166:.150,royal?.038:.064,gold);
  diamond(0,royal?1.333:1.283,royal?.190:.174,royal?.029:.049,gem);
  cylinder(0,.916,0,.158,.171,.039,gold,0,0,0,12);
  diamond(0,.915,.132,.043,shine);diamond(0,.916,.153,.031,iris);
  b.done(root,'RoyalBreastplate',surface([-.213,1.395,.426,.465],1,royal?[.08,.142]:[.10,.155]));
  if(royal){
    sheet([[-.028,1.335,.179],[-.105,1.383,.137],[-.092,1.297,.188]],violet,3);
    sheet([[.028,1.335,.179],[.105,1.383,.137],[.092,1.297,.188]],violet,3);
    for(let i=0;i<24;i++){
      const a=2*Math.PI*i/24,beta=2*Math.PI*(i+1)/24;
      const ring=(a,r,y)=>[Math.cos(a)*r,y,Math.sin(a)*r*.72];
      sheet([ring(a,.145,.91),ring(beta,.145,.91),ring(beta,.287,.718),ring(a,.287,.718)],i%2?shadow:shell,3);
      sheet([ring(a,.270,.757),ring(beta,.270,.757),ring(beta,.316,.697),ring(a,.305,.704)],i%2?lace:silver,3);
      sheet([ring(a,.242,.790),ring(beta,.242,.790),ring(beta,.278,.744),ring(a,.276,.734)],i%3?shell:lavender,3);
    }
    sheet([[-.133,.897,.139],[.133,.897,.139],[.169,.715,.219],[-.169,.715,.219]],lace,3);
    tube([[-.132,.884,.144],[-.167,.725,.223],[0,.696,.239],[.167,.725,.223],[.132,.884,.144]],.011,gold,6);
    for(const s of [-1,1]){
      sheet([[s*.137,.902,.118],[s*.239,.943,.095],[s*.227,.855,.110]],violet,3);
      sheet([[s*.177,.891,.116],[s*.231,.773,.096],[s*.182,.803,.122]],shell,3);
      diamond(s*.161,.894,.143,.025,gem);
    }
    diamond(0,.774,.216,.041,gold);diamond(0,.767,.232,.023,iris);
    for(const side of [-1,1]) {
      const crest=[[0,.742,.232],[side*.041,.752,.230],[side*.059,.783,.216],[side*.059,.803,.205]];
      tube(crest,.0043,gold,5);
      for(let k=0;k<3;k++) {
        const xx=side*(.027+k*.012),yy=.752+k*.012;
        tip([xx,yy,.228],[xx+side*.019,yy+.019,.223],.0054,shine);
      }
    }
    b.done(root,'EmbroideredApron',surface([-.182,.914,.364,.225],3,[.138,.205]));
  } else {
    for(const s of [-1,1]){
      sheet([[s*.044,.918,.132],[s*.142,.913,.110],[s*.172,.503,.084],[s*.061,.488,.118]],violet,3);
      tube([[s*.045,.91,.136],[s*.060,.499,.122],[s*.173,.511,.088]],.009,gold,5);
      diamond(s*.096,.664,.130,.026,shine);
      b.done(root,'EmbroideredTabard',surface([s<0?-.178:.036,.921,.142,.445],3,[.076,.117]));
    }
  }
}

function capeAndTail(THREE,root,mat,royal,surface){
  const cape=new THREE.Group(),tail=new THREE.Group();root.add(cape,tail);
  cape.position.set(0,1.326,-.153);tail.position.set(0,.786,-.072);
  let b=painter(THREE,mat);
  for(let i=0;i<8;i++){
    const x=-1+i*.25,n=x+.25,a=royal?.22:.297,w=royal?.245:.33;
    const hem=f=>royal?-.90+.18*Math.abs(f): -1.19+.31*Math.abs(f);
    const Z=f=>-.123-.068*(1-Math.abs(f))+.018*Math.cos(f*21);
    b.sheet([[x*a,.015,0],[n*a,.015,0],[n*w,hem(n),Z(n)],[x*w,hem(x),Z(x)]],i%2?violet:shell,2+i%2);
    b.sheet([[x*w,hem(x),Z(x)],[n*w,hem(n),Z(n)],[n*w,hem(n)+.025,Z(n)-.004],[x*w,hem(x)+.025,Z(x)-.004]],gold,3);
  }
  b.diamond(0,-.56,-.145,.082,gold);b.diamond(0,-.57,-.173,.044,gem);
  b.done(cape,'RoyalCape',surface([-.306,-.10,.612,1.05],2,[.045,.114],true));
  b=painter(THREE,mat);
  const pts=[[0,0,-.02],[.03,-.15,-.22],[.10,-.24,-.41],[.20,-.15,-.57],[.28,-.035,-.70]];
  b.tube(pts,.046,shell,8);
  for(let i=0;i<10;i++){
    const t=i/9,z=-.08-t*.57,x=.018+t*t*.24,y=-.022-.203*Math.sin(t*Math.PI*.88);
    b.egg(x,y,z,.049-.020*t,.052-.026*t,.046, i%3===1?violet:shadow,0,8);
  }
  b.tip([.24,-.089,-.63],[.30,.022,-.77],.042,shell);
  b.done(tail,'SegmentedCrestTail');
  return {cape,tail};
}

function segments(THREE,root,mat,{royal,side=1,surface}){
  const top=new THREE.Group(),bottom=new THREE.Group(),paw=new THREE.Group();
  root.add(top,bottom,paw);
  let b=painter(THREE,mat);
  b.egg(0,.015,0,.094,.231,.091,shell,0,10);
  b.egg(0,-.132,.037,.089,.080,.049,gold,0,9);
  b.egg(0,-.131,.069,.075,.063,.033,royal?silver:violet,0,9);
  b.diamond(0,-.144,.092,royal?.082:.089,gold);
  b.diamond(0,-.137,.116,royal?.070:.074,royal?silver:shell);
  b.diamond(0,-.146,.155,.025,royal?violet:lavender);
  if(royal)b.egg(0,.066,.007,.071,.148,.076,skinShade,0,12);
  b.done(top);
  b=painter(THREE,mat);
  b.cylinder(0,.015,0,.072,.052,.352,shadow);
  b.egg(0,.001,.038,.064,.169,.062,royal?silver:shell,0,9);
  b.tip([0,.195,.065],[0,-.170,.072],.061,royal?lace:steel);
  b.cylinder(0,-.118,0,.054,.051,.028,gold);
  b.done(bottom,'EngravedGreave',surface([-.079,.200,.158,.397],5,[.027,.090]));
  b=painter(THREE,mat);
  b.egg(0,.049,.038,.067,.050,.122,shadow,0,10);
  b.egg(0,.058,.061,.057,.047,.088,royal?silver:shell,0,10);
  b.sheet([[-.047,.046,.134],[.047,.046,.134],[.036,.092,.095],[-.036,.092,.095]],gold,3);
  b.done(paw,'RoyalSabatons',surface([-.074,.119,.148,.124],8,[.057,.117]));
  return {top,bottom,paw,side};
}

function arms(THREE,parent,mat,royal,surface){
  const result=[];
  for(const s of [-1,1]){
    const pivot=new THREE.Group(),elbow=new THREE.Group();
    pivot.position.set(s*(royal?.191:.235),1.295,0);elbow.position.y=-.257;
    pivot.rotation.z=s*.105;parent.add(pivot);pivot.add(elbow);
    let b=painter(THREE,mat);
    b.egg(s*.034,-.020,0,royal?.094:.119,.103,.095,gold,s*-.27,10);
    b.egg(s*.037,-.021,.014,royal?.087:.109,.096,.091,royal?silver:shell,s*-.27,16);
    b.tube([[s*.006,.059,.046],[s*.061,.054,.071],[s*.109,.016,.057],[s*.094,-.044,.048]],.010,gold,7);
    if(!royal){
      for(let j=0;j<4;j++)
        b.tip([s*(.026+j*.024),.049-j*.013,-.027],[s*(.061+j*.029),.098-j*.011,-.043],.018,lace);
    }
    b.diamond(s*.052,-.033,.076,royal?.037:.045,royal?violet:gem);
    b.egg(0,-.149,0,.059,.143,.062,shadow,0,9);
    b.cylinder(0,-.208,0,.063,.062,.024,gold);
    b.done(pivot,'GildedPauldron',surface([s*.034-.118,.085,.236,.203],7,[.032,.080]));
    b=painter(THREE,mat);
    b.egg(0,-.079,0,.059,.102,.052,royal?silver:shell,0,10);
    b.egg(0,-.063,.038,.057,.092,.026,royal?steel:violet,0,9);
    b.cylinder(0,-.147,0,.051,.048,.021,gold);
    b.egg(0,-.177,.008,.046,.062,.043,shadow,0,9);
    for(let i=0;i<3;i++)b.egg(-.024+i*.024,-.211,.030,.015,.038,.024,shell,0,7);
    b.done(elbow,'EngravedVambrace',surface([-.066,.032,.132,.189],4,[.021,.059]));
    elbow.rotation.x=-.13;
    result.push({pivot,elbow,s});
  }
  return result;
}

function biped(THREE,mat,royal,surface,textured){
  const root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group();root.add(body);body.add(head);
  head.position.set(0,1.586,0);
  const b=painter(THREE,mat);
  face(THREE,b,royal,textured,head,surface);b.done(head,'HairAndCrest');
  const h=painter(THREE,mat);
  // 뒷머리는 사진의 잘린 경계 대신 입체 머리카락과 연속된 보라빛 선으로 표현한다.
  h.egg(0,.070,-.076,royal?.118:.131,.124,.104,shadow,0,24);
  h.egg(0,-.037,-.077,royal?.097:.111,.124,.077,shadow,0,20);
  for(let j=-4;j<=4;j++){
    const a=Math.abs(j),x=j*.030,d=j*.011;
    const fall=royal?.41+.025*a:.52+.015*a;
    const trail=[[x*.6,.158-a*.011,-.050],[x,.103,-.152],[x*1.12,-.086,-.212+a*.008],
      [x*1.22+d,-.244,-.237+a*.007],[x*1.32+d,-fall,-.254+a*.010]];
    h.tube(trail,.041-a*.003,j%3===0?shell:shadow,12);
    h.tube(trail.map(([x,y,z],i)=>[x+.006,y+.001,z-(i<3?.036:.026)]),.004-a*.0004,a%2?shell:violet,7);
    h.tip(trail[3],[x*1.40+d,-fall-.071,-.265+a*.012],.028-a*.002,shadow);
  }
  h.done(head,'HairCrownBack');
  torso(THREE,body,mat,royal,surface);
  const armsRig=arms(THREE,body,mat,royal,surface),acc=capeAndTail(THREE,body,mat,royal,surface);
  const legs=[-1,1].map(side=>segments(THREE,root,mat,{royal,side,surface}));
  if(!royal){
    const sword=new THREE.Group();sword.position.set(-.317,1.049,.047);sword.rotation.z=-.16;sword.rotation.x=-.08;body.add(sword);
    const g=painter(THREE,mat);
    const crown=[0,-.080,.012], end=[0,-.947,.013];
    g.sheet([[-.053,-.123,0],crown,[0,-.691,.037],end],silver,4);
    g.sheet([crown,[.053,-.123,0],end,[0,-.691,.037]],steel,3);
    g.sheet([[-.053,-.123,0],[-.044,-.695,0],end],graphite,2);
    g.sheet([[.053,-.123,0],[.048,-.695,0],end],lavender,4);
    g.tube([[-.043,-.126,.009],[0,-.081,.038],[.043,-.126,.009]],.011,gold,6);
    g.tube([[-.114,.013,.015],[-.040,.023,.019],[0,-.033,.026],[.040,.023,.019],[.114,.013,.015]],.015,gold,7);
    g.tip([-.078,.016,.016],[-.119,.057,.016],.016,shine);
    g.tip([.078,.016,.016],[.119,.057,.016],.016,shine);
    g.box(0,.078,0,.035,.138,.034,shadow);
    for(let j=1;j<6;j++)g.cylinder(0,.026+j*.021,0,.023,.023,.009,gold,0,0,0,8);
    g.diamond(0,-.029,.034,.054,gold);g.diamond(0,-.029,.058,.036,gem);g.diamond(0,.167,0,.036,shine);
    g.done(sword,'SheathedFamilySword');
  }
  return {root,body,head,armsRig,legs,...acc,scale:royal?.307:.335};
}

export function footCycle(phase,offset){
  const t=((phase+offset)%1+1)%1,stance=.63, stride=.385;
  if(t<stance)return {z:stride*(.5-t/stance),y:0,onGround:true};
  const s=(t-stance)/(1-stance),e=s*s*(3-2*s);
  return {z:stride*(e-.5),y:.123*Math.sin(Math.PI*s)**1.18,onGround:false};
}
function walking(THREE,form,phase,amount,look){
  const bob=.016*Math.sin(phase*4*Math.PI)*amount;
  form.body.position.y=bob;
  form.head.rotation.y=look*.60;
  form.head.rotation.x=.024*Math.sin(phase*2*Math.PI)*amount;
  form.tail.rotation.y=.108*Math.sin(phase*Math.PI*2-.9)*amount+.045*look;
  if(form.cape)form.cape.rotation.x=-.11*amount;
  const up=new THREE.Vector3(0,1,0);
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const midpoint=(o,a,b)=>{
    o.position.copy(a).lerp(b,.5);
    o.quaternion.setFromUnitVectors(up,a.clone().sub(b).normalize());
  };
  for(const [i,leg] of form.legs.entries()){
    const h=.827, x=leg.side*.098, z=0;
    const stride=footCycle(phase,i*.5);
    const hip=V(x,h+bob,z),foot=V(x,.067+stride.y*amount,z+stride.z*amount);
    const end=foot.clone().sub(hip), dist=Math.max(.05,end.length());
    const lenA=.401,lenB=.390;
    const proj=Math.max(.06,Math.min(dist-.015,(dist*dist+lenA*lenA-lenB*lenB)/(2*dist)));
    const normal=V(0,end.z,-end.y).normalize();
    const bend=Math.sqrt(Math.max(.001,lenA*lenA-proj*proj));
    const knee=hip.clone().addScaledVector(end,proj/dist).addScaledVector(normal,bend);
    midpoint(leg.top,hip,knee);midpoint(leg.bottom,knee,foot);
    leg.paw.position.set(x,stride.y*amount,foot.z);
  }
  if(form.armsRig)for(const p of form.armsRig){
    p.pivot.rotation.x=-p.s*.36*Math.sin(phase*2*Math.PI)*amount;
    p.elbow.rotation.x=-.13-Math.max(0,p.pivot.rotation.x)*.49;
  }
}
export function makeRoyalModel(THREE,texture,royal,details){
  const mesh=new THREE.Group(),mat=new THREE.ShaderMaterial({uniforms:{photo:{value:texture}},vertexShader:vs,fragmentShader:fs,side:THREE.DoubleSide});
  const surface=(...args)=>detailSurface(THREE,mat,details,...args);
  const human=biped(THREE,mat,royal,surface,Boolean(details));
  mesh.add(human.root);
  human.root.scale.setScalar(human.scale);
  function pose(phase,amount,look){walking(THREE,human,phase,amount,look);}
  pose(0,0,0);
  function dispose(){
    const materials=new Set();
    mesh.traverse(item=>{if(item.isMesh){item.geometry.dispose();materials.add(item.material);}});
    for(const m of materials)m.dispose();
  }
  return {mesh,pose,dispose,headHeight:royal?.575:.642};
}
