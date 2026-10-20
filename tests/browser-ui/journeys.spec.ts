import { test, expect, type Page } from "@playwright/test";

async function english(page: Page) {
  const toggle = page.getByRole("button", {name: "Switch to English"});
  if (await toggle.count()) await toggle.click();
}
async function login(page: Page, email = "fixture@gmail.com") {
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({contentType: "application/javascript", body:
    'window.turnstile={render:(el,options)=>{setTimeout(()=>options.callback("fixture-captcha"),20);return "fixture"},remove:()=>{}};'}));
  await page.goto("/signin?next=/bundle-editor");
  await english(page);
  await page.getByRole("textbox", {name: "Gmail address"}).fill(email);
  await page.getByRole("button", {name: "Send login code"}).click();
  await page.getByRole("textbox", {name: "Eight-digit code"}).fill("12345678");
  await page.getByRole("button", {name: /Verify|Sign in/}).last().click();
  await expect(page).toHaveURL(new URL("/", page.url()).href);
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

test("bundle editor offers only printed or ebook bundles and saves matching editions", async ({page}, info) => {
  await page.goto("/bundle-editor"); await english(page);
  const picker = page.getByRole("group", {name: "Choose at least two books"});
  await expect(picker.getByRole("checkbox")).toHaveCount(4);
  const format = page.getByRole("combobox", {name: "Format", exact: true});
  await expect(format).toHaveValue("ebook");
  await format.selectOption("physical");
  await expect(format.locator("option")).toHaveCount(2);
  await expect(format.locator('option[value="mixed"]')).toHaveCount(0);
  await expect(picker.getByRole("checkbox", {name: "Ebook Only"})).toBeDisabled();
  await expect(picker.getByText("Save a printed edition price and stock for this book.")).toBeVisible();
  await expect(picker.getByRole("checkbox", {name: "Draft Book"})).toBeDisabled();
  await picker.getByRole("checkbox", {name: "Both Editions"}).check();
  await picker.getByRole("checkbox", {name: "Print Only"}).check();
  await expect(picker.getByRole("combobox")).toHaveCount(0);
  await page.getByLabel("URL slug").fill("printed-test");
  await page.getByLabel("Bangla title").fill("ছাপা বই");
  await page.getByLabel("English title", {exact: true}).fill("Printed test");
  await page.getByLabel("Bangla description").fill("একসঙ্গে দুটি ছাপা বই।");
  await page.getByLabel("English description", {exact: true}).fill("Two printed books together.");
  await page.getByLabel("Bundle total price (BDT)").fill("300");
  await page.getByLabel("Published", {exact: true}).check();
  let saved: {members: {bookId: string; format: string}[]} | undefined;
  await page.route("**/api/admin/bundles", async (route) => {saved = route.request().postDataJSON(); await route.fulfill({json: {id: "fixture"}});});
  await picker.screenshot({path: `test-results/bundle-picker-${info.project.name}.png`, caret: "initial"});
  await page.evaluate(() => window.scrollTo({top: 0, behavior: "instant"}));
  await page.screenshot({path: `test-results/bundle-editor-${info.project.name}.png`, fullPage: true, caret: "initial"});
  await page.getByRole("button", {name: "Save bundle", exact: true}).click();
  await expect(page.getByText("Bundle saved.", {exact: true})).toBeVisible();
  expect(saved?.members.map((member) => member.format)).toEqual(["physical", "physical"]);
  await page.locator(".cart-row").filter({hasText: "Printed Pair"}).getByRole("button", {name: "Edit", exact: true}).click();
  await expect(format).toHaveValue("physical");
  await expect(picker.getByRole("checkbox", {name: "Both Editions"})).toBeChecked();
  await expect(picker.getByRole("checkbox", {name: "Print Only"})).toBeChecked();
  await format.selectOption("ebook");
  await expect(picker.getByRole("checkbox", {name: "Print Only"})).not.toBeChecked();
  await expect(picker.getByRole("checkbox", {name: "Print Only"})).toBeDisabled();
  await picker.getByRole("checkbox", {name: "Ebook Only"}).check();
  await page.getByRole("button", {name: "Save bundle", exact: true}).click();
  await expect(page.getByText("Bundle saved.", {exact: true})).toBeVisible();
  expect(saved?.members.map((member) => member.format)).toEqual(["ebook", "ebook"]);
  await page.locator(".cart-row").filter({hasText: "Mixed Pair"}).getByRole("button", {name: "Edit", exact: true}).click();
  await expect(format).toHaveValue("");
  await expect(page.getByRole("button", {name: "Save bundle", exact: true})).toBeDisabled();
  await expect(format.locator('option[value="mixed"]')).toHaveCount(0);
  await page.locator("body").evaluate((body) => {body.style.zoom = "2";});
  await page.screenshot({path: `test-results/bundle-editor-zoom-${info.project.name}.png`, fullPage: true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test("storefront sells only single-format bundles and refuses old mixed offers", async ({page}) => {
  await page.goto("/bundles"); await english(page);
  await expect(page.getByRole("heading", {name: "Printed Pair"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Ebook Pair"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Mixed Pair"})).toHaveCount(0);
  await page.goto("/bundles/mixed-pair");
  await expect(page.getByRole("heading", {name: "This bundle is unavailable"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Add bundle to cart"})).toHaveCount(0);
  await page.goto("/bundles/printed-pair");
  await page.getByRole("button", {name: "Add bundle to cart"}).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("Printed Pair", {exact: true})).toBeVisible();
  await page.goto("/bundles/ebook-pair");
  await expect(page.getByRole("link", {name: "Sign in to buy"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Add bundle to cart"})).toHaveCount(0);
});

test("bundle setup keeps both printed editions and the unfinished bundle", async ({page}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/admin/print-editions/*", (route) => route.fulfill({json: {ok: true}}));
  await page.goto("/admin-editor"); await english(page);
  await page.getByRole("button", {name: "Bundles", exact: true}).click();
  await page.getByRole("combobox", {name: "Format", exact: true}).selectOption("physical");
  const picker = page.getByRole("group", {name: "Choose at least two books"});
  await page.getByLabel("URL slug").fill("keep-my-bundle");
  await expect(picker.getByRole("checkbox", {name: "Setup First"})).toBeDisabled();
  for (const book of ["Setup First", "Setup Second"]) {
    await picker.getByRole("button", {name: `Open book setup: ${book}`, exact: true}).click();
    await page.getByLabel("Printed price (BDT)").fill("250");
    await page.getByLabel("Total copies on hand").fill("4");
    await page.getByLabel("Reason for stock update").fill("Received new stock");
    await page.getByRole("button", {name: "Save printed edition", exact: true}).click();
    await expect(page.getByText("Printed edition and stock saved.", {exact: true})).toBeVisible();
    await page.getByRole("button", {name: "Return to bundle", exact: true}).click();
    await expect(page.getByLabel("URL slug")).toHaveValue("keep-my-bundle");
    await expect(picker.getByRole("checkbox", {name: book})).toBeEnabled();
  }
  await picker.getByRole("checkbox", {name: "Setup First"}).check();
  await picker.getByRole("checkbox", {name: "Setup Second"}).check();
  await expect(page.getByRole("button", {name: "Save bundle", exact: true})).toBeEnabled();
  await picker.screenshot({path: `test-results/bundle-setup-${info.project.name}.png`});
  expect(errors).toEqual([]);
});

test("Admin Bundles opens PDF ebooks directly and keeps delivery separate", async ({page}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin-editor?ebooks=1"); await english(page);
  await page.getByRole("button", {name: "Bundles", exact: true}).click();
  await expect(page.getByRole("heading", {name: "New ebook bundle (PDF / EPUB)", exact: true})).toBeVisible();
  const format = page.getByRole("combobox", {name: "Format", exact: true});
  await expect(format).toHaveValue("ebook");
  await expect(page.getByRole("heading", {name: "Delivery fees", exact: true})).toBeHidden();
  await expect(page.getByRole("heading", {name: "Printed-book orders", exact: true})).toBeHidden();
  const picker = page.getByRole("group", {name: "Choose at least two books"});
  await expect(picker.getByRole("checkbox", {name: "Print Only"})).toBeDisabled();
  await picker.getByRole("checkbox", {name: "Ebook Only"}).check();
  await picker.getByRole("checkbox", {name: "Both Editions"}).check();
  await page.getByLabel("URL slug").fill("pdf-pair");
  await page.getByLabel("Bangla title").fill("দুটি পিডিএফ");
  await page.getByLabel("English title", {exact: true}).fill("PDF pair");
  await page.getByLabel("Bangla description").fill("দুটি পিডিএফ একসঙ্গে পড়ুন।");
  await page.getByLabel("English description", {exact: true}).fill("Two PDF ebooks together.");
  await page.getByLabel("Bundle total price (BDT)").fill("300");
  await page.getByLabel("Published", {exact: true}).check();
  await page.getByRole("button", {name: "Printed & delivery", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Delivery fees", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "New ebook bundle (PDF / EPUB)", exact: true})).toBeHidden();
  await page.getByRole("button", {name: "Bundles", exact: true}).click();
  await expect(page.getByLabel("URL slug")).toHaveValue("pdf-pair");
  await expect(picker.getByRole("checkbox", {name: "Ebook Only"})).toBeChecked();
  await expect(picker.getByRole("checkbox", {name: "Both Editions"})).toBeChecked();
  let saved: { kind: string; members: {format: string}[] } | undefined;
  await page.route("**/api/admin/bundles", async (route) => {
    saved = route.request().postDataJSON(); await route.fulfill({json: {id: "fixture"}});
  });
  await page.screenshot({path: `test-results/admin-ebook-bundles-${info.project.name}.png`, fullPage: true});
  const saveRefresh = page.waitForResponse((response) => new URL(response.url()).pathname === "/admin-editor" && response.request().headers().rsc === "1");
  await page.getByRole("button", {name: "Save bundle", exact: true}).click();
  await expect(page.getByText("Bundle saved.", {exact: true})).toBeVisible();
  await (await saveRefresh).finished();
  expect(saved?.kind).toBe("ebook");
  expect(saved?.members.map((member) => member.format)).toEqual(["ebook", "ebook"]);
  await expect(format).toHaveValue("ebook");
  expect(errors).toEqual([]);
});

test("only the owner can save a receiving number; validation and reload preserve it", async ({page, baseURL}, info) => {
  const endpoint = "/api/admin/payments";
  const headers = {Origin: new URL(baseURL!).origin};
  expect((await page.request.get(endpoint)).status()).toBe(401);
  expect((await page.request.post(endpoint, {headers, data: {receivingNumber: "01712345678"}})).status()).toBe(401);
  await login(page, "customer@gmail.com");
  expect((await page.request.get(endpoint)).status()).toBe(403);
  expect((await page.request.post(endpoint, {headers, data: {receivingNumber: "01712345678"}})).status()).toBe(403);
  await page.context().clearCookies();
  await login(page);
  expect((await page.request.post(endpoint, {headers: {Origin: "https://wrong.example"}, data: {receivingNumber: "01712345678"}})).status()).toBe(403);
  expect((await page.request.post(endpoint, {headers, data: {receivingNumber: "bad"}})).status()).toBe(400);
  await page.goto("/admin-editor");
  await page.getByRole("button", {name: "Payments", exact: true}).click();
  const number = page.getByRole("textbox", {name: "bKash receiving number"});
  await number.fill("bad");
  await page.getByRole("button", {name: "Save bKash number"}).click();
  await expect(number).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#bkash-number-error")).toContainText("11-digit");
  await number.fill("01812345678");
  const saveRefresh = page.waitForResponse((response) => new URL(response.url()).pathname === "/admin-editor" && response.request().headers().rsc === "1");
  await page.getByRole("button", {name: "Save bKash number"}).click();
  await expect(page.getByText("bKash number saved. New orders will use this number.", {exact: true})).toBeVisible();
  await (await saveRefresh).finished();
  await page.reload();
  await page.getByRole("button", {name: "Payments", exact: true}).click();
  await expect(number).toHaveValue("01812345678");
  expect((await (await page.request.get(endpoint)).json()).receivingNumber).toBe("01812345678");
  await page.screenshot({path: `test-results/payment-settings-${info.project.name}.png`, fullPage: true});
  await page.locator("body").evaluate((body) => {body.style.zoom = "2";});
  await page.screenshot({path: `test-results/payment-settings-zoom-${info.project.name}.png`, fullPage: true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test("buyers copy the original order number and submit a claim that awaits approval", async ({page}, info) => {
  await page.goto("/payment-order"); await english(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await expect(page.getByText("01712345678", {exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Copy number"}).focus();
  await page.getByRole("button", {name: "Copy number"}).press("Enter");
  await expect(page.getByText("Number copied.", {exact: true})).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("01712345678");
  await page.getByLabel("bKash transaction ID", {exact: true}).fill("FIXTURE123");
  await page.getByLabel("Last 4 digits of sender's bKash number").fill("1234");
  let submitted: unknown;
  await page.route("**/api/orders/*/claim", async (route) => {
    submitted = route.request().postDataJSON(); await route.fulfill({json: {ok: true}});
  });
  await page.route(/\/api\/orders\/[^/]+$/, async (route) => route.fulfill({json: {order: {
    id: "45454545-4545-4454-8454-454545454545", book_title: "Ebook Pair", status: "review",
    payment_method: "bkash_manual", amount_paisa: 30000, tran_id: "RR-FIXTURE" }, claim: null}}));
  await page.screenshot({path: `test-results/payment-order-${info.project.name}.png`, fullPage: true});
  await page.getByRole("button", {name: "Submit for review"}).click();
  await expect(page.getByText("Awaiting approval", {exact: true})).toBeVisible();
  expect(submitted).toEqual({transactionId: "FIXTURE123", senderLast4: "1234"});
  await expect(page.getByRole("button", {name: "Submit for review"})).toHaveCount(0);
});

test("owner reviews transaction details and approves or rejects explicitly", async ({page}, info) => {
  await page.goto("/admin-editor"); await english(page);
  await page.getByRole("button", {name: /^Orders \(/}).click();
  await expect(page.getByText("FIXTURE123", {exact: true})).toBeVisible();
  await expect(page.getByText("Customer: customer@gmail.com")).toBeVisible();
  let action: {action: string; reason?: string} | undefined;
  await page.route("**/api/admin/orders/*/review", async (route) => {
    action = route.request().postDataJSON(); await route.fulfill({json: {ok: true}});
  });
  await page.getByRole("button", {name: "Reject claim", exact: true}).click();
  await expect(page.locator(".notice.error")).toContainText("5–300");
  expect(action).toBeUndefined();
  await page.getByLabel("Reason for rejection").fill("Transfer not found in bKash");
  const rejectRefresh = page.waitForResponse((response) => new URL(response.url()).pathname === "/admin-editor" && response.request().headers().rsc === "1");
  await page.getByRole("button", {name: "Reject claim", exact: true}).click();
  await expect(page.getByText("Claim rejected. The buyer can see the reason and resubmit.", {exact: true})).toBeVisible();
  await (await rejectRefresh).finished();
  expect(action?.action).toBe("reject");
  expect(action?.reason).toBe("Transfer not found in bKash");
  await page.reload();
  await page.getByRole("button", {name: /^Orders \(/}).click();
  await page.screenshot({path: `test-results/payment-review-${info.project.name}.png`, fullPage: true});
  page.once("dialog", (dialog) => dialog.accept());
  const approveRefresh = page.waitForResponse((response) => new URL(response.url()).pathname === "/admin-editor" && response.request().headers().rsc === "1");
  await page.getByRole("button", {name: "Verified — approve", exact: true}).click();
  await expect(page.getByText("Payment approved. The buyer can now download the ebooks.", {exact: true})).toBeVisible();
  await (await approveRefresh).finished();
  expect(action?.action).toBe("approve");
});
