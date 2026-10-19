# Garage photos

The garage's photos live here, one file for each entry in `garage` in `src/data/profile.ts`.

To add one:

1. Strip the photo's metadata first. CI's **Metadata check** fails the pull request if a photo here carries EXIF, XMP, IPTC, a location or an author. A phone's orientation tag is allowed.
2. Blur or crop road-vehicle number plates and identifiable faces before the photo is saved here.
3. Put the file here as `.jpg`, `.jpeg`, `.png` or `.webp`.
4. Import it in `src/data/profile.ts` and give the entry that import as its `photo`, with an `alt` that describes the photo and a `caption` that names the event and the vehicle, never the owner.

The build turns each photo into a 72 × 26 text picture. Hovering, focusing or tapping it swaps in the optimised full-colour photo, which Astro's image pipeline writes without metadata. A photo outside this folder, or one that cannot be read as an image, stops the build.
