import { onCleanup } from "solid-js"

/** Decide after the current gesture has delivered its click. A pointer may
 * move focus before that click changes the owning view's visibility. */
export function createAfterGesture() {
  let pointer = false
  let alive = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = new Set<() => void>()
  const flush = () => {
    if (!alive) return
    const tasks = [...pending]
    pending.clear()
    for (const task of tasks) task()
  }
  const start = () => { pointer = true }
  const finish = () => {
    pointer = false
    clearTimeout(timer)
    timer = setTimeout(flush, 0)
  }
  document.addEventListener("pointerdown", start, true)
  document.addEventListener("pointerup", finish, true)
  document.addEventListener("pointercancel", finish, true)
  document.addEventListener("dragend", finish, true)
  window.addEventListener("blur", finish)
  onCleanup(() => {
    alive = false
    pending.clear()
    clearTimeout(timer)
    document.removeEventListener("pointerdown", start, true)
    document.removeEventListener("pointerup", finish, true)
    document.removeEventListener("pointercancel", finish, true)
    document.removeEventListener("dragend", finish, true)
    window.removeEventListener("blur", finish)
  })
  return (task: () => void) => {
    pending.add(task)
    if (!pointer) queueMicrotask(flush)
  }
}
