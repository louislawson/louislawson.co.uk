import { expect, test, type Page } from "@playwright/test";
import { CONTEXTS, originOf, pagesOf } from "./contexts.ts";

// The links between a project's page and the rest of the site: the way back and the next project.
// The markup is covered by the Container API tests; these follow the links in a browser.

/** The projects as the home page lists them, in its order: their paths, each once. */
async function listedProjects(page: Page, origin: string) {
  await page.goto(`${origin}/`);
  const hrefs = await page
    .locator("#projects a[href^='/projects/']")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href") ?? ""),
    );
  return [...new Set(hrefs)];
}

for (const context of CONTEXTS) {
  const origin = originOf(context);
  const projectPages = pagesOf(context).filter((path) =>
    path.startsWith("/projects/"),
  );

  test.describe(`${context.name} build`, () => {
    test("the home page lists every project page of the build", async ({
      page,
    }) => {
      const listed = await listedProjects(page, origin);
      expect(projectPages.length).toBeGreaterThan(0);
      expect([...listed].sort()).toEqual([...projectPages].sort());
    });

    test("each project's next link goes to the project after it, and the last wraps to the first", async ({
      page,
    }) => {
      const listed = await listedProjects(page, origin);
      for (const [index, path] of listed.entries()) {
        await page.goto(`${origin}${path}`);
        // A project that stands alone has nothing to go on to.
        if (listed.length === 1) {
          await expect(page.locator("a.next")).toHaveCount(0);
        } else {
          await expect(page.locator("a.next")).toHaveAttribute(
            "href",
            listed[(index + 1) % listed.length]!,
          );
        }
      }
    });

    test("following the last project's next link lands on the first project", async ({
      page,
    }) => {
      const listed = await listedProjects(page, origin);
      test.skip(listed.length < 2, "this build has a single project");
      await page.goto(`${origin}${listed.at(-1)}`);
      const lastTitle = await page.locator("h1").innerText();

      await page.locator("a.next").click();
      await expect(page).toHaveURL(`${origin}${listed[0]}`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h1")).not.toHaveText(lastTitle);
    });

    for (const path of projectPages) {
      test(`${path}: the back link goes to the projects on the home page`, async ({
        page,
      }) => {
        await page.goto(`${origin}${path}`);
        await page.getByRole("link", { name: "all projects" }).click();

        await expect(page).toHaveURL(`${origin}/#projects`);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const { top, bottom } = document
                .getElementById("projects")!
                .getBoundingClientRect();
              return top < innerHeight && bottom > 0;
            }),
          )
          .toBe(true);
      });
    }
  });
}
