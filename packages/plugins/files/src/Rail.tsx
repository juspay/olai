import { servedDirectory } from "./vault.ts"
import { TESTID } from "olai-plugin-files/testids"
import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import { Glyph } from "./glyphs.tsx"

import { setSidebarOpen } from "./shell.ts"
import { HOME_ROUTE } from "olai-plugin-navigation/routes"
import { useRouter } from "olai-plugin-navigation/routing"
const ICON = "size-4"
export function FileRail() { const router = useRouter(); return <>
      {/* The word the icon stands for, in the tip a pointer gets; `label`
          carries the same door for everybody else, which is why the tip adds
          no ARIA of its own. */}
      <Tip text="Outlines">
        <RailButton
          testid={TESTID.railOutlines}
          label="Open outlines"
          href={router.routes.href(HOME_ROUTE)}
          onNavigate={() => setSidebarOpen(true)}
        >
          {/* The tree's own outline glyph (../file/icons.tsx), at the rail's
              size. Both faces of this column already agree about what is OWED;
              they agree about what an OUTLINE is for the same reason — a reader
              who collapses the column has not gone somewhere else. */}
          <Glyph of={servedDirectory()?.outlineRow() ?? ""} size={ICON} />
        </RailButton>
      </Tip>

      <Tip text="Documents">
        <RailButton
          testid={TESTID.railDocs}
          label="Open the sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          {/* And the tree's document glyph, for the same reason. */}
          <Glyph of={[...(servedDirectory()?.claims().byKind.values() ?? [])].find(claim => claim.holds === "text" && claim.kept)?.kind ?? ""} size={ICON} />
        </RailButton>
      </Tip>

</> }
