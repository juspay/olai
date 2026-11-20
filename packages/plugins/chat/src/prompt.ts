export const annotated = (
  said: string,
  lines: ReadonlyArray<string>,
): string => {
  if (lines.length === 0) return said
  const added = lines.join("\n")
  return said === "" ? added : `${said}\n\n${added}`
}
