import { readFileSync } from "node:fs";
import sharp from "sharp";
import sharpService from "astro/assets/services/sharp";
import { describe, expect, it } from "vitest";
import { checkImage } from "../metadata/image";

// The photo the dither links to is made by Astro's image pipeline, and the PR's claim is that its
// output carries no metadata. These tests hold the claim to the service that pipeline uses, on a
// real photo built in memory that carries a camera and a location. (It has to be an image sharp can
// decode: for one it cannot, Astro passes the file through unchanged, and warns.)

const located = await sharp({
  create: { width: 640, height: 480, channels: 3, background: "#3a6ea5" },
})
  .withExif({
    IFD0: { Make: "Acme Camera", Model: "Acme 1" },
    IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" },
  })
  .jpeg()
  .toBuffer();

const config = {
  service: { entrypoint: "astro/assets/services/sharp", config: {} },
};

async function optimise(format: "webp" | "jpeg" | "png") {
  const warnings: string[] = [];
  const result = await sharpService.transform(
    new Uint8Array(located),
    { src: "/src/assets/garage/car.jpg", width: 400, format },
    config as never,
    { warn: (message: string) => warnings.push(message) } as never,
  );
  return {
    bytes: new Uint8Array(result.data),
    warnings,
    format: result.format,
  };
}

describe("the optimised photo", () => {
  it("starts from a photo that does carry personal metadata, so the checks below can fail", async () => {
    const problems = await checkImage(new Uint8Array(located));
    expect(problems.join(" ")).toMatch(/GPS/);
  });

  it.each(["webp", "jpeg", "png"] as const)(
    "carries no metadata when Astro's image service writes it as %s",
    async (format) => {
      const { bytes, warnings, format: written } = await optimise(format);
      // Processed, not passed through: no warning, the format asked for, and a smaller picture.
      expect(warnings).toEqual([]);
      expect(written).toBe(format);
      expect((await sharp(bytes).metadata()).width).toBe(400);
      expect(await checkImage(bytes)).toEqual([]);
    },
  );

  it("is made by the sharp service: the site's config does not choose another image service", () => {
    const config = readFileSync(
      new URL("../../astro.config.mjs", import.meta.url),
      "utf-8",
    );
    expect(config).not.toMatch(/\bimage\s*:\s*\{[^}]*service/s);
  });
});
