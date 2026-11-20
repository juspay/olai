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
    When I expand the reference section
    Then the pages listed are "quarter.html, report.html"
    Given I mark the page
    When I click the page "report.html"
    Then the document open is "report.html"
    And the address is "/report.html"
    And the page has not reloaded
    And the only complaints are the browser refusing what the file may not do

  @scratch:good @own-scratch
  Scenario: A page named index.html at the top of the vault is still that vault's page
    When I rewrite "index.html" as:
      """
      <h1>The reader's own index</h1>
      <p>At the top of the vault, where the bundle's shell lives too.</p>
      """
    And I open the app
    When I expand the reference section
    Then the pages listed are "index.html, quarter.html, report.html"
    When I click the page "index.html"
    Then the address is "/index.html"
    And the preview shows the heading "The reader's own index"
    When I reload the page
    Then the address is "/index.html"
    And the preview shows the heading "The reader's own index"
    And there should be no page errors

  @scratch:good @own-scratch
  Scenario: A note under assets/ is still that vault's page
    When I rewrite "assets/x.md" as:
      """
      # a note under assets
      """
    And I open the app
    When I open the document "assets/x.md"
    Then the document open is "assets/x.md"
    And the address is "/assets/x.md"
    When I reload the page
    Then the address is "/assets/x.md"
    And the document open is "assets/x.md"
    And I save a screenshot as "assets-x-md.png"
    And there should be no page errors

  @corpus:good
  Scenario: The page shows what the file says, with the file's own styling
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    And the preview draws "Cabinet quote" in the file's own colour
    And the only complaints are the browser refusing what the file may not do

  @corpus:good
  Scenario: A `.html` is read, not written — there is no editor on its page
    When I open the page "report.html"
    Then there is no way to edit this page
    When I open the document "finishes.md"
    Then there is a way to edit this page

  @corpus:good
  Scenario: The frame the file is drawn in is sealed
    When I open the page "report.html"
    Then the preview is sandboxed into nobody's origin
    And the preview's response is sealed with a policy that fetches only this vault
    And the preview resolves the file's addresses beside "report.html"
    And the preview was handed the file whole

  @corpus:good
  Scenario: A script in a served `.html` runs, and still cannot touch the app
    When I open the page "report.html"
    Then the preview says "the script ran and reached nothing"
    And the app's storage is untouched by the preview
    And the app's page is untouched by the preview
    And the address is "/report.html"
    And the only complaints are the browser refusing what the file may not do

  @corpus:good
  Scenario: A page whose parts are files beside it draws with all of them
    When I open the page "quarter.html"
    Then the preview shows the heading "Q3 fitting revenue"
    And the preview drew 4 boxes for ".bar"
    And the preview says "drawn by this file's own JavaScript, from data/chart.js, in an origin that is nobody's"
    And the preview draws "Q3 fitting revenue" in the file's own colour
    And the preview is as tall as the page it shows

  @scratch:good
  Scenario: A page that draws itself with its own script draws
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
    And the preview is as tall as the page it shows

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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/first.html"
    Then the preview shows the heading "First"
    Given I mark the page
    When I click "#next" inside the preview
    Then the document open is "notes/second.html"
    And the address is "/notes/second.html"
    And the sidebar marks the page "notes/second.html" as the one open
    And the preview says nothing about the link
    And the page has not reloaded
    And the preview shows the heading "Second"
    And the preview resolves the file's addresses beside "notes/second.html"

  @scratch:good
  Scenario: A link to an outline beside the page opens the outline
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
    And the page has not reloaded
    And there is no preview on this page

  @scratch:good @own-scratch
  Scenario: A link carrying a fragment opens the page AND lands on the section
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/first.html"
    Then the preview shows the heading "First"
    When I click "#deep" inside the preview
    Then the document open is "notes/second.html"
    And the address is "/notes/second.html#beds"
    And the page has not reloaded
    And the preview shows the heading "Second"
    And the preview is at the anchor "#beds"

  @scratch:good
  Scenario: A section is on screen even when the reader arrives from halfway down
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I scroll to the bottom of the page
    And I click "#deep" inside the preview
    Then the document open is "notes/deep.html"
    And the address carries the anchor "#beds"
    And the section "beds" is on screen

  @scratch:good @own-scratch
  Scenario: A fragment naming nothing leaves the reader at the top
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I scroll to the bottom of the page
    And I click "#nowhere" inside the preview
    Then the document open is "notes/plain.html"
    And the page is scrolled to the top

  @scratch:good
  Scenario: A same-frame fragment stays inside the HTML preview
    Given I open the app
    And I mark the page
    When I rewrite "notes/long.html" as:
      """
      <h1>Long</h1>
      <p><a id="down" href="#end">jump to the end</a></p>
      <p style="height:1200px">a long page</p>
      <h2 id="end">End</h2>
      """
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/long.html"
    Then the preview shows the heading "Long"
    When I click "#down" inside the preview
    Then the preview is at the anchor "#end"
    And the address is "/notes/long.html"
    And the document open is "notes/long.html"
    And the page has not reloaded

  @scratch:good
  Scenario: A link into a note's section opens the note at that heading
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I click "#slats" inside the preview
    Then the document open is "notes/beds.md"
    And the address is "/notes/beds.md#slats"
    And the document is scrolled to the heading "Slats"
  @scratch:good @own-scratch
  Scenario: Coming back to a section restores where the reader was, not the section
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I click "#slats" inside the preview
    Then the document open is "notes/beds.md"
    And the document is scrolled to the heading "Slats"
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I go back
    Then the document open is "notes/beds.md"
    And the page is scrolled where it was left
    And the address carries the anchor "#slats"

  @scratch:good @own-scratch
  Scenario: A file rewritten under a reader does not land them a second time
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/index.html"
    Then the preview shows the heading "Index"
    When I click "#slats" inside the preview
    Then the document open is "notes/beds.md"
    And the document is scrolled to the heading "Slats"
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    And another writer appends "One more slat, **added under the reader**." to the document "notes/beds.md"
    Then the document renders bold text "added under the reader"
    And the page is scrolled where it was left
    And the address carries the anchor "#slats"
    And the page has not reloaded


  @scratch:good @own-scratch
  Scenario: A previewed page rewritten under a reader does not land them a second time
    Given I open the app
    And I mark the page
    When I rewrite "notes/deep.html" as:
      """
      <h1>Deep</h1>
      <div style="height:400px">a short stretch before the section</div>
      <h2 id="beds">Beds</h2>
      <div style="height:1200px">a long stretch after it, to read on into</div>
      """
    And I rewrite "notes/from.html" as:
      """
      <h1>From</h1>
      <p><a id="deep" href="deep.html#beds">the section over there</a></p>
      """
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I click "#deep" inside the preview
    Then the document open is "notes/deep.html"
    And the section "beds" is on screen
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    And I remember how much history there is
    And another writer appends "<p>One more slat, added under the reader.</p>" to the page "notes/deep.html"
    Then the preview shows the text "added under the reader"
    And the page is scrolled where it was left
    And the history has grown by 1
    And the preview is at no anchor
    And the address carries the anchor "#beds"
    And the page has not reloaded

  @scratch:good @own-scratch
  Scenario: Coming back to a previewed section restores where the reader was
    Given I open the app
    And I mark the page
    When I rewrite "notes/deep.html" as:
      """
      <h1>Deep</h1>
      <div style="height:400px">a short stretch before the section</div>
      <h2 id="beds">Beds</h2>
      <div style="height:1200px">a long stretch after it, to read on into</div>
      """
    And I rewrite "notes/from.html" as:
      """
      <h1>From</h1>
      <p><a id="deep" href="deep.html#beds">the section over there</a></p>
      """
    When I expand the reference section
    And I expand the folder "notes"
    And I remember how much history there is
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I click "#deep" inside the preview
    Then the document open is "notes/deep.html"
    And the section "beds" is on screen
    And the history has grown by 2
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I go back
    Then the document open is "notes/deep.html"
    And the page is scrolled where it was left
    And the preview is at no anchor
    And the address carries the anchor "#beds"

  @scratch:good @own-scratch
  Scenario: A previewed section in the pane that is not focused is on screen
    Given I open the app
    When I rewrite "notes/deep.html" as:
      """
      <h1>Deep</h1>
      <div style="height:1200px">a long stretch before the section</div>
      <h2 id="beds">Beds</h2>
      <div style="height:300px">a short stretch after it</div>
      """
    And I open the address "/s/kitchen-sink.md/notes%2Fdeep.html%23beds"
    Then there are 2 panes
    And pane 1 is showing "/notes/deep.html#beds"
    And the section "beds" is on screen
    When I press Alt+Right
    Then pane 1 is focused
    And the section "beds" is on screen
    And there should be no page errors

  @scratch:good @own-scratch
  Scenario: A window resize does not re-land a reader who has scrolled away
    Given I open the app
    And I mark the page
    When I rewrite "notes/deep.html" as:
      """
      <h1>Deep</h1>
      <p>Prose before the section, long enough that narrowing the window
      rewraps it and moves the anchor under it further down the page, which
      is what makes the frame report a second, different number rather than
      the same one twice: one, two, three, four, five, six, seven, eight,
      nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen,
      seventeen, eighteen, nineteen, twenty, twenty-one, twenty-two.</p>
      <h2 id="beds">Beds</h2>
      <div style="height:1600px">a long stretch after it, to read on into</div>
      """
    And I rewrite "notes/from.html" as:
      """
      <h1>From</h1>
      <p><a id="deep" href="deep.html#beds">the section over there</a></p>
      """
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I click "#deep" inside the preview
    Then the document open is "notes/deep.html"
    And the section "beds" is on screen
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    And I narrow the window
    Then the page is scrolled where it was left
    And there should be no page errors

  @scratch:good @own-scratch
  Scenario: A previewed page that grows late does not re-land a reader who has scrolled away
    # THE ORDER IS PINNED rather than hoped for: the rows must not have been
    # drawn yet when the reader scrolls away, or this scenario would be
    # asserting that nothing happens after nothing happened.
    Given I open the app
    And I mark the page
    When I rewrite "notes/deep.html" as:
      """
      <h1>Deep</h1>
      <div style="height:400px">a short stretch before the section</div>
      <h2 id="beds">Beds</h2>
      <div style="height:1200px">a long stretch after it, to read on into</div>
      <div id="later"></div>
      <script>
        window.grow = function () {
          for (var i = 0; i < 3; i++) {
            var row = document.createElement("div")
            row.className = "row"
            row.style.height = "400px"
            row.style.background = "#eef"
            document.getElementById("later").appendChild(row)
          }
        }
      </script>
      """
    And I rewrite "notes/from.html" as:
      """
      <h1>From</h1>
      <p><a id="deep" href="deep.html#beds">the section over there</a></p>
      """
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/from.html"
    Then the preview shows the heading "From"
    When I click "#deep" inside the preview
    Then the document open is "notes/deep.html"
    And the section "beds" is on screen
    When I scroll to the bottom of the page
    And I remember where the page is scrolled
    Then the preview drew 0 boxes for ".row"
    When I grow the preview
    Then the preview drew 3 boxes for ".row"
    And the page is scrolled where it was left
    And there should be no page errors

  @scratch:good @own-scratch
  Scenario: A page that sends the frame to its neighbour is left where it went
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/sender.html"
    Then the preview shows the heading "Second"
    And the preview resolves the file's addresses beside "notes/second.html"
    And the preview stays on the heading "Second"
    And the address is "/notes/sender.html"
    And the document open is "notes/sender.html"
    And the page has not reloaded

  @scratch:good @own-scratch
  Scenario: A click the page has already answered is not the seal's to claim
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/spa.html"
    Then the preview shows the heading "Spa"
    When I click "#own" inside the preview
    Then the preview says "this page answered it"
    And the address is "/notes/spa.html"
    And the page has not reloaded
    And the preview shows the heading "Spa"

  @scratch:good @own-scratch
  Scenario: A modified click is the browser's business, not olai's
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
    When I expand the reference section
    And I expand the folder "notes"
    And I click the page "notes/first.html"
    Then the preview shows the heading "First"
    When I meta-click "#next" inside the preview
    Then the address is "/notes/first.html"
    And the document open is "notes/first.html"
    And the page has not reloaded

  @scratch:good
  Scenario: A link at anything else in the vault is still the frame's to follow
    Given I open the app
    And I mark the page
    When I rewrite "gallery.html" as:
      """
      <h1>Gallery</h1>
      <p><a id="sheet" href="data/report.css">the stylesheet itself</a></p>
      """
    And I click the page "gallery.html"
    Then the preview shows the heading "Gallery"
    When I click "#sheet" inside the preview
    Then the address is "/gallery.html"
    And the page has not reloaded
    And the preview shows the heading "Gallery"

  @scratch:good
  Scenario: A link at a picture opens that picture's page
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
    Then the document open is "art/handle.png"
    And the address is "/art/handle.png"
    And the page has not reloaded
    And the picture drawn is "art/handle.png"
    And the picture has loaded

  @scratch:good @own-scratch
  Scenario: A link to a page the route serves and the directory does not list is dropped
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
    When I expand the reference section
    And the pages listed are "quarter.html, report.html, vendor.html"
    And requesting "/media/node_modules/handbook/index.html" answers 200
    When I click "#vendored" inside the preview
    Then the address is "/vendor.html"
    And the page has not reloaded
    And the preview shows the heading "Vendor"
    And the preview says it cannot open that link

  @scratch:good
  Scenario: A page asking for its own address moves nothing
    Given I open the app
    And I mark the page
    When I rewrite "itself.html" as a page that asks for itself
    And I remember how much history there is
    And I click the page "itself.html"
    Then the preview shows the heading "Itself"
    And the history has grown by 1
    Then the address is "/itself.html"
    And the document open is "itself.html"
    And the page has not reloaded
    When I click "#again" inside the preview
    Then the history has grown by 1
    And the address is "/itself.html"
    And the preview shows the heading "Itself"
    And the preview says nothing about the link

  @scratch:good
  Scenario: A page cannot navigate this app by naming a file the vault does not hold
    Given I open the app
    When I rewrite "forger.html" as a page that posts forged addresses at the app
    And I click the page "forger.html"
    Then the preview shows the heading "Forger"
    And the address is "/forger.html"
    And the document open is "forger.html"
    When something other than the preview asks the app to open "finishes.md"
    Then the address is "/forger.html"
    When I click "#honest" inside the preview
    Then the address is "/finishes.md"
    And the document open is "finishes.md"

  @corpus:good
  Scenario: The preview draws the file's own picture
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    And the preview draws its picture "#mine"

  @corpus:good
  Scenario: The preview fetches nothing but this vault's pictures
    When I open the page "report.html"
    Then the preview shows the heading "Cabinet quote"
    And the preview draws its picture "#mine"
    And the preview draws no picture for "#up, #encoded, #remote, #inline"
    And the preview reached nothing off this server

  @scratch:good
  Scenario: A page cannot pull the vault's other files into the frame
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
    Then the preview shows the heading "After"
    And the page has not reloaded

  @scratch:good @own-scratch @wire
  Scenario: A previewed page's body reaches the frame and never the tab
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
    And the websocket never carried "the cabinets came to four thousand"
    And the websocket never carried "the cabinets came to five thousand"

  @scratch:good @wire
  Scenario: A note's body still travels to the reader who opens one
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
    And the preview shows the heading "Form"

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
    And the preview draws its picture "#candidates"
    And the preview draws its picture "#sourced"
    And the preview fetched the vault's pictures at "/media/art/handle.png?srcset, /media/art/handle.png?source, /media/art/handle.png?painted"
    And there should be no page errors

  @scratch:good
  Scenario: A page that refreshes itself away is not allowed to leave
    Given I open the app
    When I rewrite "runaway.html" as a page that walks the frame off by "refreshing itself"
    And I click the page "runaway.html"
    Then the preview exhausts its walk-off budget and becomes empty
    And the app's storage is untouched by the preview
    And the app's page is untouched by the preview
    And the address is "/runaway.html"

  @scratch:good
  Scenario: A same-origin app link in a preview navigates the owning pane
    Given I open the app
    When I rewrite "outbound.html" as a page that walks the frame off by "a link the reader follows"
    And I click the page "outbound.html"
    Then the preview shows the heading "Walk off"
    When I follow the link out of the preview
    Then the address is "/"
    And there is no preview on this page
    And there should be no page errors

  @scratch:good
  Scenario: A picture that arrives after the page has loaded takes the frame with it
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
    And the preview is as tall as the page it shows
    And there should be no page errors

  @scratch:good
  Scenario: A page that draws more of itself after loading takes the frame with it
    Given I open the app
    When I rewrite "grows.html" as:
      """
      <h1>Grown</h1>
      <div id="later"></div>
      <script>
        addEventListener("load", function () {
          setTimeout(function () {
            for (var i = 0; i < 3; i++) {
              var row = document.createElement("div")
              row.className = "row"
              row.style.height = "400px"
              row.style.background = "#eef"
              document.getElementById("later").appendChild(row)
            }
          }, 50)
        })
      </script>
      """
    And I click the page "grows.html"
    Then the preview shows the heading "Grown"
    And the preview drew 3 boxes for ".row"
    And the preview is as tall as the page it shows
    And the preview is taller than the viewport
    And there should be no page errors

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
    And the preview is shorter than the viewport

  @scratch:good
  Scenario: A page with no height that satisfies it stops rather than flickering
    Given I open the app
    When I rewrite "flip.html" as:
      """
      <h1>Flip</h1>
      <style>
        @media (max-height: 700px) { .swap { height: 900px } }
        @media (min-height: 701px) { .swap { height: 60px } }
      </style>
      <div class="swap">taller when its viewport is shorter</div>
      """
    And I click the page "flip.html"
    Then the preview shows the heading "Flip"
    And the preview settles at one height
    And there should be no page errors

  @scratch:good
  Scenario: A page sized in viewport units does not inflate to the bound
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
    Given I open the app
    And I mark the page
    When I rewrite "notes/dashboard.html" as:
      """
      <h1>Dashboard</h1>
      """
    When I expand the reference section
    And I expand the folder "notes"
    Then the pages listed are "notes/dashboard.html, quarter.html, report.html"
    And the page has not reloaded
    When I click the page "notes/dashboard.html"
    Then the preview shows the heading "Dashboard"

  @corpus:good
  Scenario: A markdown link to a `.html` beside it opens the page
    Given I open the document "finishes.md"
    And I mark the page
    When I follow the link "the quote" in the rendered markdown
    Then the document open is "report.html"
    And the address is "/report.html"
    And the page has not reloaded

  @scratch:good
  Scenario: A heading opened in the OTHER pane leaves this preview where it is
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

  @scratch:good @own-scratch
  Scenario: An unreadable page says so on the page
    Given I rewrite "locked.html" as:
      """
      <h1>Secret</h1>
      """
    And the served file "locked.html" cannot be read
    When I open the page "locked.html"
    Then the page says the file could not be read
    And there is no preview frame
