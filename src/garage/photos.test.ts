import type { ImageMetadata } from "astro";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { ditherPhoto } from "./dither";
import { resolveGaragePhotos, type PhotoSources } from "./photos";

/** An image built in memory: no photo is a file in these tests. */
async function image(grey: number, width = 400, height = 300) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: grey, g: grey, b: grey },
    },
  })
    .png()
    .toBuffer();
}

const metadata = (src: string): ImageMetadata => ({
  src,
  width: 400,
  height: 300,
  format: "png",
});

/** What an import of an image is to Astro: reading its `src` is how the build learns it is used. */
function trackedImage(onSrcRead: () => void): ImageMetadata {
  const photo = { width: 400, height: 300, format: "png" } as ImageMetadata;
  Object.defineProperty(photo, "src", {
    enumerable: true,
    get() {
      onSrcRead();
      return "/_astro/tracked.abc123.png";
    },
  });
  return photo;
}

/** A `read` that serves these bytes by path, and fails for any other. */
const serving =
  (files: Record<string, Uint8Array>): PhotoSources["read"] =>
  async (path) => {
    const bytes = files[path];
    if (bytes === undefined) throw new Error(`ENOENT: ${path}`);
    return bytes;
  };

describe("resolveGaragePhotos", () => {
  it("gives a placeholder photo nothing, and asks for nothing", async () => {
    const optimise = vi.fn();
    const result = await resolveGaragePhotos(
      [{ name: "Tractors", photo: "TODO: photo" }],
      { images: {}, read: serving({}) },
      optimise,
    );
    expect(result).toEqual([undefined]);
    expect(optimise).not.toHaveBeenCalled();
  });

  it("dithers the photo's own file and links the optimised copy", async () => {
    const truck = await image(200);
    const photo = metadata("/_astro/truck.abc123.png");
    const sources: PhotoSources = {
      images: { "/src/assets/garage/truck.png": photo },
      read: serving({ "/src/assets/garage/truck.png": truck }),
    };
    const optimise = vi.fn(async () => "/_astro/truck.abc123_Z1.webp");
    const [resolved] = await resolveGaragePhotos(
      [{ name: "Trucks", photo }],
      sources,
      optimise,
    );
    expect(resolved?.dither).toBe(await ditherPhoto(truck));
    expect(resolved?.href).toBe("/_astro/truck.abc123_Z1.webp");
    expect(optimise).toHaveBeenCalledWith(photo);
  });

  it("finds each entry's file however the files are ordered, and keeps the entries' order", async () => {
    const dark = await image(20);
    const light = await image(230);
    const a = metadata("/_astro/a.111.png");
    const b = metadata("/_astro/b.222.png");
    const sources: PhotoSources = {
      images: { "/src/assets/garage/b.png": b, "/src/assets/garage/a.png": a },
      read: serving({
        "/src/assets/garage/a.png": dark,
        "/src/assets/garage/b.png": light,
      }),
    };
    const result = await resolveGaragePhotos(
      [
        { name: "First", photo: a },
        { name: "Placeholder", photo: "TODO: photo" },
        { name: "Second", photo: b },
      ],
      sources,
      async (photo) => `${photo.format}-${photo.width}.webp`,
    );
    expect(result[1]).toBeUndefined();
    expect(result[0]?.dither).toBe(await ditherPhoto(dark));
    expect(result[2]?.dither).toBe(await ditherPhoto(light));
    expect(result[0]?.dither).not.toBe(result[2]?.dither);
  });

  describe("without marking an original as used", () => {
    // Astro keeps an imported photo's original in the build when its `src` is read, and when the
    // file is imported with a query (?inline, ?raw, ?url). Either would publish the original.
    it("never reads a photo's src, whether it is found, or optimised, or its file read", async () => {
      let reads = 0;
      const photo = trackedImage(() => reads++);
      const other = trackedImage(() => reads++);
      const bytes = await image(120);
      await resolveGaragePhotos(
        [{ name: "Cars", photo }],
        {
          images: {
            "/src/assets/garage/cars.png": photo,
            "/src/assets/garage/other.png": other,
          },
          read: serving({ "/src/assets/garage/cars.png": bytes }),
        },
        async () => "/_astro/cars.webp",
      ).catch(() => undefined);
      expect(reads).toBe(0);
    });

    it("finds a photo by being the same import, not by an equal address, so no address is read", async () => {
      const bytes = await image(120);
      const imported = metadata("/_astro/cars.abc123.png");
      const lookalike = metadata("/_astro/cars.abc123.png");
      await expect(
        resolveGaragePhotos(
          [{ name: "Cars", photo: lookalike }],
          {
            images: { "/src/assets/garage/cars.png": imported },
            read: serving({ "/src/assets/garage/cars.png": bytes }),
          },
          async () => "",
        ),
      ).rejects.toThrow(/Cars.*src\/assets\/garage/s);
    });

    it("reads each file by its path, as a plain read, once", async () => {
      const bytes = await image(120);
      const photo = metadata("/_astro/cars.abc123.png");
      const read = vi.fn(serving({ "/src/assets/garage/cars.png": bytes }));
      await resolveGaragePhotos(
        [{ name: "Cars", photo }],
        { images: { "/src/assets/garage/cars.png": photo }, read },
        async () => "/_astro/cars.webp",
      );
      expect(read.mock.calls).toEqual([["/src/assets/garage/cars.png"]]);
    });
  });

  describe("a photo in the folder that no entry uses", () => {
    // Astro publishes every image it imports, and an optimised copy only replaces the original of
    // one that was processed. A photo nothing uses would be published as it is.
    it("stops the build, naming the file, because it would be published unprocessed", async () => {
      const bytes = await image(120);
      const used = metadata("/_astro/used.111.png");
      const stray = metadata("/_astro/stray.222.png");
      await expect(
        resolveGaragePhotos(
          [{ name: "Cars", photo: used }],
          {
            images: {
              "/src/assets/garage/used.png": used,
              "/src/assets/garage/stray.png": stray,
            },
            read: serving({ "/src/assets/garage/used.png": bytes }),
          },
          async () => "/_astro/used.webp",
        ),
      ).rejects.toThrow(/stray\.png[\s\S]*published/);
    });

    it("names every one of them", async () => {
      await expect(
        resolveGaragePhotos(
          [{ name: "Tractors", photo: "TODO: photo" }],
          {
            images: {
              "/src/assets/garage/one.png": metadata("/_astro/one.png"),
              "/src/assets/garage/two.png": metadata("/_astro/two.png"),
            },
            read: serving({}),
          },
          async () => "",
        ),
      ).rejects.toThrow(/one\.png[\s\S]*two\.png/);
    });

    it("is not a problem when every photo is used", async () => {
      const bytes = await image(120);
      const photo = metadata("/_astro/a.111.png");
      await expect(
        resolveGaragePhotos(
          [{ name: "Cars", photo }],
          {
            images: { "/src/assets/garage/a.png": photo },
            read: serving({ "/src/assets/garage/a.png": bytes }),
          },
          async () => "/_astro/a.webp",
        ),
      ).resolves.toHaveLength(1);
    });
  });

  it("stops the build, naming the entry and the folder, when a photo is not in src/assets/garage", async () => {
    await expect(
      resolveGaragePhotos(
        [{ name: "Lost tractor", photo: metadata("/_astro/elsewhere.png") }],
        { images: {}, read: serving({}) },
        async () => "",
      ),
    ).rejects.toThrow(/Lost tractor.*src\/assets\/garage/s);
  });

  it("stops the build when a file cannot be read, naming the entry and the file", async () => {
    const photo = metadata("/_astro/a.111.png");
    await expect(
      resolveGaragePhotos(
        [{ name: "Cars", photo }],
        { images: { "/src/assets/garage/a.png": photo }, read: serving({}) },
        async () => "",
      ),
    ).rejects.toThrow(/Cars[\s\S]*a\.png/);
  });

  it("stops the build when the file is not an image, naming the entry", async () => {
    const photo = metadata("/_astro/a.111.png");
    await expect(
      resolveGaragePhotos(
        [{ name: "Cars", photo }],
        {
          images: { "/src/assets/garage/a.png": photo },
          read: serving({
            "/src/assets/garage/a.png": new TextEncoder().encode(
              "not an image",
            ),
          }),
        },
        async () => "",
      ),
    ).rejects.toThrow(/Cars/);
  });
});
