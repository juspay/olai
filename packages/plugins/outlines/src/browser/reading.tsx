import { untrack } from "solid-js"

import { samePageRequest, type PageReading, type PageRequest } from "@olai/format"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

import { createDoors, type Doors } from "./doors.ts"
import type { NodePageRoute } from "olai-plugin-navigation/routes"
import { createLicences, type Licences } from "./licences.ts"
import { createNames, type Names } from "./names.ts"
import { client } from "../client.ts"

export interface Reading {
  readonly page: Accessor<PageReading | undefined>
  readonly pending: Accessor<boolean>
  readonly failure: Accessor<Error | undefined>
  readonly at: Accessor<number>
  readonly names: Accessor<Names>
  readonly doors: Accessor<Doors>
  readonly licences: Accessor<Licences>
  readonly about: Accessor<PageRequest | null>
}

interface Answered {
  readonly page: PageReading
  readonly about: PageRequest | null
}

export const createReading = (
  request: Accessor<PageRequest | null>,
  holding?: Accessor<boolean>,
  stream?: Accessor<NodePageRoute["stream"] | undefined>,
): Reading => {
  const [at, setAt] = createSignal(0)
  const subscription = createMemo(() => {
    const channel = stream?.()
    const answer = untrack(() => channel === undefined ? client().streams.page.use(request) : channel.use(request))
    const stop = answer.changed?.(() => setAt(was => was + 1))
    if (stop) onCleanup(stop)
    return answer
  })
  const answer = () => subscription()?.()
  const answered = createMemo<Answered | undefined>(() => {
    const arrived = answer()
    return arrived === undefined ? undefined : { page: arrived, about: untrack(request) }
  })
  const held = createMemo<Answered | undefined>((was) => {
    if (holding?.() === true) return was
    return answered() ?? was
  }, undefined)
  const page = createMemo(() => held()?.page)
  const pending = createMemo(() => {
    const wanted = request()
    const drawn = held()?.about
    return wanted !== null && (drawn == null || !samePageRequest(wanted, drawn))
  })
  return {
    page,
    pending,
    failure: () => subscription()?.error?.(),
    at,
    names: createNames(page),
    doors: createDoors(page),
    licences: createLicences(page),
    about: () => held()?.about ?? null,
  }
}

const ReadingContext = createContext<Accessor<PageReading | undefined>>()
const FramesContext = createContext<Accessor<number>>()
const NamesContext = createContext<Accessor<Names>>()
const DoorsContext = createContext<Accessor<Doors>>()
const LicencesContext = createContext<Accessor<Licences>>()

export function ReadingProvider(props: {
  readonly reading: Reading
  readonly children: JSX.Element
}) {
  return (
    <ReadingContext.Provider value={props.reading.page}>
      <FramesContext.Provider value={props.reading.at}>
        <NamesContext.Provider value={props.reading.names}>
          <DoorsContext.Provider value={props.reading.doors}>
            <LicencesContext.Provider value={props.reading.licences}>
              {props.children}
            </LicencesContext.Provider>
          </DoorsContext.Provider>
        </NamesContext.Provider>
      </FramesContext.Provider>
    </ReadingContext.Provider>
  )
}

export const useReading = (): Accessor<PageReading | undefined> => {
  const reading = useContext(ReadingContext)
  if (reading === undefined) throw new Error("a page reading outside <ReadingProvider>")
  return reading
}

export const useFrames = (): Accessor<number> => {
  const frames = useContext(FramesContext)
  if (frames === undefined) throw new Error("a frame count outside <ReadingProvider>")
  return frames
}

export const useNames = (): Accessor<Names> => {
  const names = useContext(NamesContext)
  if (names === undefined) throw new Error("a name lookup outside <ReadingProvider>")
  return names
}

export const useDoors = (): Accessor<Doors> => {
  const doors = useContext(DoorsContext)
  if (doors === undefined) throw new Error("a door lookup outside <ReadingProvider>")
  return doors
}

export const useLicences = (): Accessor<Licences> => {
  const licences = useContext(LicencesContext)
  if (licences === undefined) throw new Error("a licence lookup outside <ReadingProvider>")
  return licences
}

export interface Readings {
  readonly join: (pane: () => string, reading: Reading) => void
  readonly at: (index: string) => PageReading | undefined
  readonly names: (index: string) => Names
}

const ReadingsContext = createContext<Readings>()

export const ReadingsProvider = ReadingsContext.Provider

export const useReadings = (): Readings => {
  const readings = useContext(ReadingsContext) ?? ownedReadings
  if (readings === undefined) throw new Error("a page reading outside <App>")
  return readings
}

const unnamed: Names = () => undefined

export const createReadings = (): Readings => {
  const [joined, setJoined] = createSignal<
    ReadonlyArray<{
      readonly pane: () => string
      readonly reading: Reading
    }>
  >([])
  return {
    join: (pane, reading) => {
      const entry = { pane, reading }
      setJoined((were) => [...were, entry])
      onCleanup(() => setJoined((were) => were.filter((one) => one !== entry)))
    },
    at: (index) => joined().find((one) => one.pane() === index)?.reading.page(),
    names: (index) =>
      joined().find((one) => one.pane() === index)?.reading.names() ?? unnamed,
  }
}

let ownedReadings: Readings | undefined
export const holdReadings = (value: Readings): (() => void) => {
  ownedReadings = value
  return () => { if (ownedReadings === value) ownedReadings = undefined }
}

export function PropertyReading(props: { readonly page: Accessor<PageReading | undefined>; readonly children: JSX.Element }) {
  const names = createNames(props.page)
  const doors = createDoors(props.page)
  const licences = createLicences(props.page)
  return <NamesContext.Provider value={names}><DoorsContext.Provider value={doors}><LicencesContext.Provider value={licences}>
    {props.children}
  </LicencesContext.Provider></DoorsContext.Provider></NamesContext.Provider>
}
