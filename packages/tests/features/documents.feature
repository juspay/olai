Feature: Documents
  Some notes are not a line. A `.md` under the served directory is a document:
  it gets a page of its own, it is listed in the sidebar's file tree whether
  or not any outline names it (under the folders it lives in, beside any
  outlines in the same folder), and a node that attaches one with `doc` shows
  it — the whole document when you are zoomed on that node, one line of it
  anywhere else.

  The markdown is the same pipeline a note goes through, so what is proved here
  is proved for notes too: fenced code highlighted without a byte fetched from
  anywhere but this server, footnotes that link to their own note, and pictures
  that are files in the served directory and nowhere else.

  @corpus:good
  Scenario: Every document found has a page, and the sidebar says so
    When I open the app
    Then the documents listed are "finishes.md, kitchen-sink.md, notes/palette.md"
    Given I mark the page
    When I click the document "notes/palette.md"
    Then the document open is "notes/palette.md"
    And the address is "/doc/notes/palette.md"
    # A route, not a reload: the page answered in place.
    And the page has not reloaded
    And there should be no page errors

  @corpus:good
  Scenario: A document is a page of its own, at its own address
    When I open the document "finishes.md"
    Then the document open is "finishes.md"
    And the document renders bold text "matte"
    And there should be no page errors

  @corpus:good
  Scenario: A fenced code block is highlighted, by code this server shipped
    When I open the document "finishes.md"
    Then the document highlights a code block as "ts"
    # Vendored, never a CDN: a page that fetched its highlighter from the
    # internet would tell a third party that someone is reading their outline.
    And the page requested nothing off this server

  # `kitchen-sink.md` is the page a person changing how markdown is SET opens in
  # both themes — every mark the pipeline claims, once each. Most of what it is
  # for cannot be asserted (whether an `h4` reads as a heading is a question for
  # an eye), so what is pinned here is the handful that can go silently wrong
  # and stay wrong: the page pushed sideways by one unbreakable word, a task
  # list drawn with two markers, and a value in a table split into two words.
  @corpus:good
  Scenario: The whole markdown surface is drawn without breaking the page
    When I open the document "kitchen-sink.md"
    Then nothing overflows the pane
    And the task list is drawn with checkboxes and no bullets
    And no code span in a table is broken across lines
    # Nix, because this repository is built with it and its own docs are full of
    # `nix` fences: an unregistered language is grey text, not an error.
    And the document highlights a code block as "nix"
    And the document highlights a code block as "ts"
    And there should be no page errors

  # The RHYTHM, as an invariant rather than a look somebody once approved. The
  # scale is declared in `@olai/web`'s markdown/scale.ts, the stylesheet is
  # generated from it, and these two walk every element the fixture draws —
  # once as a document, once as a note, because a note re-answers three of the
  # sizes and the sweep has to see both sets.
  @corpus:good
  Scenario: A document is set on the declared scale, and nothing else
    When I open the document "kitchen-sink.md"
    Then every rendered element is on the markdown scale

  @corpus:good
  Scenario: A note is set on the same scale, clamped under its title
    When I open the node "catch-up"
    Then every rendered element is on the markdown scale
    And nothing overflows the pane

  @corpus:good
  Scenario: A footnote links to its own note
    When I open the document "finishes.md"
    Then the document shows a footnote that lands on its note

  @corpus:good
  Scenario: A relative picture is served from the directory it lives in
    When I open the document "finishes.md"
    Then the picture "/media/art/handle.png" is drawn in the document
    And requesting "/media/art/handle.png" answers 200 with type "image/png"
    # `notes/palette.md` names the same picture through `../`, so it is
    # resolved against the document's own directory rather than the root.
    When I open the document "notes/palette.md"
    Then the picture "/media/art/handle.png" is drawn in the document

  @corpus:good
  Scenario: Nothing outside the served directory is reachable through it
    # `outside.png` is a real picture one directory above the served root, so
    # these are refused because they climb and not because there is nothing
    # there.
    #
    # The spelling is the point. A plain `/media/../outside.png` never leaves a
    # client at all: every URL parser — the browser's, curl's — collapses the
    # `..` (and a `%2e%2e`, which the URL standard also reads as a dot) before
    # anything is sent, so it arrives as `/outside.png` and this route is not
    # even asked. An ENCODED separator is the one climbing spelling that
    # survives the parser and reaches the server, which makes it the one worth
    # asking a browser about. The rest are `mediaTarget`'s own unit tests, in
    # `packages/surface`, where a URL nobody can send can still be tried.
    Then requesting "/media/..%2foutside.png" answers 404
    # Only pictures, whatever else is in the directory.
    And requesting "/media/garden.jsonl" answers 404
    And requesting "/media/finishes.md" answers 404
    And requesting "/media/art/handle.png" answers 200 with type "image/png"

  @corpus:good
  Scenario: A node's doc is a reference in the tree and the document itself when zoomed
    Given I open the outline "house.jsonl"
    Then the node "install" refers to the document "finishes.md"
    And the reference on "install" shows "Finishes"
    And the reference on "install" does not draw the document
    When I zoom into the node "install"
    Then the reference on "install" draws the document
    And the document renders bold text "matte"

  @corpus:good
  Scenario: The reference on a node is the way to the document's page
    Given I open the outline "house.jsonl"
    And I mark the page
    When I follow the document link on "install"
    Then the document open is "finishes.md"
    And the address is "/doc/finishes.md"
    And the page has not reloaded

  @corpus:good
  Scenario: A document names no node, so nothing in the tree lights up
    When I open the document "notes/palette.md"
    Then no outline tree is shown
    # Not a dead end: the sidebar is still the way on.
    And the outline list is shown

  @corpus:good
  Scenario: An address that names no document is answered, not broken
    When I open the document "nowhere.md"
    Then the main pane says there is no document "nowhere.md"
    And there should be no page errors

  @scratch:good
  Scenario: A document edited on disk redraws the open page, with no reload
    Given I open the document "finishes.md"
    And I mark the page
    When I rewrite "finishes.md" as:
      """
      # Finishes

      Handles: **polished** nickel after all.
      """
    Then the document renders bold text "polished"
    And the page has not reloaded

  @scratch:good
  Scenario: A document dropped into the directory joins the sidebar
    Given I open the app
    And I mark the page
    When I rewrite "notes/wiring.md" as:
      """
      # Wiring

      Two circuits.
      """
    Then the documents listed are "finishes.md, kitchen-sink.md, notes/palette.md, notes/wiring.md"
    And the page has not reloaded
