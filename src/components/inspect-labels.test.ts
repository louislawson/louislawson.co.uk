import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { visibleSections } from "../content/visibility";
import { profile } from "../data/profile";
import { INSPECT_LABELS } from "./inspect-labels";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf-8");

const swa = JSON.parse(read("public/staticwebapp.config.json")) as {
  routes: { route: string; headers: Record<string, string> }[];
  globalHeaders: Record<string, string>;
  responseOverrides: Record<string, { rewrite: string }>;
};
/** The directives of a Cache-Control header, as a list. */
const directives = (value: string | undefined) =>
  (value ?? "").split(",").map((part) => part.trim());
const assetCache = directives(
  swa.routes.find((route) => route.route === "/_astro/*")?.headers[
    "Cache-Control"
  ],
);
const pageCache = directives(swa.globalHeaders["Cache-Control"]);

// A label states a fact about the real build. One that is about a setting is held to it here, so a
// change to the setting that makes the label false fails the build, and the label is fixed with it.
// Each entry is a phrase a label uses, and what has to be true for it.
const facts: {
  label: keyof typeof INSPECT_LABELS;
  phrase: string;
  holds: () => boolean;
  because: string;
}[] = [
  {
    label: "footer",
    phrase: "hashed assets cached for a year",
    holds: () =>
      assetCache.includes("max-age=31536000") &&
      assetCache.includes("immutable"),
    because:
      "/_astro/* in staticwebapp.config.json is max-age=31536000, immutable",
  },
  {
    label: "footer",
    phrase: "HTML revalidated on every load",
    holds: () =>
      pageCache.includes("max-age=0") && pageCache.includes("must-revalidate"),
    because: "the global Cache-Control is max-age=0, must-revalidate",
  },
  {
    label: "footer",
    phrase: "served by Azure Static Web Apps",
    holds: () =>
      /resource "azurerm_static_web_app"/.test(read("infra/site/main.tf")),
    because: "infra/site/main.tf declares an azurerm_static_web_app",
  },
  {
    label: "notFound",
    phrase: "serves it for any address that does not exist",
    holds: () => swa.responseOverrides["404"]?.rewrite === "/404.html",
    because: "the 404 response override rewrites to /404.html",
  },
  {
    label: "nav",
    phrase: "one per section with content",
    holds: () => {
      // visibleSections() is what the bar is built from: a section with nothing in it has no link.
      const ids = visibleSections([{}], {
        ...profile,
        skills: [],
        exploring: [],
        certifications: [],
        garage: [],
      }).map((section) => section.id);
      return ids.join() === "projects,contact";
    },
    because: "visibleSections() drops a section with nothing in it",
  },
];

describe("the inspect labels", () => {
  it("are the shell's: the bar, the footer and the 404 page's content", () => {
    expect(Object.keys(INSPECT_LABELS).sort()).toEqual([
      "footer",
      "nav",
      "notFound",
    ]);
  });

  it.each(Object.entries(INSPECT_LABELS))(
    "%s is one short line, in the console's lower case, with no full stop",
    (_name, label) => {
      // It sits on one line above its part, up to a width, so it has to fit.
      expect(label.length).toBeGreaterThan(10);
      expect(label.length).toBeLessThanOrEqual(110);
      expect(label).toMatch(/^[a-z]/);
      expect(label).not.toMatch(/\.$/);
      expect(label).not.toMatch(/[\n\r]/);
    },
  );

  it.each(facts)(
    "$label says “$phrase”, and that is so: $because",
    ({ label, phrase, holds }) => {
      expect(INSPECT_LABELS[label]).toContain(phrase);
      expect(holds()).toBe(true);
    },
  );
});
