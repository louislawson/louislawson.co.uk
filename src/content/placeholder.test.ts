import { describe, expect, it } from "vitest";
import { containsTodo, isPlaceholder } from "./todo";
import { todo } from "./schema";

describe("placeholders", () => {
  it("accepts a string that starts with TODO:", () => {
    expect(todo.safeParse("TODO: add the real title").success).toBe(true);
  });

  it("rejects a string that does not start with TODO:", () => {
    expect(todo.safeParse("A real title").success).toBe(false);
    expect(todo.safeParse("todo: lower case").success).toBe(false);
    expect(todo.safeParse(" TODO: leading space").success).toBe(false);
  });

  it("names the TODO: prefix in the error", () => {
    const result = todo.safeParse("A real title");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("TODO:");
  });

  it("is recognised by isPlaceholder for strings only", () => {
    expect(isPlaceholder("TODO: later")).toBe(true);
    expect(isPlaceholder("done")).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
    expect(isPlaceholder(42)).toBe(false);
    expect(isPlaceholder(["TODO: x"])).toBe(false);
  });

  describe("containsTodo", () => {
    // One rule for every text field and for a Markdown body, which no schema covers.
    it("finds TODO and TODOs as words, in any case, anywhere in the text", () => {
      for (const body of [
        "TODO: write the result section",
        "Some prose.\n\nTODO write more",
        "Still to do: see the TODOs below",
        "- todos remain",
        "(Todo)",
        "Faster deploys. TODO: add the figure",
        "line one\nTODO line two",
      ]) {
        expect(containsTodo(body), body).toBe(true);
      }
    });

    it("leaves ordinary words alone", () => {
      for (const body of [
        "A Todoist-style board and autodoc output.",
        "Nothing left to do here.",
        "mastodon, A to-do list",
        "",
      ]) {
        expect(containsTodo(body), body).toBe(false);
      }
    });
  });
});
