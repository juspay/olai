Feature: Documents become writable
  A document was a page olai could only read; now it is a page that can be
  written, through the same gate every other write goes through. Edit turns
  the rendered body into its SOURCE — live-previewed since
  md-live-preview-editor, so the markers hide except at the caret while the
  bytes stay exactly what was typed — and a write is one op: validated,
  revision-published, audit-trailed, landing on disk and WAITING for a commit
  like a keystroke's write does. Nothing is echoed: what comes back after a
  write is the file itself, arriving on the same live stream a `git pull`
  arrives on, which is what makes a second tab just another reader.

  THERE IS NO SAVE VERB (ruled 2026-08-18). A document autosaves: half a
  second of quiet, or the caret leaving, and what is in the editor is on disk.
  Done is a way back to reading rather than a way to commit. So a scenario
  here never presses Save — it waits, exactly as a person does.

  The conflict story is the draft's guard, and autosave is why it matters more
  than it did: the same file can be edited in vim while a browser holds its
  editor open, and every write sends what this editor LAST SAVED — so a file
  that moved refuses the write in the ops layer's own words, the draft is kept,
  and nobody's text is silently clobbered, in either direction. Overwriting is
  still possible, and it is an explicit second verb a person presses after
  reading the refusal.

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
    And the document autosaves
    And I leave the document editor
    Then the document renders bold text "unlacquered"
    And the document is no longer being typed
    And the page has not reloaded
    And there should be no page errors

  # The old ruling's Cancel is gone with the Save it belonged to: under
  # autosave there is nothing to abandon, and saying so out loud is worth a
  # scenario — leaving by the caret's own key is leaving, not undoing.
  @scratch:good
  Scenario: Escape leaves the editor, and what was typed is already the file
    Given I open the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      Typed, and **left** without pressing anything.
      """
    And I press Escape in the document editor
    Then the document is no longer being typed
    And the document renders bold text "left"

  @scratch:good
  Scenario: A written edit reaches a second tab, live
    Given I open the document "finishes.md"
    And a second tab opens the document "finishes.md"
    When I start editing the document
    And I retype the document as:
      """
      # Finishes

      Handles: **rewired** entirely.
      """
    And the document autosaves
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
    And the document autosaves
    # vim gets there first: the file moves on disk after this editor's last
    # write, so the `was` it sends next is one the file no longer says.
    And I rewrite "finishes.md" as:
      """
      # Finishes

      Handles: **vim** got here first.
      """
    Then the editor notices the file changed on disk
    When I retype the document as:
      """
      # Finishes

      Handles: **mine**, and I mean it.
      """
    And the document autosaves
    Then the write is refused saying "has changed since it was read"
    And the document editor holds text containing "mine"
    # The explicit second verb, after the refusal has been read.
    When I overwrite the document anyway
    And I leave the document editor
    Then the document renders bold text "mine"
    And the document is no longer being typed
    And there should be no page errors

  @scratch:good
  Scenario: A new document is created from the sidebar and lands in its editor
    Given I open the app
    And I mark the page
    When I create the document "notes/wiring.md" from the sidebar
    Then the document open is "notes/wiring.md"
    And the document is being typed
    And the page has not reloaded
    When I retype the document as:
      """
      # Wiring

      Two **circuits**, one breaker.
      """
    And the document autosaves
    And I leave the document editor
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
    And the document is being typed
    And the page has not reloaded

  # TODAY's cell, because a document page anchors the month to today rather
  # than to a day it is not of — and nothing in this vault is dated this
  # century, so today is bare. Which is the ordinary way anybody reaches this:
  # reading a note, wanting to write down what happened today.
  @scratch:journal
  Scenario: A bare day pressed while reading a document still lands in its editor
    Given I open the document "notes/ferry.md"
    And I mark the page
    When I press today's bare day
    Then the document open is today's note under "Daily"
    And the document is being typed
    And the page has not reloaded

  # The clobber shape. A draft belongs to the file it was typed in, and a
  # `was` guard cannot save you here: two documents whose text happens to
  # match — two empty notes, two copies of one file — would let A's draft land
  # on B with the guard satisfied. So the draft may not cross the file at all.
  #
  # Under autosave the crossing is what the LEAVING writes: navigating away
  # flushes what is owed, and it must flush it to the file it was typed in.
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
    And the document is no longer being typed
    # And what an editor opened here holds is THIS file, never the draft left
    # behind on the last one.
    When I start editing the document
    Then the document editor holds text containing "Kitchen sink"
    And the document editor holds no text containing "belong to finishes.md alone"

  @scratch:journal
  Scenario: A bare calendar day mints that day's note where the vault keeps them
    # The vault's convention is Daily/YYYY/MM/, and nobody configured that:
    # it is read off the newest existing daily note's own path. 2019-11-20 has
    # no node and no note, so its cell is the creation affordance.
    Given I open the day "2019-11-05"
    And I mark the page
    When I press the bare day "2019-11-20"
    Then the document open is "Daily/2019/11/2019-11-20.md"
    And the document is being typed
    And the page has not reloaded
    When I retype the document as:
      """
      Rain all day. Fixed the **latch**.
      """
    And the document autosaves
    And I leave the document editor
    Then the document renders bold text "latch"
    And there should be no page errors
