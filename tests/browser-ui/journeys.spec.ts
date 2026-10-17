import { test, expect, type Page } from "@playwright/test";

async function english(page: Page) {
  const toggle = page.getByRole("button", {name: "Switch to English"});
  if (await toggle.count()) await toggle.click();
}
async function login(page: Page) {
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({contentType: "application/javascript", body:
    'window.turnstile={render:(el,options)=>{setTimeout(()=>options.callback("fixture-captcha"),20);return "fixture"},remove:()=>{}};'}));
  await page.goto("/signin?next=/bundle-editor");
  await english(page);
  await page.getByRole("textbox", {name: "Gmail address"}).fill("fixture@gmail.com");
  await page.getByRole("button", {name: "Send login code"}).click();
  await page.getByRole("textbox", {name: "Eight-digit code"}).fill("12345678");
  await page.getByRole("button", {name: /Verify|Sign in/}).last().click();
  await expect(page).toHaveURL("http://localhost:3001/");
}

test("OTP always opens the homepage with an SSR session; library and refresh stay usable", async ({page}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/library");
  await expect(page).toHaveURL(/\/signin\?next=/);
  await login(page);
  await expect(page.getByRole("heading", {name: "Find your next favourite"})).toBeVisible();
  await expect(page.getByRole("button", {name: "বাংলায় দেখুন"})).toBeEnabled();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({path: `test-results/login-${info.project.name}.png`, fullPage: true, caret: "initial"});
  await page.goto("/library");
  await expect(page.getByRole("heading", {name: "My library", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Ebook Only"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", {name: "PDF", exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("navigation immediately shows progress, clears on completion, and same-page anchors scroll", async ({page}, info) => {
  await page.route("**/bundles*", async (route) => {
    if (route.request().headers()["rsc"]) await new Promise((resolve) => setTimeout(resolve, 1800));
    await route.continue();
  });
  await page.goto("/"); await english(page);
  if (info.project.name === "mobile") await page.getByRole("button", {name: "Menu", exact: true}).click();
  await page.getByRole("link", {name: "Bundles", exact: true}).first().click();
  await expect(page.locator(".navigation-feedback")).toBeVisible();
  await page.screenshot({path: `test-results/navigation-${info.project.name}.png`});
  await expect(page.getByRole("heading", {name: "Book bundles"})).toBeVisible({timeout: 15000});
  await expect(page.locator(".navigation-feedback")).toHaveCount(0);
  await page.goto("/");
  await page.getByRole("link", {name: "Explore the collection", exact: true}).click();
  await expect(page).toHaveURL(/#catalogue$/);
  await expect(page.locator(".navigation-feedback")).toHaveCount(0);
  const library = page.getByRole("link", {name: "My library", exact: true}).last();
  await library.focus();
  await library.press("Enter");
  await expect(page).toHaveURL(/\/signin\?next=/);
  await expect(page.locator(".navigation-feedback")).toHaveCount(0);
});

test("bundle editor shows all books with reasons, saves per-book formats, and restores edit selections", async ({page}, info) => {
  await page.goto("/bundle-editor"); await english(page);
  const picker = page.getByRole("group", {name: "Choose at least two books"});
  await expect(picker.getByRole("checkbox")).toHaveCount(3);
  await expect(picker.getByRole("checkbox", {name: "Ebook Only"})).toBeDisabled();
  await expect(picker.getByText("Save a printed edition price and stock for this book.")).toBeVisible();
  await expect(picker.getByRole("checkbox", {name: "Draft Book"})).toBeDisabled();
  await page.getByRole("combobox", {name: "Format", exact: true}).selectOption("mixed");
  await picker.getByRole("checkbox", {name: "Ebook Only"}).check();
  await picker.getByRole("checkbox", {name: "Print Only"}).check();
  await expect(picker.getByLabel("Edition for Ebook Only")).toHaveValue("ebook");
  await expect(picker.getByLabel("Edition for Print Only")).toHaveValue("physical");
  await page.getByLabel("URL slug").fill("mixed-test");
  await page.getByLabel("Bangla title").fill("মিশ্র বই");
  await page.getByLabel("English title", {exact: true}).fill("Mixed test");
  await page.getByLabel("Bangla description").fill("একটি ইবুক ও একটি ছাপা বই।");
  await page.getByLabel("English description", {exact: true}).fill("One ebook and one printed book.");
  await page.getByLabel("Bundle total price (BDT)").fill("300");
  await page.getByLabel("Published", {exact: true}).check();
  let saved: {members: {bookId: string; format: string}[]} | undefined;
  await page.route("**/api/admin/bundles", async (route) => {saved = route.request().postDataJSON(); await route.fulfill({json: {id: "fixture"}});});
  await picker.screenshot({path: `test-results/bundle-picker-${info.project.name}.png`, caret: "initial"});
  await page.evaluate(() => window.scrollTo({top: 0, behavior: "instant"}));
  await page.screenshot({path: `test-results/bundle-editor-${info.project.name}.png`, fullPage: true, caret: "initial"});
  await page.getByRole("button", {name: "Save bundle", exact: true}).click();
  await expect(page.getByText("Bundle saved.", {exact: true})).toBeVisible();
  expect(saved?.members.map((member) => member.format)).toEqual(["ebook", "physical"]);
  await page.getByRole("button", {name: "Edit", exact: true}).click();
  await expect(page.getByRole("combobox", {name: "Format", exact: true})).toHaveValue("mixed");
  await expect(picker.getByRole("checkbox", {name: "Ebook Only"})).toBeChecked();
  await expect(picker.getByRole("checkbox", {name: "Print Only"})).toBeChecked();
  await page.locator("body").evaluate((body) => {body.style.zoom = "2";});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test("mixed bundle lists each edition and enters the delivery cart", async ({page}) => {
  await page.goto("/bundles/mixed-pair"); await english(page);
  await expect(page.getByText("MIXED BUNDLE", {exact: true})).toBeVisible();
  await expect(page.getByText(/Ebooks unlock after bKash approval/)).toBeVisible();
  await page.getByRole("button", {name: "Add bundle to cart"}).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("Mixed Pair", {exact: true})).toBeVisible();
});
