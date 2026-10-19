// The garage's photos as the build finds them. Photos live in src/assets/garage/ and are found only
// through documented APIs: Astro's image imports through `import.meta.glob` (which give each
// photo's metadata), the project's `root` from `astro:config/server` (to read a file by the path
// the glob gives), and Astro's `getImage` for the optimised copy, whose output carries no metadata.
// Nothing here reads a path off an image object.
//
// Only the optimised copy may be published, and Astro publishes the original of any image it sees
// used. A query import (`?inline`, `?raw`, `?url`) counts as use, so the bytes are read from the
// file instead, and photos.ts never reads an image's `src`, which counts as use too. The matching,
// the dither and the checks are in photos.ts, where they are tested.
import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import { root } from "astro:config/server";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Profile } from "../content/schema";
import { resolveGaragePhotos, type GaragePhoto } from "./photos";

// Vite reads this pattern as written, so it is a string literal and not a constant: a pattern held
// in a variable is not seen at all, and the folder would look empty.
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/garage/*.{jpeg,jpg,png,webp}",
  { eager: true, import: "default" },
);

/** The file at a path the glob gave, which is from the project's root: "/src/assets/garage/a.jpg". */
const read = (path: string) =>
  readFile(fileURLToPath(new URL(`.${path}`, root)));

/** The widest the optimised photo is made: a card is at most about 560 pixels across. */
export const PHOTO_MAX_WIDTH = 1600;

/**
 * Each shown entry's dither and optimised photo, in the order of `garage`. Every photo in the
 * folder is processed in every build, whether or not its entry is shown, because Astro publishes
 * the original of an imported image that nothing processes; `all` is every entry in the profile,
 * shown or not, so a photo of an entry that is left out is not taken for one nothing uses.
 */
export function garagePhotos(
  garage: Profile["garage"],
  all: Profile["garage"],
): Promise<(GaragePhoto | undefined)[]> {
  return resolveGaragePhotos(
    garage,
    { images, read },
    async (photo) => {
      const optimised = await getImage({
        src: photo,
        width: Math.min(photo.width, PHOTO_MAX_WIDTH),
        format: "webp",
      });
      return optimised.src;
    },
    all,
  );
}
