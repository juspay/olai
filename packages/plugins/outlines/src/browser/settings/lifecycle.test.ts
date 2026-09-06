import { expect, test } from "bun:test"
import { density, followDensity } from "./density.ts"
import { doneHidden, followDonePrefs } from "./done.ts"
import { followFolds } from "../fold/memory.ts"

test("outline preferences follow storage without preferences UI and release all observers", () => {
  const stored = new Map<string,string>([["olai.notes.density", "compact"], ["olai.done.hidden", "false"]])
  const listeners = new Set<(event:StorageEvent) => void>()
  const globals = {
    localStorage: {getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)},
    window: {addEventListener:(_:string,fn:(event:StorageEvent)=>void)=>listeners.add(fn),removeEventListener:(_:string,fn:(event:StorageEvent)=>void)=>listeners.delete(fn)},
  }
  const before = Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const)
  const stops: Array<()=>void> = []
  try {
    for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{configurable:true,value})
    stops.push(followDensity(),followDonePrefs(),followFolds())
    expect(listeners.size).toBe(4)
    expect(density()).toBe("compact")
    expect(doneHidden()).toBe(false)
    for (const listener of listeners) listener({key:"olai.notes.density",newValue:"open",storageArea:localStorage} as StorageEvent)
    expect(density()).toBe("open")
    for (const stop of stops.splice(0)) stop()
    expect(listeners.size).toBe(0)
    stored.set("olai.notes.density","cozy")
    stored.set("olai.done.hidden","true")
    stops.push(followDensity(),followDonePrefs(),followFolds())
    expect(listeners.size).toBe(4)
    expect(density()).toBe("cozy")
    expect(doneHidden()).toBe(true)
  } finally {
    for (const stop of stops) stop()
    for (const [key,descriptor] of before) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis,key)
      else Object.defineProperty(globalThis,key,descriptor)
    }
  }
  expect(listeners.size).toBe(0)
})
