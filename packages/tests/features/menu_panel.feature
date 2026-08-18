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

  Scenario: Escape puts the menu away
    When I open the node menu of "kitchen"
    And I press "Escape"
    Then the node menu is closed

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

  Scenario: A pointer outside puts the menu away
    When I open the node menu of "kitchen"
    And I click away from the node menu
    Then the node menu is closed

  Scenario: A pointer outside is NOT handed the caret back
    # The other half of the rule above, and the reason it is a rule: a press
    # that landed somewhere is where the reader now is, and a menu that took
    # the caret back off it would be pulling them out of what they just
    # pressed. Kobalte's own content keeps this distinction; so does ours.
    When I open the node menu of "kitchen" with the keyboard
    And I click away from the node menu
    Then the node menu is closed
    And the caret is nowhere

  Scenario: The ••• again puts it away
    # The two-roots bug, from the other side: a dismissal that read the press
    # of an open menu's own trigger as a press outside would shut the panel and
    # then have the trigger's own click reopen it, so the second press would do
    # nothing at all. Kobalte excludes the trigger; this is what says so.
    When I open the node menu of "kitchen"
    And I press the node menu of "kitchen"
    Then the node menu is closed

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
    # Two down from `Zoom in` is `Collapse` (`menu_verbs.feature` holds the
    # whole list, in order): a walk that stopped short or ran on would choose
    # something else, and every entry around it does something visible.
    Given the node "kitchen" is expanded
    When I open the node menu of "kitchen" with the keyboard
    And I press "Home"
    And I press "ArrowDown"
    And I press "ArrowDown"
    And I press "Enter"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden

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

  # ── the panel is taller than the window ─────────────────────────────
  #
  # The list is seventeen verbs on a node with children, which is taller than
  # a laptop window leaves either above or below a row. Floating-ui flips it to
  # whichever side has more room and then stops helping: the rest hangs off the
  # screen, where nothing can press it. What answers that is the popper's own
  # measurement — `--kb-popper-content-available-height` capping the panel, and
  # the panel scrolling inside the cap (`menu/Dropdown.tsx`).
  #
  # It is pinned HERE, and by the LAST entry, because that is the one the next
  # verb pushes off the edge: a menu that grew an eighteenth would fail this
  # rather than shipping a verb nobody can reach.

  Scenario: A menu taller than the window keeps its last entry reachable
    Given the window is shorter than the outline
    When I open the node menu of "kitchen"
    Then the node menu offers "Copy as text"
    And every entry of the node menu is inside the window
    And the last entry of the node menu can be pressed
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
