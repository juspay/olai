import type { Who } from "@olai/surface"

export const saying = (person: Who): string =>
  person.name === null || person.name === person.login
    ? person.login
    : `${person.name} (${person.login})`
