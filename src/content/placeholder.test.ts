import { describe, expect, it } from "vitest";
import { containsTodo, isPlaceholder, todo } from "./schema";

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

  // PR 2.2: a project is real only if it has no placeholder anywhere. The body is Markdown, which
  // no schema covers, so apply containsTodo() to it: a body with TODO anywhere is not real.
  it.todo("treats a project whose Markdown body contains TODO as not real");

  describe("containsTodo", () => {
    it("finds TODO as a word, in any case, anywhere in the text", () => {
      for (const value of [
        "TODO: later",
        "Faster deploys. TODO: add the figure",
        "todo write this",
        "(Todo)",
        "line one\nTODO line two",
      ]) {
        expect(containsTodo(value), value).toBe(true);
      }
    });

    it("leaves words that merely contain it alone", () => {
      for (const value of ["Todoist", "autodoc", "mastodon", "A to-do list"]) {
        expect(containsTodo(value), value).toBe(false);
      }
    });
  });
});
