/** Waiting forms register with their own transcript, including hidden copies
 * of the same conversation. A reveal never searches another page's DOM. */
import { createContext, createSignal, onCleanup, useContext } from "solid-js"

export const createWaitingForms = () => {
  const [forms, setForms] = createSignal<ReadonlyArray<{ element: HTMLElement; waiting: () => boolean }>>([])
  return {
    first: () => forms().filter(form => form.waiting() && form.element.isConnected)
      .sort((a, b) => a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)[0]?.element,
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
