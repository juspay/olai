// Fenced code, painted in the browser.
//
// What the server sends is <code class="ol-code language-racket"> and the code
// as text (olai/web/markdown); what a step here asks about is what
// highlight.js made of it — the class it writes on the element it painted, and
// at least one token span inside. Asserting behaviour, not colours: which
// token wears which of the palette's colours is the skin's business, and a
// screenshot would be the wrong test for it.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

Then("the code block on this page is painted", async function () {
  const code = this.page
    .locator("#ol-outline .ol-doc-body pre > code.language-racket")
    .first();
  await code.waitFor({ state: "visible" });
  // hljs marks what it painted; the spans are the paint itself
  await this.page
    .locator("#ol-outline .ol-doc-body pre > code.hljs > span[class^='hljs-']")
    .first()
    .waitFor({ state: "visible" });
  assert.match(await code.innerText(), /displayln|listening/);
});

// The same document, moved under an open page: a different fence, so what the
// step above finds is what this write put there and not what the page loaded
// with. Sized differently from the fixture's, like every edit in this suite.
When("I rewrite the document with a fenced block", async function () {
  await this.rewriteDoc(
    "# Rewritten under the server\n\n" +
      "```racket\n(define (again) (displayln \"listening again\"))\n```\n",
  );
});
