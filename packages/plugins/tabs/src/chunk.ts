/**
 * THE MENU, behind one `import()` — the one door the strip and the link menu
 * both open it by, so Kobalte's dropdown is loaded on the first right-click and
 * stays off first paint (`@olai/web`'s `client/claims.test.ts` holds the list).
 */
import { lazy } from "solid-js"

export const PointMenu = lazy(() => import("./Menu.tsx"))
