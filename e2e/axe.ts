import AxeBuilder from "@axe-core/playwright";
import type { TestInfo } from "@playwright/test";
import { expect, test as base } from "./test.ts";

// What every accessibility scan shares: the rule sets, the one place a rule could be switched off,
// and how a failure is reported. A spec asks for `makeAxeBuilder` and never builds an AxeBuilder
// itself, so no scan can quietly use a looser set of rules than the others.

/** The rule sets a page must pass: WCAG 2.0, 2.1 and 2.2, and axe's own best-practice rules. */
export const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

type AxeFixture = { makeAxeBuilder: () => AxeBuilder };

export const test = base.extend<AxeFixture>({
  makeAxeBuilder: async ({ page }, use) => {
    // No disableRules() and no exclude() here. If one is ever needed it goes on this line with a
    // comment that says which rule or element, why, and when it can come out; the PR lists it too.
    await use(() => new AxeBuilder({ page }).withTags(AXE_TAGS));
  },
});

export { expect };

/** One line for each violation, so the failing assertion reads without opening the attachment. */
function summarise(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? "no impact"}): ${violation.help}\n` +
      violation.nodes
        .map((node) => `    ${node.target.join(" ")}\n      ${node.html}`)
        .join("\n"),
  );
}

/** What axe could not decide, as a short line: the rule and why, with how many nodes. */
function summariseIncomplete(
  incomplete: Awaited<ReturnType<AxeBuilder["analyze"]>>["incomplete"],
) {
  return incomplete.map((item) => {
    const reasons = new Map<string, number>();
    for (const node of item.nodes) {
      const why = String(node.any[0]?.data?.messageKey ?? "undecided");
      reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
    return `${item.id}: ${[...reasons].map(([why, count]) => `${count} ${why}`).join(", ")}`;
  });
}

/**
 * Scans the page as it now stands and fails on any violation. The full results (passes,
 * incomplete checks and all) are attached to the test only when it fails, as the report's JSON.
 * What axe could not decide is not a violation, but it is not a pass either, so it is noted on the
 * test as an annotation that the report shows.
 */
export async function expectNoViolations(
  builder: AxeBuilder,
  testInfo: TestInfo,
  name = "accessibility-scan-results",
) {
  const results = await builder.analyze();
  if (results.violations.length > 0) {
    await testInfo.attach(name, {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
  }
  for (const line of summariseIncomplete(results.incomplete)) {
    testInfo.annotations.push({
      type: "axe could not decide",
      description: line,
    });
  }
  expect(summarise(results.violations)).toEqual([]);
  // A scan that ran no rule would find nothing, and pass.
  expect(results.passes.length, "rules that passed").toBeGreaterThan(0);
  return results;
}
