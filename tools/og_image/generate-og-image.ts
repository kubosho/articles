import fs from 'node:fs/promises';
import path from 'node:path';

import fm from 'front-matter';
import { chromium } from 'playwright';
import sharp from 'sharp';

type Params = {
  pageTitle: string;
  siteTitle: string;
};

const BLOG_TITLE = '学ぶ、考える、書き出す。';

function addBr(text: string): string {
  const t = text;
  return t.replace(/、/g, '$&<br />');
}

export async function generateOgImage({ pageTitle, siteTitle }: Params): Promise<Buffer> {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  const page = await context.newPage();
  await page.setViewportSize({
    width: 1200,
    height: 630,
  });

  const [baseHtml, baseImage] = await Promise.all([
    fs.readFile(path.resolve(__dirname, './templates/og-image.html'), 'utf-8'),
    fs.readFile(path.resolve(__dirname, './templates/og-image.png'), 'base64'),
  ]);

  const html = baseHtml
    .replace('{{pageTitle}}', pageTitle)
    .replace('{{siteTitle}}', siteTitle)
    .replace('{{image}}', `data:image/png;base64,${baseImage}`);

  await page.setContent(html, { waitUntil: 'load' });

  const screenshot = await page.screenshot();
  await browser.close();
  return screenshot;
}

async function main(): Promise<void> {
  const entriesPath = path.resolve(__dirname, '../../', 'src');
  const entriesDirents = await fs.readdir(entriesPath, { withFileTypes: true });

  const ogImagesPath = path.resolve(__dirname, '../../', 'dist/og_images');
  await fs.rm(ogImagesPath, { recursive: true }).catch(() => {});
  await fs.mkdir(ogImagesPath, { recursive: true }).catch(() => {});
  await fs.readdir(ogImagesPath, { withFileTypes: true }).catch(() => {});

  await Promise.all(
    entriesDirents.map(async ({ name: fileName }) => {
      const filepath = path.join(entriesPath, fileName);
      const slug = path.parse(fileName).name;

      const contents = await fs.readFile(filepath, 'utf-8');
      const { attributes } = fm<{ title: string }>(contents);

      const buffer = await generateOgImage({ pageTitle: attributes.title, siteTitle: addBr(BLOG_TITLE) });
      await sharp(buffer)
        .webp({ quality: 80 })
        .toFile(path.resolve(ogImagesPath, `${slug}.webp`));
    }),
  );
}

void main();
