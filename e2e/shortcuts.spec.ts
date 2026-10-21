import { expect, test, type Page } from "@playwright/test";
import { CONTEXTS, originOf } from "./contexts.ts";
import { expectArrived, hashOf, sectionKeys } from "./sections.ts";

// The number keys and the footer switch that turns them off: what needs a real browser, which is
// the keys reaching the page, the focus they must not steal, and the choice surviving a reload.
// The markup is covered by the Container API tests and the key rules by Vitest. Jumps pressed in
// quick succession are in quick-jumps.spec.ts.

const switchOf = (page: Page) =>
  page.getByRole("button", { name: "keyboard shortcuts:" });

for (const context of CONTEXTS) {
  const home = `${originOf(context)}/`;

  test.describe(`${context.name} build`, () => {
    test("each number key jumps to its section", async ({ page }) => {
      await page.goto(home);
      const sections = await sectionKeys(page);
      expect(sections.length).toBeGreaterThan(0);
      expect(await hashOf(page)).toBe("");

      for (const { key, id } of sections) {
        await page.keyboard.press(key);
        await expect.poll(() => hashOf(page)).toBe(`#${id}`);
        await expectArrived(page, id);
      }
    });

    test("a number with no section does nothing", async ({ page }) => {
      await page.goto(home);
      const { length } = await sectionKeys(page);
      // Keys are single characters: with nine sections, there is no digit left to be the extra.
      test.skip(length >= 9, "every digit has a section");
      await page.keyboard.press(String(length + 1));
      await page.keyboard.press("0");
      expect(await hashOf(page)).toBe("");
      expect(page.url()).toBe(home);
    });

    test("a number key on a project page goes to the section on the home page", async ({
      page,
    }) => {
      await page.goto(`${originOf(context)}/projects/this-website/`);
      const [first] = await sectionKeys(page);
      await page.keyboard.press(first!.key);
      await expect(page).toHaveURL(`${home}#${first!.id}`);
    });

    test("keys are ignored while typing in a field", async ({ page }) => {
      await page.goto(home);
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "probe-input";
        const editable = document.createElement("div");
        editable.id = "probe-editable";
        editable.contentEditable = "true";
        document.body.append(input, editable);
      });
      const [first] = await sectionKeys(page);

      await page.locator("#probe-input").focus();
      await page.keyboard.press(first!.key);
      await expect(page.locator("#probe-input")).toHaveValue(first!.key);

      await page.locator("#probe-editable").focus();
      await page.keyboard.press(first!.key);
      await expect(page.locator("#probe-editable")).toHaveText(first!.key);

      expect(await hashOf(page)).toBe("");
      // The keys still work once focus is back on the page.
      await page.locator("#probe-input").blur();
      await page.locator("#probe-editable").blur();
      await page.keyboard.press(first!.key);
      await expect.poll(() => hashOf(page)).toBe(`#${first!.id}`);
    });

    test("keys are ignored with Control, Alt or Meta held", async ({
      page,
    }) => {
      await page.goto(home);
      const [first] = await sectionKeys(page);

      for (const modifier of ["Control", "Alt", "Meta"]) {
        await page.keyboard.press(`${modifier}+${first!.key}`);
      }
      // A beat for a scroll that should not have started.
      await page.waitForTimeout(300);
      expect(await hashOf(page)).toBe("");

      await page.keyboard.press(first!.key);
      await expect.poll(() => hashOf(page)).toBe(`#${first!.id}`);
    });

    test("a key held down acts once, not on its repeats", async ({ page }) => {
      await page.goto(home);
      const [first, second] = await sectionKeys(page);
      expect(second, "needs two sections").toBeDefined();

      try {
        await page.keyboard.down(second!.key);
        await expect.poll(() => hashOf(page)).toBe(`#${second!.id}`);
        await expectArrived(page, second!.id);
        // Move away while the key stays down: a repeat that acted would bring the page back.
        await page.evaluate((id) => (location.hash = id), first!.id);
        await page.keyboard.down(second!.key);
        await page.keyboard.down(second!.key);
        await page.waitForTimeout(300);
        expect(await hashOf(page)).toBe(`#${first!.id}`);
      } finally {
        await page.keyboard.up(second!.key);
      }
    });

    test.describe("the shortcuts switch", () => {
      test("starts on, and says so to a screen reader", async ({ page }) => {
        await page.goto(home);
        await expect(switchOf(page)).toBeVisible();
        expect(await switchOf(page).ariaSnapshot()).toBe(
          '- button "keyboard shortcuts:" [pressed]',
        );
        await expect(page.locator("html")).toHaveAttribute(
          "data-shortcuts",
          "on",
        );
      });

      test("turns the keys and their hints off, and the choice survives a reload", async ({
        page,
      }) => {
        await page.goto(home);
        const hints = page.locator("a[data-number] .hint");
        const [first] = await sectionKeys(page);
        await expect(hints.first()).toBeVisible();

        await switchOf(page).click();
        expect(await switchOf(page).ariaSnapshot()).toBe(
          '- button "keyboard shortcuts:"',
        );
        await expect(hints.first()).toBeHidden();
        await page.keyboard.press(first!.key);
        await page.waitForTimeout(300);
        expect(await hashOf(page)).toBe("");

        await page.reload();
        await expect(page.locator("html")).toHaveAttribute(
          "data-shortcuts",
          "off",
        );
        expect(await switchOf(page).ariaSnapshot()).toBe(
          '- button "keyboard shortcuts:"',
        );
        await expect(hints.first()).toBeHidden();
        await page.keyboard.press(first!.key);
        await page.waitForTimeout(300);
        expect(await hashOf(page)).toBe("");

        await switchOf(page).click();
        await page.reload();
        expect(await switchOf(page).ariaSnapshot()).toBe(
          '- button "keyboard shortcuts:" [pressed]',
        );
        await expect(hints.first()).toBeVisible();
        await page.keyboard.press(first!.key);
        await expect.poll(() => hashOf(page)).toBe(`#${first!.id}`);
      });

      test("is remembered on a project page too", async ({ page }) => {
        await page.goto(home);
        await switchOf(page).click();
        await page.goto(`${originOf(context)}/projects/this-website/`);
        await expect(page.locator("html")).toHaveAttribute(
          "data-shortcuts",
          "off",
        );
        expect(await switchOf(page).ariaSnapshot()).toBe(
          '- button "keyboard shortcuts:"',
        );
      });
    });
  });
}
