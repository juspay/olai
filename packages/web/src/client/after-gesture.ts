import { onCleanup } from "solid-js"

export function createAfterGesture() {
  let pointer = false
  let alive = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = new Set<() => void>()
  const drain = () => {
    const tasks = [...pending]
    pending.clear()
    for (const task of tasks) task()
  }
  const flush = () => { if (alive) drain() }
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
  document.addEventListener("contextmenu", finish, true)
  window.addEventListener("blur", finish)
  onCleanup(() => {
    alive = false
    clearTimeout(timer)
    document.removeEventListener("pointerdown", start, true)
    document.removeEventListener("pointerup", finish, true)
    document.removeEventListener("pointercancel", finish, true)
    document.removeEventListener("dragend", finish, true)
    document.removeEventListener("contextmenu", finish, true)
    window.removeEventListener("blur", finish)
    drain()
  })
  return (task: () => void) => {
    if (!alive) { queueMicrotask(task); return }
    pending.add(task)
    if (!pointer) queueMicrotask(flush)
  }
}
