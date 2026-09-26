// Regenerate the committed images with: node scripts/generate-brand-assets.mjs
// Requires Playwright Chromium and network access to the same Google Fonts as the app.
// Production serves the generated files directly, without a font or image service.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const output = fileURLToPath(new URL("../src/app/", import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&family=Noto+Sans+JP:wght@500;700&display=block">';

async function render(html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html lang="vi"><head><meta charset="utf-8">${fonts}</head><body>${html}</body></html>`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const japanese = await document.fonts.load('700 32px "Noto Sans JP"', "語学ぶまなぶ");
    const latin = await document.fonts.load('700 32px Geist', "Học từ vựng tiếng Nhật.");
    if (!japanese.length || !latin.length) throw new Error("Brand fonts did not load.");
  });
  return page.screenshot({ omitBackground: true });
}

async function icon(size, apple = false) {
  return render(`<style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: transparent; }
    .mark { width: 100%; height: 100%; border-radius: ${apple ? "0" : "50%"}; background: #c63d3d;
      display: flex; align-items: center; justify-content: center; color: white;
      font: 700 ${size * 0.66}px / 1 "Noto Sans JP"; }
    </style><div class="mark" lang="ja">語</div>`, size, size);
}

// ICO supports PNG entries; include small sizes for browser tabs and larger bookmarks.
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

try {
  const icons = [];
  for (const size of [16, 32, 48, 64, 128, 256]) icons.push({ size, png: await icon(size) });
  await writeFile(`${output}favicon.ico`, ico(icons));
  await writeFile(`${output}icon.png`, await icon(192));
  await writeFile(`${output}apple-icon.png`, await icon(180, true));

  const preview = await render(`<style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body { background: #edf0f3; color: #1e252d; font-family: Geist, sans-serif; }
    .brand { position: absolute; top: 58px; left: 64px; display: flex; align-items: center; gap: 16px; font-size: 36px; font-weight: 700; letter-spacing: -1px; }
    .mark { width: 58px; height: 58px; border-radius: 50%; background: #c63d3d; color: white; display: flex; align-items: center; justify-content: center; font: 700 38px / 1 "Noto Sans JP"; }
    h1 { position: absolute; left: 64px; top: 212px; margin: 0; font-size: 72px; line-height: 1.12; font-weight: 700; letter-spacing: -2.6px; }
    h1 span { color: #c63d3d; }
    .description { position: absolute; left: 64px; top: 416px; margin: 0; width: 560px; font-size: 27px; line-height: 1.5; color: #596570; }
    .footer { position: absolute; left: 64px; bottom: 54px; font-size: 22px; font-weight: 600; color: #596570; }
    .card { position: absolute; right: 64px; top: 104px; width: 424px; height: 422px; border-radius: 16px; background: white; box-shadow: 0 22px 55px rgba(49,63,77,.12); padding: 32px; }
    .label { color: #596570; font-size: 20px; font-weight: 600; }
    .kanji { margin-top: 26px; text-align: center; font: 500 116px / 1.25 "Noto Sans JP"; letter-spacing: -3px; }
    .reading { margin-top: 12px; text-align: center; color: #596570; font: 500 28px / 1.4 "Noto Sans JP"; }
    .meaning { margin-top: 26px; padding-top: 22px; border-top: 1px solid #d8dde2; font-size: 27px; font-weight: 600; text-align: center; }
    </style>
    <div class="brand"><span class="mark" lang="ja">語</span>Kotoba</div>
    <h1>Học từ vựng<br><span>tiếng Nhật.</span></h1>
    <p class="description">Tạo bài học và ôn tập<br>bằng flashcard.</p>
    <div class="footer">Học đều, nhớ lâu.</div>
    <div class="card"><div class="label">日本語 · Tiếng Nhật</div><div class="kanji" lang="ja">学ぶ</div><div class="reading" lang="ja">まなぶ</div><div class="meaning">học, học hỏi</div></div>`, 1200, 630);
  await writeFile(`${output}opengraph-image.png`, preview);
  console.log("Generated Kotoba favicon, browser icon, Apple icon, and 1200 × 630 share preview.");
} finally {
  await browser.close();
}
