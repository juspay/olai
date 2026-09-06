/** A host diagnostic must work even when the renderer module cannot load.
 * It names the failure and retries the authoritative selection; it never mounts
 * an inferred shell. Any rendered application takes over presentation. */
export const bootStatus = (root: Element): {
  readonly failed: (message: string, retry: () => Promise<void>, recovery?: "retry" | "reload") => void
  readonly clear: () => void
  readonly dispose: () => void
} => {
  const status = document.createElement("section")
  status.setAttribute("role", "alert")
  status.setAttribute("aria-label", "Browser startup failed")
  const detail = document.createElement("p")
  const button = document.createElement("button")
  button.textContent = "Retry browser startup"
  status.append(detail, button)
  let problem: { message: string; retry: () => Promise<void>; recovery: "retry" | "reload" } | undefined
  const update = () => {
    if (!problem || root.childElementCount > 0) status.remove()
    else { detail.textContent = problem.message; button.textContent = problem.recovery === "reload" ? "Reload page" : "Retry browser startup"; root.after(status) }
  }
  const observer = new MutationObserver(update)
  observer.observe(root, { childList: true })
  button.onclick = async () => {
    if (!problem) return
    button.disabled = true
    try { await problem.retry() } finally { button.disabled = false }
  }
  return {
    failed: (message, retry, recovery = "retry") => { problem = { message, retry, recovery }; update() },
    clear: () => { problem = undefined; update() },
    dispose: () => { observer.disconnect(); button.onclick = null; status.remove() },
  }
}
