Feature: Markdown editing stops being a dumb text box
  A document is written in an editor that DRAWS the markdown while you are in
  it — `**bold**` is bold, a heading is heading-sized, a `#tag` wears the same
  quiet ink it wears on a row — and the markers appear only around the caret,
  the way Obsidian and Typora do it.

  THE SOURCE IS STILL THE DOCUMENT MODEL, which is the whole architecture in
  one sentence: what the editor holds is the markdown string the file holds,
  character for character, and the rich text is a rendering laid over it.
  Nothing parses the text into a model of its own and writes it back — an
  editor that did would normalise bytes nobody touched (`_em_` becoming
  `*em*`, a list reflowing, an escape dropped), and under autosave that churn
  would land on every pause. So the fidelity these scenarios check is not a
  behaviour anybody implemented; it is the absence of a step.

  ONE SURFACE, TWO MODES (human, twice). The page IS this editor, mounted
  readonly — the rendering the reader is looking at — and a click makes that
  very view writable, at the character they clicked. There is no Edit verb and
  no Done verb, because there is nothing to switch: nothing is swapped for
  anything, so nothing moves, and the words a reader was aiming at are still
  where they were when the caret arrives.

  AUTOSAVE, with no Save verb and no dirty flag: half a second of quiet, or the
  caret leaving, and what is in the editor is on disk. Every write is
  CONDITIONAL on what that editor last saved, so an agent or a second tab
  writing the same file is refused in the ops layer's own words, on the page,
  with the draft kept — never a silent clobber. And a document nobody is typing
  in FOLLOWS the disk, so a file rewritten under a reader is re-read rather
  than argued with.

  AND VIM, behind a preference, off by default. The one key it moves is
  Escape: inside a vim editor it is the mode switch, so it does not give the
  caret back — said in the keyboard map (`client/keys.ts`) rather than guarded
  in the editor.

  WHAT THIS PAGE GAVE UP for that is stated where the rendering's own promises
  are pinned (`documents.feature`): a table is pipe text, an image is its
  `![](…)`, a fence is not highlighted, a footnote is a bracket, and there are
  no minted ids for an anchor to land on. A LINK is the exception, because a
  vault is a web of them: the editor draws one over the link's own text, with
  the app's own address on it (`client/mde/links.ts`).

  The editor itself is a chunk (~700 kB of CodeMirror, its markdown grammar and
  the live-preview plugins), fetched the first time a document page is opened.
  Until it does — and forever, if it never comes — what a reader sees is the
  page's own rendering and what a writer types into is the textarea this app
  shipped before live preview. Nothing about reading or writing is gated on a
  fetch.

  @scratch:good
  Scenario: The markers hide, and the caret is what shows them
    Given I open the document "finishes.md"
    Then the document is the live-preview surface
    And the document hides the markers around "matte"
    # The caret is the whole rule: stand in the word and the source is there to
    # edit, leave and it is drawn again.
    When I put the caret in the document's word "matte"
    Then the document being typed shows the markers around "matte"
    # ...and nothing has been written at all: drawing is not editing.
    And "finishes.md" holds the text "- Doors: **matte**, not gloss."

  @scratch:good
  Scenario: The page IS the editor, reading — and a click makes it writable in place
    Given I open the document "finishes.md"
    # No caret anywhere yet: opening a page is reading, not editing.
    Then the document is the live-preview surface
    And the document is not being typed
    And the document renders bold text "matte"
    # ...and the click does not replace anything. The surface is the same
    # element before and after — which is what "no jump" means when it is
    # measured rather than described.
    When I click the document's word "gloss"
    Then the document is being typed
    And the document did not move when the caret arrived

  @scratch:good
  Scenario: The caret lands where the click landed
    Given I open the document "finishes.md"
    When I click the document's word "gloss"
    Then the document is being typed
    # Typing goes where the finger went, not to the end of the file — which the
    # rendering-swapped-for-an-editor shape could not do at all, since the thing
    # clicked was not the thing that got the caret.
    When I type "!"
    And I wait for the autosave
    # It went INTO the word the pointer was over — the line that held it does
    # not say what it said — rather than to the end of the document, whose last
    # line is untouched. Which character of the word the caret landed on is the
    # browser's own hit-testing and not this app's promise, so the claim is
    # made about the two lines rather than about an offset.
    Then "finishes.md" no longer holds the text "not gloss."
    And "finishes.md" holds the text "[^brass]: Unlacquered, so it ages."

  # THE EDITOR WRITES NOTHING NOBODY TYPED, which is the same law as the
  # markers, one layer down: `@codemirror/lang-markdown` ships commands that
  # continue a list on Enter and RENUMBER the items around it, and a paste that
  # rewrites a URL into a link. All of it is off — a list continued by hand is a
  # list the file says was continued by hand — and under autosave the difference
  # is bytes committed on the next pause.
  @scratch:good
  Scenario: Enter is a newline, not a list marker somebody else typed
    Given I open the document "finishes.md"
    When I put the caret at the end of the document's line "not gloss"
    And I press "Enter"
    And I type "plain"
    And I wait for the autosave
    # A new line, and no `- ` on it that nobody pressed.
    Then "finishes.md" holds the text "not gloss.\nplain"

  @scratch:good
  Scenario: Enter in a numbered list does not renumber the items around it
    Given I rewrite "finishes.md" as:
      """
      1. one
      1. two
      1. three
      """
    And I open the document "finishes.md"
    When I put the caret at the end of the document's line "one"
    And I press "Enter"
    And I wait for the autosave
    # Every number is the one the person wrote. A renumber would have made this
    # "1. one / 2. two / 3. three" — three lines edited by one keystroke.
    Then "finishes.md" holds the text "1. two"
    And "finishes.md" holds the text "1. three"

  @scratch:good
  Scenario: A tag in the editor is the tag on the row
    Given I open the document "finishes.md"
    When I put the caret at the end of the document
    And I type " #cabinets"
    Then the document styles the tag "cabinets"

  @scratch:good
  Scenario: A document writes itself on a pause, with nothing pressed
    Given I open the document "finishes.md"
    When I put the caret at the end of the document
    And I type " Ask about the oiled finish."
    And I wait for the autosave
    # No Enter, no click away, no Save: the caret is still in the document.
    Then the document is being typed
    And "finishes.md" holds the text "Ask about the oiled finish."

  # AND ITS OWN NEXT WRITE IS NEVER THE CONFLICT. Every write is conditional on
  # what this editor LAST SAVED, so the baseline has to advance with each one
  # that lands: an autosave chain judging its second write against the file as
  # it was before its first would refuse ordinary typing, in the words that are
  # supposed to mean somebody else got there.
  @scratch:good
  Scenario: Typing, pausing and typing again is two writes and no refusal
    Given I open the document "finishes.md"
    When I put the caret at the end of the document
    And I type " One."
    And I wait for the autosave
    And I type " Two."
    And I wait for the autosave
    Then "finishes.md" holds the text " One. Two."
    And nothing was refused
    And there should be no page errors

  @scratch:good
  Scenario: A concurrent write is refused, in the ops layer's own words
    Given I open the document "finishes.md"
    When I put the caret at the end of the document
    And I type " Mine."
    And I wait for the autosave
    # vim, or an agent, gets there first: the file moves on disk after this
    # editor's last write, so the `was` it sends next is one the file no longer
    # says.
    And I rewrite "finishes.md" as:
      """
      Theirs.
      """
    And I type " And mine again."
    And I wait for the autosave
    Then the write is refused saying "is not what this write expected to replace"
    # The draft is kept — nothing anybody typed is lost by a validator saying
    # no — and the file still says what the other writer wrote.
    And the document being typed ends with "And mine again."
    And "finishes.md" holds the text "Theirs."

  # ...and the other side of that guard, which is the one a reader meets far
  # more often: a file rewritten under somebody who is only READING it.
  @scratch:good
  Scenario: A document nobody is typing in follows the file
    Given I open the document "finishes.md"
    Then the document renders bold text "matte"
    When I rewrite "finishes.md" as:
      """
      Handles: **rewired** entirely.
      """
    Then the document renders bold text "rewired"
    # No conflict, because there was nothing to conflict with: a re-read is not
    # a draft being taken away.
    And the editor has not noticed a conflict
    And there should be no page errors

  @scratch:good
  Scenario: Vim is off until this browser says otherwise, and then Escape is vim's
    Given I open the document "finishes.md"
    When I start editing the document
    And I press "Escape"
    # Plain: Escape is the app's way out of an editor, as it has always been.
    Then the document is no longer being typed
    When I set editing to "vim"
    And I start editing the document
    Then the document is being typed
    When I press Escape where I am
    # Vim: Escape is the mode switch. The caret is exactly where it was.
    Then the document is being typed
    And this browser has stored that editing is "vim"

  # A FILE'S OWN LINE ENDINGS are bytes nobody typed either. CodeMirror splits
  # on any break and joins with `\n`, so a document written on Windows would
  # come back with every line changed by one keystroke.
  @scratch:good
  Scenario: A document written in CRLF stays written in CRLF
    Given I rewrite "finishes.md" in CRLF as:
      """
      # Finishes

      Handles: **matte** black.
      """
    When I open the document "finishes.md"
    And I start editing the document
    And I type " Yes."
    And the document autosaves
    Then "finishes.md" still uses CRLF line endings

  @corpus:good
  Scenario: The editing preference says what it does, in both settings
    When I open the app
    And I open the preferences
    Then the Editing row explains that "the keys your platform already gives a text field"
    When I set editing to "vim"
    And I open the preferences
    Then the Editing row explains that "Escape is the mode switch"

  # The chunk, from both ends: a page of titles never asks for the editor, and
  # a caret that lands before it arrives still writes.
  @corpus:good
  Scenario: An outline of titles never fetches the editor
    When I open the outline "house.olai"
    Then nothing has asked for the markdown editor
    And there should be no page errors

  # THE TEXTAREA IS NOT A VIM EDITOR, whatever the preference says. Until the
  # chunk lands — and forever if it never does — Escape has to be the app's, or
  # it is nobody's: a document left with no keyboard way out at all.
  @scratch:good
  Scenario: With the editor held up, Escape is the app's even with vim on
    Given the markdown editor never arrives
    And I open the document "finishes.md"
    And I set editing to "vim"
    When I start editing the document
    Then the document is being typed
    When I press Escape in the document editor
    Then the document is no longer being typed

  @scratch:good
  Scenario: If the editor never arrives, the document is still writable
    Given the markdown editor never arrives
    And I open the document "finishes.md"
    When I start editing the document
    And I type " Typed into the plain box."
    And I wait for the autosave
    Then "finishes.md" holds the text "Typed into the plain box."
