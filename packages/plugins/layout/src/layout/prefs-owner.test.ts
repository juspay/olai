import {expect,test} from "bun:test"
import {followLayout} from "./prefs-owner.ts"
import {PANEL_OPEN_KEY,panelOpen,setPanelOpen,setSidebarWidth,SIDEBAR_WIDTH_KEY,sidebarWidth} from "./prefs.ts"

test("layout owns fresh preferences, listeners and stopped setters",()=>{
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,"window")
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,"localStorage")
 const stored=new Map([[PANEL_OPEN_KEY,"true"],[SIDEBAR_WIDTH_KEY,"360"]])
 const listeners=new Map<string,Set<(...args:any[])=>void>>()
 Object.defineProperty(globalThis,"window",{configurable:true,value:{innerWidth:1400,
  addEventListener:(name:string,fn:(...args:any[])=>void)=>{let set=listeners.get(name);if(!set)listeners.set(name,set=new Set());set.add(fn)},
  removeEventListener:(name:string,fn:(...args:any[])=>void)=>listeners.get(name)?.delete(fn),
 }})
 Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{
  getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key),
 }})
 let stop:undefined|(()=>void)
 try {
  stop=followLayout()
  expect(panelOpen()).toBe(true)
  expect(sidebarWidth()).toBe(360)
  expect(listeners.get("storage")?.size).toBe(5)
  expect(listeners.get("resize")?.size).toBe(1)
  setSidebarWidth(440,{persist:false})
  expect(sidebarWidth()).toBe(440)
  stop();stop=undefined
  expect(listeners.get("storage")?.size).toBe(0)
  expect(listeners.get("resize")?.size).toBe(0)
  setPanelOpen(false)
  expect(stored.get(PANEL_OPEN_KEY)).toBe("true")
  stored.set(SIDEBAR_WIDTH_KEY,"280")
  stop=followLayout()
  expect(sidebarWidth()).toBe(280)
  for(const fn of listeners.get("storage")??[])fn({key:PANEL_OPEN_KEY,newValue:"false"})
  expect(panelOpen()).toBe(false)
 } finally {
  stop?.()
  if(oldWindow)Object.defineProperty(globalThis,"window",oldWindow);else Reflect.deleteProperty(globalThis,"window")
  if(oldStorage)Object.defineProperty(globalThis,"localStorage",oldStorage);else Reflect.deleteProperty(globalThis,"localStorage")
 }
})
