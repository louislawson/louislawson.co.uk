# Garage photos

The garage's photos live here, one file for each entry in `garage` in `src/data/profile.ts`.

To add one:

1. Strip the photo's metadata first. CI's **Metadata check** fails the pull request if a photo here carries EXIF, XMP, IPTC, a location or an author. A phone's orientation tag is allowed.
2. Blur or crop road-vehicle number plates and identifiable faces before the photo is saved here.
3. Put the file here as `.jpg`, `.jpeg`, `.png` or `.webp`.
4. Import it in `src/data/profile.ts` and give the entry that import as its `photo`, with an `alt` that describes the photo and a `caption` that names the event and the vehicle, never the owner.

The build turns each photo into a 72 × 26 text picture. Hovering, focusing or tapping it swaps in the optimised full-colour photo, which Astro's image pipeline writes without metadata. Only that optimised copy is published, never the original. A photo outside this folder, or one that cannot be read as an image, stops the build.

Every photo in this folder is processed in every build, whether or not its card is shown: production leaves out an entry while its note, `alt` or caption is still a `TODO:`, and its photo is then optimised but not shown or linked, and no original is published. A photo is only dithered and linked when its card is shown.

Every photo in this folder must be used by an entry. Astro publishes any image it imports that nothing processes, so a photo no entry uses would be published as it is, full size; the build fails and names it instead. The code that finds and reads the photos must never read an image's `src` or import a photo with a query such as `?inline`, which also make Astro keep the original: `src/garage/` has tests for both.
