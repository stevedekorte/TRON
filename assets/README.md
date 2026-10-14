# assets

catalog.json is the machine-readable provenance and deployment catalog; path-map.json preserves old logical paths. runtime contains Vite-imported media so content-hashed filenames remain compatible. source contains editable/original inputs and archival variants, not automatically published. public/assets contains URL-addressable media. Regenerate the catalog with python3 tools/assets/catalog.py. Unknown provenance is explicitly marked; human credits remain authored in docs/credits_extended.txt.
