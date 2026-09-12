import { servedDirectory } from "./vault.ts"
import { TESTID } from "olai-plugin-files/testids"
import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { Glyph } from "./glyphs.tsx"

import { setSidebarOpen } from "./shell.ts"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { useRouter } from "olai-plugin-navigation/routing"
const ICON = "size-4"
export function FileRail() { const router = useRouter(); return <>
      <RailButton
        testid={TESTID.railOutlines}
        label="open outlines"
        title="outlines"
        onClick={() => {
          setSidebarOpen(true)
          router.go(HOME_ROUTE)
        }}
      >
        {/* The tree's own outline glyph (../file/icons.tsx), at the rail's
            size. Both faces of this column already agree about what is OWED;
            they agree about what an OUTLINE is for the same reason — a reader
            who collapses the column has not gone somewhere else. */}
        <Glyph of={servedDirectory()?.outlineRow() ?? ""} size={ICON} />
      </RailButton>

      <RailButton
        testid={TESTID.railDocs}
        label="open the directory"
        title="documents"
        onClick={() => setSidebarOpen(true)}
      >
        {/* And the tree's document glyph, for the same reason. */}
        <Glyph of={[...(servedDirectory()?.claims().byKind.values() ?? [])].find(claim => claim.holds === "text" && claim.kept)?.kind ?? ""} size={ICON} />
      </RailButton>

</> }
