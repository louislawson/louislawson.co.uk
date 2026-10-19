import type { ImageMetadata } from "astro";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { ditherPhoto } from "./dither";
import { resolveGaragePhotos, type PhotoSources } from "./photos";

/** An image built in memory, and the data URL Vite's ?inline gives for a file like it. */
async function image(grey: number, width = 400, height = 300) {
  const bytes = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: grey, g: grey, b: grey },
    },
  })
    .png()
    .toBuffer();
  return { bytes, url: `data:image/png;base64,${bytes.toString("base64")}` };
}

const metadata = (src: string): ImageMetadata => ({
  src,
  width: 400,
  height: 300,
  format: "png",
});

describe("resolveGaragePhotos", () => {
  it("gives a placeholder photo nothing, and asks for nothing", async () => {
    const optimise = vi.fn();
    const result = await resolveGaragePhotos(
      [{ name: "Tractors", photo: "TODO: photo" }],
      { images: {}, inline: {} },
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
      inline: { "/src/assets/garage/truck.png": truck.url },
    };
    const optimise = vi.fn(async () => "/_astro/truck.abc123_Z1.webp");
    const [resolved] = await resolveGaragePhotos(
      [{ name: "Trucks", photo }],
      sources,
      optimise,
    );
    expect(resolved?.dither).toBe(await ditherPhoto(truck.bytes));
    expect(resolved?.href).toBe("/_astro/truck.abc123_Z1.webp");
    expect(optimise).toHaveBeenCalledWith(photo);
  });

  it("finds each entry's file by its image's address, however the files are ordered, and keeps the entries' order", async () => {
    const dark = await image(20);
    const light = await image(230);
    const a = metadata("/_astro/a.111.png");
    const b = metadata("/_astro/b.222.png");
    const sources: PhotoSources = {
      images: { "/src/assets/garage/b.png": b, "/src/assets/garage/a.png": a },
      inline: {
        "/src/assets/garage/a.png": dark.url,
        "/src/assets/garage/b.png": light.url,
      },
    };
    const result = await resolveGaragePhotos(
      [
        { name: "First", photo: a },
        { name: "Placeholder", photo: "TODO: photo" },
        { name: "Second", photo: b },
      ],
      sources,
      async (photo) => `${photo.src}.webp`,
    );
    expect(result.map((r) => r?.href)).toEqual([
      "/_astro/a.111.png.webp",
      undefined,
      "/_astro/b.222.png.webp",
    ]);
    expect(result[0]?.dither).toBe(await ditherPhoto(dark.bytes));
    expect(result[2]?.dither).toBe(await ditherPhoto(light.bytes));
    expect(result[0]?.dither).not.toBe(result[2]?.dither);
  });

  it("stops the build, naming the entry and the folder, when a photo is not in src/assets/garage", async () => {
    await expect(
      resolveGaragePhotos(
        [{ name: "Lost tractor", photo: metadata("/_astro/elsewhere.png") }],
        { images: {}, inline: {} },
        async () => "",
      ),
    ).rejects.toThrow(/Lost tractor.*src\/assets\/garage/s);
  });

  it("stops the build when a file has no bytes to read, rather than showing a blank card", async () => {
    const photo = metadata("/_astro/a.111.png");
    await expect(
      resolveGaragePhotos(
        [{ name: "Cars", photo }],
        { images: { "/src/assets/garage/a.png": photo }, inline: {} },
        async () => "",
      ),
    ).rejects.toThrow(/Cars/);
  });

  it("stops the build when the file's text is not a base64 data URL", async () => {
    const photo = metadata("/_astro/a.111.png");
    await expect(
      resolveGaragePhotos(
        [{ name: "Cars", photo }],
        {
          images: { "/src/assets/garage/a.png": photo },
          inline: { "/src/assets/garage/a.png": "/_astro/a.111.png" },
        },
        async () => "",
      ),
    ).rejects.toThrow(/Cars.*data URL/s);
  });

  it("stops the build when the file is not an image, naming the entry", async () => {
    const photo = metadata("/_astro/a.111.png");
    await expect(
      resolveGaragePhotos(
        [{ name: "Cars", photo }],
        {
          images: { "/src/assets/garage/a.png": photo },
          inline: {
            "/src/assets/garage/a.png": `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`,
          },
        },
        async () => "",
      ),
    ).rejects.toThrow(/Cars/);
  });
});
