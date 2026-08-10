/**
 * What an installed olai is: the manifest a browser reads when someone adds
 * this page to a home screen or a dock.
 *
 * Its own file, beside `clientDist.ts` and `codec.ts`, because it has nothing
 * to do with the thing that serves it. `listener.ts` sequences an origin gate,
 * an upgrade, a stale-tab check and a serving stack, and says out loud that it
 * is a file this repo should not own for long — the app's name and mark have a
 * different reason to change, and should not leave with it.
 *
 * Only what is olai's is here. `start_url` and `display: standalone` are the
 * framework's install-friendly defaults (`pwaManifestLayer`), and so is a
 * `short_name` that is just the name; restating any of them would be two
 * places to change one decision, and the spec's own defaults (`scope` from
 * `start_url`, `orientation: "any"`, `purpose: "any"`) are the same trap one
 * layer down.
 *
 * The icon FILES are the browser bundle's (`packages/web/src/client/public`,
 * copied to the dist root by its build) and the paths below are the URLs that
 * puts them at. They are the only two ends of this contract, they live in two
 * packages that do not import each other — deliberately, see
 * `clientDist.ts` — and what checks that they still agree is a browser test
 * that fetches every `src` this names
 * (`packages/tests/features/install_it.feature`). It has to be a test rather
 * than a type: the static layer answers an unmatched path with the HTML shell,
 * so a stale path here would 200 rather than 404, and only the content type
 * would say otherwise.
 *
 * The colours are this app's own paper (`--color-paper`, light) rather than
 * the racket original's, because they are the chrome around the page that
 * opens under them; the icons ARE the original, unchanged.
 */

import type { ManifestOptions } from "@kolu/surface-app/server"

export const MANIFEST: ManifestOptions = {
  name: "olai",
  description: "Self-hosted outliner: your files, your agent, a live web view.",
  themeColor: "#fdfdfc",
  backgroundColor: "#fdfdfc",
  lang: "en",
  categories: ["productivity", "utilities"],
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      // The one icon a platform may crop to its own shape: it carries the
      // padding that survives being cut into a circle or a squircle.
      purpose: "maskable",
    },
  ],
}
