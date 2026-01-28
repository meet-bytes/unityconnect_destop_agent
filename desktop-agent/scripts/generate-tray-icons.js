/**
 * Build-time script: generate tray icons with status badges (active, idle, stopped).
 * Run via: npm run generate-tray-icons
 * Output: assets/tray-active.png, tray-idle.png, tray-stopped.png
 */

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets", "app-logo.png");
const OUT = path.join(ROOT, "assets");

const TRAY_SIZE = 16;
const BADGE_SIZE = 6;
const BADGE_OFFSET = 0;

const STATUS = {
  active: "#22c55e",
  idle: "#eab308",
  stopped: "#94a3b8",
};

function svgCircle(size, color) {
  const r = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r}" fill="${color}"/></svg>`
  );
}

async function generate() {
  if (!fs.existsSync(SRC)) {
    console.error("Missing source icon:", SRC);
    process.exit(1);
  }

  for (const [name, color] of Object.entries(STATUS)) {
    const badge = svgCircle(BADGE_SIZE, color);
    const outPath = path.join(OUT, `tray-${name}.png`);
    await sharp(SRC)
      .resize(TRAY_SIZE, TRAY_SIZE)
      .composite([
        {
          input: badge,
          left: TRAY_SIZE - BADGE_SIZE - BADGE_OFFSET,
          top: BADGE_OFFSET,
        },
      ])
      .png()
      .toFile(outPath);
    console.log("Generated", outPath);
  }
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
