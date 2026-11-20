export const wholeYet = <T>(
  keys: ReadonlyArray<string>,
  valueOf: (key: string) => T | undefined,
): boolean => keys.length > 0 && keys.every((key) => valueOf(key) !== undefined)
