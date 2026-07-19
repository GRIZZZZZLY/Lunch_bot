import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const LIMITS = {
  totalJavaScript: 1_750_000,
  largestJavaScript: 525_000,
  totalCss: 160_000,
  totalAssets: 1_900_000,
};

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (!entry.name.endsWith(".map") && entry.name !== "stats.html") {
      const fileStat = await stat(absolutePath);
      files.push({ path: absolutePath, size: fileStat.size });
    }
  }

  return files;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const files = await collectFiles(DIST_DIR);
const javascript = files.filter((file) => file.path.endsWith(".js"));
const css = files.filter((file) => file.path.endsWith(".css"));
const totalJavaScript = javascript.reduce((sum, file) => sum + file.size, 0);
const largestJavaScript = Math.max(0, ...javascript.map((file) => file.size));
const totalCss = css.reduce((sum, file) => sum + file.size, 0);
const totalAssets = files.reduce((sum, file) => sum + file.size, 0);

const measurements = {
  totalJavaScript,
  largestJavaScript,
  totalCss,
  totalAssets,
};

let failed = false;
for (const [name, value] of Object.entries(measurements)) {
  const limit = LIMITS[name];
  const passed = value <= limit;
  process.stdout.write(
    `${passed ? "PASS" : "FAIL"} ${name}: ${formatBytes(value)} / ${formatBytes(limit)}\n`,
  );
  failed ||= !passed;
}

if (failed) {
  process.exitCode = 1;
}
