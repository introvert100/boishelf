import { chromium } from "@playwright/test";
import fs from "node:fs";
fs.mkdirSync(".local", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
const pending = new Set();
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => pending.add(r.url()));
page.on("requestfinished", (r) => pending.delete(r.url()));
page.on("requestfailed", (r) => {
  pending.delete(r.url());
  errors.push(`${r.url()} ${r.failure()?.errorText}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
await page.goto("http://localhost:3000", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.getByRole("button", { name: "Switch to English" }).click();
await page.getByRole("heading", { name: "Find your next favourite" }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: ".local/desktop.png", fullPage: true });
console.log(
  JSON.stringify(
    {
      errors,
      pending: [...pending],
      overflow: await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      })),
      fonts: await page.evaluate(() => ({
        body: getComputedStyle(document.body).fontFamily,
        loaded: document.fonts.check('16px "DM Sans"'),
      })),
    },
    null,
    2,
  ),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "বাংলায় দেখুন" }).click();
await page.screenshot({ path: ".local/mobile.png", fullPage: true });
await browser.close();
