@share-scratch
Feature: A `.pdf`, a `.csv` and a picture in the vault
  A served directory is somebody's folder, and what is in one is not only
  outlines, notes and saved pages. There is the bank's export, the screenshot
  of the thing that broke, the diagram somebody drew, the receipt. olai claims
  those the way it claims `.html` — one entry in the format's kinds table — so
  each is listed in the sidebar under the folder it lives in, with a glyph of
  its own, and has a page at its own prefix-free address.

  All three are VIEW ONLY, and that is one decision rather than three
  omissions: `write_document` takes a `.md` and nothing else, so an Edit
  control on any of these would be a door onto a refusal.

  What each is DRAWN AS is the whole of what differs, and each answer is a
  ruling:

    - a `.csv` is parsed on open and drawn as a table, first row as the header,
      and a file bigger than a page draws SAYS what it left out. No silent
      truncation, and no spreadsheet: nothing here writes one back. The bound is
      on the READING — the scan stops at the row, column and cell bounds rather
      than parsing a million-row export and slicing — which is why it says "the
      first 500 rows" and not "of 12,431": that total is a number only a full
      scan knows.
    - a picture is an `<img>` — every spelling, an `.svg` included, which is
      exactly the element that will not run one. `art/diagram.svg` is a fixture
      with teeth for that reason: it carries a script that tries to rename this
      document and mark it, and neither may ever happen.
    - a `.pdf` is the browser's own viewer, embedded. Zero dependencies: every
      browser a person actually runs ships one, and what is inside it is the
      browser's — out-of-process, with no markup of ours in it, which is where
      a scenario has to stop. This suite's Chromium is not such a browser, and
      that is what makes the fallback assertable here at all.

  The one `@scratch:good` scenario writes a file of its own and keeps a private
  copy (`@own-scratch`), because its subject is a file bigger than the corpus
  should hold.

  @corpus:good
  Scenario: The three kinds are listed in the sidebar, each with its own glyph
    When I open the app
    # Folders start collapsed; these three sit in folders of their own.
    When I expand the folder "art"
    And I expand the folder "data"
    And I expand the folder "reports"
    Then the "image" rows listed are "art/diagram.svg, art/handle.png, art/tall.png"
    And the "csv" rows listed are "data/sales.csv"
    And the "pdf" rows listed are "reports/q3.pdf"
    # …and the outlines and documents beside them are untouched: a vault that
    # gained three kinds did not lose the two it had.
    And the "outline" rows listed are "Daily/2026-08.olai, garden.olai, house.olai"
    And the "image" row "art/handle.png" wears its own glyph
    And the "csv" row "data/sales.csv" wears its own glyph
    And the "pdf" row "reports/q3.pdf" wears its own glyph
    And there should be no page errors

  @corpus:good
  Scenario: A `.csv` opens as a table, and the first row is the header
    When I open the app
    And I expand the folder "data"
    Given I mark the page
    When I click the "csv" row "data/sales.csv"
    Then the document open is "data/sales.csv"
    And the address is "/data/sales.csv"
    # A route, not a reload: the page answered in place, exactly as a
    # document's link does.
    And the page has not reloaded
    And the table's header is "region, quarter, units, note"
    # The two things a csv reader has to get right, in one fixture: a comma
    # INSIDE a quoted field is content, and a doubled quote is one quote.
    And the table's row 1 is "North|Q3|128|steady, no returns"
    And the table's row 2 is "South|Q3|94|two \"late\" deliveries"
    # An empty field is a value, not a missing cell.
    And the table's row 3 is "East|Q3|0|"
    And the table draws 4 rows under the header
    # The whole file is on the screen, so there is nothing to say about what
    # was left out — and saying nothing is what that has to look like.
    And the csv page says nothing was left out
    # VIEW ONLY: no Edit control, because write_document takes a `.md` and
    # nothing else — a control here would be a door onto a refusal.
    And this file has no editor
    And there should be no page errors

  @scratch:good @own-scratch
  Scenario: A csv bigger than a page draws says what it left out
    # Five hundred rows is the bound (`@olai/format`'s `CSV_ROWS`); seven
    # hundred is a file past it. `@own-scratch` because this writes a file the
    # fixture does not hold and the assertion is about that file's size.
    Given a csv of 700 data rows exists at "data/big.csv"
    When I open the address "/data/big.csv"
    Then the document open is "data/big.csv"
    # THE CLAMP, SAID. A table showing the first five hundred rows of seven
    # hundred with nothing saying so is a lie the reader cannot see.
    And the table's header is "row, squared"
    # 499 UNDER it, because the header is one of the five hundred: a `.csv` has
    # no line that is not a row, and the page draws the first row it read as
    # the header.
    And the table draws 499 rows under the header
    # NO TOTAL in the sentence, and that is the point rather than a shortfall:
    # the scan stopped at five hundred rows, so "701" is a number this page
    # never read.
    And the csv page says "Showing the first 500 rows."
    And there should be no page errors

  @corpus:good
  Scenario: A picture opens as a page
    When I open the app
    And I expand the folder "art"
    Given I mark the page
    When I click the "image" row "art/handle.png"
    Then the document open is "art/handle.png"
    And the address is "/art/handle.png"
    And the page has not reloaded
    # The address the app minted, and then the bytes really arriving: a `src`
    # that 404s draws the same empty box as one that is right.
    And the picture drawn is "art/handle.png"
    And the picture has loaded
    And this file has no editor
    And there should be no page errors

  @corpus:good
  Scenario: An `.svg` opens as a page and does not run
    When I open the address "/art/diagram.svg"
    Then the document open is "art/diagram.svg"
    And the picture drawn is "art/diagram.svg"
    And the picture has loaded
    # The fixture's script tried to rename this document and mark it. An
    # `<img>` runs neither — and the response the media route answers an SVG
    # with would stop it even if something did.
    And no svg has run in this tab
    And there should be no page errors

  @corpus:good
  Scenario: A `.pdf` opens in the browser's own viewer
    When I open the app
    And I expand the folder "reports"
    Given I mark the page
    When I click the "pdf" row "reports/q3.pdf"
    Then the document open is "reports/q3.pdf"
    And the address is "/reports/q3.pdf"
    And the page has not reloaded
    And the pdf drawn is "reports/q3.pdf"
    # NEVER SILENTLY EMPTY. This suite's Chromium ships no PDF viewer at all,
    # so what it proves is the half only a viewer-less browser can: the
    # `<object>` falls back to a sentence and the file itself rather than to
    # the empty rectangle an `<embed>` would leave. Real Chrome draws this
    # fixture in its own viewer, and the evidence pass is where that is seen.
    And the pdf viewer drew it, or the page says it cannot
    And this file has no editor
    And there should be no page errors

  @corpus:good
  Scenario Outline: The address alone opens each of them, typed into the bar
    # A RELOAD, not a route — the whole point of a prefix-free address is that
    # it is a real URL somebody can paste. `@olai/web`'s routes carry no
    # `/img/` or `/pdf/`: the suffix already says which page a path opens.
    When I open the address "/<file>"
    Then the document open is "<file>"
    And the address is "/<file>"
    And there should be no page errors

    Examples:
      | file             |
      | data/sales.csv   |
      | art/handle.png   |
      | reports/q3.pdf   |
