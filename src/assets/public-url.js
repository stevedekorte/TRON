import assets from 'virtual:tron-public-assets';
/** Stable logical paths in development, immutable content URLs in production. */
export function publicAssetUrl(path){return import.meta.env.BASE_URL+(assets[path]??path);}
