const vertexShader = `
varying vec2 photoUV;
varying float sheen;
uniform float goldShine;
void main() {
  vec4 viewPoint=modelViewMatrix*vec4(position,1.0);
  vec3 n=normalize(normalMatrix*normal);
  vec3 lamp=normalize(vec3(-.48,.70,.52));
  vec3 halfLight=normalize(lamp+normalize(-viewPoint.xyz));
  sheen=.79+.24*max(0.0,dot(n,lamp))+.18*pow(max(0.0,dot(n,halfLight)),14.0);
  sheen+=goldShine*(.055+.20*pow(max(0.0,dot(n,halfLight)),24.0));
  photoUV=uv;
  gl_Position=projectionMatrix*viewPoint;
}`;
const fragmentShader = `
varying vec2 photoUV;
varying float sheen;
uniform sampler2D photo;
void main() {
  gl_FragColor=vec4(texture2D(photo,photoUV).rgb*sheen,1.0);
}`;

export function createPhotoSurfaceMaterial(THREE,photo,goldShine=0) {
  const material = new THREE.ShaderMaterial({
    uniforms:{photo:{value:photo},goldShine:{value:goldShine}},vertexShader,fragmentShader
  });
  material.userData.hairSheen = true;
  material.userData.goldShine=goldShine;
  return material;
}
