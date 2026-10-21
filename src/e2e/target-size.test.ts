import { describe, expect, it } from "vitest";
import {
  MIN_TARGET,
  isInlineInSentence,
  targetProblem,
  type TargetFacts,
} from "./target-size.ts";

const target = (facts: Partial<TargetFacts> = {}): TargetFacts => ({
  name: "a link",
  display: "inline-block",
  surroundingText: "",
  width: 40,
  height: 40,
  ...facts,
});

describe("an inline link in a sentence", () => {
  it("is a link that flows with the words around it", () => {
    expect(
      isInlineInSentence(
        target({
          display: "inline",
          surroundingText: "The setup is written up on the run sheet.",
        }),
      ),
    ).toBe(true);
  });

  it("counts a single word beside the link as a sentence", () => {
    expect(
      isInlineInSentence(
        target({ display: "inline", surroundingText: "see " }),
      ),
    ).toBe(true);
  });

  it("is not a link alone in its block, which is a control and not a sentence", () => {
    expect(
      isInlineInSentence(target({ display: "inline", surroundingText: "  " })),
    ).toBe(false);
  });

  it("is not a link among separators only: a row of links is a menu", () => {
    expect(
      isInlineInSentence(
        target({ display: "inline", surroundingText: " · · " }),
      ),
    ).toBe(false);
  });

  it("is not a block, an inline block or a flex item, whatever words are near", () => {
    for (const display of ["block", "inline-block", "flex", "inline-flex"]) {
      expect(
        isInlineInSentence(
          target({ display, surroundingText: "Some words beside it." }),
        ),
        display,
      ).toBe(false);
    }
  });

  it("reads words in any script", () => {
    expect(
      isInlineInSentence(
        target({ display: "inline", surroundingText: "日本語 " }),
      ),
    ).toBe(true);
  });
});

describe("a target that is too small", () => {
  it("passes at exactly the minimum on both sides", () => {
    expect(MIN_TARGET).toBe(24);
    expect(targetProblem(target({ width: 24, height: 24 }))).toBeUndefined();
  });

  it("fails when either side is short, and says which", () => {
    expect(targetProblem(target({ width: 23.5, height: 40 }))).toMatch(
      /23\.5 × 40/,
    );
    expect(targetProblem(target({ width: 40, height: 20 }))).toMatch(/40 × 20/);
  });

  it("names the target so the failure can be found", () => {
    expect(targetProblem(target({ name: "a.footer-link", width: 10 }))).toMatch(
      /a\.footer-link/,
    );
  });

  it("lets a small inline link in a sentence through", () => {
    expect(
      targetProblem(
        target({
          display: "inline",
          surroundingText: "Read the run sheet for this",
          height: 18,
          width: 60,
        }),
      ),
    ).toBeUndefined();
  });

  it("does not let a small inline link in a row of links through", () => {
    expect(
      targetProblem(
        target({
          display: "inline",
          surroundingText: " · ",
          height: 18,
          width: 60,
        }),
      ),
    ).toMatch(/60 × 18/);
  });

  it("ignores a target with no box: it is not on the page", () => {
    expect(targetProblem(target({ width: 0, height: 0 }))).toBeUndefined();
  });
});
