# assets

catalog.json is the machine-readable provenance and deployment catalog; path-map.json preserves old logical paths. runtime contains Vite-imported media so content-hashed filenames remain compatible. source contains editable/original inputs and archival variants, not automatically published. public/assets contains URL-addressable media. Regenerate the catalog with python3 tools/assets/catalog.py. Unknown provenance is explicitly marked; human credits remain authored in docs/credits_extended.txt.

Production public media is fingerprinted by `tools/build/public-assets.js`; `dist/asset-manifest.json` maps logical paths to SHA-256 filenames. Vite-imported runtime media keeps Vite-generated hashes. Stable aliases remain for older clients, while the service worker precaches only canonical media and reuses matching content across releases.
