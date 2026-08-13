Feature: Documents become writable
  A document was a page olai could only read; now it is a page that can be
  written, through the same gate every other write goes through. Edit turns
  the rendered body into its SOURCE — a textarea holding the file verbatim,
  because what you type is the source everywhere in this app — and Save is one
  op: validated, revision-published, audit-trailed, landing on disk and
  WAITING for a commit like a keystroke's write does. Nothing is echoed: what
  comes back after a save is the file itself, arriving on the same live stream
  a `git pull` arrives on, which is what makes a second tab just another
  reader.

  The conflict story is the draft's guard. The same file can be edited in vim
  while a browser holds its editor open, and the save sends what this editor
  READ — so a file that moved refuses the write in the ops layer's own words,
  the draft is kept, and nobody's text is silently clobbered, in either
  direction. Overwriting is still possible, and it is an explicit second verb
  a person presses after reading the refusal.

  Creation has two doors. The sidebar's path box mints any `.md` by name, and
  a BARE calendar day — no node, no note — mints that day's note where the
  vault already keeps them, the convention read off the newest existing daily
  note's own path. Both land in the new document's editor, because an empty
  page is not what "start writing" means.

  Every scenario is a scratch: the whole feature is about writes.

  @scratch:good
  Scenario: A document becomes editable, and the edit is the file
    Given I open the document "finishes.md"
    And I mark the page
    When I start editing the document
    Then the document editor holds text containing "matte"
    When I retype the document as:
      """
      # Finishes

      Handles: **unlacquered** brass after all.
      """
    And I save the document
    Then the document renders bold text "unlacquered"
    And the document editor is gone
    And the page has not reloaded
    And there should be no page errors

  @scratch:good
  Scenario: Escape abandons the draft, and the file never hears of it
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      typed, and thought better of
      """
    And I cancel the document editor
    Then the document editor is gone
    And the document renders bold text "matte"

  @scratch:good
  Scenario: A saved edit reaches a second tab, live
    Given I open the document "finishes.md"
    And a second tab opens the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      # Finishes

      Handles: **rewired** entirely.
      """
    And I save the document
    Then the second tab renders bold text "rewired"

  @scratch:good
  Scenario: An external edit is surfaced in words, never clobbered
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      # Finishes

      Handles: **mine**, says this tab.
      """
    # vim gets there first: the file moves on disk while the editor is open.
    And I rewrite "finishes.md" as:
      """
      # Finishes

      Handles: **vim** got here first.
      """
    Then the editor notices the file changed on disk
    When I save the document
    Then the save is refused saying "has changed since it was read"
    And the document editor holds text containing "mine"
    # The explicit second verb, after the refusal has been read.
    When I overwrite the document anyway
    Then the document renders bold text "mine"
    And the document editor is gone
    And there should be no page errors

  @scratch:good
  Scenario: A new document is created from the sidebar and lands in its editor
    Given I open the app
    And I mark the page
    When I create the document "notes/wiring.md" from the sidebar
    Then the document open is "notes/wiring.md"
    And the document editor is open
    And the page has not reloaded
    When I retype the document as:
      """
      # Wiring

      Two **circuits**, one breaker.
      """
    And I save the document
    Then the document renders bold text "circuits"
    When I expand the folder "notes"
    Then the documents listed are "finishes.md, kitchen-sink.md, notes/palette.md, notes/wiring.md"

  @scratch:good
  Scenario: Creating a document that already exists is refused in the ops layer's words
    Given I open the app
    When I create the document "finishes.md" from the sidebar
    Then the creation is refused saying "already a document"

  @scratch:journal
  Scenario: A bare calendar day mints that day's note where the vault keeps them
    # The vault's convention is Daily/YYYY/MM/, and nobody configured that:
    # it is read off the newest existing daily note's own path. 2019-11-20 has
    # no node and no note, so its cell is the creation affordance.
    Given I open the day "2019-11-05"
    And I mark the page
    When I press the bare day "2019-11-20"
    Then the document open is "Daily/2019/11/2019-11-20.md"
    And the document editor is open
    And the page has not reloaded
    When I retype the document as:
      """
      Rain all day. Fixed the **latch**.
      """
    And I save the document
    Then the document renders bold text "latch"
    And there should be no page errors
