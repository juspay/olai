Feature: A `.html` in the vault
  A served directory is somebody's folder, and what is in one is not only
  outlines and notes: a saved article, a report a build wrote, an export from
  some other tool. olai claims `.html` the way it claims `.md` — the file is
  listed in the sidebar under the folder it lives in, with a glyph of its own,
  and it has a page at its own address that shows what the file says.

  It SHOWS the file, and the file RUNS. That is the rule from 2026-08-16, and it
  replaced the opposite one: the seal used to admit exactly one script by its
  hash — olai's own tape measure — so a saved dashboard or a page that draws
  itself was a heading over an empty box. What has not changed by one inch is
  where it runs: a frame whose origin is nobody's, sandboxed with no
  `allow-same-origin`, so there are no cookies, no storage and no reach into the
  app around it. So the fixture is hostile in both directions now: `report.html`
  rewrites its own paragraph (and must), then tries to write `localStorage`, set
  a cookie, mark the app's DOM and navigate the tab away (and must fail at every
  one). The paragraph it leaves behind is where both halves are read.

  What the seal is FOR, now that it is not for stopping code, is stopping BYTES.
  The file is served at its own address on the media route, behind a content
  policy on the RESPONSE whose every fetching directive names one place: this
  vault, on this host. So a relative address in the file resolves beside the
  file — a picture draws, and a link opens the page next door — while a climb
  out of the vault, the same climb spelled `%2e%2e`, a remote host, a `data:`
  URI and a `<base>` pointing at somebody else's server are all refused before a
  request is made. `report.html` carries one of each. The scenarios below read
  every one of those as evidence rather than as a promise.

  @corpus:good
  Scenario: A `.html` is listed in the sidebar and opens as a page
    When I open the app
    Then the pages listed are "report.html"
    Given I mark the page
    When I click the page "report.html"
    Then the document open is "report.html"
    And the address is "/doc/report.html"
    # A route, not a reload: the page answered in place, exactly as a document's
    # link does.
    And the page has not reloaded
    # Not "no page errors": a preview of this file carries several, and every
    # one of them is the browser saying it refused an address the file may not
    # have. Those refusals are evidence, so they are asserted as such rather
    # than filtered away — and the one that is NOT there any more is the script,
    # which is the whole of the new rule read from the console.
    And the only complaints are the browser refusing what the file may not do

  @corpus:good
  Scenario: The page shows what the file says, with the file's own styling
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    # Its own `<style>` block, which is what a saved page's appearance IS — and
    # what `style-src 'unsafe-inline'` in the seal exists to allow. Refusing it
    # would leave every preview as unstyled text and nobody would use this.
    And the preview draws "Cabinet quote" in the file's own colour
    And the only complaints are the browser refusing what the file may not do

  @corpus:good
  Scenario: A `.html` is read, not written — there is no editor on its page
    # `write_document` takes a `.md` and refuses anything else (`@olai/ops`),
    # so an Edit control here would be a door onto a refusal. The document page
    # beside it still has one, which is what makes this an assertion about the
    # KIND rather than about the page having lost a button.
    When I open the page "report.html"
    Then there is no way to edit this page
    When I open the document "finishes.md"
    Then there is a way to edit this page

  @corpus:good
  Scenario: The frame the file is drawn in is sealed
    # The mechanisms, as facts on the element and on the response rather than as
    # an outcome that could be true by luck. The sandbox has ONE token and the
    # one that is absent is the point — no `allow-same-origin`, so the frame's
    # origin is nobody's — and the policy the file is answered with says the
    # same thing a second time (so a reader who types the address is in an
    # opaque origin too) and names one place anything may be fetched from. A
    # reviewer attacking this reads these three lines first.
    When I open the page "report.html"
    Then the preview is sandboxed into nobody's origin
    And the preview's response is sealed with a policy that fetches only this vault
    # …and the addressing decision that goes with it. A page served at its own
    # address resolves its own relative addresses beside itself; `report.html`
    # carries a `<base>` of its own pointing at somebody else's server, and the
    # policy refuses the element rather than the file being edited to drop it.
    And the preview resolves the file's addresses beside "report.html"
    And the preview was handed the file whole

  @corpus:good
  Scenario: A script in a served `.html` runs, and still cannot touch the app
    # The probe, and it reads the opposite thing it used to. `report.html`'s
    # script rewrites this paragraph, so the paragraph is the evidence that the
    # file's own JavaScript ran — read INSIDE the frame, where it ran, rather
    # than out here where nothing would have happened either way. The rest of
    # the sentence is the script's own account of what it could NOT do.
    When I open the page "report.html"
    Then the preview says "the script ran and reached nothing"
    # ...and the same three, read from the app's side: the origin the script
    # tried to write into, and the address it tried to take the tab to.
    And the app's storage is untouched by the preview
    And the app's page is untouched by the preview
    And the address is "/doc/report.html"
    # The browser's own account, from the other side: it refused the addresses
    # and the base, said so, and nothing else went wrong — and nothing in there
    # complains about a script, because a script running is what is supposed to
    # happen now.
    And the only complaints are the browser refusing what the file may not do

  @scratch:good
  Scenario: A page that draws itself with its own script draws
    # The ruling, as the thing a reader sees. Under the old seal this fixture
    # was a heading over an empty box: the script matched no hash and the
    # browser refused it, so the bars below were never created. A saved
    # dashboard, an exported report and a chart a build wrote are all this
    # shape, which is why "shown but never run" was the wrong rule.
    Given I open the app
    When I rewrite "chart.html" as:
      """
      <h1>Sales</h1>
      <div id="chart"></div>
      <script>
        var bars = [40, 120, 80]
        var chart = document.getElementById("chart")
        for (var i = 0; i < bars.length; i++) {
          var bar = document.createElement("div")
          bar.className = "bar"
          bar.style.width = "60px"
          bar.style.height = bars[i] + "px"
          bar.style.margin = "0 0 8px 0"
          bar.style.background = "#14532d"
          chart.appendChild(bar)
        }
      </script>
      """
    And I click the page "chart.html"
    Then the preview shows the heading "Sales"
    And the preview drew 3 boxes for ".bar"
    # …and the frame is the height of what the script drew, which is the other
    # half of the same fact: the measurement is taken after the page builds
    # itself, not before.
    And the preview is as tall as the page it shows

  @scratch:good
  Scenario: A relative link opens the page beside it, inside the frame
    # What giving the file a real address bought, and the bug it closes:
    # `html-preview-relative-links` on the roadmap. Under the old seal a
    # relative link resolved against a `<base>` at the media route's directory,
    # which was an address the route would not answer — so a click was a 404.
    # Served at its own path, the file's neighbours are its neighbours, and the
    # page that opens is sealed exactly as the one that linked to it.
    Given I open the app
    When I rewrite "notes/first.html" as:
      """
      <h1>First</h1>
      <p><a id="next" href="second.html">the next page</a></p>
      """
    And I rewrite "notes/second.html" as:
      """
      <h1>Second</h1>
      """
    And I expand the folder "notes"
    And I click the page "notes/first.html"
    Then the preview shows the heading "First"
    When I click "#next" inside the preview
    # The page beside it, in the frame, and STILL THERE — a document this
    # server sealed says so as it parses, so the frame is not brought home from
    # it the way it is brought home from a stranger's page (the two scenarios
    # below this one).
    Then the preview shows the heading "Second"
    And the preview resolves the file's addresses beside "notes/second.html"
    And the app's page is untouched by the preview

  @corpus:good
  Scenario: The preview draws the file's own picture
    # The point of the whole exercise, and the narrowest possible statement of
    # it: a file beside this one, drawn — which means the address resolved
    # against the media route, the route recognised it as a picture under the
    # served directory, and the policy allowed the fetch. Read as DECODED
    # rather than as present, since a broken `<img>` is on screen too.
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    And the preview draws its picture "#mine"

  @corpus:good
  Scenario: The preview fetches nothing but this vault's pictures
    # The privacy half, which needs no script: a saved page full of remote
    # images would tell somebody else's server what this reader is reading, the
    # moment it is drawn. It is the same rule markdown is already held to — a
    # relative picture or nothing, and a vendored highlighter — asked of the one
    # surface that hands over foreign markup whole.
    #
    # Four addresses, four refusals, and each is a different mechanism failing
    # to be needed: the climb is normalised out of `/media/` before it is
    # fetched, the encoded climb is the same URL by another spelling, the
    # remote host is not this origin, and `data:` is not this scheme. The last
    # line is the one that would catch a policy quietly widened to make one of
    # them work: the remote address was STOPPED, by the policy and named as
    # such, rather than merely having failed to arrive.
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    And the preview draws its picture "#mine"
    And the preview draws no picture for "#up, #encoded, #remote, #inline"
    And the preview reached nothing off this server

  @scratch:good
  Scenario: A page cannot pull the vault's other files into the frame
    # The guard at the OTHER end of the route, and the only address in this
    # feature that the policy lets through to the server: `finishes.md` is
    # inside the served directory, so it is under `/media/` and passes the
    # policy's path — and the route answers a page, a picture or one of the
    # parts a page draws with, and nothing else ever. A `.md` has a page of its
    # own, so handing it over raw here would be a second way to read it with no
    # argument for the first. Both halves are read, because the promise is not
    # "the picture did not draw" (an `<img>` at a document would not draw
    # either) but "the file was never served".
    Given I open the app
    When I rewrite "greedy.html" as:
      """
      <h1>Greedy</h1>
      <img id="notapicture" src="finishes.md" alt="">
      <img id="climb" src="../../../etc/hostname" alt="">
      """
    And I click the page "greedy.html"
    Then the preview shows the heading "Greedy"
    And the preview draws no picture for "#notapicture, #climb"
    And requesting "/media/finishes.md" answers 404

  @scratch:good
  Scenario: A form in a saved page cannot post anywhere
    # The other way a page reaches somebody else's server without a script, and
    # the one this feature was missing: a `<form action>` and a click. It is
    # refused twice — the sandbox has no `allow-forms`, and the seal now says
    # `form-action 'none'`, which it has to say out loud because that directive
    # is one of the few that does NOT fall back to `default-src` (opencode's
    # review of this PR found the gap).
    #
    # What this scenario reads is the OUTCOME, not which of the two said no:
    # the click happens, nothing leaves this server, and the frame is still on
    # the document the seal put there. That the policy carries the directive at
    # all is `@olai/surface`'s `seal.test.ts`, where the whole directive set is
    # asserted.
    Given I open the app
    When I rewrite "form.html" as:
      """
      <h1>Form</h1>
      <form action="https://example.invalid/collect" method="post">
        <input name="reading" value="what this reader is reading">
        <button id="send" type="submit">send</button>
      </form>
      """
    And I click the page "form.html"
    Then the preview shows the heading "Form"
    When I click "#send" inside the preview
    Then the page requested nothing off this server
    # …and the frame did not go anywhere: a submission that HAD been allowed is
    # a navigation, and this page would be somebody else's answer or the empty
    # seal that the walk-off budget ends at.
    And the preview shows the heading "Form"

  @scratch:good
  Scenario: A page with a picture in it is as tall as the picture makes it
    # The measurement, and what pictures did to it. An `<img>` is a zero-tall
    # box until its bytes arrive, so the reading taken when the document parsed
    # is short by the whole height of the picture — and under the old rule (one
    # height per width, because nothing could be fetched and nothing could
    # therefore move) that short reading was the only one the frame would ever
    # accept. `art/tall.png` is 1200px tall and carries no width or height
    # attribute, so the page cannot be measured correctly before it loads.
    #
    # The picture is HELD BACK on purpose, because otherwise this scenario is a
    # race it usually wins for the wrong reason: a kilobyte over loopback often
    # beats the first layout, and a run where it did would pass with or without
    # the mechanism under test. Held, the order is the one a page with a real
    # photograph in it always sees.
    Given I open the app
    And the vault's pictures are slow to arrive
    When I rewrite "poster.html" as:
      """
      <h1>Poster</h1>
      <img src="art/tall.png" alt="a tall picture">
      """
    And I click the page "poster.html"
    Then the preview shows the heading "Poster"
    And the preview draws its picture "img"
    And the preview is as tall as the page it shows
    And the preview is taller than the viewport

  # ── the frame comes home ─────────────────────────────────────────────
  #
  # A `sandbox` attribute belongs to the browsing CONTEXT and survives every
  # navigation; the seal's policy belongs to one RESPONSE and does not. So a
  # page that walks the frame off the vault — a `refresh`, a link to a stranger
  # — lands somewhere with no `default-src` over it, where its script may fetch
  # whatever it likes. The origin is still nobody's, so this app and this vault
  # are still out of reach; what is lost is the privacy half of the promise,
  # which is the half a preview makes.
  #
  # These two are that gap, closed and proved. Two kinds of unasked-for
  # navigation exist now and only one of them is a walk-off: a file of this
  # vault greets the app as it parses, so the scenario above this section stays
  # where the link took it, while a page that says nothing is replaced by the
  # file — a bounded number of times, and then by nothing at all. The
  # destination here is this app, because unsealed the frame would load olai
  # inside olai and run its JavaScript — the failure would be unmistakable —
  # and because it needs no network. grok's review of PR #197 is what found
  # this.

  @scratch:good
  Scenario: A page that refreshes itself away is not allowed to leave
    Given I open the app
    When I rewrite "runaway.html" as a page that walks the frame off by "refreshing itself"
    And I click the page "runaway.html"
    # The whole promise, read where the damage would be: the frame is not
    # somewhere else. A page that re-arms its walk-off every time the markup is
    # restored gets a bounded number of tries and then the empty seal, so this
    # also says the answer terminates rather than ping-ponging forever.
    Then the app is not loaded inside the preview
    # …and the app around it is untouched, which is the half that was never at
    # risk and is asserted anyway, because that is what a probe is for.
    And the app's storage is untouched by the preview
    And the app's page is untouched by the preview
    And the address is "/doc/runaway.html"

  @scratch:good
  Scenario: A link out of a preview comes home to the sealed document
    Given I open the app
    When I rewrite "outbound.html" as a page that walks the frame off by "a link the reader follows"
    And I click the page "outbound.html"
    Then the preview shows the heading "Walk off"
    When I follow the link out of the preview
    # The positive half of the same mechanism: the file's own markup is BACK,
    # which is what says the restore ran rather than the navigation having
    # quietly failed and left everything where it was.
    Then the preview is back on the sealed document
    And the app is not loaded inside the preview

  # ── how tall the frame is ────────────────────────────────────────────
  #
  # The frame is the height of the page it holds. It was `70dvh` flat before —
  # two thirds of a screen for every file, which is a guess that is wrong in
  # both directions at once: a receipt sat above a screenful of white, and an
  # article got a scrollbar inside the page's own scrollbar. Nothing outside a
  # frame can measure what is in it, so the seal prepends a tape measure whose
  # whole job is to report the page's height back out.
  #
  # These three scenarios are written against pages of a KNOWN height (a `div`
  # with a `height` on it, so the number is the fixture's rather than the
  # font's) and each reads the height of the document inside the frame for
  # itself — the client believes what arrives over `postMessage`, and the
  # question every one of these asks is whether that number was the truth.

  @scratch:good
  Scenario: A short page gets a short frame
    Given I open the app
    When I rewrite "receipt.html" as:
      """
      <h1>Receipt</h1>
      <p>Two runs of shaker fronts, £4,180 fitted.</p>
      """
    And I click the page "receipt.html"
    Then the preview shows the heading "Receipt"
    And the preview is as tall as the page it shows
    # The half that was the complaint: a three-line file no longer claims a
    # screenful. Under the old fixed `70dvh` this line failed.
    And the preview is shorter than the viewport

  @scratch:good
  Scenario: A page taller than the screen gets a frame taller than the screen
    Given I open the app
    When I rewrite "article.html" as:
      """
      <h1>Article</h1>
      <div style="height:1200px;background:#eef">a long page</div>
      """
    And I click the page "article.html"
    Then the preview shows the heading "Article"
    And the preview is as tall as the page it shows
    # The other half: a long page is read by scrolling THIS page, not by
    # scrolling a box inside it.
    And the preview is taller than the viewport

  @scratch:good
  Scenario: A page sized in viewport units does not inflate to the bound
    # The measurement is taken INSIDE the box it sizes, so a page whose own
    # height is a share of the viewport — `min-height: 100vh` on a wrapper, which
    # is ordinary in a saved dashboard — reports a number that grows every time
    # the frame acts on the last one. Measured before this was guarded: a page
    # one screen tall came out at 1798px against a 1800px bound, so every such
    # export rendered as a two-screen box. Both reviews of PR #197 found it.
    #
    # The rule that bounds it has moved on since, and this says the current one:
    # a height is accepted once per width PER READING, and there are two
    # readings — the one taken when the document parsed, and the one taken at
    # `load`, when the page's pictures have landed and can no longer be missing
    # from its height. So a `vh` page has exactly two rungs available to it at
    # one width rather than an open ladder, and this scenario is the one that
    # reads what that comes to: a page one screen tall stays under one screen.
    Given I open the app
    When I rewrite "hero.html" as:
      """
      <h1>Hero</h1>
      <div style="min-height:100vh;background:#fee">a wrapper sized in vh</div>
      """
    And I click the page "hero.html"
    Then the preview shows the heading "Hero"
    And the preview is shorter than the viewport

  @scratch:good
  Scenario: An enormous page is bounded, and the rest of it is still there
    Given I open the app
    When I rewrite "atlas.html" as:
      """
      <h1>Atlas</h1>
      <div style="height:8000px;background:#efe">a very long page</div>
      """
    And I click the page "atlas.html"
    Then the preview shows the heading "Atlas"
    # A measured height is still a number from an untrusted frame, and even an
    # honest one can be absurd. Past the bound the growing stops and the old
    # behaviour — the page scrolling inside its own frame — takes over. Where
    # exactly it stops is a styling decision and is not named here; that it
    # stops, and that nothing was dropped when it did, is the promise.
    And the preview stops short of its page and scrolls the rest

  @scratch:good
  Scenario: A `.html` dropped into the directory joins the sidebar
    # The same live path every other served file is on: one probe, one revision,
    # no reload. A `.html` is not a second read path.
    Given I open the app
    And I mark the page
    When I rewrite "notes/dashboard.html" as:
      """
      <h1>Dashboard</h1>
      """
    When I expand the folder "notes"
    Then the pages listed are "notes/dashboard.html, report.html"
    And the page has not reloaded
    When I click the page "notes/dashboard.html"
    Then the preview shows the heading "Dashboard"

  @corpus:good
  Scenario: A markdown link to a `.html` beside it opens the page
    # A vault links between its own files with plain relative paths, and the
    # rule that resolves one is the same arithmetic a `doc` and a picture go
    # through — beside the file the link was WRITTEN in. Before there was a page
    # to open, such a link was a full browser navigation to whatever the address
    # bar happened to resolve it against.
    Given I open the document "finishes.md"
    And I mark the page
    When I follow the link "the quote" in the rendered markdown
    Then the document open is "report.html"
    And the address is "/doc/report.html"
    And the page has not reloaded
