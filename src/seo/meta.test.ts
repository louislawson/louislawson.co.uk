import { describe, expect, it } from "vitest";
import { metaTags } from "./meta";

const base = {
  title: "This website · Louis Lawson",
  pathname: "/projects/this-website/",
  image: "/og/projects/this-website.png",
  type: "article" as const,
  description: "A static site.",
};

/** The tags as `key=content` lines, so a test reads them as a list. */
function lines(tags: ReturnType<typeof metaTags>): string[] {
  return tags.map((tag) => `${tag.attribute}:${tag.key}=${tag.content}`);
}

describe("the meta tags of a page", () => {
  it("has the description, the Open Graph tags and the Twitter card", () => {
    expect(lines(metaTags(base, "https://louislawson.co.uk"))).toEqual([
      "name:description=A static site.",
      "property:og:title=This website · Louis Lawson",
      "property:og:description=A static site.",
      "property:og:image=https://louislawson.co.uk/og/projects/this-website.png",
      "property:og:url=https://louislawson.co.uk/projects/this-website/",
      "property:og:type=article",
      "property:og:locale=en_GB",
      "name:twitter:card=summary_large_image",
    ]);
  });

  it("makes the image and the address absolute from the site URL, as the canonical is", () => {
    const tags = metaTags(base, "https://preview.example.net");
    const content = (key: string) => tags.find((t) => t.key === key)?.content;
    expect(content("og:image")).toBe(
      "https://preview.example.net/og/projects/this-website.png",
    );
    expect(content("og:url")).toBe(
      "https://preview.example.net/projects/this-website/",
    );
  });

  it("leaves both description tags out together while there is no description", () => {
    const tags = metaTags(
      { ...base, description: undefined },
      "https://louislawson.co.uk",
    );
    const keys = tags.map((t) => t.key);
    expect(keys).not.toContain("description");
    expect(keys).not.toContain("og:description");
    expect(keys).toContain("og:title");
    expect(keys).toContain("og:image");
    expect(keys).toContain("twitter:card");
  });

  it("uses the type it is given", () => {
    const tags = metaTags(
      { ...base, type: "website", pathname: "/" },
      "https://louislawson.co.uk",
    );
    expect(tags.find((t) => t.key === "og:type")?.content).toBe("website");
    expect(tags.find((t) => t.key === "og:url")?.content).toBe(
      "https://louislawson.co.uk/",
    );
  });

  it("has the Twitter card by name and the Open Graph tags by property", () => {
    const tags = metaTags(base, "https://louislawson.co.uk");
    for (const tag of tags) {
      expect(tag.attribute).toBe(
        tag.key.startsWith("og:") ? "property" : "name",
      );
    }
  });
});
