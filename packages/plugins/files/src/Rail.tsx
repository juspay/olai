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
      {/* ONE ICON FOR THE FILES, as the column has one list of them. The word
          the icon stands for is in the tip a pointer gets; `label` carries the
          same door for everybody else, which is why the tip adds no ARIA of
          its own. */}
      <Tip text="Files">
        <RailButton
          testid={TESTID.railOutlines}
          label="Open files"
          href={router.routes.href(HOME_ROUTE)}
          onNavigate={() => setSidebarOpen(true)}
        >
          {/* The tree's own outline glyph (../file/icons.tsx), at the rail's
              size: the kind the front page lists, and the one most rows in
              the list wear. */}
          <Glyph of={servedDirectory()?.outlineRow() ?? ""} size={ICON} />
        </RailButton>
      </Tip>
</> }
