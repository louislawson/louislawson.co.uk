// Finds the file behind each garage entry's photo and turns it into what the page shows. The files
// come from Vite's and Astro's documented imports (see load-photos.ts), never from a path read off
// an image object, so a photo has to be in src/assets/garage/ to be found.
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
  /** Each of the same files as a base64 data URL (Vite's `?inline` import), by the same path. */
  inline: Record<string, string>;
}

const DATA_URL = /^data:[^;,]*;base64,/;

/** The bytes of a base64 data URL. */
function bytesOf(url: string, name: string): Uint8Array {
  if (!DATA_URL.test(url)) {
    throw new Error(
      `The photo for "${name}" did not load as a base64 data URL, so it cannot be dithered`,
    );
  }
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
}

/**
 * One result per entry, in the order given: nothing for an entry whose photo is a placeholder, and
 * otherwise the dither of the photo's own file and the address of its optimised copy. A photo that
 * cannot be found or read stops the build, so a card is never quietly left blank.
 */
export async function resolveGaragePhotos(
  garage: readonly { name: string; photo: ImageMetadata | string }[],
  sources: PhotoSources,
  optimise: (photo: ImageMetadata) => Promise<string>,
): Promise<(GaragePhoto | undefined)[]> {
  return Promise.all(
    garage.map(async ({ name, photo }) => {
      if (typeof photo === "string" || isPlaceholder(photo)) return undefined;
      const path = Object.keys(sources.images).find(
        (key) => sources.images[key]?.src === photo.src,
      );
      if (path === undefined) {
        throw new Error(
          `The photo for "${name}" is not in src/assets/garage/, so it cannot be found`,
        );
      }
      const url = sources.inline[path];
      if (url === undefined) {
        throw new Error(
          `The file for the photo of "${name}" (${path}) was not read`,
        );
      }
      try {
        return {
          dither: await ditherPhoto(bytesOf(url, name)),
          href: await optimise(photo),
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          reason.includes(`"${name}"`)
            ? reason
            : `The photo for "${name}" (${path}) could not be processed: ${reason}`,
          { cause: error },
        );
      }
    }),
  );
}
