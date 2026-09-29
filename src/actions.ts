import { appendFileSync } from "node:fs";

export function getInput(name: string, fallback = ""): string {
  const v = process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`];
  return v === undefined || v === "" ? fallback : v.trim();
}

export function saveState(name: string, value: string): void {
  const file = process.env.GITHUB_STATE;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

export function getState(name: string): string {
  return process.env[`STATE_${name}`] ?? "";
}

export function appendSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, markdown + "\n");
  else console.log(markdown);
}

export function warning(message: string): void {
  console.log(`::warning::${message.replace(/\r?\n/g, "%0A")}`);
}
