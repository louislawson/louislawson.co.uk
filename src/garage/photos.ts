// Finds the file behind each garage entry's photo and turns it into what the page shows. The files
// come from Astro's documented image imports (see load-photos.ts), never from a path read off an
// image object, so a photo has to be in src/assets/garage/ to be found.
//
// Astro keeps an imported photo's original in the build when the build learns it is used, and it
// learns that when the image's `src` is read and when the file is imported with a query such as
// `?inline`. The optimised copy is all that may be published, so nothing here reads a `src`, and a
// photo is matched by being the same import and read as a plain file.
import type { ImageMetadata } from "astro";
import { isPlaceholder } from "../content/todo";
import { ditherPhoto } from "./dither";

export interface GaragePhoto {
  /** The photo as text, for the page to show before the photo is asked for. */
  dither: string;
  /** The optimised photo, which the dither links to. */
  href: string;
}

export interface PhotoSources {
  /** The image imports of src/assets/garage/, by path, as `import.meta.glob` finds them. */
  images: Record<string, ImageMetadata>;
  /** The bytes of the file at one of those paths. */
  read(path: string): Promise<Uint8Array>;
}

const FOLDER = "src/assets/garage/";

/**
 * One result per entry, in the order given: nothing for an entry whose photo is a placeholder, and
 * otherwise the dither of the photo's own file and the address of its optimised copy. A photo that
 * cannot be found or read stops the build, so a card is never quietly left blank, and so does a
 * photo in the folder that no entry uses, because Astro would publish it as it is.
 */
export async function resolveGaragePhotos(
  garage: readonly { name: string; photo: ImageMetadata | string }[],
  sources: PhotoSources,
  optimise: (photo: ImageMetadata) => Promise<string>,
): Promise<(GaragePhoto | undefined)[]> {
  const paths = Object.keys(sources.images);
  const used = new Set<string>();
  const results = await Promise.all(
    garage.map(async ({ name, photo }) => {
      if (typeof photo === "string" || isPlaceholder(photo)) return undefined;
      const path = paths.find((key) => sources.images[key] === photo);
      if (path === undefined) {
        throw new Error(
          `The photo for "${name}" is not in ${FOLDER}, so it cannot be found`,
        );
      }
      used.add(path);
      try {
        return {
          dither: await ditherPhoto(await sources.read(path)),
          href: await optimise(photo),
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `The photo for "${name}" (${path}) could not be processed: ${reason}`,
          { cause: error },
        );
      }
    }),
  );
  const unused = paths.filter((path) => !used.has(path));
  if (unused.length > 0) {
    throw new Error(
      `${FOLDER} holds ${unused.length === 1 ? "a photo" : "photos"} that no entry in the garage uses: ${unused.join(", ")}. ` +
        `Astro publishes every image it imports, so ${unused.length === 1 ? "it" : "they"} would be published as ${unused.length === 1 ? "it is" : "they are"}. ` +
        `Use ${unused.length === 1 ? "it" : "them"} in an entry, or remove ${unused.length === 1 ? "it" : "them"}`,
    );
  }
  return results;
}
