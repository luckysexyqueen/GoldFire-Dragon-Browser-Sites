import { BED, BEDROOM } from './palace-locations.mjs?v=canopy-room';
export const TEXTILE_ASSETS=['bedroom-curtain','bedroom-curtain-brass','bedroom-carpet']
 .map(file=>new URL('./img/locations/'+file+'.webp?v=canopy-room',import.meta.url).href);
export function curtainPanelWidth(amount){
  return .176+.503*Math.max(0,Math.min(1,amount));
}
export function createBedroomTextiles(THREE, [velvet,brass,carpet]) {
  function makeMaterial(photo, f=.14){
    return new THREE.ShaderMaterial({
      side:THREE.DoubleSide,uniforms:{photo:{value:photo}},
      vertexShader:`
        varying vec2 imageUV;
        varying float shade;
        void main() {
          imageUV=uv;
          shade=1.0-${f.toFixed(3)}*(1.0-abs(dot(normalize(normal),normalize(vec3(.25,.74,.52)))));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        }`,
      fragmentShader:`
        uniform sampler2D photo;
        varying vec2 imageUV;
        varying float shade;
        void main() { gl_FragColor=vec4(texture2D(photo,imageUV).rgb*shade,1.0); }`
    });
  }
  const bronze=makeMaterial(brass),cloth=makeMaterial(velvet,.29),rug=makeMaterial(carpet,.035);
  const parts=[],panels=[];
  function shape(name,geo,material,x,y,z){
    const mesh=new THREE.Mesh(geo,material);
    mesh.name='BedroomTextile-'+name;mesh.visible=false;
    mesh.position.set(x,y,-z);parts.push(mesh);return mesh;
  }
  function timber(name,x,y,z,w,h,d){
    return shape(name,new THREE.BoxGeometry(w,h,d),bronze,x,y,z);
  }
  const near=BED.near-.113,far=BED.far+.038,half=.674, top=.490,bottom=BEDROOM.floor+.027;
  const height=top-bottom,d=far-near;
  for(const sign of [-1,1]){
    for(const z of [near,far]){
      timber('Column'+sign+z,sign*half,BEDROOM.floor+(top-BEDROOM.floor)*.5,z,.035,top-BEDROOM.floor+.032,.037);
      timber('Cap'+sign+z,sign*half,top+.034,z,.061,.055,.059);
    }
    timber('SideRail'+sign,sign*half,top+.016,(near+far)/2,.032,.038,d);
  }
  timber('FrontRail',0,top+.016,near,2*half+.055,.042,.044);
  timber('RearRail',0,top+.016,far,2*half+.055,.036,.035);

  for(const sign of [-1,1]){
    const p=[],uv=[],faces=[],U=60,V=28;
    // 옆 기둥에서 가운데로 당겨지는 패널. 실제 굴곡과 접힌 밑단을 가진 양면 천이다.
    for(let j=0;j<=V;j++)for(let i=0;i<=U;i++){
      const x=i/U,t=j/V,fold=Math.cos(x*2*Math.PI*9+.18*Math.sin(t*3));
      const vertical=t*height+.014*Math.pow(1-t,14)*(.52+.48*Math.cos(x*18*Math.PI));
      p.push(x,vertical,.021*fold*(.66+.34*t));
      uv.push(x,1-t);
    }
    for(let j=0;j<V;j++)for(let i=0;i<U;i++){
      const a=j*(U+1)+i,b=a+U+1;
      faces.push(a,a+1,b+1,a,b+1,b);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(faces);g.computeVertexNormals();
    const curtain=shape('Curtain'+sign,g,cloth,sign*half,bottom,near);
    panels.push([curtain,sign]);
  }

  // 한 장의 실제 표면으로 바닥 전체를 덮고, 가장자리는 벽과 만나게 한다.
  const w=BEDROOM.halfWidth*2,dFloor=BEDROOM.front+BEDROOM.back;
  const plane=new THREE.PlaneGeometry(w,dFloor);
  plane.rotateX(-Math.PI/2);
  const uv=plane.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
  shape('WallToWallCarpet',plane,rug,0,BEDROOM.floor+.0018,(BEDROOM.front-BEDROOM.back)/2);

  return {
    pieces:parts,
    set(amount){
      const width=curtainPanelWidth(amount);
      for(const [mesh,sign] of panels)mesh.scale.x=-sign*width;
    }
  };
}
