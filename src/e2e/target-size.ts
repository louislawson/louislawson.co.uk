// The rule behind the target-size check (e2e/reflow.spec.ts), kept apart from the spec so Vitest
// can test it. The browser reports plain facts about each link and button; this decides. Nothing the
// site's build reads imports this.

/** WCAG 2.5.8 (AA): a target is at least 24 by 24 CSS pixels. */
export const MIN_TARGET = 24;

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
 * block it sits in holds words beyond the links and buttons themselves. A link alone in its block,
 * or in a row of links with only separators between them, is a control and not a sentence, and so
 * is anything a layout has turned into a block, an inline block or a flex item.
 */
export function isInlineInSentence(
  target: Pick<TargetFacts, "display" | "surroundingText">,
): boolean {
  return (
    target.display === "inline" && /[\p{L}\p{N}]/u.test(target.surroundingText)
  );
}

/** What is wrong with a target's size, or undefined when it passes or is not on the page. */
export function targetProblem(target: TargetFacts): string | undefined {
  // A target with no box is hidden (display: none): a visitor cannot aim at it.
  if (target.width === 0 && target.height === 0) return undefined;
  if (target.width >= MIN_TARGET && target.height >= MIN_TARGET)
    return undefined;
  if (isInlineInSentence(target)) return undefined;
  return `${target.name} is ${target.width} × ${target.height} px, under ${MIN_TARGET} × ${MIN_TARGET}`;
}
