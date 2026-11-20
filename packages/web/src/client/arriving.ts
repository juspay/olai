import { createSignal } from "solid-js"

export interface Arrival<T> {
  readonly ready: () => boolean
  readonly waiting: () => boolean
  readonly failure: () => Error | undefined
  readonly now: () => T
  readonly install: (value: T) => void
}

const startOnce = (begin: () => void): (() => void) => {
  let started = false
  return () => {
    if (started) return
    started = true
    begin()
  }
}

export const createArrival = <T>(what: string, fetch: () => Promise<T>): Arrival<T> => {
  const [arrival, setArrival] = createSignal<T | Error | undefined>(undefined)

  const install = (value: T): void => {
    setArrival(() => value)
  }

  const start = startOnce(() => {
    void fetch().then(install, (cause: unknown) => {
      const error = new Error(
        `${what} could not be loaded: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        { cause },
      )
      console.error(error)
      setArrival(error)
    })
  })

  const askedFor = (): T | Error | undefined => {
    const here = arrival()
    if (here === undefined) start()
    return here
  }

  return {
    install,
    ready: () => {
      const here = askedFor()
      return here !== undefined && !(here instanceof Error)
    },
    waiting: () => askedFor() === undefined,
    failure: () => {
      const here = arrival()
      return here instanceof Error ? here : undefined
    },
    now: () => {
      const here = arrival()
      if (here === undefined || here instanceof Error) {
        throw new Error(`${what} was used before it arrived — its ready() answers first`)
      }
      return here
    },
  }
}
