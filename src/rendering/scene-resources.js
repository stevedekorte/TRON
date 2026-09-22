/** Dispose scene-owned resources once. Shadow/effect owners release their private targets first. */
export function disposeSceneResources(scene) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  scene.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  for (const m of materials) {
    for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    m.dispose();
  }
  for (const g of geometries) g.dispose();
  for (const t of textures) t.dispose();
  scene.clear();
}
