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
    Then the pages listed are "quarter.html, report.html"
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
    And the address is "/doc/notes/second.html"
    And the sidebar marks the page "notes/second.html" as the one open
    # A route, not a reload: answered in place, exactly as the sidebar's own
    # click is.
    And the page has not reloaded
    # …and it is the page beside it that opened, drawn behind its own seal at
    # its own address.
    And the preview shows the heading "Second"
    And the preview resolves the file's addresses beside "notes/second.html"

  @scratch:good
  Scenario: A link to a note beside the page opens the note
    # The other kind of file olai has a page for, and the one judgement call in
    # this rule. The media route REFUSES a `.md` — it is not a part a page draws
    # itself with, and a note has a page of its own — so this link is a 404 in
    # the frame and has always been a dead click. It never reaches the network
    # now: it names a note, and a note has a page, which is where the reader
    # meant to go. The two rules answer different questions — what a browser may
    # be SERVED, and where a reader may be TAKEN.
    Given I open the app
    When I rewrite "notes/index.html" as:
      """
      <h1>Index</h1>
      <p><a id="note" href="palette.md">the palette note</a></p>
      """
    And I expand the folder "notes"
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I click "#note" inside the preview
    Then the document open is "notes/palette.md"
    And the address is "/doc/notes/palette.md"

  @scratch:good
  Scenario: A link carrying a fragment stays the frame's, even at the file next door
    # THE CARVE-OUT, which is load-bearing and was the one kept behaviour with
    # no scenario. `other.html#beds` names a file olai has a page for, so every
    # other rule here would claim it — and it must not be claimed, because what
    # a fragment names is an anchor inside the rendered page and olai's own
    # `/doc/` page cannot land on one. It is the same call `routeIn` makes about
    # a link in rendered markdown, and `docs/format.md` states it as part of the
    # closed bug.
    #
    # So the assertion is BOTH halves: the app did not move, and the frame did.
    # Either alone passes for the wrong reason — an app that stayed put because
    # the click did nothing at all would look identical from out here.
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
    # The app is where it was: this click was never its to answer.
    Then the address is "/doc/notes/first.html"
    And the document open is "notes/first.html"
    And the page has not reloaded
    # …and the frame went, which is the half that says the click was not merely
    # swallowed — the neighbour is in there, at the anchor the link named, which
    # is the thing olai's own page could not have done.
    And the preview shows the heading "Second"
    And the preview is at the anchor "#beds"

  @scratch:good
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
    And the address is "/doc/notes/sender.html"
    And the document open is "notes/sender.html"
    And the page has not reloaded

  @scratch:good
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
    And the address is "/doc/notes/spa.html"
    And the page has not reloaded
    And the preview shows the heading "Spa"

  @scratch:good
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
    Then the address is "/doc/notes/first.html"
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
    Then the address is "/doc/gallery.html"
    And the page has not reloaded
    # …and the frame went, found something that does not greet, and was brought
    # home to the file, which is where the reader can see it.
    And the preview shows the heading "Gallery"

  @scratch:good
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
    # Nothing became unreachable: `/doc/` refuses that path too, so olai has no
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
    Then the address is "/doc/vendor.html"
    And the page has not reloaded
    And the preview shows the heading "Vendor"

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
    And the address is "/doc/forger.html"
    And the document open is "forger.html"
    # …and neither does a well-formed message from something that is not the
    # frame: the sender is identified by IDENTITY, since every sandboxed frame
    # on the internet posts from the same opaque origin.
    When something other than the preview asks the app to open "finishes.md"
    Then the address is "/doc/forger.html"
    When I click "#honest" inside the preview
    Then the address is "/doc/finishes.md"
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
    # The half of "read when it is opened" that a memory change could quietly
    # break. The set holds this file's PATH and not its bytes, so the body on
    # screen was read because this reader asked for it — and the file moving on
    # disk has to reach that reader anyway, exactly as an outline's change does.
    # A server that only ever read a body once would pass every other scenario
    # in this feature and fail here.
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
    # No reload and no second click: the frame is redrawn from a body the
    # server read again because somebody was watching this file.
    Then the preview shows the heading "After"
    And the page has not reloaded

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
    And the address is "/doc/report.html"
    And the page has not reloaded
