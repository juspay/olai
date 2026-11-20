import { Given, Then } from "@cucumber/cucumber";

import {
  announcedTimes,
  markRegion,
  nothingAnnounced,
  regionHeld,
} from "../support/probe.ts";
import {
  BREADCRUMBS,
  CHAT_COMPLETION,
  DOCUMENT_REFERRERS,
  EDGE_HELD,
  FILTER_BAR,
  HEADER_SEARCH_RESULTS,
  nodeSelector,
  PALETTE_LIST,
  PIN_SHELF,
  PROPS,
  SEARCH_REFUSAL,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const REGIONS: Readonly<Record<string, string>> = {
  breadcrumbs: BREADCRUMBS,
  "property drawer": PROPS,
  "edge panel's list": EDGE_HELD,
  "referrers section": DOCUMENT_REFERRERS,
  "pinned shelf": PIN_SHELF,
  "palette list": PALETTE_LIST,
  "@ menu": CHAT_COMPLETION,
  "header search panel": HEADER_SEARCH_RESULTS,
  "filter bar": FILTER_BAR,
  "search refusal": SEARCH_REFUSAL,
};

const regionOf = (name: string): string => {
  const found = REGIONS[name];
  if (found === undefined) {
    throw new Error(
      `no region is called "${name}"; this suite watches ${
        Object.keys(REGIONS).map((one) => `"${one}"`).join(", ")
      }`,
    );
  }
  return found;
};

Given(
  "I mark every element of the {string}",
  async function (this: OlaiWorld, name: string) {
    await markRegion(this, regionOf(name), name);
  },
);

Then(
  "the {string} kept every element it had",
  async function (this: OlaiWorld, name: string) {
    await regionHeld(this, regionOf(name), name);
  },
);

Then(
  "nothing in the {string} was announced again",
  async function (this: OlaiWorld, name: string) {
    await nothingAnnounced(this, regionOf(name), name);
  },
);

Given(
  "I mark every element of the row {string}",
  async function (this: OlaiWorld, id: string) {
    await markRegion(this, nodeSelector(id), `row "${id}"`);
  },
);

Then(
  "the row {string} was read out loud {int} time(s)",
  async function (this: OlaiWorld, id: string, times: number) {
    await announcedTimes(this, nodeSelector(id), `row "${id}"`, times);
  },
);

Then("the row {string} kept every element it had", async function (this: OlaiWorld, id: string) {
  await regionHeld(this, nodeSelector(id), `row "${id}"`);
});
