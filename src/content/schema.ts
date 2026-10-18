import type { ImageMetadata } from "astro";
import { z } from "astro/zod";
import { PLACEHOLDER_PREFIX, containsTodo, isPlaceholder } from "./todo.ts";

/** A value Louis hasn't supplied yet. Any field that can be unknown accepts this instead. */
export const todo = z.string().startsWith(PLACEHOLDER_PREFIX, {
  error: `A placeholder must start with "${PLACEHOLDER_PREFIX}"`,
});

/** The value a field takes when it is known, or a placeholder when it is not. */
function orTodo<T extends z.ZodType>(schema: T, expected: string) {
  return z.union([schema, todo], {
    error: `Expected ${expected}, or a placeholder starting with "${PLACEHOLDER_PREFIX}"`,
  });
}

/**
 * Text is real or a whole placeholder. A TODO inside otherwise real text ("Faster deploys. TODO:
 * add the figure", "todo: write this", "TODO write this") would pass for finished content and be
 * published, so it is an error. The word boundary leaves words like "Todoist" alone.
 */
const wholeOrNoTodo = {
  error: `A placeholder must be the whole value and start with "${PLACEHOLDER_PREFIX}"`,
};
const noPartialTodo = (value: string) =>
  !containsTodo(value) || isPlaceholder(value);

const plainText = z.string().trim().min(1);
const text = plainText.refine(noPartialTodo, wholeOrNoTodo);
const url = orTodo(z.httpUrl(), "an http(s) URL");

const headline = orTodo(
  z
    .string()
    .trim()
    .refine((value) => {
      const words = value.split(/\s+/).length;
      return words >= 2 && words <= 5;
    })
    .refine(noPartialTodo, wholeOrNoTodo),
  "a headline of 2 to 5 words",
);

const status = orTodo(
  z.enum(["in-service", "commissioning", "complete", "archived"]),
  "in-service, commissioning, complete or archived",
);

/** A measurement is real or absent, so unlike every other field it takes no placeholder. */
const real = plainText.refine((value) => !containsTodo(value), {
  error:
    "A measurement is real or absent: remove it rather than use a placeholder",
});

const measurement = z.strictObject({
  label: real,
  before: real,
  after: real.optional(),
  unit: real.optional(),
});

const link = z.strictObject({ label: text, url });

const forbidden = (reason: string) => z.never({ error: reason }).optional();

const code = z.string().regex(/^R\d{2}$/, {
  error: "A code is R and two digits, for example R01",
});

const projectFields = {
  code,
  title: text,
  summary: text,
  headline,
  status,
  period: text,
  featured: z.boolean(),
  order: z.number().int().positive(),
  setup: text,
  change: text,
  result: text,
  measurements: z.array(measurement).optional(),
  stack: z.array(text).min(1),
  links: z.array(link).default([]),
};

/**
 * Work projects are anonymised: they carry a descriptor and may not name an organisation, so
 * naming an employer is a build error. Personal and open-source projects may be named.
 */
export const projectSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...projectFields,
    kind: z.literal("work"),
    descriptor: text,
    org: forbidden("A work project is anonymised: use descriptor, never org"),
  }),
  ...(["personal", "open-source"] as const).map((kind) =>
    z.strictObject({
      ...projectFields,
      kind: z.literal(kind),
      org: text.optional(),
      descriptor: forbidden(
        `A ${kind} project is named: use org, not descriptor`,
      ),
    }),
  ),
] as const);

export type Project = z.infer<typeof projectSchema>;

const certificationDate = orTodo(
  z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/),
  "a year (2025) or a year and month (2025-06)",
);

const isPositiveInt = (value: unknown) =>
  Number.isInteger(value) && (value as number) > 0;

/**
 * An imported image (Astro's ImageMetadata). It is checked but never rebuilt: a parsed copy would
 * lose the properties Astro hides on the object it tracks, and the image pipeline needs that one.
 */
const photo = orTodo(
  z.custom<ImageMetadata>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      "src" in value &&
      typeof value.src === "string" &&
      value.src !== "" &&
      "width" in value &&
      isPositiveInt(value.width) &&
      "height" in value &&
      isPositiveInt(value.height) &&
      "format" in value &&
      typeof value.format === "string",
  ),
  "an imported image with src, width, height and format",
);

export const profileSchema = z.strictObject({
  roleLine: text,
  intro: text,
  careerLine: text,
  region: text,
  /** Shown until the end of `until`, UK time. Leave it out for no statement. */
  availability: z
    .strictObject({
      text,
      until: orTodo(z.iso.date(), "a date as YYYY-MM-DD"),
    })
    .optional(),
  email: orTodo(z.email(), "an email address"),
  links: z.strictObject({ github: url, linkedin: url }),
  /** The file is `public/cv.pdf`. */
  cv: orTodo(z.literal("/cv.pdf"), "/cv.pdf"),
  skills: z.array(
    z.strictObject({
      group: text,
      context: text,
      tools: z.array(text).min(1),
      /** Codes of the projects where this was used. */
      runs: z.array(code),
    }),
  ),
  /** The design shows 3 to 5; the launch gate (PR 2.2) decides what production needs. */
  exploring: z.array(text).max(5),
  certifications: z.array(
    z.strictObject({
      title: text,
      issuer: text,
      date: certificationDate,
      verify: url.optional(),
    }),
  ),
  /** The sentence beside the garage's wheel figure: what the machines mean to Louis. */
  garageIntro: text,
  garage: z.array(
    z.strictObject({ name: text, note: text, photo, alt: text, caption: text }),
  ),
});

export type Profile = z.infer<typeof profileSchema>;

/** Parses the profile data, failing with one error that lists every problem. */
export function parseProfile(input: unknown): Profile {
  const result = profileSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `src/data/profile.ts does not match the profile schema:
${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
