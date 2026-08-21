@share-scratch
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
  that are files in the served directory and nowhere else. Two of the three
  scratch scenarios write disjoint files, so they share a copy per worker
  (`@share-scratch`); the one that lists every document, and the spaced-name
  outline whose examples all write the same two files, keep a private copy.

  @corpus:good
  Scenario: Every document found has a page, and the sidebar says so
    When I open the app
    # Folders start collapsed; open `notes` so the nested document is listed.
    When I expand the folder "notes"
    Then the documents listed are "finishes.md, kitchen-sink.md, notes/palette.md"
    Given I mark the page
    When I click the document "notes/palette.md"
    Then the document open is "notes/palette.md"
    And the address is "/notes/palette.md"
    # A route, not a reload: the page answered in place.
    And the page has not reloaded
    And there should be no page errors

  # The ⌘K row of the `.olai`/`.md` parity table. The palette streamed node
  # hits and captured a line to the inbox, and offered no way to a document at
  # all: a reader who knew the file existed had to leave the modal, find the
  # sidebar and open the folder it lives in.
  #
  # What a row is keyed on is the whole of the promise, and it is deliberately
  # narrow: the file's NAME and the folder it sits in. Nothing here reads a
  # body — searching what is INSIDE a document is a different question with an
  # item of its own, and the grammar in this box still selects nodes.
  @corpus:good
  Scenario: The ⌘K palette opens a document by name
    Given I open the outline "house.olai"
    And I mark the page
    When I press the palette shortcut
    And I type "palette" into the palette
    Then the palette lists the document "notes/palette.md"
    When I pick the palette item "palette.md"
    Then the document open is "notes/palette.md"
    And the address is "/notes/palette.md"
    # A route, not a reload: the same page the sidebar's row opens.
    And the page has not reloaded
    And there should be no page errors

  # One reading, two doors — the rule the node hits already keep. A box that
  # found a document while the chord beside it did not would be the same drift
  # inside one client.
  @corpus:good
  Scenario: The header's box finds the same document, drawn the same way
    Given I open the outline "house.olai"
    When I search the header for "palette"
    Then the header search lists the document "notes/palette.md"
    When I press the header search result "palette.md"
    Then the document open is "notes/palette.md"
    And the address is "/notes/palette.md"
    And there should be no page errors

  # A folder is a way in, and an outline is not a document: the rows are the
  # files whose address opens a BODY, which is the registry's answer rather
  # than a list of suffixes written out here.
  @corpus:good
  Scenario: The palette's document rows are the bodied files, matched by path
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "notes/" into the palette
    Then the palette lists the document "notes/palette.md"
    When I type "garden" into the palette
    Then the palette lists no document "garden.olai"

  @corpus:good
  Scenario: A document is a page of its own, at its own address
    When I open the document "finishes.md"
    Then the document open is "finishes.md"
    And the document renders bold text "matte"
    And there should be no page errors

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

  # Survey and jump. A document long enough to be worth opening is long enough
  # to be lost in, and the two halves of the answer are one feature: an id and a
  # link on every heading, and a contents derived from them at view time. There
  # is nothing stored to go stale — what a line of the contents points at is an
  # id the rendered page is carrying.
  @corpus:good
  Scenario: A document opens with a contents of its own headings
    When I open the document "kitchen-sink.md"
    Then the contents is open
    And the contents lists every heading in the document
    # A survey you cannot put away is furniture. The collapse is the
    # platform's, so this is the element's own state and not a flag beside it.
    When I shut the contents
    Then the contents is shut
    And there should be no page errors

  # `open` is an attribute the BROWSER owns once a reader has touched it, so
  # "open by default" is only true of a document that gets its own `<details>`.
  # This pins the PROMISE rather than either mechanism that keeps it (the
  # keyed block in `Toc.tsx`, and the frame a new body has not arrived in yet)
  # — it stays green while at least one of them holds, and says so when
  # neither does. Asked in both directions, because coming BACK to the document
  # you shut is the sharp half.
  @scratch:good
  Scenario: A contents shut on one document does not follow you to the next
    Given I open the document "kitchen-sink.md"
    And I shut the contents
    And I rewrite "notes/wiring.md" as:
      """
      # Wiring

      ## Upstairs

      Two circuits.

      ## Downstairs

      One more, on its own breaker.
      """
    When I expand the folder "notes"
    And I click the document "notes/wiring.md"
    Then the document open is "notes/wiring.md"
    And the contents is open
    When I click the document "kitchen-sink.md"
    Then the document open is "kitchen-sink.md"
    And the contents is open

  @corpus:good
  Scenario: A line of the contents lands on its heading
    When I open the document "kitchen-sink.md"
    And I follow the contents line "Footnotes"
    # The address, because the whole point of an anchor is that it can be
    # copied and handed to somebody — and it is asked against the HEADING,
    # because a fragment that names nothing changes the address too.
    Then the address names the heading "Footnotes"
    And the heading "Footnotes" is at the top of the pane

  # A `.md` may open with a `---` block, and the block is the document's own
  # RECORD rather than the first thing it says. It was neither: the parser had
  # no frontmatter extension, so the fence came out as a thematic break and
  # `agent: claude-opus` as a setext `<h2>` — with an anchor on it, and a line
  # in the contents naming a section the document does not have.
  #
  # `notes/palette.md` carries one now, and the contents is asked for its LINES
  # rather than held to the headings the page drew: a phantom heading is in
  # both, so the comparison next door is satisfied by it.
  @corpus:good
  Scenario: A document's frontmatter is a record and not part of its page
    When I open the document "notes/palette.md"
    Then the document does not draw the text "agent: claude-opus"
    And the document draws no rule
    And the contents lines are "Palette, What the block above has to do"
    And there should be no page errors

  # The other half of the same block: what the document is CALLED. The title is
  # the first line of its PROSE — the sidebar, the palette and every row that
  # names a document said `---` before, because the fence was the first line
  # with anything on it.
  #
  # …and the door this whole item is. A document's frontmatter keys are the
  # same open namespace a node's properties are, so `prop:` selects one, and
  # the row says which key was the reason exactly as a node's row does.
  @corpus:good
  Scenario: A document is found by a property its frontmatter writes
    Given I open the outline "house.olai"
    When I search the header for "prop:agent=claude-opus"
    Then the header search lists the document "notes/palette.md"
    And the header search result for the document "notes/palette.md" is called "Palette"
    And the header search result "Palette" shows the property "agent" holding "claude-opus"
    And the header search result "Palette" marks "agent" as why it matched
    And there should be no page errors

  # A property is a property and NOT a record. The block carries a `date:` and a
  # `#`-looking value on purpose: neither becomes the thing it resembles, and
  # both are still findable by the name they actually have.
  @corpus:good
  Scenario: A frontmatter key is not a tag and not a day
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "#swatches" into the palette
    Then the palette lists no document "notes/palette.md"
    When I type "date:2026-09-01" into the palette
    Then the palette lists no document "notes/palette.md"
    When I type "prop:date=2026-09-01" into the palette
    Then the palette lists the document "notes/palette.md"

  # A note is a tree row, not a page: it is drawn under a title the page owns,
  # three of them on screen at once. `catch-up`'s note has two headings, so a
  # contents WOULD be drawn here if this were decided by the markdown rather
  # than by what kind of thing is being read.
  @corpus:good
  Scenario: A note has headings and no contents
    When I open the node "catch-up"
    Then the note has headings of its own
    And there is no contents on the page
    And there should be no page errors

  # Same rule, the other shape: the whole document drawn under the node that
  # attaches it is still not that document's page.
  @corpus:good
  Scenario: A document drawn under a node has no contents
    Given I open the outline "house.olai"
    When I zoom into the node "install"
    Then the reference on "install" draws the document
    And there is no contents on the page

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
    And requesting "/media/garden.olai" answers 404
    And requesting "/media/finishes.md" answers 404
    And requesting "/media/art/handle.png" answers 200 with type "image/png"

  @corpus:good
  Scenario: A node's doc is a reference in the tree and the document itself when zoomed
    Given I open the outline "house.olai"
    Then the node "install" refers to the document "finishes.md"
    And the reference on "install" shows "Finishes"
    And the reference on "install" does not draw the document
    When I zoom into the node "install"
    Then the reference on "install" draws the document
    And the document renders bold text "matte"

  # A `doc` line used to go blank for a file that had something to say: the
  # fold was `text ?? ""`, and a refusal looked like an empty preview. The
  # sentence is the same one the unreadable `.html` page draws.

  @scratch:good @own-scratch
  Scenario: An unreadable document says so on the node's line
    Given I rewrite "note.md" as:
      """
      # Finishes

      Brushed brass.
      """
    And I rewrite "house.olai" as:
      """
      {"id":"install","ord":"a0","title":"install the cabinets","doc":"note.md"}
      """
    And I open the outline "house.olai"
    Then the node "install" refers to the document "note.md"
    And the reference on "install" shows "Finishes"
    When the served file "note.md" cannot be read
    Then the reference on "install" says the file could not be read

  @corpus:good
  Scenario: The reference on a node is the way to the document's page
    Given I open the outline "house.olai"
    And I mark the page
    When I follow the document link on "install"
    Then the document open is "finishes.md"
    And the address is "/finishes.md"
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

  @scratch:good @own-scratch
  Scenario: A document dropped into the directory joins the sidebar
    Given I open the app
    And I expand the folder "notes"
    And I mark the page
    When I rewrite "notes/wiring.md" as:
      """
      # Wiring

      Two circuits.
      """
    Then the documents listed are "finishes.md, kitchen-sink.md, notes/palette.md, notes/wiring.md"
    And the page has not reloaded

  # A filename with a space in it is still a document a vault can point at.
  # The three spellings are the ones markdown actually writes: a percent-
  # encoded destination, the angle-bracketed form that lets the space sit
  # in the source, and the space left raw. What earns the browser is the
  # click: the parser has to emit a link, the click has to stay in this
  # app, and the address bar has to name the file.
  @scratch:good @own-scratch
  Scenario Outline: A markdown link to a document whose name has spaces opens it
    Given I open the app
    And I rewrite "the brief.md" as:
      """
      # The brief

      Oak counters.
      """
    And I rewrite "spaced-linker.md" as:
      """
      # Linker

      See [the brief](<destination>).
      """
    And I click the document "spaced-linker.md"
    And I mark the page
    When I follow the link "the brief" in the rendered markdown
    Then the document open is "the brief.md"
    And the address is "/the%20brief.md"
    And the page has not reloaded
    And there should be no page errors

    Examples:
      | destination     |
      | the%20brief.md  |
      | <the brief.md>  |
      | the brief.md    |

  # ── the half a document could not have ───────────────────────────────
  #
  # Every reference in this vault points ONE way on disk: `install` writes
  # `doc: finishes.md` and the file itself says nothing about the node. Until a
  # document travelled with the addresses it points AT — and every other file
  # did too — "what is talking about this?" was a question nothing could answer
  # (docs/brainstorming/first-class-documents.md).

  @corpus:good
  Scenario: A document's page says what points at it
    When I open the document "finishes.md"
    Then the document is pointed at by 1 thing
    When I open what points at the document
    # The RECORD that attached it, not merely the outline it sits in: a link is
    # always some record's, and naming the file would be the coarser answer
    # offered because it was the easier one.
    Then what points at the document is "install the cabinets"
    And there should be no page errors

  # A `[…](…)` in a body is a reference the same way a `doc` field is, which is
  # what makes one rule for both worth having: `finishes.md` links the saved
  # quote, so the quote's page knows who sent a reader to it.
  @corpus:good
  Scenario: A link written in one document's prose is a reference from it
    When I open the document "report.html"
    Then the document is pointed at by 1 thing
    When I open what points at the document
    # No "no page errors" here, unlike its neighbour: this fixture is a saved
    # page that deliberately reaches for the outside world, and the console
    # errors are the sandbox REFUSING it (features/html_preview.feature).
    Then what points at the document is "Finishes"

  # ── search reaches a body ────────────────────────────────────────────
  #
  # `cabinetmaker` is written in `finishes.md`'s prose and in no node's title,
  # note or id. This is the roadmap's `search-document-bodies`, and before it a
  # word inside a document was invisible to every door in this app.
  @corpus:good
  Scenario: A word in a document's prose is something a search finds
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "cabinetmaker" into the palette
    Then the palette lists the document "finishes.md"
    And there should be no page errors

  # …and the same word through the other door, over the same reading: two doors
  # that found different things would be the drift the one index exists against.
  @corpus:good
  Scenario: The header's box finds a body too
    Given I open the outline "house.olai"
    When I search the header for "cabinetmaker"
    Then the header search lists the document "finishes.md"
    When I press the header search result "Finishes"
    Then the document open is "finishes.md"
    And there should be no page errors
