import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

for (const source of process.argv.slice(2)) {
  const data = new Uint8Array(await fs.readFile(source));
  const task = getDocument({data, useSystemFonts: true});
  const doc = await task.promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(`\n--- PAGE ${p} ---\n` + content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join(''));
    if (p === 1 || p === 2) {
      const viewport = page.getViewport({scale: 1.2});
      const factory = doc.canvasFactory;
      const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({canvasContext: target.context, viewport}).promise;
      await fs.writeFile(path.join(import.meta.dirname, `${path.basename(source,'.pdf')}-page-${p}.png`), target.canvas.toBuffer('image/png'));
      factory.destroy(target);
    }
  }
  const output = path.join(import.meta.dirname, path.basename(source, '.pdf') + '.txt');
  await fs.writeFile(output, pages.join('\n'));
  console.log(JSON.stringify({source, pages:doc.numPages, textPath:output, attachments:Object.keys(await doc.getAttachments() || {})}));
  await task.destroy();
}
