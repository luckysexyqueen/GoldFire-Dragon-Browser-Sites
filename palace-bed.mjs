import { BED } from './palace-locations.mjs?v=canopy-room';

export const BED_IMAGE=new URL('./img/locations/bedroom-furniture.webp',import.meta.url).href;
export function createBed(THREE,photo) {
  const material=new THREE.ShaderMaterial({
    uniforms:{photo:{value:photo}},
    vertexShader:`
      varying vec2 imageUV;
      varying float shade;
      void main(){
        imageUV=uv;
        shade=.87+.13*max(0.0,dot(normal,normalize(vec3(-.38,.84,.30))));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D photo;
      varying vec2 imageUV;
      varying float shade;
      void main(){gl_FragColor=vec4(texture2D(photo,imageUV).rgb*shade,1.0);}
    `
  });
  const meshes=[];
  function atlas(geometry,tile){
    const uv=geometry.getAttribute('uv'),col=tile%3,row=Math.floor(tile/3);
    for(let i=0;i<uv.count;i++)uv.setXY(i,(col+.012+.976*uv.getX(i))/3,(row+.012+.976*(1-uv.getY(i)))/2);
    return geometry;
  }
  function add(name,base,x,y,z,w,h,d,tile){
    const mesh=new THREE.Mesh(atlas(base,tile),material);
    mesh.name='BedroomBed-'+name;
    mesh.position.set(x,y,-z);mesh.scale.set(w,h,d);mesh.visible=false;
    meshes.push(mesh);return mesh;
  }
  function box(name,x,y,z,w,h,d,tile){
    return add(name,new THREE.BoxGeometry(1,1,1),x,y,z,w,h,d,tile);
  }
  function cushion(name,x,y,z,w,h,d,tile){
    return add(name,new THREE.SphereGeometry(.5,24,12),x,y,z,w,h,d,tile);
  }
  function panel(name,y,z,w,h,depth,tile) {
    const shape=new THREE.Shape();
    shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(.5,.08);
    shape.bezierCurveTo(.50,.24,.23,.19,.17,.35);
    shape.bezierCurveTo(.12,.42,.045,.50,0,.52);
    shape.bezierCurveTo(-.045,.50,-.12,.42,-.17,.35);
    shape.bezierCurveTo(-.23,.19,-.50,.24,-.5,.08);
    shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:1,steps:1,curveSegments:20,bevelEnabled:false});
    g.translate(0,0,-.5);
    const pos=g.getAttribute('position'),uv=g.getAttribute('uv');
    for(let i=0;i<pos.count;i++)uv.setXY(i,Math.min(1,Math.max(0,pos.getX(i)+.5)),Math.min(1,Math.max(0,pos.getY(i)+.5)));
    return add(name,g,0,y,z,w,h,depth,tile);
  }
  const z=(BED.near+BED.far)/2,d=BED.far-BED.near,w=BED.halfWidth*2;
  box('Base',0,-.355,z,w,.147,d,1);
  box('GoldRail',0,-.293,z,w+.018,.018,d+.019,4);
  box('Mattress',0,BED.top-.035,z,w-.022,.070,d-.018,0);
  box('Cover',0,BED.top-.005,z-.016,w-.035,.013,d-.045,0);
  box('FootTrim',0,BED.top-.049,BED.near+.008,w-.022,.010,.017,4);
  box('CrossBand',0,BED.top+.001,BED.near+.082,w-.04,.004,.014,5);
  panel('HeadboardGold',-.163,BED.far+.017,w+.050,.547,.035,4);
  panel('HeadboardVelvet',-.167,BED.far-.007,w-.012,.478,.024,3);
  for(const sign of [-1,1]){
    box('Post'+sign,sign*(BED.halfWidth+.003),-.167,BED.far+.012,.035,.515,.045,4);
    cushion('Finial'+sign,sign*(BED.halfWidth+.003),.106,BED.far+.012,.057,.069,.054,4);
    cushion('Pillow'+sign,sign*.216,BED.top+.028,BED.far-.12,.370,.066,.175,2);
  }
  return meshes;
}
