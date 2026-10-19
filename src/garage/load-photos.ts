// The garage's photos as the build finds them. Photos live in src/assets/garage/ and are found only
// through documented APIs: Astro's image imports (which give each photo's metadata) and Vite's
// `?inline` import (which gives its bytes), both through `import.meta.glob`; and the optimised copy
// comes from Astro's `getImage`, whose output carries no metadata. Nothing here reads a path off an
// image object. The matching and the dither are in photos.ts, where they are tested.
import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import type { Profile } from "../content/schema";
import { resolveGaragePhotos, type GaragePhoto } from "./photos";

// Vite reads these patterns as written, so each is a string literal here and not a shared constant:
// a pattern held in a variable is not seen at all, and the folder would look empty.
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/garage/*.{jpeg,jpg,png,webp}",
  { eager: true, import: "default" },
);
const inline = import.meta.glob<string>(
  "/src/assets/garage/*.{jpeg,jpg,png,webp}",
  { eager: true, query: "?inline", import: "default" },
);

/** The widest the optimised photo is made: a card is at most about 560 pixels across. */
export const PHOTO_MAX_WIDTH = 1600;

/** Each entry's dither and optimised photo, in the order of `garage`. */
export function garagePhotos(
  garage: Profile["garage"],
): Promise<(GaragePhoto | undefined)[]> {
  return resolveGaragePhotos(garage, { images, inline }, async (photo) => {
    const optimised = await getImage({
      src: photo,
      width: Math.min(photo.width, PHOTO_MAX_WIDTH),
      format: "webp",
    });
    return optimised.src;
  });
}
