// The rule every single-key shortcut on the site follows (the number keys and the i key), so each
// one is held to the same guards and the footer switch can turn them off together.

export interface KeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
  /** An input method is composing text: a key then belongs to it. */
  isComposing?: boolean;
}

export interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

const FIELDS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * The key a shortcut may act on, or nothing. Nothing while Control, Alt or Meta is held (the
 * browser's own shortcuts keep working), while a key repeats or an input method is composing, or
 * while the visitor is typing in a field. Shift is not held against it: the key says what was
 * typed. On QWERTY, Shift+1 is "!", which is no digit; on AZERTY the top row types a digit only
 * with Shift, and refusing it would lock those visitors out.
 */
export function plainKey(
  event: KeyEvent,
  target: KeyTarget | null,
): string | undefined {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    event.isComposing
  ) {
    return undefined;
  }
  if (
    target &&
    (FIELDS.has((target.tagName ?? "").toUpperCase()) ||
      target.isContentEditable)
  ) {
    return undefined;
  }
  return event.key;
}
