@share-scratch
Feature: Documents
  A `.md` under the served directory is a document with a page of its own.
  Reference lists it under its folders whether or not an outline names it.
  A relative link in a node's note opens the document on its own page.

  The markdown is the same pipeline a note goes through, so what is proved here
  is proved for notes too: fenced code highlighted without a byte fetched from
  anywhere but this server, footnotes that link to their own note, and pictures
  that are files in the served directory and nowhere else. Scratch scenarios
  share a restored copy per worker (`@share-scratch`); scenarios marked
  `@own-scratch` keep a private copy for their isolation requirements.

  @corpus:good
  Scenario: Every document found has a page, and the sidebar says so
    When I open the app
    When I expand the reference section
    And I expand the folder "notes"
    Then the documents listed are "finishes.md, kitchen-sink.md, notes/palette.md"
    Given I mark the page
    When I click the document "notes/palette.md"
    Then the document open is "notes/palette.md"
    And the address is "/notes/palette.md"
    And the page has not reloaded
    And there should be no page errors

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
    And the page has not reloaded
    And there should be no page errors

  @corpus:good
  Scenario: The header's box finds the same document, drawn the same way
    Given I open the outline "house.olai"
    When I search the header for "palette"
    Then the header search lists the document "notes/palette.md"
    When I press the header search result "palette.md"
    Then the document open is "notes/palette.md"
    And the address is "/notes/palette.md"
    And there should be no page errors

  @corpus:good
  Scenario: The palette finds document paths and whole outline names
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "notes/" into the palette
    Then the palette lists the document "notes/palette.md"
    When I type "garden" into the palette
    Then the palette lists the document "garden.olai"

  @corpus:good
  Scenario: A document is a page of its own, at its own address
    When I open the document "finishes.md"
    Then the document open is "finishes.md"
    And the document renders bold text "matte"
    And there should be no page errors

  @corpus:good
  Scenario: The whole markdown surface is drawn without breaking the page
    When I open the document "kitchen-sink.md"
    Then nothing overflows the pane
    And the task list is drawn with checkboxes and no bullets
    And no code span in a table is broken across lines
    And the document highlights a code block as "nix"
    And the document highlights a code block as "ts"
    And there should be no page errors

  @corpus:good
  Scenario: A document opens with a contents of its own headings
    When I open the document "kitchen-sink.md"
    Then the contents is open
    And the contents lists every heading in the document
    When I shut the contents
    Then the contents is shut
    And there should be no page errors

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
    When I expand the reference section
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
    Then the address names the heading "Footnotes"
    And the heading "Footnotes" is at the top of the pane

  @corpus:good
  Scenario: A document's frontmatter is the page's run, not its prose
    When I open the document "notes/palette.md"
    Then the document does not draw the text "agent: claude-opus"
    And the document draws no rule
    And the contents lines are "Palette, What the block above has to do"
    And the document shows the property "agent" holding "claude-opus"
    And the document shows the property "date" holding "2026-09-01"
    And the document shows the property "owners" holding "alice, bob"
    And the document shows the property "tags" holding "#swatches"
    And there should be no page errors

  @corpus:good
  Scenario: A document with no frontmatter shows no properties
    When I open the document "finishes.md"
    Then the document shows no properties
    And there should be no page errors

  @corpus:good
  Scenario: A document's properties are hidden while editing
    When I open the document "notes/palette.md"
    Then the document shows the property "agent" holding "claude-opus"
    When I start editing the document
    Then the document shows no properties
    When I cancel the document editor
    Then the document shows the property "agent" holding "claude-opus"

  @corpus:good
  Scenario: A document is found by a property its frontmatter writes
    Given I open the outline "house.olai"
    When I search the header for "prop:agent=claude-opus"
    Then the header search lists the document "notes/palette.md"
    And the header search result for the document "notes/palette.md" is called "Palette"
    And the header search result "Palette" shows the property "agent" holding "claude-opus"
    And the header search result "Palette" marks "agent" as why it matched
    And there should be no page errors

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

  @corpus:good
  Scenario: A note has headings and no contents
    When I open the node "catch-up"
    Then the note has headings of its own
    And there is no contents on the page
    And there should be no page errors

  @corpus:good
  Scenario: A linked document is reached on its own page
    Given I open the outline "house.olai"
    When I follow the document link on "install"
    Then the document open is "finishes.md"

  @corpus:good
  Scenario: A relative picture is served from the directory it lives in
    When I open the document "finishes.md"
    Then the picture "/media/art/handle.png" is drawn in the document
    And requesting "/media/art/handle.png" answers 200 with type "image/png"
    When I open the document "notes/palette.md"
    Then the picture "/media/art/handle.png" is drawn in the document

  @scratch:good
  Scenario: A picture below the fold waits for the reader, and the first one does not
    Given a document whose second picture is far below the fold
    When I open the address "/pictures.md"
    Then the document open is "pictures.md"
    And the document's first picture is fetched at once
    And the document's second picture has not been fetched
    When I scroll to the document's second picture
    Then the document's second picture has drawn
    And there should be no page errors

  @corpus:good
  Scenario: Nothing outside the served directory is reachable through it
    Then requesting "/media/..%2foutside.png" answers 404
    And requesting "/media/garden.olai" answers 404
    And requesting "/media/finishes.md" answers 404
    And requesting "/media/art/handle.png" answers 200 with type "image/png"

  @corpus:good
  Scenario: A node's note links its document
    Given I open the outline "house.olai"
    When I zoom into the node "install"
    And I follow the document link on "install"
    Then the document open is "finishes.md"
    And the document renders bold text "matte"

  @scratch:good @own-scratch
  Scenario: An unreadable linked document says so on its own page
    Given I open the outline "house.olai"
    When I follow the document link on "install"
    Then the document renders bold text "matte"
    When the served file "finishes.md" cannot be read
    Then the page says the file could not be read
    And the outline list links to "house.olai"
    When the served file "finishes.md" can be read again
    Then the document renders bold text "matte"
    And there should be no page errors

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
    When I expand the reference section
    And I expand the folder "notes"
    And I mark the page
    When I rewrite "notes/wiring.md" as:
      """
      # Wiring

      Two circuits.
      """
    When I expand the reference section
    Then the documents listed are "finishes.md, kitchen-sink.md, notes/palette.md, notes/wiring.md"
    And the page has not reloaded

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

  @corpus:good
  Scenario: A document's page says what points at it
    When I open the document "finishes.md"
    Then the document is pointed at by 1 thing
    When I open what points at the document
    Then what points at the document is "install the cabinets"
    And there should be no page errors

  @corpus:good
  Scenario: A link written in one document's prose is a reference from it
    When I open the document "report.html"
    Then the document is pointed at by 1 thing
    When I open what points at the document
    Then what points at the document is "Finishes"

  @scratch:good
  Scenario: A link in another document's prose arrives and leaves live
    Given I open the document "finishes.md"
    And I mark the page
    When I rewrite "notes/palette.md" as:
      """
      # Palette

      [the finishes](../finishes.md)
      """
    Then the document is pointed at by 2 things
    When I open what points at the document
    Then what points at the document is "install the cabinets, Palette"
    When I rewrite "notes/palette.md" as:
      """
      # Palette

      no link here
      """
    Then the document is pointed at by 1 things
    And the page has not reloaded
    And there should be no page errors

  @scratch:good
  Scenario: A heading link is a reference to the whole document
    Given I open the document "finishes.md"
    When I rewrite "notes/palette.md" as:
      """
      # Palette

      [the top](../finishes.md#finishes)
      """
    Then the document is pointed at by 2 things
    When I open what points at the document
    Then what points at the document is "install the cabinets, Palette"
    And there should be no page errors

  @scratch:good
  Scenario: A plugin rebuild keeps the document's referrers open
    Given I open the document "finishes.md"
    When I open what points at the document
    Then what points at the document is "install the cabinets"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the what-points-at section is still open
    And what points at the document is "install the cabinets"
    And there should be no page errors

  @corpus:good
  Scenario: A picture's page says which documents show it
    When I open the document "art/handle.png"
    Then the document is pointed at by 3 things
    When I open what points at the document
    Then what points at the document is "Finishes, Kitchen sink — every mark the pipeline claims, Palette"
    And there should be no page errors

  @scratch:good
  Scenario: A pdf's page says which document links it
    When I rewrite "notes/palette.md" as:
      """
      # Palette

      [the quote](../reports/q3.pdf)
      """
    And I open the document "reports/q3.pdf"
    Then the document is pointed at by 1 things
    When I open what points at the document
    Then what points at the document is "Palette"
    And there should be no page errors
  @scratch:good
  Scenario: A plugin rebuild keeps a pdf page's referrers open
    Given I rewrite "notes/palette.md" as:
      """
      # Palette

      [the quote](../reports/q3.pdf)
      """
    And I open the document "reports/q3.pdf"
    And I open what points at the document
    Then what points at the document is "Palette"
    When I open another browser tab
    And I open the plugins panel
    And I switch the plugin "journal" off
    And I close the plugins panel
    And I use the original browser tab
    Then the journal chrome is absent
    And the what-points-at section is still open
    And what points at the document is "Palette"
    And there should be no page errors

  @scratch:good
  Scenario: A referrer put away is on the Trash and nowhere else
    Given I open the document "finishes.md"
    When I rewrite "_olai/Trash.olai" as:
      """
      {"id":"old-notes","ord":"a0","title":"the old finishes notes","desc":"[finishes](../finishes.md)"}
      """
    Then the document is pointed at by 1 things
    When I open what points at the document
    Then what points at the document is "install the cabinets"
    And there should be no page errors

  @scratch:good
  Scenario: The last document referrer going takes the section with it
    Given I open the document "finishes.md"
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}
      {"id":"install","parent":"kitchen","ord":"a0","title":"install the cabinets"}
      """
    And the document's page draws no what-points-at section

  @corpus:good
  Scenario: A word in a document's prose is something a search finds
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "cabinetmaker" into the palette
    Then the palette lists the document "finishes.md"
    And there should be no page errors

  @corpus:good
  Scenario: The header's box finds a body too
    Given I open the outline "house.olai"
    When I search the header for "cabinetmaker"
    Then the header search lists the document "finishes.md"
    When I press the header search result "Finishes"
    Then the document open is "finishes.md"
    And there should be no page errors

  @scratch:good
  Scenario: A repeated row follows its own note rather than a descendant's
    Given I rewrite "house.olai" as:
      """
      {"id":"parent","ord":"a0","title":"Parent"}
      {"id":"linked","parent":"parent","ord":"a0","title":"Linked","desc":"[own](finishes.md)"}
      {"id":"nested","parent":"linked","ord":"a0","title":"Nested","desc":"[other](notes/palette.md)"}
      {"id":"copy","ord":"a1","mirror":"parent"}
      """
    And I open the outline "house.olai"
    When I follow the document link on "linked"
    Then the document open is "finishes.md"
    And the document renders bold text "matte"
    And there should be no page errors
