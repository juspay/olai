import { Then } from "@cucumber/cucumber"
import { TITLE_EDITOR } from "../support/world.ts"
import type { OlaiWorld } from "../support/world.ts"
Then("the outline content has no row editor", async function(this: OlaiWorld) {
  await this.page.locator(TITLE_EDITOR).waitFor({state:"detached"})
})
