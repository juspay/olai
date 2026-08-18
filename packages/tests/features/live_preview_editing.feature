Feature: Markdown editing stops being a dumb text box
  A note and a document are written in an editor that DRAWS the markdown while
  you are in it — `**bold**` is bold, a heading is heading-sized, a `#tag`
  wears the same quiet ink it wears on the row — and the markers appear only
  around the caret, the way Obsidian and Typora do it.

  THE SOURCE IS STILL THE DOCUMENT MODEL, which is the whole architecture in
  one sentence: what the editor holds is the markdown string the file holds,
  character for character, and the rich text is a rendering laid over it.
  Nothing parses the text into a model of its own and writes it back — an
  editor that did would normalise bytes nobody touched (`_em_` becoming
  `*em*`, a list reflowing, an escape dropped), and under autosave that churn
  would land on every pause. So the fidelity these scenarios check is not a
  behaviour anybody implemented; it is the absence of a step.

  AUTOSAVE, with no Save verb and no dirty flag: half a second of quiet, or the
  caret leaving, and what is in the editor is on disk. Every write is
  CONDITIONAL on what that editor last saved, so an agent or a second tab
  writing the same node is refused in the ops layer's own words, under the row,
  with the draft kept — never a silent clobber.

  AND VIM, behind a preference, off by default. The one key it moves is
  Escape: inside a vim editor it is the mode switch, so it does not close the
  editor — said in the keyboard map (`client/keys.ts`) rather than guarded in
  the editor.

  ONE SURFACE, TWO MODES (human, on the first shape). A note the reader has
  opened IS this editor, mounted readonly — the rendering they are looking at —
  and a click makes that very view writable, at the character they clicked.
  Nothing is swapped for anything, so nothing moves: the words a reader was
  aiming at are still where they were when the caret arrives.

  Where the editor cannot be the reading surface, the page's own markdown
  rendering stays, and each is a place no caret can go: a day page, the agenda,
  the trash, a chat reply, a node's own page, and a row unfolded by the DENSITY
  preference rather than by a reader — that last one because `open` unfolds
  every untouched row, and an editor per note is 266 of them on this
  repository's own roadmap.

  The editor itself is a chunk (~700 kB of CodeMirror, its markdown grammar and
  the live-preview plugins), fetched the first time a reader opens a note or a
  caret lands in prose. Until it does — and forever, if it never comes — what a
  reader sees is the rendering and what a writer types into is the textarea this
  app shipped before live preview. Nothing about reading or writing is gated on
  a fetch.

  @scratch:good
  Scenario: The markers hide, and the caret is what shows them
    Given I open the outline "house.olai"
    When I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    And the note being typed draws "walnut" in bold
    And the note being typed hides the markers around "birch"
    # The caret is the whole rule: stand in the word and the source is there to
    # edit, leave and it is drawn again.
    When I put the caret in the note's word "walnut"
    Then the note being typed shows the markers around "walnut"
    And the note being typed hides the markers around "birch"
    # ...and nothing has been written at all: drawing is not editing.
    And "house.olai" holds a node whose note ends "Measure the alcove before ordering."

  @scratch:good
  Scenario: An open note IS the editor, reading — and a click makes it writable in place
    Given I open the outline "house.olai"
    # No caret anywhere yet: opening a row is reading, not editing.
    When I open the note of "order"
    Then the note of "order" is the live-preview surface
    And the note of "order" is not being typed
    And the description of "order" renders bold text "walnut"
    # ...and the click does not replace anything. The surface is the same
    # element before and after — which is what "no jump" means when it is
    # measured rather than described.
    When I click the note of "order"
    Then the note of "order" is being typed
    And the note of "order" did not move when the caret arrived

  @scratch:good
  Scenario: The caret lands where the click landed
    Given I open the outline "house.olai"
    When I open the note of "order"
    And I click the note's word "walnut"
    Then the note of "order" is being typed
    # Typing goes where the finger went, not to the end of the note — which the
    # rendering-swapped-for-an-editor shape could not do at all, since the thing
    # clicked was not the thing that got the caret.
    When I type "!"
    And I wait for the autosave
    # It went INTO the word rather than to the end of the note, which is the
    # whole claim: the last sentence is untouched, and the mark is where the
    # pointer was.
    Then "house.olai" holds a node whose note contains "!"
    And "house.olai" holds a node whose note ends "Measure the alcove before ordering."

  @scratch:good
  Scenario: A tag in the editor is the tag on the row
    Given I open the outline "house.olai"
    When I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    When I type " #cabinets"
    Then the note being typed styles the tag "cabinets"

  @scratch:good
  Scenario: A note writes itself on a pause, with nothing pressed
    Given I open the outline "house.olai"
    When I open the note of "order"
    And I click the note of "order"
    And I put the caret at the end of the note
    And I type " Ask about the oiled finish."
    And I wait for the autosave
    # No Enter, no click away, no Save: the caret is still in the note.
    Then the note of "order" is being typed
    And "house.olai" holds a node whose note ends "Ask about the oiled finish."

  @scratch:good
  Scenario: A concurrent write is refused, in the ops layer's own words
    Given I open the outline "house.olai"
    When I open the note of "order"
    And I click the note of "order"
    And I put the caret at the end of the note
    And I type " Mine."
    And I wait for the autosave
    # vim, or an agent, gets there first: the record moves on disk after this
    # editor's last write, so the `was` it sends next is one the file no longer
    # says.
    And another writer rewrites the note of "order" in "house.olai" as "Theirs."
    And I put the caret at the end of the note
    And I type " And mine again."
    And I wait for the autosave
    Then the autosave is refused saying "is not the one this write expected to replace"
    # The draft is kept — nothing anybody typed is lost by a validator saying
    # no — and the file still says what the other writer wrote.
    And the note being typed ends with "And mine again."
    And "house.olai" holds a node whose note ends "Theirs."

  @scratch:good
  Scenario: Vim is off until this browser says otherwise, and then Escape is vim's
    Given I open the outline "house.olai"
    When I open the note of "order"
    And I click the note of "order"
    And I press "Escape"
    # Plain: Escape is the app's way out of an editor, as it has always been.
    Then the note of "order" is no longer being typed
    # ...and it folded the row with it, which is what Escape has always done:
    # editing and expanding are one state you leave at once.
    When I set editing to "vim"
    And I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    When I press Escape in the note
    # Vim: Escape is the mode switch. The editor is exactly where it was.
    Then the note of "order" is being typed
    And this browser has stored that editing is "vim"

  @corpus:good
  Scenario: The editing preference says what it does, in both settings
    When I open the app
    And I open the preferences
    Then the Editing row explains that "take the keys your platform already gives a text field"
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

  @scratch:good
  Scenario: If the editor never arrives, the note is still writable
    Given the markdown editor never arrives
    And I open the outline "house.olai"
    When I open the note of "order"
    And I click the note of "order"
    Then the note of "order" is being typed
    When I type " Typed into the plain box."
    And I wait for the autosave
    Then "house.olai" holds a node whose note ends "Typed into the plain box."
