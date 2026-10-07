import { test, expect } from "@playwright/test";
test("catalogue, language, filters and book details work", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator(".book-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", { name: "Find your next favourite" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search books" }).fill("quiet focus");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.getByRole("link", { name: "The Power of Quiet Focus", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "The Power of Quiet Focus" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Buy this ebook" }).click();
  await expect(
    page.getByRole("heading", { name: "Make it yours" }),
  ).toBeVisible();
  await expect(
    page.getByText("Test checkout. Do not use real money"),
  ).toBeVisible();
});
test("search empty state and category reset", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.getByRole("button", { name: "Fiction", exact: true }).click();
  await expect(page.locator(".book-card")).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Search books" })
    .fill("no-book-matches-this");
  await expect(
    page.getByRole("heading", { name: "No books found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all books" }).click();
  await expect(page.locator(".book-card")).toHaveCount(8);
});
test("unconfigured authentication and admin routes stay closed", async ({
  page,
  request,
}) => {
  await page.goto("/library", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/signin/);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByText("Gmail code sign-in is not fully connected yet.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    (
      await request.post("/api/admin/books", {
        headers: { Origin: "http://localhost:3000" },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/admin/sample-pdf", {
        headers: { Origin: "http://localhost:3000" },
        data: { bookId: "00000000-0000-4000-8000-000000000001" },
      })
    ).status(),
  ).toBe(401);
  const id = "00000000-0000-4000-8000-000000000001";
  expect((await request.delete(`/api/admin/books/${id}`, {
    headers: { Origin: "http://localhost:3000" },
  })).status()).toBe(401);
  expect((await request.post(`/api/admin/books/${id}/preview`, {
    headers: { Origin: "http://localhost:3000" }, data: { pages: 1 },
  })).status()).toBe(401);
  expect((await request.post(`/api/admin/books/${id}/restore`, {
    headers: { Origin: "http://localhost:3000" }, data: {},
  })).status()).toBe(401);
  expect((await request.get(`/api/admin/books/${id}/preview-view`)).status()).toBe(401);
  expect((await request.get(`/api/previews/${id}`)).status()).toBe(503);
  expect(
    (
      await request.post(
        "/api/downloads/00000000-0000-4000-8000-000000000001/pdf",
        { headers: { Origin: "http://localhost:3000" } },
      )
    ).status(),
  ).toBe(401);
});
test("policies, 404 and mobile layout are clear", async ({ page }) => {
  await page.goto("/policies/refund", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toBeVisible();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator("body").evaluate((el) => {
    el.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
  ).toBe(true);
  await page.goto("/books/missing-book", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});
test("CSRF and readiness endpoints deny unauthorised callers", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/checkout", {
        headers: { Origin: "https://evil.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/health/ready")).status()).toBe(401);
  expect((await request.get("/api/health")).status()).toBe(200);
});
