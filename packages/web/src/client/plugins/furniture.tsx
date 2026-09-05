/** Transitional file navigation adapter. Clocks and bar geometry are supplied
 * by their browser plugins; this last host adapter moves with navigation. */
import type { FileLink } from "@olai/plugin-api"
import { provideFileLinks } from "./runtime.ts"
import { Link } from "../router.tsx"
import { atFile } from "../routes.ts"

const FileDoor: FileLink = (props) => (
  <Link
    route={atFile(props.file)}
    class={props.class}
    testid={props.testid}
    label={props.label}
    title={props.title}
  >
    {props.children}
  </Link>
)

export const provideNavigationLinks = (): Promise<void> => provideFileLinks({ File: FileDoor })
