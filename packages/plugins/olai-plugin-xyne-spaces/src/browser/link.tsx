/**
 * THE LINK, as this tab holds it — ONE subscription, for the pill.
 */

import { type Accessor, createContext, type JSX, useContext } from "solid-js"

import { SPACES_UNDIALED, type SpacesLink } from "../wire.ts"

const LinkContext = createContext<Accessor<SpacesLink>>(() => SPACES_UNDIALED)

export function LinkProvider(props: {
  readonly link: Accessor<SpacesLink | undefined>
  readonly children: JSX.Element
}): JSX.Element {
  const link: Accessor<SpacesLink> = () => props.link() ?? SPACES_UNDIALED
  return <LinkContext.Provider value={link}>{props.children}</LinkContext.Provider>
}

export const useLink = (): Accessor<SpacesLink> => useContext(LinkContext)
