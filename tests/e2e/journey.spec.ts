import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * The core WorldForge journey (spec steps 1–15) plus access-control, invalid-ID,
 * empty-state, failed-write and concurrent-edit checks. No AI provider is needed.
 */

const run = Date.now().toString(36);
const password = "e2e-password-123";
const owner = { name: "E2E Archivist", email: `e2e-owner-${run}@test.worldforge.dev` };
const outsider = { name: "E2E Outsider", email: `e2e-outsider-${run}@test.worldforge.dev` };
const names = { world: `E2E Realm ${run}`, a: "Ilsa Marrow", b: "Tavin Roe", faction: "The Lantern Guild", event: "Burning of the Lantern Hall" };

async function signUp(page: Page, who: { name: string; email: string }) {
  await page.goto("/signup");
  await page.fill("#name", who.name);
  await page.fill("#email", who.email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/worlds\/new/);
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/dashboard/);
}

async function pick(page: Page, combobox: ReturnType<Page["locator"]>, name: string) {
  await combobox.click();
  await page.getByRole("dialog").getByPlaceholder("Search…").fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).first().click();
}

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

test.describe.serial("worldbuilding journey", () => {
  let worldUrl = "";
  let eventUrl = "";
  // Sign in once and reuse the session (sign-in is rate limited per account).
  let ownerState: StorageState;
  const asOwner = async (browser: Browser) => {
    const ctx = await browser.newContext({ storageState: ownerState });
    return { ctx, page: await ctx.newPage() };
  };

  test("1. sign in as an authorized user", async ({ page }) => {
    await signUp(page, owner);
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await signIn(page, owner.email);
    await expect(page.getByRole("heading", { name: "Your worlds" })).toBeVisible();
    ownerState = await page.context().storageState();
  });

  test("2. create a universe", async ({ browser }) => {
    const { page } = await asOwner(browser);
    await page.goto("/worlds/new");
    await page.fill("#name", names.world);
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByRole("button", { name: /Create universe/ }).click();
    await page.waitForURL(/\/worlds\/[\w-]{20,}$/);
    worldUrl = new URL(page.url()).pathname;
    await expect(page.getByText(names.world).first()).toBeVisible();
  });

  test("3–5. create two characters and a faction, and connect a character to it", async ({ browser }) => {
    const { page } = await asOwner(browser);
    // Empty state before anything exists.
    await page.goto(`${worldUrl}/characters`);
    await expect(page.getByText("No characters yet")).toBeVisible();

    // A failed write: the name is required and nothing is saved.
    await page.goto(`${worldUrl}/characters/new`);
    await page.getByRole("button", { name: "Create character" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/characters\/new$/);

    await page.fill("#name", names.a);
    await page.getByRole("button", { name: "Create character" }).click();
    await page.waitForURL(/\/characters\/[\w-]{20,}$/);

    await page.goto(`${worldUrl}/factions/new`);
    await page.fill("#name", names.faction);
    await page.getByRole("button", { name: "Create faction" }).click();
    await page.waitForURL(/\/factions\/[\w-]{20,}$/);

    await page.goto(`${worldUrl}/characters/new`);
    await page.fill("#name", names.b);
    await page.getByRole("button", { name: "Faction", exact: false }).first().click();
    await pick(page, page.getByRole("combobox").last(), names.faction);
    await page.getByRole("button", { name: "Create character" }).click();
    await page.waitForURL(/\/characters\/[\w-]{20,}$/);
    await expect(page.getByText(names.faction).first()).toBeVisible();

    await page.goto(`${worldUrl}/characters`);
    await expect(page.getByText(names.a)).toBeVisible();
    await expect(page.getByText(names.b)).toBeVisible();
  });

  test("6–7. create a historical event with a participant", async ({ browser }) => {
    const { page } = await asOwner(browser);
    await page.goto(`${worldUrl}/events/new`);
    await page.fill("#title", names.event);
    await page.fill("#startYear", "412");
    await page.getByRole("button", { name: "Add participant" }).click();
    await pick(page, page.getByRole("combobox", { name: "" }).filter({ hasText: "Choose an entity" }), names.b);
    await page.getByRole("button", { name: "Record event" }).click();
    await page.waitForURL(/\/events\/[\w-]{20,}$/);
    eventUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: names.event })).toBeVisible();
    await expect(page.getByText(names.b).first()).toBeVisible();
    await expect(page.getByText("Year 412").first()).toBeVisible();
  });

  test("8–9. the relationship graph shows the expected nodes and edge", async ({ browser }) => {
    const { page } = await asOwner(browser);
    await page.goto(`${worldUrl}/graph`);
    const canvas = page.getByLabel("Relationship graph");
    await expect(canvas).toBeVisible();
    for (const n of [names.a, names.b, names.faction]) await expect(canvas.locator(".react-flow__node", { hasText: n })).toBeVisible();
    await expect(canvas.locator(".react-flow__edge")).toHaveCount(1);
  });

  test("10. the timeline shows the event", async ({ browser }) => {
    const { page } = await asOwner(browser);
    await page.goto(`${worldUrl}/timeline`);
    await expect(page.getByRole("button", { name: new RegExp(`${names.event}, Year 412`) })).toBeVisible();
  });

  test("11–15. propose a change, review the impact, commit to a branch, and keep canon intact", async ({ browser }) => {
    const { page } = await asOwner(browser);
    await page.goto(eventUrl);
    await page.getByRole("link", { name: /Simulate a change/ }).click();
    await page.waitForURL(/\/simulator/);
    await page.fill("#p-sy", "420");
    await page.getByRole("button", { name: /Analyse impact/ }).click();
    await page.waitForURL(/proposal=/);

    // 12. The impact report lists the primary change with its basis.
    await expect(page.getByText(/Primary change|Direct/i).first()).toBeVisible();
    const proposalUrl = page.url();

    // 13. Accept the suggested changes and commit them to a new branch.
    // The primary change is accepted by default; accept any other suggested change still pending.
    const acceptAll = page.getByRole("button", { name: /Accept all suggested changes/ });
    if (await acceptAll.isEnabled()) await acceptAll.click();
    await expect(page.getByText("ACCEPTED", { exact: false }).first()).toBeVisible();
    const commit = page.getByRole("button", { name: /^Commit \d+ change/ });
    await expect(commit).toBeEnabled();
    await commit.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Commit" }).click();
    await expect(page.getByText(/Committed\./)).toBeVisible();

    // 14. Persistence: the committed state survives a reload and the branch exists.
    await page.goto(proposalUrl);
    await expect(page.getByText(/Committed\./)).toBeVisible();
    await page.goto(`${worldUrl}/branches`);
    await expect(page.getByText(/What if/).first()).toBeVisible();

    // 15. Canon is unchanged; the branch sees the new date.
    await page.goto(eventUrl);
    await expect(page.getByText("Year 412").first()).toBeVisible();
    await page.goto(`${worldUrl}/timeline`);
    await expect(page.getByRole("button", { name: new RegExp(`${names.event}, Year 412`) })).toBeVisible();
    const timelineSelect = page.getByLabel("Timeline", { exact: true });
    const branchValue = await timelineSelect.locator("option", { hasText: /What if/ }).first().getAttribute("value");
    await timelineSelect.selectOption(branchValue!);
    await expect(page.getByRole("button", { name: new RegExp(`${names.event}, Year 420`) })).toBeVisible();
  });

  test("concurrent edits are detected instead of overwritten", async ({ browser }) => {
    const { ctx, page: a } = await asOwner(browser);
    await a.goto(`${worldUrl}/characters`);
    await a.getByText(names.a).click();
    await a.waitForURL(/\/characters\/[\w-]{20,}$/);
    const editUrl = `${new URL(a.url()).pathname}/edit`;
    const b = await ctx.newPage();
    await a.goto(editUrl);
    await b.goto(editUrl);
    await a.fill("#summary", "Edited in tab A");
    await a.getByRole("button", { name: "Save changes" }).click();
    await a.waitForURL(/\/characters\/[\w-]{20,}$/);
    await b.fill("#summary", "Edited in tab B");
    await b.getByRole("button", { name: "Save changes" }).click();
    await expect(b.getByRole("alert").filter({ hasText: /changed by someone else/ })).toBeVisible();
    await a.reload();
    await expect(a.getByText("Edited in tab A").first()).toBeVisible();
    await ctx.close();
  });

  test("unauthorized access and invalid IDs are refused", async ({ browser }) => {
    // Signed out: protected pages redirect to sign-in.
    const anon = await browser.newContext();
    const p1 = await anon.newPage();
    await p1.goto(worldUrl);
    await expect(p1).toHaveURL(/\/login/);
    const api = await p1.request.get(`/api${worldUrl}/export`);
    expect(api.status()).toBe(401);
    await anon.close();

    // Signed in, but not a member: the universe does not exist for them.
    const other = await browser.newContext();
    const p2 = await other.newPage();
    await signUp(p2, outsider);
    const res = await p2.goto(worldUrl);
    expect(res?.status()).toBe(404);
    expect((await p2.request.get(`/api${worldUrl}/export`)).status()).toBe(404);

    // Invalid record IDs inside a universe 404 as well.
    const { ctx: own, page: p3 } = await asOwner(browser);
    expect((await p3.goto(`${worldUrl}/characters/00000000-0000-0000-0000-000000000000`))?.status()).toBe(404);
    expect((await p3.goto(`${worldUrl}/events/not-an-id`))?.status()).toBe(404);
    await other.close();
    await own.close();
  });
});
