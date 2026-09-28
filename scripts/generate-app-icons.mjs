import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser = await chromium.launch({channel: process.env.TRON_BROWSER_CHANNEL || 'chrome', headless: true});
try {
  const page = await browser.newPage({deviceScaleFactor: 1});
  const logo = (await readFile('public/images/encom-app.svg','utf8')).replace('<svg ', '<svg x="86" y="86" width="340" height="340" ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#080c16"/>${logo}</svg>`;
  const revision=createHash('sha256').update(svg).digest('hex').slice(0,12);
  const iconName=size=>`encom-e-${revision}-${size}.png`;
  await writeFile('public/icons/icon.svg',svg+'\n');
  await writeFile(`public/icons/encom-e-${revision}.svg`,svg+'\n');
  for (const size of [180,192,512]) {
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    const png=await page.screenshot({path:`public/icons/icon-${size}.png`});
    await writeFile(`public/icons/${iconName(size)}`,png);
  }
  const manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
  for(const icon of manifest.icons)icon.src=`icons/${iconName(parseInt(icon.sizes,10))}`;
  await writeFile('public/manifest.webmanifest',JSON.stringify(manifest,null,2)+'\n');
  const html=(await readFile('index.html','utf8'))
    .replace(/(<link rel="icon"[^>]*href=")[^"]+/,`$1./icons/encom-e-${revision}.svg`)
    .replace(/(<link rel="apple-touch-icon"[^>]*href=")[^"]+/,`$1./icons/${iconName(180)}`);
  await writeFile('index.html',html);
} finally {await browser.close();}
