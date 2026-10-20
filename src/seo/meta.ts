import { CARD_HEIGHT, CARD_WIDTH } from "./card-content";

export interface MetaTag {
  /** Open Graph tags are `property`; the description and the Twitter card are `name`. */
  attribute: "name" | "property";
  key: string;
  content: string;
}

export interface PageMeta {
  /** The page's title, as the browser tab shows it. */
  title: string;
  /** The page's address path, from which og:url is made as the canonical is. */
  pathname: string;
  /** The card's path on this site, for example /og/home.png. */
  image: string;
  /** What the card shows, in one line, for whoever cannot see it. */
  imageAlt: string;
  type: "website" | "article";
  /** Left out while there is none to say: a placeholder never reaches a tag. */
  description?: string | undefined;
}

/**
 * The tags that make a link to a page preview well. The image and the address are absolute, from
 * the site URL, as the canonical is: a crawler resolves nothing relative. No JSON-LD: it would
 * need an inline script, which the content security policy does not allow.
 */
export function metaTags(meta: PageMeta, siteUrl: string): MetaTag[] {
  const absolute = (path: string) => new URL(path, siteUrl).href;
  const tags: MetaTag[] = [];
  if (meta.description !== undefined) {
    tags.push({
      attribute: "name",
      key: "description",
      content: meta.description,
    });
  }
  tags.push({ attribute: "property", key: "og:title", content: meta.title });
  if (meta.description !== undefined) {
    tags.push({
      attribute: "property",
      key: "og:description",
      content: meta.description,
    });
  }
  tags.push(
    {
      attribute: "property",
      key: "og:image",
      content: absolute(meta.image),
    },
    // The size, so a scraper lays the card out on its first fetch without measuring it.
    {
      attribute: "property",
      key: "og:image:width",
      content: String(CARD_WIDTH),
    },
    {
      attribute: "property",
      key: "og:image:height",
      content: String(CARD_HEIGHT),
    },
    {
      attribute: "property",
      key: "og:image:alt",
      content: meta.imageAlt,
    },
    {
      attribute: "property",
      key: "og:url",
      content: absolute(meta.pathname),
    },
    { attribute: "property", key: "og:type", content: meta.type },
    { attribute: "property", key: "og:locale", content: "en_GB" },
    {
      attribute: "name",
      key: "twitter:card",
      content: "summary_large_image",
    },
    { attribute: "name", key: "twitter:image:alt", content: meta.imageAlt },
  );
  return tags;
}
