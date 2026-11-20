import { heldService } from "./held.ts"
export interface ReferrerMemory {
  readonly opened: ReadonlyMap<string, boolean> | undefined
  readonly remember: (key: string, open: boolean) => void
  readonly forget: (key: string) => void
}

export const createReferrerMemory = (): ReferrerMemory => {
  const opened = new Map<string, boolean>()
  return {
    opened,
    remember: (key, open) => { opened.set(key, open) },
    forget: (key) => { opened.delete(key) },
  }
}

export const referrerMemoryChannel = () => heldService<ReferrerMemory>()