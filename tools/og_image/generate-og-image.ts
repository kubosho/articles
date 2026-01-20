import fs from 'node:fs/promises';
import path from 'node:path';

import fm from 'front-matter';
import satori from 'satori';
import sharp from 'sharp';

type Params = {
  title: string;
};

export async function generateOgImage({ title }: Params): Promise<string> {
  const [backgroundImage, font] = await Promise.all([
    fs.readFile(path.resolve(__dirname, './templates/og-image.png'), 'base64'),
    fs.readFile(path.resolve(__dirname, './fonts/NotoSansJP-Bold.ttf')),
  ]);

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          boxSizing: 'border-box',
          display: 'flex',
          width: 1200,
          height: 630,
          padding: '24px 48px 24px',
          backgroundImage: `url(data:image/png;base64,${backgroundImage})`,
          backgroundSize: '1200px 630px',
        },
        children: {
          type: 'h1',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              margin: 0,
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#1b1b1b',
            },
            children: title,
          },
        },
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'NotoSansJP',
          data: font,
          weight: 900,
          style: 'normal',
        },
      ],
    },
  );

  return svg;
}

async function main(): Promise<void> {
  const entriesPath = path.resolve(__dirname, '../../', 'articles');
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

      const image = await generateOgImage({
        title: attributes.title,
      });

      await sharp(Buffer.from(image, 'utf-8'))
        .webp({ quality: 100 })
        .toFile(path.resolve(ogImagesPath, `${slug}.webp`));
    }),
  );
}

void main();
