import { location } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
export const name = "preferences"
export const sections = location<() => JSX.Element>("preferences.sections")
