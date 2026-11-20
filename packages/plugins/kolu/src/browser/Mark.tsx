import { BrandMark } from "@olai/plugin-kit"

import { MARK_BODY, MARK_TOKEN, MARK_VIEWBOX } from "./mark.generated.ts"

export const KoluMark = () => (
  <BrandMark viewBox={MARK_VIEWBOX} token={MARK_TOKEN} body={MARK_BODY} />
)
