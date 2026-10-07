import { test, expect } from "@playwright/test";

test("a normal JPG cover decodes through the browser file reader", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1130;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 17;
    for (let index = 0; index < pixels.data.length; index += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      pixels.data[index] = seed & 255;
      pixels.data[index + 1] = seed >>> 8 & 255;
      pixels.data[index + 2] = seed >>> 16 & 255;
      pixels.data[index + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/jpeg", 0.35));
    const file = new File([blob], "book-cover.jpg", { type: "image/jpeg" });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader could not open JPG"));
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const source = new Image();
      source.onload = () => resolve(source);
      source.onerror = () => reject(new Error("Browser could not decode JPG"));
      source.src = dataUrl;
    });
    return { size: file.size, width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(result.size).toBeGreaterThan(100_000);
  expect(result.size).toBeLessThan(5 * 1024 * 1024);
  expect(result).toMatchObject({ width: 800, height: 1130 });
});
