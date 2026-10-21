import { expect, test as base } from "@playwright/test";

// The `test` every spec uses. A production page loads Cloudflare's analytics beacon, and a test run
// must neither fetch it nor tell Cloudflare about a visit, so every request to Cloudflare's hosts is
// answered here with an empty 204 and never reaches the network. The addresses are kept, so a test
// can say which build asked and which did not. src/e2e/specs.test.ts holds every spec to this file.

/** The hosts Cloudflare Web Analytics uses: the script's and the one it reports to. */
const CLOUDFLARE_ANALYTICS =
  /^https:\/\/(?:[a-z0-9-]+\.)*cloudflareinsights\.com(?:[/?#]|$)/;

export type Analytics = {
  /** The address of every request the page made to Cloudflare's analytics hosts, in order. */
  requests: string[];
};

export const test = base.extend<{ analytics: Analytics }>({
  analytics: [
    async ({ context }, use) => {
      const analytics: Analytics = { requests: [] };
      await context.route(CLOUDFLARE_ANALYTICS, (route) => {
        analytics.requests.push(route.request().url());
        // A module script needs a JavaScript type and a CORS header to run, even if it is empty.
        return route.fulfill({
          status: 204,
          contentType: "text/javascript",
          headers: { "access-control-allow-origin": "*" },
          body: "",
        });
      });
      await use(analytics);
    },
    { auto: true },
  ],
});

export { expect };
