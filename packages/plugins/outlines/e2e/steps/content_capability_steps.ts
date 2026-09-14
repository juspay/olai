import { Then } from "@olai/tests/harness/runner.ts"
import { TITLE_EDITOR } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
Then("the outline content has no row editor", async function(this: OlaiWorld) {
  await this.page.locator(TITLE_EDITOR).waitFor({state:"detached"})
})
