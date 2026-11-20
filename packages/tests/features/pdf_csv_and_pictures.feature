@share-scratch
Feature: A `.pdf`, a `.csv` and a picture in the vault
  A served directory is somebody's folder, and what is in one is not only
  outlines, notes and saved pages. There is the bank's export, the screenshot
  of the thing that broke, the diagram somebody drew, the receipt. olai claims
  those the way it claims `.html` — one entry in the format's kinds table — so
  each is listed in the sidebar under the folder it lives in, with a glyph of
  its own, and has a page at its own prefix-free address.

  All three are VIEW ONLY, and that is one decision rather than three
  omissions: `markdown_write` takes a `.md` and nothing else, so an Edit
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
    When I expand the folder "art"
    And I expand the folder "data"
    And I expand the folder "reports"
    When I expand the reference section
    Then the "image" rows listed are "art/diagram.svg, art/handle.png, art/tall.png"
    And the "csv" rows listed are "data/sales.csv"
    And the "pdf" rows listed are "reports/q3.pdf"
    And the "outline-olai" rows listed are "Daily/2026-08.olai, garden.olai, house.olai"
    And the "image" row "art/handle.png" wears its own glyph
    And the "csv" row "data/sales.csv" wears its own glyph
    And the "pdf" row "reports/q3.pdf" wears its own glyph
    And the "pdf" row "reports/q3.pdf" reads "q3.pdf"
    And the "image" row "art/handle.png" reads "handle.png"
    And there should be no page errors

  @corpus:good
  Scenario: A `.csv` opens as a table, and the first row is the header
    When I open the app
    And I expand the folder "data"
    Given I mark the page
    When I click the "csv" row "data/sales.csv"
    Then the document open is "data/sales.csv"
    And the address is "/data/sales.csv"
    And the page has not reloaded
    And the table's header is "region, quarter, units, note"
    And the table's row 1 is "North|Q3|128|steady, no returns"
    And the table's row 2 is "South|Q3|94|two \"late\" deliveries"
    And the table's row 3 is "East|Q3|0|"
    And the table draws 4 rows under the header
    And the csv page says nothing was left out
    And this file has no editor
    And there should be no page errors

  @scratch:good @own-scratch
  Scenario: A csv bigger than a page draws says what it left out
    Given a csv of 700 data rows exists at "data/big.csv"
    When I open the address "/data/big.csv"
    Then the document open is "data/big.csv"
    And the table's header is "row, squared"
    And the table draws 499 rows under the header
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
    # Playwright's Chromium ships no PDF viewer, so this step allows either
    # outcome: a viewer, or the `<object>`'s fallback.
    And the pdf viewer drew it, or the page says it cannot
    And this file has no editor
    And there should be no page errors

  @corpus:good
  Scenario Outline: The address alone opens each of them, typed into the bar
    When I open the address "/<file>"
    Then the document open is "<file>"
    And the address is "/<file>"
    And there should be no page errors

    Examples:
      | file             |
      | data/sales.csv   |
      | art/handle.png   |
      | reports/q3.pdf   |
