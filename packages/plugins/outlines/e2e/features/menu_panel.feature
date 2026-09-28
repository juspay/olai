@corpus:good
Feature: The ••• menu opens and shuts
  The panel itself, rather than what its verbs do (`menu_verbs.feature`) or the
  gutter it hangs in (`workflowy_gutter.feature`): the ways a person puts it
  away, and the keyboard that walks it.

  It is a `@kobalte/core` DropdownMenu — the SolidJS ecosystem's accessible
  primitive — where it used to be this client's fourth hand-rolled dismissable
  panel. Everything below was true of the hand-rolled one and untested (the
  three dismissals), or is what adopting the primitive BOUGHT (the arrow keys,
  which the hand-rolled list deliberately did not implement and said so). Both
  halves belong here: a swap nothing holds to the old behaviour is a swap that
  can quietly change it.

  Background:
    Given I open the outline "house.olai"
    # `demo` is the row the refused-mark scenarios open the menu OF —
    # finished, so the page is asked to keep it drawn (the menu under a row
    # that is not there is nobody's case).
    And I show the done nodes

  Scenario: Escape hands the caret back to the •••
    # A menu opened with the keyboard HOLDS the caret, so the dismissal has to
    # give it back or the reader is on `<body>` — nowhere, and the whole
    # document to walk down again. The primitive's own way of doing that
    # (`onCloseAutoFocus`) is refused: it restores the trigger on every close,
    # and a pointer that landed somewhere else must not be pulled back. So
    # this step is the only thing standing between a keyboard and nowhere.
    When I open the node menu of "kitchen" with the keyboard
    And I press "Escape"
    Then the node menu is closed
    And the node menu of "kitchen" has the caret

  Scenario: A pointer outside is NOT handed the caret back
    # The other half of the rule above, and the reason it is a rule: a press
    # that landed somewhere is where the reader now is, and a menu that took
    # the caret back off it would be pulling them out of what they just
    # pressed. Kobalte's own content keeps this distinction; so does ours.
    When I open the node menu of "kitchen" with the keyboard
    And I click away from the node menu
    Then the node menu is closed
    And the caret is nowhere

  Scenario: The keyboard opens it, reaches an entry, and chooses
    # What the primitive brought. The panel this replaced was a plain list of
    # buttons — "not role=menu: we do not implement roving focus / arrow keys",
    # in its own words — so a keyboard could only Tab through them one at a
    # time. Enter on the `•••` opens the menu with the caret inside it, Home
    # goes to the first entry (`Zoom in`) and Enter chooses it.
    Given I mark the page
    When I open the node menu of "kitchen" with the keyboard
    And I press "Home"
    And I press "Enter"
    Then the zoomed node is "kitchen"
    And the page has not reloaded
    And there should be no page errors

  Scenario: The question takes the caret, and Cancel hands it back
    # The panel swaps its content for the question one verb asks first, and a
    # swap that left the caret where the list was leaves the keyboard on
    # `<body>` — nowhere, and a walk down the whole document to get back. The
    # question is on screen either way, so nothing else in this suite would
    # notice; this is the step that does. Cancelling is the same rule in
    # reverse: back to the entry that was asked from, not to the top of the
    # list. (Nothing is written here — `menu_verbs.feature` owns what the
    # confirm DOES.)
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    Then the node menu's "Move to Trash" has the caret
    When I choose "Cancel" from the node menu
    Then the node menu is not asking anything
    And the node menu's "Move to Trash" has the caret

  Scenario: ArrowDown walks the entries in order
    # ONE DOWN FROM `Zoom in` is `Mark ›` (`menu_verbs.feature` holds the
    # whole list, in order): a walk that stopped short or ran on would land
    # somewhere else. A submenu's entry is a stop on the walk like any other,
    # and landing on it does not open it — only a key that says so does.
    When I open the node menu of "kitchen" with the keyboard
    And I press "Home"
    And I press "ArrowDown"
    Then the node menu's "Mark" has the caret
    And the node menu's "Mark" is closed
    When I press "ArrowDown"
    Then the node menu's "Set date…" has the caret

  # ── submenus ─────────────────────────────────────────────────────────
  #
  # The menu is short now: what varies by a choice (`Mark ›`) and what is
  # reached for rarely (`More ›`) cost the top level one line each, and the
  # entries are in a submenu beside the panel. The submenu is Kobalte's own
  # `Sub`, portalled beside the panel rather than inside it — so the keyboard
  # that walks the list has to walk into it and back out, and a click on the
  # entry has to open it and leave the panel standing.

  Scenario: A click on a submenu's entry opens it beside the panel
    When I open the node menu of "kitchen"
    And I open "Mark" in the node menu
    # `kitchen` is doing: `Doing` again is not offered, the clear is.
    Then the node menu's "Mark" offers:
      | To do     |
      | Done      |
      | Cancelled |
      | Clear     |
    And the node menu is open
    And there should be no page errors

  Scenario: More holds the rarely reached, in its own order
    When I open the node menu of "install"
    And I open "More" in the node menu
    Then the node menu's "More" offers:
      | Copy link       |
      | Copy as text    |
      | Expand all      |
      | Collapse all    |
      | Add property…   |
      | Link to…        |
      | Wait for…       |

  Scenario: ArrowRight walks into a submenu, ArrowLeft back out to its entry
    When I open the node menu of "kitchen" with the keyboard
    And I press "End"
    And I press "ArrowUp"
    Then the node menu's "More" has the caret
    When I press "ArrowRight"
    Then the node menu's "More" is open
    And the node menu's "Copy link" has the caret
    When I press "ArrowLeft"
    Then the node menu's "More" is closed
    And the node menu's "More" has the caret
    When I press "Escape"
    Then the node menu is closed
    And the node menu of "kitchen" has the caret

  Scenario: Enter on a verb inside a submenu chooses it, and the whole menu goes
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen" with the keyboard
    And I press "End"
    And I press "ArrowUp"
    And I press "ArrowRight"
    And I press "ArrowDown"
    And I press "ArrowDown"
    And I press "ArrowDown"
    Then the node menu's "Collapse all" has the caret
    When I press "Enter"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And the node menu is closed

  Scenario: The keyboard reaches Move to Trash last, and it asks before it moves anything
    # The last line, alone under its own rule: End is the one key that
    # reaches it, and choosing it swaps the list for the question with the
    # caret on the answer — the keyboard never has to leave the panel.
    When I open the node menu of "install" with the keyboard
    And I press "End"
    Then the node menu's "Move to Trash" has the caret
    When I press "Enter"
    Then the node menu asks "Move “install the cabinets” and the 3 rows under it to Trash? You can put them back from Trash in the sidebar."
    And the node menu's "Move to Trash" has the caret
    When I press "Escape"
    Then the node menu is closed

  Scenario: A row opened a SECOND time still puts the caret in the panel
    # The row is armed after the first press (`Dots`), and that is the case the
    # panel's own focus line exists for: the first open creates the primitive
    # while it is already open, so a binding-not-a-signal can miss it. Without
    # the line this scenario walks nothing — the caret stays on the `•••` and
    # the arrows go to a button that is not a menu.
    Given I mark the page
    When I open the node menu of "kitchen" with the keyboard
    And I press "Escape"
    And I open the node menu of "kitchen" with the keyboard
    And I press "Home"
    And I press "Enter"
    Then the zoomed node is "kitchen"
    And the page has not reloaded
    And there should be no page errors

  # ── the panel paints over the page ──────────────────────────────────
  #
  # A top-level row is a sticky section heading (`Tree.tsx`), at the same
  # layer the menu rides. Left in the row, the panel is a preceding sibling
  # of the next heading's stacking context, and the heading paints through
  # it — the human's screenshot, "Move to Trash" cut in two. Zoomed into
  # `kitchen`, `order` and `install` are those two headings: the menu of
  # the first hangs down over the second. `elementFromPoint` at the overlap
  # is the only honest assertion; a bounding box cannot see a layer.

  Scenario: An open menu paints over a later section heading
    Given I zoom into the node "kitchen"
    When I open the node menu of "order"
    Then the node menu takes the pointer where it crosses the section heading of "install"
    And there should be no page errors

  # The line beside the `•••` was the one overlay #233 left in the row. A
  # later heading still painted through it — the same stacking context, the
  # same `elementFromPoint` question, a different box. `demo` is done, so
  # `Mark › Doing` is refused and the line hangs under that row over `order`.
  Scenario: A refusal paints over a later section heading
    Given I zoom into the node "kitchen"
    When I open the node menu of "demo"
    And I choose "Mark › Doing" from the node menu
    Then the node menu of "demo" says "`take out the old counters` is done. Undo that first — nothing should decide on your behalf that finished work is not finished."
    And the node menu's said line takes the pointer where it crosses the section heading of "order"
    And there should be no page errors
