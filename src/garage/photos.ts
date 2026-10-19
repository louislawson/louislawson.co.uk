// Finds the file behind each garage entry's photo and turns it into what the page shows. The files
// come from Astro's documented image imports (see load-photos.ts), never from a path read off an
// image object, so a photo has to be in src/assets/garage/ to be found.
//
// Astro publishes the original of every image it imports unless something processes it, and it
// keeps the original of one it learns is used: when the image's `src` is read, and when the file is
// imported with a query such as `?inline`. Only the optimised copy may be published, so:
//   - every photo in the folder is processed in every build, whether or not its card is shown (a
//     card is left out of production while a part of its entry is a placeholder, and the whole
//     section while none is shown, but the photo was imported all the same);
//   - nothing here reads a `src`, and a photo is matched by being the same import and read as a
//     plain file;
//   - a photo that no entry uses, shown or not, stops the build, as one that is not in the folder.
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

interface Entry {
  name: string;
  photo: ImageMetadata | string;
}

const FOLDER = "src/assets/garage/";

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * One result per entry in `garage`, the entries the page shows, in the order given: nothing for an
 * entry whose photo is a placeholder, and otherwise the dither of the photo's own file and the
 * address of its optimised copy. `all` is every entry in the profile, shown or not (it defaults to
 * `garage`): a photo of any of them must be in the folder, and every photo in the folder is
 * processed and must be used by one of them.
 */
export async function resolveGaragePhotos(
  garage: readonly Entry[],
  sources: PhotoSources,
  optimise: (photo: ImageMetadata) => Promise<string>,
  all: readonly Entry[] = garage,
): Promise<(GaragePhoto | undefined)[]> {
  const paths = Object.keys(sources.images);
  const pathOf = (photo: ImageMetadata) =>
    paths.find((key) => sources.images[key] === photo);

  const used = new Set<string>();
  for (const { name, photo } of [...all, ...garage]) {
    if (typeof photo === "string" || isPlaceholder(photo)) continue;
    const path = pathOf(photo);
    if (path === undefined) {
      throw new Error(
        `The photo for "${name}" is not in ${FOLDER}, so it cannot be found`,
      );
    }
    used.add(path);
  }
  const unused = paths.filter((path) => !used.has(path));
  if (unused.length > 0) {
    const one = unused.length === 1;
    throw new Error(
      `${FOLDER} holds ${one ? "a photo" : "photos"} that no entry in the garage uses: ${unused.join(", ")}. ` +
        `Astro publishes every image it imports, so ${one ? "it" : "they"} would be published as ${one ? "it is" : "they are"}. ` +
        `Use ${one ? "it" : "them"} in an entry, or remove ${one ? "it" : "them"}`,
    );
  }

  // Every photo, once, whether or not its card is shown: processing is what keeps the original
  // out of the build.
  const hrefs = new Map<string, string>();
  await Promise.all(
    paths.map(async (path) => {
      try {
        hrefs.set(path, await optimise(sources.images[path]!));
      } catch (error) {
        throw new Error(
          `The photo ${path} could not be processed: ${reasonOf(error)}`,
          { cause: error },
        );
      }
    }),
  );

  // The dither is only for a card that is shown.
  return Promise.all(
    garage.map(async ({ name, photo }) => {
      if (typeof photo === "string" || isPlaceholder(photo)) return undefined;
      const path = pathOf(photo)!;
      try {
        return {
          dither: await ditherPhoto(await sources.read(path)),
          href: hrefs.get(path)!,
        };
      } catch (error) {
        throw new Error(
          `The photo for "${name}" (${path}) could not be processed: ${reasonOf(error)}`,
          { cause: error },
        );
      }
    }),
  );
}
