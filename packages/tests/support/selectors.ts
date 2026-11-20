/**
 * TWO CHARACTERS need escaping inside a CSS string and no more: the closing
 * quote and the backslash that would escape it, in that order — escaping the
 * quote first would turn a value's own trailing `\` into the escape for the
 * quote after it. A NEWLINE cannot appear raw in a CSS string at all, so it
 * becomes the character escape `\a `, where the trailing space terminates the
 * hex digits and is part of the escape rather than decoration.
 */
export type Match = "=" | "~=" | "^=";

export const attr = (name: string, value: string, match: Match = "="): string =>
  `[${name}${match}"${
    value.replace(/[\\"]/g, (char) => `\\${char}`).replace(/\n/g, "\\a ")
  }"]`;
