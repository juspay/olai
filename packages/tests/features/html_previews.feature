@share-scratch
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

  The `@scratch:good` scenarios each write a file of their own (a page the
  fixture does not hold), so they share one scratch copy per worker
  (`@share-scratch`). A scenario that rewrites a file an earlier one already
  wrote, or that lists the whole vault, keeps a private copy (`@own-scratch`).

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
    Then the pages listed are "quarter.html, report.html"
    Given I mark the page
    When I click the page "report.html"
    Then the document open is "report.html"
    And the address is "/report.html"
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
    And the address is "/report.html"
    # The browser's own account, from the other side: it refused the addresses
    # and the base, said so, and nothing else went wrong — and nothing in there
    # complains about a script, because a script running is what is supposed to
    # happen now.
    And the only complaints are the browser refusing what the file may not do

  @corpus:good
  Scenario: A page whose parts are files beside it draws with all of them
    # THE WHOLE RULE, end to end, over a fixture that is in the repository: a
    # saved dashboard is a page, a stylesheet and a script sitting next to each
    # other in a folder, and every one of the three has to travel for the page
    # to be the page. Under the seal this replaced, two of the three were dead
    # — the route answered pictures only, so `data/report.css` 404'd, and the
    # policy named one script by hash, so `data/chart.js` was refused — and
    # `quarter.html` drew as a heading over an empty box.
    #
    # It is a @corpus fixture rather than a page a step writes, because this is
    # the scenario the PR's evidence screenshot is taken against: a reader
    # holding the repository can serve `packages/tests/fixtures/good` and see
    # what the picture shows.
    When I open the page "quarter.html"
    Then the preview shows the heading "Q3 fitting revenue"
    # The SCRIPT ran: four bars exist that no markup in the file declares, and
    # the paragraph it rewrote says so.
    And the preview drew 4 boxes for ".bar"
    And the preview says "drawn by this file's own JavaScript, from data/chart.js, in an origin that is nobody's"
    # …and the STYLESHEET arrived: the heading wears the colour a file beside
    # this one gives it, which is the difference between a page and its text.
    And the preview draws "Q3 fitting revenue" in the file's own colour
    # The frame is the height of what the script drew, which is the same
    # measurement every other page gets — taken after the page builds itself.
    And the preview is as tall as the page it shows

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

  # ── a link to a page beside it opens that page ───────────────────────
  #
  # `html-preview-relative-links`, finished. A folder holds two pages and one
  # links to the other; clicking that link opens the other page IN OLAI — the
  # app's own address, its own heading, its own entry lit in the directory
  # column — which is exactly where clicking that file in the sidebar lands.
  #
  # #206 gave the file a real address, which made the neighbour RENDER inside
  # the frame while every other sign in the app went on saying the file the
  # reader had left. That was honest scope and it was not the ask. What claims
  # the click now is a handler the seal puts in the page: it recognises a link
  # at a file of this vault that olai has a page for, refuses to follow it, and
  # posts the address out. Nothing about the seal moved to make that work — the
  # frame gets no origin and no channel back, only the `postMessage` it already
  # reports its height on, and what it says is a LOOKUP KEY in this app's own
  # list of files (`@olai/surface`'s `seal.ts`, `Hypertext.tsx`).

  @scratch:good
  Scenario: A relative link opens the page beside it, in olai
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
    Given I mark the page
    When I click "#next" inside the preview
    # THE ASK, read on the APP rather than inside the frame — three readings of
    # one navigation, because the complaint about what #206 shipped was that the
    # frame moved and none of these did.
    Then the document open is "notes/second.html"
    And the address is "/notes/second.html"
    And the sidebar marks the page "notes/second.html" as the one open
    # …and nothing was said, because nothing went wrong: the refusal below is
    # drawn for a click this app could not answer, never for one it could.
    And the preview says nothing about the link
    # A route, not a reload: answered in place, exactly as the sidebar's own
    # click is.
    And the page has not reloaded
    # …and it is the page beside it that opened, drawn behind its own seal at
    # its own address.
    And the preview shows the heading "Second"
    And the preview resolves the file's addresses beside "notes/second.html"

  @scratch:good
  Scenario: A link to an outline beside the page opens the outline
    # THE THIRD KIND, and the one that goes to a different page shape. A vault
    # is outlines as well as prose, so a saved page sitting in one can link at
    # `house.olai` beside it — and an outline is not drawn as a body like the
    # other two, it is a TREE. Which page a path opens at is not a
    # question the frame can answer or needs to: the seal claims the click
    # because the registry claims the suffix, and the app looks the path up in
    # whichever list holds it (`page.ts`'s `opensAt`).
    #
    # So this is the same host-revalidates shape as the other two, against the
    # OUTLINES membership list instead of the documents one — and the proof it
    # really is a different page is that the preview is gone, rather than a
    # frame sitting there with an outline in it.
    Given I open the app
    And I mark the page
    When I rewrite "atlas.html" as:
      """
      <h1>Atlas</h1>
      <p><a id="tree" href="house.olai">the house outline</a></p>
      """
    And I click the page "atlas.html"
    Then the preview shows the heading "Atlas"
    When I click "#tree" inside the preview
    Then the address is "/house.olai"
    And the outline list is shown
    # A route, not a reload — the same in-place navigation the sidebar's own
    # click on that outline makes.
    And the page has not reloaded
    # …and this is the outline's page rather than a preview showing an outline.
    And there is no preview on this page

  @scratch:good @own-scratch
  Scenario: A link carrying a fragment opens the page AND lands on the section
    # THE CARVE-OUT IS GONE, and this is what replaced it. `other.html#beds`
    # names two things — a file olai has a page for, and a place inside it — and
    # until the document page could land on a section the honest answer was to
    # leave the whole click to the frame. It can now, so the link carries: the
    # app opens the neighbour's page AND arrives at the section.
    #
    # Both halves are read, because either alone passes for the wrong reason. An
    # app that navigated and ignored the anchor would satisfy the address; a
    # frame scrolled to `#beds` with the app still on `first.html` is the old
    # behaviour, which is exactly what this replaces.
    Given I open the app
    And I mark the page
    When I rewrite "notes/first.html" as:
      """
      <h1>First</h1>
      <p><a id="deep" href="second.html#beds">the next page, at its beds</a></p>
      """
    And I rewrite "notes/second.html" as:
      """
      <h1>Second</h1>
      <p style="height:1200px">a long page</p>
      <h2 id="beds">Beds</h2>
      """
    And I expand the folder "notes"
    And I click the page "notes/first.html"
    Then the preview shows the heading "First"
    When I click "#deep" inside the preview
    # The app moved, and its address carries the place inside the page — which
    # is what makes the section a thing a reader can copy out of the bar and
    # send, rather than a scroll position this tab happens to be at.
    Then the document open is "notes/second.html"
    And the address is "/notes/second.html#beds"
    And the page has not reloaded
    # …and the page landed there. For a `.html` that is the frame's own URL
    # carrying the fragment, so the browser does the scrolling — the same thing
    # it would do for a reader who typed the address.
    And the preview shows the heading "Second"
    And the preview is at the anchor "#beds"

  @scratch:good
  Scenario: A section is on screen even when the reader arrives from halfway down
    # THE HOST WINDOW LANDS TOO, which is the half a frame cannot do for itself.
    #
    # A `.html` preview is sized to its content, so the browser's own scroll to
    # the fragment inside the frame moves nothing when the page fits: the anchor
    # sits some way down a frame taller than the window. Everything about the
    # address can be right while the reader is looking at the top of the file —
    # or, worse, at whatever the PREVIOUS page happened to be scrolled to, which
    # is what this app did for one round when it skipped its own scroll-to-top
    # for an address that named a section.
    #
    # So the scenario starts SCROLLED DOWN a tall page. If the window is left
    # where it was, the new preview is drawn under a viewport already halfway
    # down it; if the window goes to the top and stops, the section is still
    # below the fold. Both are failures here, which is what makes this catch its
    # own revert.
    #
    # THE FIXTURE IS SIZED ON PURPOSE: the page is tall enough to put the anchor
    # well below one screen and SHORT enough to fit inside the frame's own
    # clamp, so the browser's scroll inside the frame moves nothing and the
    # window is the only thing that can land. A taller page would overflow the
    # frame, the inner scroll would do the work, and this would pass with the
    # host's half deleted — which it did, when the fixture was first written.
    Given I open the app
    And I mark the page
    When I rewrite "notes/deep.html" as:
      """
      <h1>Deep</h1>
      <div style="height:1200px">a long stretch before the section</div>
      <h2 id="beds">Beds</h2>
      <div style="height:300px">a short stretch after it</div>
      """
    And I rewrite "notes/from.html" as:
      """
      <h1>From</h1>
      <div style="height:1600px">a long stretch, so this page scrolls</div>
      <p><a id="deep" href="deep.html#beds">the section over there</a></p>
      """
    And I expand the folder "notes"
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    # …and the reader is halfway down it when they press the link.
    When I scroll to the bottom of the page
    And I click "#deep" inside the preview
    Then the document open is "notes/deep.html"
    And the address carries the anchor "#beds"
    # THE ASSERTION THIS SCENARIO EXISTS FOR: the section is in the window, not
    # merely named by the address and not merely scrolled to inside a frame that
    # is itself off screen.
    And the section "beds" is on screen

  @scratch:good @own-scratch
  Scenario: A fragment naming nothing leaves the reader at the top
    # The other form of the same skip. A cross-file link whose anchor names no
    # id in the page it opens has nothing to land on — and the written rule is
    # that the reader is left at the TOP, which is what a browser does with the
    # same address. Left to itself the window would keep the previous page's
    # scroll, so "no landing happened" would be indistinguishable from "the page
    # is scrolled somewhere arbitrary".
    Given I open the app
    When I rewrite "notes/plain.html" as:
      """
      <h1>Plain</h1>
      <div style="height:2200px">no section by that name anywhere in here</div>
      """
    And I rewrite "notes/from.html" as:
      """
      <h1>From</h1>
      <div style="height:1600px">a long stretch, so this page scrolls</div>
      <p><a id="nowhere" href="plain.html#nosuchthing">a section that is not there</a></p>
      """
    And I expand the folder "notes"
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I scroll to the bottom of the page
    And I click "#nowhere" inside the preview
    Then the document open is "notes/plain.html"
    # The page opened, and the reader is at the top of it rather than wherever
    # the page they came from had been scrolled to.
    And the page is scrolled to the top

  @scratch:good
  Scenario: An in-page anchor is still the frame's own jump
    # The half that did NOT change, and the one the rule above is a comparison
    # against: `#top` names a place in the document the reader is already
    # looking at, so there is nothing for the app to do with it. A page
    # scrolling itself is not a navigation, and the test is the document rather
    # than the presence of a hash — which is why the handler compares pathnames
    # instead of asking whether there is a fragment at all.
    Given I open the app
    And I mark the page
    When I rewrite "notes/long.html" as:
      """
      <h1>Long</h1>
      <p><a id="down" href="#end">jump to the end</a></p>
      <p style="height:1200px">a long page</p>
      <h2 id="end">End</h2>
      """
    And I expand the folder "notes"
    And I click the page "notes/long.html"
    Then the preview shows the heading "Long"
    When I click "#down" inside the preview
    # The frame jumped inside itself…
    Then the preview is at the anchor "#end"
    # …and the app did not move at all: no navigation, no history, no address.
    And the address is "/notes/long.html"
    And the document open is "notes/long.html"
    And the page has not reloaded

  @scratch:good
  Scenario: A link into a note's section opens the note at that heading
    # THE OTHER MECHANISM, and the one that needed real work. A `.md` is markup
    # this app renders, and `rehype-slug` gives `## Beds` the id `beds` — which
    # is then moved into the block's own namespace, because a page can hold a
    # document, a note per row and a day's notes, and two of them opening
    # `## Shape` would otherwise answer for each other. So the id in the address
    # is not the id in the page, and a browser looking for `beds` would find
    # nothing and leave the reader at the top.
    #
    # `render.ts`'s `landingId` is the one translation between the two, and the
    # face does the looking — which is what this reads: the note opens, the
    # address carries the section, and the heading the link named is the one on
    # screen.
    Given I open the app
    And I mark the page
    When I rewrite "notes/beds.md" as:
      """
      # Beds

      Prose at the top of the page, line 1 of it.

      Prose at the top of the page, line 2 of it.

      Prose at the top of the page, line 3 of it.

      Prose at the top of the page, line 4 of it.

      Prose at the top of the page, line 5 of it.

      Prose at the top of the page, line 6 of it.

      Prose at the top of the page, line 7 of it.

      Prose at the top of the page, line 8 of it.

      Prose at the top of the page, line 9 of it.

      Prose at the top of the page, line 10 of it.

      Prose at the top of the page, line 11 of it.

      Prose at the top of the page, line 12 of it.

      Prose at the top of the page, line 13 of it.

      Prose at the top of the page, line 14 of it.

      Prose at the top of the page, line 15 of it.

      Prose at the top of the page, line 16 of it.

      Prose at the top of the page, line 17 of it.

      Prose at the top of the page, line 18 of it.

      Prose at the top of the page, line 19 of it.

      Prose at the top of the page, line 20 of it.

      Prose at the top of the page, line 21 of it.

      Prose at the top of the page, line 22 of it.

      Prose at the top of the page, line 23 of it.

      Prose at the top of the page, line 24 of it.

      Prose at the top of the page, line 25 of it.

      Prose at the top of the page, line 26 of it.

      Prose at the top of the page, line 27 of it.

      Prose at the top of the page, line 28 of it.

      Prose at the top of the page, line 29 of it.

      Prose at the top of the page, line 30 of it.

      ## Slats

      More prose, under the heading the link named — line 1.

      More prose, under the heading the link named — line 2.

      More prose, under the heading the link named — line 3.

      More prose, under the heading the link named — line 4.

      More prose, under the heading the link named — line 5.

      More prose, under the heading the link named — line 6.

      More prose, under the heading the link named — line 7.

      More prose, under the heading the link named — line 8.

      More prose, under the heading the link named — line 9.

      More prose, under the heading the link named — line 10.

      More prose, under the heading the link named — line 11.

      More prose, under the heading the link named — line 12.

      More prose, under the heading the link named — line 13.

      More prose, under the heading the link named — line 14.

      More prose, under the heading the link named — line 15.

      More prose, under the heading the link named — line 16.

      More prose, under the heading the link named — line 17.

      More prose, under the heading the link named — line 18.

      More prose, under the heading the link named — line 19.

      More prose, under the heading the link named — line 20.

      More prose, under the heading the link named — line 21.

      More prose, under the heading the link named — line 22.

      More prose, under the heading the link named — line 23.

      More prose, under the heading the link named — line 24.

      More prose, under the heading the link named — line 25.

      More prose, under the heading the link named — line 26.

      More prose, under the heading the link named — line 27.

      More prose, under the heading the link named — line 28.

      More prose, under the heading the link named — line 29.

      More prose, under the heading the link named — line 30.
      """
    And I rewrite "notes/index.html" as:
      """
      <h1>Index</h1>
      <p><a id="slats" href="beds.md#slats">the slats section</a></p>
      """
    And I expand the folder "notes"
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I click "#slats" inside the preview
    Then the document open is "notes/beds.md"
    And the address is "/notes/beds.md#slats"
    # The section the link named is the one the reader is looking at — read as
    # the page's own scroll rather than as the address, since the address is
    # what the two lines above already say.
    And the document is scrolled to the heading "Slats"
  @scratch:good @own-scratch
  Scenario: Coming back to a section restores where the reader was, not the section
    # A LANDING HAPPENS ONCE, and this is the scenario that says so. A browser
    # applies a hash when you follow a link and does NOT re-apply it when you
    # come back to that entry: on the way back the position it owes you is the
    # one you left. This app read the fragment off the route on every render
    # instead, so `popstate` set the route, the scroll memory put the reader
    # back where they had scrolled to, and a frame later the page yanked them
    # to the heading.
    #
    # So: land on a section, scroll AWAY from it, go somewhere else, come back.
    # What is owed is the scroll position, and the fragment in the address —
    # still there, still copyable — must not be spent a second time.
    Given I open the app
    And I mark the page
    When I rewrite "notes/beds.md" as:
      """
      # Beds

      Prose at the top of the page, and plenty of it, so that landing on the
      section below is a real scroll and scrolling away from it is another.

      Prose line 1, filling the page.

      Prose line 2, filling the page.

      Prose line 3, filling the page.

      Prose line 4, filling the page.

      Prose line 5, filling the page.

      Prose line 6, filling the page.

      Prose line 7, filling the page.

      Prose line 8, filling the page.

      Prose line 9, filling the page.

      Prose line 10, filling the page.

      Prose line 11, filling the page.

      Prose line 12, filling the page.

      Prose line 13, filling the page.

      Prose line 14, filling the page.

      Prose line 15, filling the page.

      Prose line 16, filling the page.

      Prose line 17, filling the page.

      Prose line 18, filling the page.

      Prose line 19, filling the page.

      Prose line 20, filling the page.

      Prose line 21, filling the page.

      Prose line 22, filling the page.

      Prose line 23, filling the page.

      Prose line 24, filling the page.

      Prose line 25, filling the page.

      Prose line 26, filling the page.

      Prose line 27, filling the page.

      Prose line 28, filling the page.

      Prose line 29, filling the page.

      Prose line 30, filling the page.

      ## Slats

      More prose under the heading, line 1.

      More prose under the heading, line 2.

      More prose under the heading, line 3.

      More prose under the heading, line 4.

      More prose under the heading, line 5.

      More prose under the heading, line 6.

      More prose under the heading, line 7.

      More prose under the heading, line 8.

      More prose under the heading, line 9.

      More prose under the heading, line 10.

      More prose under the heading, line 11.

      More prose under the heading, line 12.

      More prose under the heading, line 13.

      More prose under the heading, line 14.

      More prose under the heading, line 15.

      More prose under the heading, line 16.

      More prose under the heading, line 17.

      More prose under the heading, line 18.

      More prose under the heading, line 19.

      More prose under the heading, line 20.

      More prose under the heading, line 21.

      More prose under the heading, line 22.

      More prose under the heading, line 23.

      More prose under the heading, line 24.

      More prose under the heading, line 25.

      More prose under the heading, line 26.

      More prose under the heading, line 27.

      More prose under the heading, line 28.

      More prose under the heading, line 29.

      More prose under the heading, line 30.
      """
    And I rewrite "notes/index.html" as:
      """
      <h1>Index</h1>
      <p><a id="slats" href="beds.md#slats">the slats section</a></p>
      """
    And I expand the folder "notes"
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I click "#slats" inside the preview
    Then the document open is "notes/beds.md"
    And the document is scrolled to the heading "Slats"
    # The reader reads on, and scrolls somewhere of their own choosing.
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    # …then goes elsewhere, and comes back.
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I go back
    Then the document open is "notes/beds.md"
    # THE ASSERTION: where they left it, and it STAYS there — a re-applied
    # landing would fire a frame after the restore, which is exactly what a
    # single reading cannot catch.
    And the page is scrolled where it was left
    # …and the address still carries the section, because the fragment was
    # never the thing that was wrong.
    And the address carries the anchor "#slats"

  @scratch:good @own-scratch
  Scenario: A file rewritten under a reader does not land them a second time
    # THE SAME RULE as the scenario above, disturbed the other way — and the way
    # that is nobody's gesture at all. The effect that performs a landing TRACKS
    # the document's text, and has to: the id in the address is the heading's
    # own, the id in the page is minted from what was rendered
    # (`markdown/render.ts`'s `landingId`), and the body arrives a frame behind
    # the address. So a file REWRITTEN under an open page re-ran it — an agent's
    # write, a `git pull`, another tab — and dragged whoever was reading it back
    # to a heading they had asked for minutes ago
    # (`docs/brainstorming/reactivity-after-the-flip.md`'s 4.9).
    #
    # A SHORT WINDOW rather than a long fixture: what this needs is a page with
    # somewhere to be, and the height of the window is the cheaper half of that.
    Given the window is shorter than the page
    And I open the app
    And I mark the page
    When I rewrite "notes/beds.md" as:
      """
      # Beds

      Prose at the top of the page, line 1, so landing on the section
      below is a real scroll and scrolling away from it is another.

      Prose at the top of the page, line 2, so landing on the section
      below is a real scroll and scrolling away from it is another.

      Prose at the top of the page, line 3, so landing on the section
      below is a real scroll and scrolling away from it is another.

      Prose at the top of the page, line 4, so landing on the section
      below is a real scroll and scrolling away from it is another.

      Prose at the top of the page, line 5, so landing on the section
      below is a real scroll and scrolling away from it is another.

      Prose at the top of the page, line 6, so landing on the section
      below is a real scroll and scrolling away from it is another.

      ## Slats

      More prose under the heading, line 1, so there is a page to be
      somewhere in.

      More prose under the heading, line 2, so there is a page to be
      somewhere in.

      More prose under the heading, line 3, so there is a page to be
      somewhere in.

      More prose under the heading, line 4, so there is a page to be
      somewhere in.

      More prose under the heading, line 5, so there is a page to be
      somewhere in.

      More prose under the heading, line 6, so there is a page to be
      somewhere in.
      """
    And I rewrite "notes/index.html" as:
      """
      <h1>Index</h1>
      <p><a id="slats" href="beds.md#slats">the slats section</a></p>
      """
    And I expand the folder "notes"
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I click "#slats" inside the preview
    Then the document open is "notes/beds.md"
    And the document is scrolled to the heading "Slats"
    # The reader reads on, and scrolls somewhere of their own choosing.
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    # …and then somebody else writes the file they are reading. ONE LINE, so
    # what changed is the only thing this scenario has to spell.
    And another writer appends "One more slat, **added under the reader**." to the document "notes/beds.md"
    Then the document renders bold text "added under the reader"
    # THE ASSERTION: the write reached the page and moved nothing else.
    And the page is scrolled where it was left
    # …and the address still carries the section, because the fragment was
    # never the thing that was wrong.
    And the address carries the anchor "#slats"
    And the page has not reloaded

  @scratch:good @own-scratch
  Scenario: A page that sends the frame to its neighbour is left where it went
    # THE OTHER UNASKED-FOR NAVIGATION, and the last kept behaviour with no
    # scenario of its own. A click is not the only way a frame moves: a page can
    # assign `location`, or carry a `<meta http-equiv="refresh">`, and when what
    # it names is a file of THIS VAULT that navigation is a FEATURE rather than
    # a walk-off — the neighbour is answered by the same route behind the same
    # seal, so it greets while it parses and the frame is left where it went.
    #
    # The click handler cannot be what keeps it: this is not a click, so
    # `FOLLOW` never sees it. What keeps it is the greeting (`Hypertext.tsx`'s
    # `Custody`) — and that mechanism was only ever exercised by pages walking
    # off to a STRANGER, where the assertion is the opposite one, that the file
    # comes back. This is the half that says the same mechanism can say yes, and
    # it is the case this PR most needed to hold: a change that made the app
    # answer navigations rather than clicks would pass every other scenario here
    # and break this one.
    Given I open the app
    And I mark the page
    When I rewrite "notes/second.html" as:
      """
      <h1>Second</h1>
      """
    And I rewrite "notes/sender.html" as:
      """
      <h1>Sender</h1>
      <script>location.href = "second.html"</script>
      """
    And I expand the folder "notes"
    And I click the page "notes/sender.html"
    # The frame went where the page sent it…
    Then the preview shows the heading "Second"
    # …to the neighbour's own address on the media route, which is what says it
    # arrived behind the seal rather than anywhere else — being sealed is why it
    # could greet at all.
    And the preview resolves the file's addresses beside "notes/second.html"
    # …and it STAYS, which is the whole promise: a document that says nothing is
    # replaced by the file after a short grace, so a frame still here afterwards
    # is one whose greeting was heard.
    And the preview stays on the heading "Second"
    # The app never moved. This was the FRAME's navigation, not a click handed
    # out, and nothing about it is the app's to answer.
    And the address is "/notes/sender.html"
    And the document open is "notes/sender.html"
    And the page has not reloaded

  @scratch:good @own-scratch
  Scenario: A click the page has already answered is not the seal's to claim
    # WHY THE HANDLER IS ON THE BUBBLE, pinned rather than described. The seal's
    # click handler refuses a press whose default is already prevented — that is
    # `press.ts`'s rule, shipped — and the only way that can be true of a page
    # that answers its own links is if the handler runs AFTER the page's own.
    #
    # This scenario is what tells the two apart. Registered at the capture
    # phase, the seal would see the click first, find nothing prevented, claim
    # it and navigate the app; on the bubble it sees a press the page has
    # already taken and leaves it alone. A saved page that routes its own links
    # keeps them, and the unit product over `ours` cannot say so — it knows what
    # the rule answers, not which listener asks it.
    Given I open the app
    And I mark the page
    When I rewrite "notes/spa.html" as:
      """
      <h1>Spa</h1>
      <p><a id="own" href="second.html">handled by this page</a></p>
      <p id="probe">not yet</p>
      <script>
        document.getElementById("own").addEventListener("click", function (event) {
          event.preventDefault()
          document.getElementById("probe").textContent = "this page answered it"
        })
      </script>
      """
    And I rewrite "notes/second.html" as:
      """
      <h1>Second</h1>
      """
    And I expand the folder "notes"
    And I click the page "notes/spa.html"
    Then the preview shows the heading "Spa"
    When I click "#own" inside the preview
    # The page's own handler ran…
    Then the preview says "this page answered it"
    # …and neither the app nor the frame moved: the press was the page's.
    And the address is "/notes/spa.html"
    And the page has not reloaded
    And the preview shows the heading "Spa"

  @scratch:good @own-scratch
  Scenario: A modified click is the browser's business, not olai's
    # The other half of the same rule, in a real browser rather than in a truth
    # table: a modified click is a reader asking for the BROWSER's own
    # behaviour, and no surface in this app claims one.
    #
    # What the browser then does with it is not asserted, and that is deliberate
    # rather than a gap: which modifier opens a tab is a platform's decision (on
    # Linux this one is a plain navigation, so the frame follows the link), and
    # a scenario that pinned the frame's fate would be asserting Chromium's
    # keyboard conventions rather than olai's rule. What is olai's rule, and all
    # of it, is that the APP does not answer this press — which is exactly what
    # would break if the seal's handler stopped consulting `ours`.
    Given I open the app
    And I mark the page
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
    When I meta-click "#next" inside the preview
    Then the address is "/notes/first.html"
    And the document open is "notes/first.html"
    And the page has not reloaded

  @scratch:good
  Scenario: A link at anything else in the vault is still the frame's to follow
    # The scope, read as what did NOT change. A link to a part a page draws
    # itself with — a picture, a stylesheet, a font — names a file olai has no
    # page for, so the handler leaves the click alone and the frame follows it
    # exactly as it did before any of this: it lands on something that is not a
    # sealed document, says nothing, and the file is put back. That is #206's
    # walk-off story, untouched, and this is the line that says a click on a
    # link olai cannot answer was not quietly turned into a dead one.
    Given I open the app
    And I mark the page
    When I rewrite "gallery.html" as:
      """
      <h1>Gallery</h1>
      <p><a id="shot" href="art/handle.png">the picture itself</a></p>
      """
    And I click the page "gallery.html"
    Then the preview shows the heading "Gallery"
    When I click "#shot" inside the preview
    # The app did not move — this was never its click…
    Then the address is "/gallery.html"
    And the page has not reloaded
    # …and the frame went, found something that does not greet, and was brought
    # home to the file, which is where the reader can see it.
    And the preview shows the heading "Gallery"

  @scratch:good @own-scratch
  Scenario: A link to a page the route serves and the directory does not list is dropped
    # THE SEAM THIS CHANGE COSTS, pinned rather than left to be met. The two ends
    # disagree about what the vault holds, and they disagree in one direction:
    # the seal claims a click by SUFFIX under `/media/`, which is the ROUTE's
    # world, and the route's guard is lexical — it serves any `.html` it finds on
    # disk. The app's list is the STORE's world, and the store's walk skips
    # dot-directories and `node_modules` (`@olai/store`'s `disk.ts`). So this
    # file is servable and unlistable at once, and the click is claimed and then
    # dropped.
    #
    # Nothing became unreachable: the app refuses that path too, so olai has no
    # page for it either. What is lost is the FRAME drawing it, which is what
    # #206 did — and losing it silently is why this scenario exists. Both halves
    # are read, because "the click did nothing" alone would also be true of a
    # file that simply is not there.
    Given I open the app
    And I mark the page
    When I rewrite "node_modules/handbook/index.html" as:
      """
      <h1>Vendored</h1>
      """
    And I rewrite "vendor.html" as:
      """
      <h1>Vendor</h1>
      <p><a id="vendored" href="node_modules/handbook/index.html">the vendored handbook</a></p>
      """
    And I click the page "vendor.html"
    Then the preview shows the heading "Vendor"
    # It is not in the directory the app draws — the pages listed are the ones
    # the store walked, and the pruned one is not among them…
    And the pages listed are "quarter.html, report.html, vendor.html"
    # …and the route serves it all the same, which is the half that makes this a
    # seam rather than a missing file.
    And requesting "/media/node_modules/handbook/index.html" answers 200
    When I click "#vendored" inside the preview
    # The click was claimed by the seal — so the frame did not follow it — and
    # then dropped by the app, which holds no page for that path.
    Then the address is "/vendor.html"
    And the page has not reloaded
    And the preview shows the heading "Vendor"
    # …and the reader is TOLD, which is the half a dropped click owes them:
    # the page did not move and nothing else on screen would account for it.
    # HACKING's rule is that an error surfaces somewhere in the UX, and a
    # click this app claimed and could not answer is one.
    And the preview says it cannot open that link

  @scratch:good
  Scenario: A page asking for its own address moves nothing
    # THE GUARD THE HUMAN PICKED, and the reason it is the one that was needed.
    #
    # This channel needs no gesture — a `postMessage` is not a press, and
    # nothing on the app's side can tell the two apart. Everywhere else that
    # costs nothing: a message naming ANOTHER file navigates once and takes the
    # frame with it, so the sender is gone. A message naming THE FILE ALREADY
    # SHOWN is the one that does not — the route is the page that is open, so
    # the page does not re-key, the frame is never replaced, and the sender is
    # still sitting there able to send again. Unrefused, that is the reader's
    # back button being spent by a script, and the same hazard class the
    # walk-off budget exists for on the channel that arrived after it.
    #
    # So the file being shown is not a file this can open. Both halves are read:
    # the script asking twelve times, and a reader clicking a link to the page
    # they are already on — an ordinary thing to find in a saved page, and not
    # covered by the seal's in-page rule, which is about a fragment.
    Given I open the app
    And I mark the page
    When I rewrite "itself.html" as a page that asks for itself
    # The ledger is read BEFORE the page is opened, so the twelve messages the
    # page sends as it parses are inside what is being counted. Read after them
    # it would be a baseline taken past the thing under test — which is what an
    # earlier draft of this did, and it passed with the guard deleted.
    And I remember how much history there is
    And I click the page "itself.html"
    Then the preview shows the heading "Itself"
    # ONE entry, for the reader's own click on the sidebar — and none at all for
    # the twelve the page asked for.
    And the history has grown by 1
    Then the address is "/itself.html"
    And the document open is "itself.html"
    And the page has not reloaded
    # …and the reader's half: a plain click at a link to this very page.
    When I click "#again" inside the preview
    Then the history has grown by 1
    And the address is "/itself.html"
    And the preview shows the heading "Itself"
    # NOTHING IS SAID about it, and that is the one place this parts company
    # with a click the app could not answer. A miss is owed its reason; a
    # self-open names a page olai has and is DRAWING — an alarm saying the link
    # cannot be opened, over the very file it names, would be a refusal the
    # screen it is drawn on contradicts.
    And the preview says nothing about the link

  @scratch:good
  Scenario: A page cannot navigate this app by naming a file the vault does not hold
    # THE HOSTILE CASE, and the reason the message is a lookup key rather than
    # an instruction. A previewed page runs its own JavaScript, so it can post
    # this app anything at all: a page that is not there, a climb out of the
    # vault, one of the app's own addresses, a bare path. Each is decoded
    # through the vault's one URL decoder and then MATCHED against the files
    # this app is serving, and the route is built from the string that list
    # holds — so a miss moves nothing, and nothing a frame said ever reaches the
    # address bar.
    #
    # The last two lines are the fixture's teeth and the residue, in one act. A
    # forged prefix that no longer matched the seal's would make every line
    # above vacuous, so the page also sends one WELL-FORMED message naming a
    # file this vault really holds, and that one does open its page — which is
    # no more than the page could have done by drawing a link and is exactly as
    # far as this channel goes.
    Given I open the app
    When I rewrite "forger.html" as a page that posts forged addresses at the app
    And I click the page "forger.html"
    Then the preview shows the heading "Forger"
    And the address is "/forger.html"
    And the document open is "forger.html"
    # …and neither does a well-formed message from something that is not the
    # frame: the sender is identified by IDENTITY, since every sandboxed frame
    # on the internet posts from the same opaque origin.
    When something other than the preview asks the app to open "finishes.md"
    Then the address is "/forger.html"
    When I click "#honest" inside the preview
    Then the address is "/finishes.md"
    And the document open is "finishes.md"

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
  Scenario: A `.html` rewritten under an open page shows what it says now
    # The half of "shown, never kept" that a memory or a wire change could
    # quietly break. The set holds this file's PATH and not its bytes, so the
    # page on screen was fetched by the frame itself — and the file moving on
    # disk has to reach that reader anyway, exactly as an outline's change does.
    # A server that only ever answered for this file once would pass every other
    # scenario in this feature and fail here.
    Given I open the app
    And I mark the page
    When I rewrite "live.html" as:
      """
      <h1>Before</h1>
      """
    And I click the page "live.html"
    Then the preview shows the heading "Before"
    When I rewrite "live.html" as:
      """
      <h1>After</h1>
      """
    # No reload and no second click: the frame is re-pointed because the file's
    # REVISION moved, which is the one thing this page asks the wire for.
    Then the preview shows the heading "After"
    And the page has not reloaded

  @scratch:good @own-scratch @wire
  Scenario: A previewed page's body reaches the frame and never the tab
    # The two wires, and the rule between them. The frame fetches this file over
    # HTTP from `/media/` and draws what it fetched; the SOCKET's business is
    # only that the file moved, which it says in a number. So every word of this
    # file must be on screen and none of it may ever have crossed the websocket
    # — and that is a claim about an edit as much as about an open, because the
    # change has to arrive without the body arriving with it.
    #
    # It used to cross twice, and the unread copy went FIRST: the page opened
    # the document's body to learn its revision, and the frame was not created
    # until that copy had landed. For a saved dashboard of a megabyte that was
    # two full transfers, serialized, per open and per edit.
    Given I open the app
    And I mark the page
    When I rewrite "live.html" as:
      """
      <h1>First reading</h1>
      <p id="probe">the cabinets came to four thousand</p>
      """
    And I click the page "live.html"
    Then the preview shows the heading "First reading"
    And the preview says "the cabinets came to four thousand"
    When I rewrite "live.html" as:
      """
      <h1>Second reading</h1>
      <p id="probe">the cabinets came to five thousand</p>
      """
    Then the preview shows the heading "Second reading"
    And the preview says "the cabinets came to five thousand"
    And the page has not reloaded
    # Both readings of the file, and neither of them on the socket.
    And the websocket never carried "the cabinets came to four thousand"
    And the websocket never carried "the cabinets came to five thousand"

  @scratch:good @wire
  Scenario: A note's body still travels to the reader who opens one
    # The other half of the same rule, and the one a fix aimed at the preview
    # could break without any scenario noticing: a `.md` is drawn FROM its body,
    # so the socket is the only way that reader can have it. It is here rather
    # than in `documents.feature` because it is not a claim about documents —
    # it is the second half of the claim above, and the pair is the rule.
    Given I open the app
    When I rewrite "ledger.md" as:
      """
      # Ledger

      The joiner invoiced for **cabinets** and nothing else.
      """
    And I open the document "ledger.md"
    Then the document renders bold text "cabinets"
    And the websocket carried "The joiner invoiced for"

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

  # ── the other ways a page names a picture ────────────────────────────
  #
  # #201 shipped the pictures and named three shapes it had not covered:
  # `srcset`, `<picture><source>`, and a CSS `background: url(…)`. The argument
  # for deferring was that all three "work by consequence of the shared base" —
  # a file served at its own address resolves every relative URL beside itself,
  # whichever attribute or property carries it — and both reviewers agreed the
  # gap was bounded. It is still a claim about three specific spellings that
  # nothing checked, and one of them is CSS rather than markup, which the
  # policy answers under `default-src` rather than under an `<img>`.
  #
  # A NESTED page on purpose, sitting in `art/` beside the picture it draws. At
  # the served ROOT every wrong base — the app's root, the media root, the
  # file's own directory — produces the same URL, so a scenario there could not
  # tell them apart. From `art/`, `handle.png` is `/media/art/handle.png` and a
  # base that had slipped anywhere gives `/media/handle.png` or `/handle.png`,
  # which the step names.
  #
  # A QUERY PER SPELLING, and it is what makes this three claims instead of
  # one: the route cuts at the `?` before it decodes a name, so all three are
  # the same FILE and three different REQUESTS. Without them a browser answers
  # the stylesheet's fetch out of the cache the `<img>` above it already
  # filled, and a refused `background` would be indistinguishable from an
  # allowed one.

  @scratch:good
  Scenario: A page draws pictures named by srcset, by source, and by a stylesheet
    Given I open the app
    When I rewrite "art/wall.html" as:
      """
      <style>
        #painted {
          width: 120px;
          height: 60px;
          background: url("handle.png?painted") no-repeat;
        }
      </style>
      <h1>Wall</h1>
      <img id="candidates" srcset="handle.png?srcset 1x" alt="by srcset">
      <picture>
        <source srcset="handle.png?source">
        <img id="sourced" alt="by source">
      </picture>
      <div id="painted"></div>
      """
    And I expand the folder "art"
    And I click the page "art/wall.html"
    Then the preview shows the heading "Wall"
    # The two with an element to read are read the strong way: decoded, not
    # merely present, since a broken `<img>` is on screen too.
    And the preview draws its picture "#candidates"
    And the preview draws its picture "#sourced"
    # And all three by the address they were fetched from, which is the only
    # half a `background: url(…)` has an answer for — and the half that says
    # the base is the file's own directory and not the vault's root.
    And the preview fetched the vault's pictures at "/media/art/handle.png?srcset, /media/art/handle.png?source, /media/art/handle.png?painted"
    And there should be no page errors

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
    And the address is "/runaway.html"

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

  @scratch:good
  Scenario: A picture that arrives after the page has loaded does not move the frame
    # Live-wire, not a pixel threshold: a `loading="lazy"` image landing after
    # `load`, with the route holding it back so the order is not a race.
    # `rungs.test.ts` counts the rungs; this is a browser agreeing about what
    # they cost. Relative assertions (`shorter than the page it shows`), not
    # hard-coded px.
    #
    # Two rungs is at most one arriving reading and one settled one per width,
    # so a picture that lands after `load` is refused a third: the frame keeps
    # the height it had and the page scrolls inside it. The frame cannot tell
    # "I grew because my pictures landed" from "I grew because you made me
    # taller and I am measured in `vh`" — they are the same message.
    Given I open the app
    And the vault's pictures are slow to arrive
    When I rewrite "late.html" as:
      """
      <h1>Late</h1>
      <img loading="lazy" src="art/tall.png" alt="a tall picture, later">
      """
    And I click the page "late.html"
    Then the preview shows the heading "Late"
    And the preview draws its picture "img"
    And the preview is shorter than the page it shows
    And the preview is shorter than the viewport
    And there should be no page errors

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

  @scratch:good @own-scratch
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
    Then the pages listed are "notes/dashboard.html, quarter.html, report.html"
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
    And the address is "/report.html"
    And the page has not reloaded

  @scratch:good
  Scenario: A heading opened in the OTHER pane leaves this preview where it is
    # Two panes previewing two things is what the split is for (#219), and a
    # LANDING is a fact about the pane it was asked of — which is why it carries
    # one. The preview watched the landing for the case it exists for (arriving
    # at another section of the file already open), and watched it through an
    # input with no equality: the router notifies EVERY pane on every push, so a
    # question whose answer was `undefined` before and after re-ran anyway and
    # re-pointed the frame. What a reader saw was a saved page flashing white
    # and losing its scroll because they clicked a link next door — and, for a
    # page that draws itself, its script running again.
    #
    # The address the frame is pointed at carries the component's own visit
    # counter, so "pointed where it was" is exactly "not navigated" — there is
    # no window to race and nothing to count.
    Given I open the app
    When I rewrite "linker.md" as:
      """
      # Linker

      [a section of the sink](kitchen-sink.md#nowhere-at-all)
      """
    And I click the document "linker.md"
    And I open the address "/s/quarter.html/linker.md?f=1"
    Then the preview shows the heading "Q3 fitting revenue"
    When I remember where the preview is pointed
    And I follow the link "a section of the sink" in the rendered markdown
    Then pane 1 is showing "/kitchen-sink.md#nowhere-at-all"
    And the preview is pointed where it was
    And there should be no page errors
