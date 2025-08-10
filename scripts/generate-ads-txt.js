import fs from 'node:fs/promises';
import path from 'node:path';
import fetch from 'node-fetch';

async function main() {
  try {
    const adsTxtUrl = process.env.EZOIC_ADSTXT_URL;
    const projectRoot = process.cwd();
    const outputPath = path.join(projectRoot, 'public', 'ads.txt');

    if (!adsTxtUrl) {
      console.warn('[ads.txt] Skipping generation: EZOIC_ADSTXT_URL is not set.');
      return;
    }

    const response = await fetch(adsTxtUrl, { redirect: 'follow' });
    if (!response.ok) {
      console.warn(`[ads.txt] Failed to fetch (${response.status}) from EZOIC_ADSTXT_URL; skipping write.`);
      return;
    }

    const content = await response.text();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(`[ads.txt] Wrote ${content.length} bytes to public/ads.txt`);
  } catch (error) {
    console.warn('[ads.txt] Error generating ads.txt:', error);
  }
}

main();


