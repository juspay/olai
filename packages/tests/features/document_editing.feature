@share-scratch
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
  the day page's **+ day note** mints that day's note where the vault already
  keeps them, the convention read off the newest existing daily note's own
  path. Both land in the new document's editor, because an empty page is not
  what "start writing" means. Clicking a calendar day never writes: every
  cell navigates to `/d/<date>`, empty or not.

  Every scenario is a scratch: the whole feature is about writes. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

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
    Then the document creation is refused saying "already a document"

  # A DOCUMENT IS NOT A MOUNT, and these three are the difference. Going from
  # one document to another keeps the same page on screen — same route kind,
  # same arm — so anything the page decided "once, at mount" is a decision it
  # made about the file you are no longer reading. Which editor is open, which
  # file a draft belongs to, and whether a freshly minted document was minted
  # are all that kind of decision, and every one of them is wrong the moment
  # the file changes underneath it rather than the page.
  #
  # The two creation scenarios above start from an outline and from a day, so
  # they change the arm and remount by luck. These start from a DOCUMENT,
  # which is the ordinary path — the calendar and the file tree are in the
  # sidebar of every page, including a document's.

  @scratch:good
  Scenario: A document created while reading another still lands in its editor
    Given I open the document "finishes.md"
    And I mark the page
    When I create the document "notes/wiring.md" from the sidebar
    Then the document open is "notes/wiring.md"
    And the document editor is open
    And the page has not reloaded

  # TODAY's cell, because a document page anchors the month to today rather
  # than to a day it is not of — and nothing in this vault is dated this
  # century, so today is empty. Clicking it navigates; + day note is the mint.
  # Which is the ordinary way anybody reaches this: reading a note, wanting to
  # write down what happened today.
  @scratch:journal
  Scenario: Today's cell from a document opens today, and + day note mints it
    Given I open the document "notes/ferry.md"
    And I mark the page
    When I click today
    Then today is the one being read
    And the day is empty
    And the document editor is gone
    And the page has not reloaded
    When I press + day note
    Then the document open is today's note under "Daily"
    And the document editor is open
    And the page has not reloaded

  # The clobber shape. A draft belongs to the file it was typed in, and a
  # `was` guard cannot save you here: two documents whose text happens to
  # match — two empty notes, two copies of one file — would let A's draft land
  # on B with the guard satisfied. So the draft may not cross the file at all.
  @scratch:good
  Scenario: An edit in flight does not follow you to the next document
    Given I open the document "finishes.md"
    And I start editing the document
    And I retype the document as:
      """
      # Finishes

      Handles: **mine**, and they belong to finishes.md alone.
      """
    When I click the document "kitchen-sink.md"
    Then the document open is "kitchen-sink.md"
    And the document editor is gone
    # And what an editor opened here holds is THIS file, never the draft left
    # behind on the last one.
    When I start editing the document
    Then the document editor holds text containing "Kitchen sink"
    And the document editor holds no text containing "belong to finishes.md alone"

  @scratch:journal
  Scenario: Clicking an empty calendar day opens that day and writes nothing
    # 2019-11-20 has no node and no note. A click here used to mint; now it
    # navigates, and the page says so. The file is not created.
    Given I open the day "2019-11-05"
    And I mark the page
    When I click the day "2019-11-20"
    Then the address is "/d/2019-11-20"
    And the day open is "2019-11-20"
    And the day is empty
    And the + day note button is shown
    And the document editor is gone
    And the page has not reloaded

  @scratch:journal
  Scenario: + day note mints that day's note where the vault keeps them
    # The vault's convention is Daily/YYYY/MM/, and nobody configured that:
    # it is read off the newest existing daily note's own path. The button is
    # the creation affordance; the calendar cell never writes.
    Given I open the day "2019-11-20"
    And I mark the page
    Then the + day note button is shown
    When I press + day note
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

  # Minting records an empty inverse — nothing takes a minted file back — so
  # ⌘Z after this door still speaks, and does not try to unmint the file.
  @scratch:journal
  Scenario: + day note leaves undo intact
    Given I open the day "2019-11-20"
    When I press + day note
    Then the document editor is open
    When I cancel the document editor
    And I press "ControlOrMeta+z"
    Then the undo says "nothing to undo"

  # A `/d/<anything>` is a day page without a note, so the button is the same
  # door; a date that isn't a day is the server's to refuse, verbatim. The
  # calendar never produces one — its cells are days.
  @scratch:journal
  Scenario: + day note on a date that is not a day is refused in the ops layer's words
    Given I open the day "hello"
    Then the + day note button is shown
    When I press + day note
    Then the day-note mint is refused saying "not a day"
