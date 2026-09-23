// Reuse the static maze depth atlas: a moving shadow can darken only the first
// surface reached by the light. The RG channels contain packed 16-bit depth.
export function mazeLightVisibility(atlas, prefix, worldPosition, wallId = null, surfaceNormal = null) {
  const name = (s) => prefix + s;
  const uniforms = {
    [name('Atlas')]: { value: atlas.target.texture },
    [name('Matrices')]: { value: atlas.entries.map((e) => e.matrix) },
  };
  const declarations = `uniform sampler2D ${name('Atlas')};uniform mat4 ${name('Matrices')}[${atlas.entries.length}];`;
  const code =
    `float ${name('Visible')}=1.;\n` +
    (wallId ? `
      // Closed slab faces facing away from the light are shielded by the slab
      // itself. A nearest texel straddling the roof edge must not expose them.
      vec3 ${name('Normal')}=normalize(${surfaceNormal || `cross(dFdx(${worldPosition}),dFdy(${worldPosition}))`});
      ${surfaceNormal ? '' : `if(!gl_FrontFacing)${name('Normal')}=-${name('Normal')};`}
      if(${wallId}>.5&&dot(${name('Normal')},vec3(-.5,1.,-.5))<=0.)${name('Visible')}=0.;
    ` : '') +
    atlas.entries
      .map(
        (_, i) => `{
  vec4 projected=${name('Matrices')}[${i}]*vec4(${worldPosition},1.);
  vec3 p=projected.xyz/projected.w;
  vec3 px=dFdx(p),py=dFdy(p);float det=px.x*py.y-px.y*py.x;
  vec2 slope=abs(det)>1e-20?vec2(px.z*py.y-py.z*px.y,py.z*px.x-px.z*py.x)/det:vec2(0.);
  if(all(greaterThan(p,vec3(0.)))&&all(lessThan(p,vec3(1.)))){
   vec2 local=(floor(p.xy*${atlas.size}.)+.5)/${atlas.size}.;
   vec2 uv=(local+vec2(${i % atlas.columns}.,${Math.floor(i / atlas.columns)}.))/vec2(${atlas.columns}.,${atlas.rows}.);
   vec4 sampleDepth=texture2D(${name('Atlas')},uv);
   float nearest=unpackRGToDepth(sampleDepth.rg);
   ${wallId ? `float casterId=floor(sampleDepth.b*255.+.5)+256.*floor(sampleDepth.a*255.+.5);` : ''}
   float receiver=p.z+dot(slope,local-p.xy);
   // Correct sample position on the receiver plane; retain only quantization
   // tolerance, not a large bias that could expose an obscured wall face.
   if(receiver>nearest+3./65535.${wallId ? `&& !(${wallId}>.5&&abs(casterId-${wallId})<.5)` : ''})${name('Visible')}=0.;
  }
 }`,
      )
      .join('\n');
  return { uniforms, declarations, code, visible: name('Visible') };
}
export function occludeProjectedShadow(material, atlas) {
  const base = (material.userData.mazeOcclusionBase ??= {
    compile: material.onBeforeCompile,
    key: material.customProgramCacheKey(),
  });
  material.onBeforeCompile = (shader) => {
    base.compile?.(shader);
    const mask = mazeLightVisibility(atlas, 'projectedMaze', 'projectedWorld');
    Object.assign(shader.uniforms, mask.uniforms);
    shader.vertexShader = 'varying vec3 projectedWorld;\n' + shader.vertexShader;
    // Projected silhouettes already compute `world` on the receiving floor.
    shader.vertexShader = shader.vertexShader.replace(
      'gl_Position=',
      'projectedWorld=world.xyz;gl_Position=',
    );
    shader.fragmentShader =
      '#include <packing>\nvarying vec3 projectedWorld;\n' +
      mask.declarations +
      '\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main(){',
      `void main(){${mask.code}\nif(${mask.visible}<.5)discard;`,
    );
  };
  material.customProgramCacheKey = () => `${base.key}|maze-occlusion-v1:${atlas.entries.length}`;
  material.dispose();
  material.needsUpdate = true;
}
