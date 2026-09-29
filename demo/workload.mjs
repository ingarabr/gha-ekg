import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const seconds = Number(process.argv[2] ?? "20");
const end = Date.now() + seconds * 1000;
const file = join(tmpdir(), "gha-ekg-demo.bin");
const hog = [];

while (Date.now() < end) {
  const phase = Math.floor((seconds * 1000 - (end - Date.now())) / (seconds * 250));
  if (phase === 0) {
    let x = 0;
    for (let i = 0; i < 5e7; i++) x += Math.sqrt(i);
  } else if (phase === 1) {
    hog.push(Buffer.alloc(32 * 1024 * 1024, 1));
    await new Promise((r) => setTimeout(r, 500));
  } else if (phase === 2) {
    writeFileSync(file, Buffer.alloc(128 * 1024 * 1024, 2));
    readFileSync(file);
  } else {
    const res = await fetch("https://api.github.com/zen");
    await res.text();
    await new Promise((r) => setTimeout(r, 500));
  }
}
rmSync(file, { force: true });
