// The rule behind the target-size check (e2e/reflow.spec.ts), kept apart from the spec so Vitest
// can test it. The browser reports plain facts about each link and button; this decides. Nothing the
// site's build reads imports this.

/** WCAG 2.5.8 (AA): a target is at least 24 by 24 CSS pixels. */
export const MIN_TARGET = 24;

/**
 * What a finger needs: the controls a phone's visitor reaches for are at least 44 by 44 CSS pixels.
 * This is the platforms' guidance (and WCAG 2.5.5, AAA), not the AA criterion above, so it is
 * checked for named controls on a touch screen and not for every link on the page.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * How many words must sit in a link's block, outside every link and button, for the link to be in a
 * sentence. A label ("Email:"), a year, or a lone word beside a row of links is not one.
 */
export const SENTENCE_WORDS = 3;

/** What the page tells us about one link or button. */
export interface TargetFacts {
  /** How to find it again in a failure message. */
  name: string;
  /** Its computed `display`: a flex item or an inline block reports `block` or `inline-block`. */
  display: string;
  /** The text of its block outside every link and button in that block. */
  surroundingText: string;
  width: number;
  height: number;
}

/**
 * The criterion exempts a target "in a sentence, or is limited by the line-height of non-target
 * text". That is a link that flows with the words around it: its own display is `inline`, and the
 * block it sits in holds at least SENTENCE_WORDS words beyond the links and buttons themselves. A
 * link alone in its block, beside a label or a year, or in a row of links with only separators
 * between them, is a control and not a sentence, and so is anything a layout has turned into a
 * block, an inline block or a flex item.
 */
export function isInlineInSentence(
  target: Pick<TargetFacts, "display" | "surroundingText">,
): boolean {
  const words = target.surroundingText.match(/[\p{L}\p{N}]+/gu) ?? [];
  return target.display === "inline" && words.length >= SENTENCE_WORDS;
}

/** A box with neither a width nor a height is hidden (display: none): a visitor cannot aim at it. */
const hasNoBox = (target: Pick<TargetFacts, "width" | "height">) =>
  target.width === 0 && target.height === 0;

/** The words that say a target is under a size, and by how much. */
const tooSmall = (
  target: Pick<TargetFacts, "name" | "width" | "height">,
  min: number,
) =>
  `${target.name} is ${target.width} × ${target.height} px, under ${min} × ${min}`;

/** What is wrong with a target's size, or undefined when it passes or is not on the page. */
export function targetProblem(target: TargetFacts): string | undefined {
  if (hasNoBox(target)) return undefined;
  if (target.width >= MIN_TARGET && target.height >= MIN_TARGET)
    return undefined;
  if (isInlineInSentence(target)) return undefined;
  return tooSmall(target, MIN_TARGET);
}

/**
 * What is wrong with a control's size for a finger, or undefined when it passes or is not on the
 * page. Unlike targetProblem it has no exemption for a link in a sentence: it is asked of the
 * controls named in the spec, which are never in a sentence. A spec that names a control checks it
 * is on the page first, because a control with no box passes here, as it does there.
 */
export function touchProblem(
  target: Pick<TargetFacts, "name" | "width" | "height">,
): string | undefined {
  if (hasNoBox(target)) return undefined;
  if (target.width >= MIN_TOUCH_TARGET && target.height >= MIN_TOUCH_TARGET)
    return undefined;
  return tooSmall(target, MIN_TOUCH_TARGET);
}
