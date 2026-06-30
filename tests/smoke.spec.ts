import { test, expect, Page } from "@playwright/test";

// Collect page console errors during a test for assertion.
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

// Ignore expected/harmless noise. Individual Wikimedia image 404s are handled by
// the UI fallback and are reported separately by `npm run check:data`, so a
// stray resource 404 should not fail the browser smoke test.
const IGNORE = [
  /favicon/i,
  /Download the React DevTools/i,
  /WebGL/i,
  /THREE\.WebGLRenderer/i,
  /Failed to load resource/i,
  /net::ERR/i,
  /status of 40\d/i,
];
const realErrors = (errs: string[]) => errs.filter((e) => !IGNORE.some((re) => re.test(e)));

test.describe("Antarang smoke", () => {
  test("home / timeline renders", async ({ page }) => {
    const errs = trackErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Antarang/ })).toBeVisible();
    await expect(page.getByText("World Art", { exact: true })).toBeVisible();
    await expect(page.getByText("Indian Art", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "india" })).toBeVisible();
    expect(realErrors(errs), `console errors: ${errs.join(" | ")}`).toHaveLength(0);
  });

  test("search returns artists and works", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/Search artists/i).fill("van gogh");
    await expect(page.getByText(/result/i)).toBeVisible();
    await expect(page.getByText("Vincent van Gogh").first()).toBeVisible();
  });

  test("museum loads and real artwork images resolve from Wikimedia", async ({ page }) => {
    const errs = trackErrors(page);
    await page.goto("/museum/vincent-van-gogh");
    // Both the top-bar h1 and the enter-overlay h2 say the artist name; take the first.
    await expect(page.getByRole("heading", { name: "Vincent van Gogh" }).first()).toBeVisible();

    // Open the works list (works without entering pointer-lock).
    await page.getByRole("button", { name: /Works \(/ }).click();
    await expect(page.getByText("Works in this hall")).toBeVisible();

    // At least one real artwork thumbnail must actually load (naturalWidth > 0).
    const firstImg = page.locator("aside img").first();
    await expect(firstImg).toBeVisible();
    await expect
      .poll(async () => firstImg.evaluate((el: HTMLImageElement) => el.naturalWidth), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    expect(realErrors(errs), `console errors: ${errs.join(" | ")}`).toHaveLength(0);
  });

  test("inspect modal opens with metadata and Wikipedia link", async ({ page }) => {
    await page.goto("/museum/vincent-van-gogh");
    await page.getByRole("button", { name: /Works \(/ }).click();
    await page.locator("aside button").first().click();
    await expect(page.getByText("The story")).toBeVisible();
    await expect(page.getByText("Why it matters")).toBeVisible();
    await expect(page.getByRole("link", { name: /Read on Wikipedia/ })).toBeVisible();
  });

  test("unknown artist 404s", async ({ page }) => {
    const res = await page.goto("/museum/not-a-real-artist");
    expect(res?.status()).toBe(404);
  });
});
