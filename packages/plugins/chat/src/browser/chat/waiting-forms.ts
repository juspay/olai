/** Waiting forms register with their own transcript, including hidden copies
 * of the same conversation. A reveal never searches another page's DOM. */
import { createContext, createSignal, onCleanup, useContext } from "solid-js"

export const createWaitingForms = () => {
  const [forms, setForms] = createSignal<ReadonlyArray<{ element: HTMLElement; waiting: () => boolean }>>([])
  return {
    first: () => forms().find(form => form.waiting())?.element,
    register: (element: HTMLElement, waiting: () => boolean) => {
      const form = { element, waiting }
      setForms(all => [...all, form])
      onCleanup(() => setForms(all => all.filter(one => one !== form)))
    },
  }
}
const context = createContext<ReturnType<typeof createWaitingForms>>()
export const WaitingFormsProvider = context.Provider
export const useWaitingForms = () => useContext(context)
