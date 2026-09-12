/**
 * THE CI CHIP AND THE ODU READOUT — attributes, never colours.
 */

import * as assert from "node:assert"

import { Then } from "@cucumber/cucumber"

import { TESTID } from "olai-plugin-odu/testids"
import type { OlaiWorld } from "../support/world.ts"
import { POLL_TIMEOUT } from "../support/world.ts"

Then(
  "the CI chip on {string} is {word}",
  async function (this: OlaiWorld, id: string, state: string) {
    const chip = this.node(id).locator(`[data-testid="${TESTID.ciChip}"]`).first()
    await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    await this.waitUntil(
      async () => (await chip.getAttribute("data-state")) === state,
      `the CI chip on ${id} to be ${state}`,
    )
  },
)

Then(
  "{string} has no CI chip",
  async function (this: OlaiWorld, id: string) {
    await this.node(id).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    assert.equal(
      await this.node(id).locator(`[data-testid="${TESTID.ciChip}"]`).count(),
      0,
      `${id} should have no CI chip`,
    )
  },
)

Then(
  "the odu readout is {word}",
  async function (this: OlaiWorld, status: string) {
    const pill = this.page.locator(`[data-testid="${TESTID.odu}"]`).first()
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    await this.waitUntil(
      async () => (await pill.getAttribute("data-odu")) === status,
      `the odu readout to say ${status}`,
    )
  },
)
