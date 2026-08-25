Feature: On a phone
  The same app, on a screen 390 points wide and read with a thumb.

  Two things change and nothing else does. There is no second column to put
  the sidebar in, so the DIRECTORY (calendar + file tree) goes behind a
  BURGER in the app header as a slide-over DRAWER with scrim: shut, the
  outline has the whole screen under the header; open, the drawer covers the
  left with a dim scrim over the page. The header itself is identity and
  search — ☰, olai, the magnifier. Connection and git interrupt as banners
  when they are news; a healthy phone does not advertise health. The agent
  is the thumb strip (one tap); preferences live in the drawer. Chat is a
  bottom sheet (half/full snap) rather than a side dock. And what a finger
  aims at gets bigger: 44px, the number both mobile platforms print in their
  guidelines.

  An always-open capped header of the whole sidebar was the first answer here
  and it was worse in both directions: it took a third of the screen from the
  outline to show a list nobody had asked for, and the one control that HAS
  to be reachable — the way into the agent — ended up somewhere down inside a
  strip that scrolled. Five chips in the bar was the second answer and it
  crushed `live` and the commit mark. The strip is the one tap; two taps is
  still the budget for anything in the directory drawer.

  The tree's gutter is the one exception, and it is a deliberate one: a
  44px-wide toggle AND a 44px-wide bullet at every level of indent leave a
  390px screen no room for the title they are in front of. So those two take
  the full 44px in HEIGHT — the axis where a miss lands on the wrong node —
  and 28px across, which is what the racket original used for the same control
  on the same screen. The `•••` is not drawn there at all for the same reason,
  which is why a row's menu has a second door here: hold a finger on the row.
  A GESTURE costs no width, and it is the only affordance that does.

  The last scenario is a laptop, on purpose: this is a rule about the pointer,
  not about the app, and a control that grew everywhere would be a regression
  in the other direction.

  @corpus:good @phone
  Scenario: One column — the sidebar is a drawer behind a burger
    Given I open the outline "house.olai"
    Then the burger is on screen
    And the sidebar is put away
    When I tap the burger
    # Full-height fixed drawer with scrim under the header (geometry asserted
    # in panels.feature). The outline list lives in the drawer; the tree is
    # under the scrim — not a one-column stack, so "list above tree" does not apply.
    Then the directory drawer is open with a scrim
    And there should be no page errors

  @scratch:chat @phone
  Scenario: The agent is one tap away on a phone
    # The one control that has to be reachable. It is the thumb strip — never
    # behind the burger, never a fifth chip in the bar — so a thumb can open
    # the panel without opening the directory drawer first.
    Given I open the app
    Then the burger is on screen
    And the chat strip is showing
    When I tap the agent toggle
    Then the agent panel is showing
    And I can type into the chat

  @scratch:good @phone
  Scenario: A live phone does not advertise health
    # WhatsApp's rule. The pills that used to crowd the bar — live, the commit
    # mark, the agent toggle, prefs — are not in it. Search is. A dead wire is
    # the freeze overlay, which the sister scenario holds.
    Given I open the outline "garden.olai"
    Then the burger is on screen
    And the phone header is identity and search

  @scratch:good @phone
  Scenario: Connecting freezes a phone too
    # `connecting` is the state of every first paint. A real dial races past it
    # before a poll can sample, so this holds WebSocket in CONNECTING. The
    # freeze overlay is the news — there is no connecting pill in the bar.
    When I open the app held at connecting
    Then the app is frozen under the offline overlay

  @scratch:good @phone
  Scenario: A dead wire freezes a phone too
    Given I open the outline "garden.olai"
    When the server stops
    Then the app is frozen under the offline overlay
    When the server starts again on the same port
    # What "retired" waits on: the handshake, not a snapshot of whether the
    # freeze overlay happens to be visible this tick. The server's log is the
    # one record of the pid echo being refused; the overlay then publishes
    # the same state. Sister of the_connection.feature's restart scenario.
    Then the server rejected the stale tab
    And the connection is "retired"
    And the overlay offers a reload

  @corpus:good @phone
  Scenario: A tap on a bullet zooms into that node
    Given I open the outline "house.olai"
    And I mark the page
    When I tap the bullet of "kitchen"
    Then the zoomed node is "kitchen"
    And the address is "/#kitchen"
    And the page has not reloaded

  @corpus:good @phone
  Scenario: A tap on a toggle folds and unfolds
    Given I open the outline "house.olai"
    When I tap the toggle of "kitchen"
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    When I tap the toggle of "kitchen"
    Then the node "kitchen" is expanded
    And the children of "kitchen" are shown

  @corpus:good @phone
  Scenario: The collapse triangle is always on, the ••• is not drawn
    # Touch has no hover: the triangle stays as the fold affordance; the
    # ••• is not drawn at all, so a 390px title still has room. What a phone
    # reaches the MENU with instead is the next scenario.
    Given I open the outline "house.olai"
    Then the collapse control of "kitchen" is revealed
    And the node menu of "kitchen" is not on the row

  # ── the menu, without a ••• to press ──────────────────────────────────
  #
  # A phone had no way at all to reach a row's verbs: the `•••` is the door on
  # a pointer device and it is not drawn here, so zooming, folding, the marks,
  # the date, the trash and the clipboard were all a mouse away. The gesture
  # that costs no width is HOLDING a finger on the row — Workflowy's own on a
  # handset — and it opens the same menu, in the same place, with the same
  # catalog: a door, not a smaller menu.
  #
  # The three scenarios after the first are all one worry. A row is already
  # covered in things a finger means — the title opens the editor, the bullet
  # zooms, the page scrolls — and a press that answered for any of them would
  # have traded one unreachable menu for a tree that cannot be read.

  @corpus:good @phone
  Scenario: Holding a finger on a row opens its ••• menu
    Given I open the outline "house.olai"
    And I mark the page
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    # The pointer's catalog, both halves of it: what changes the reading, and
    # what changes the directory.
    And the node menu offers "Zoom in"
    And the node menu offers "Complete"
    # The middle of a row is its TITLE, and a tap there opens the editor. This
    # is that collision, on the gesture most likely to meet it — the same
    # `swallowGhost()` the bullet scenario below locks the link half of, and
    # the half a person would hit first, since a thumb lands on the words.
    And no row is being edited
    And the page has not reloaded
    And there should be no page errors

  @corpus:good @phone
  Scenario: A verb chosen with a thumb does what it says
    Given I open the outline "house.olai"
    And the node "kitchen" is expanded
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    When I tap "Collapse" in the node menu
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And the node menu is closed

  @corpus:good @phone
  Scenario: A verb chosen with a thumb does not also press the row under it
    # The panel lies over rows, and a touchscreen makes up the click that
    # stands in for a tap AFTER the entry it was aimed at is gone — so the
    # browser hit-tests the point again and finds whatever the panel was
    # covering. This is the scenario for `client/ghost.ts`: without it,
    # choosing `Move to Trash` here opened the mirror three rows down, on a
    # question nobody had answered yet.
    Given I open the outline "house.olai"
    And I mark the page
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    When I tap "Move to Trash" in the node menu
    Then the node menu asks "Move “kitchen remodel #home” and the 7 rows under it to the Trash? They keep their ids, and the Trash in the sidebar is where to put them back."
    And the address is "/house.olai"
    And the page has not reloaded

  @corpus:good @phone
  Scenario: A finger that scrolls the page is not a finger that pressed
    # BOTH halves, and the second is the one that would go quietly: a row that
    # CLAIMED the gesture — `touch-action: none` on the line, a captured
    # pointer, a prevented `touchmove` — leaves every step about the menu
    # staying shut passing, and the page nailed to the top. So the page has to
    # be taller than the screen and has to MOVE. (Checked by making it: adding
    # `touch-none` to the row's own class fails this scenario here, on
    # `scrollY 0`, and nowhere else in the suite. A `preventDefault` on
    # `pointerdown` is NOT that mutation — it does not cancel a scroll, which
    # is why this module never needed to avoid one.)
    #
    # No corpus in this suite is taller than 390×844 — they are outlines a
    # person can read inside a scenario — so the screen is what shrinks, which
    # is a real handset too (one with its keyboard up), and the step checks its
    # own premise rather than trusting it.
    Given I open the outline "house.olai"
    And the screen is shorter than the outline
    When I flick the node "kitchen" up the screen
    Then the outline has scrolled
    And the node menu is closed
    And no row is being edited

  # ── the bullet is the handle, on a finger as on a mouse ───────────────
  #
  # A row can be picked up with a finger now, and the gesture is the same long
  # press — WATCHED, never claimed, until a deadline the browser has already
  # agreed is not a scroll. What it is held ON is the BULLET, which is what a
  # mouse and a pen have always dragged from, so it is one handle on three
  # devices rather than a fourth thing to learn.
  #
  # That costs the bullet its old job as a second door to the `•••` menu (this
  # scenario used to hold a finger there and assert the panel), and the trade
  # is deliberate: two long presses cannot both own one press, the menu has a
  # whole row to be reached from, and a handle has only itself. What the
  # scenario was really holding — that a finger lifting after a press does not
  # ALSO follow the link under it — is held here still, by the drag.

  @corpus:good @phone
  Scenario: A finger held on the bullet picks the row up, and does not follow its link
    Given I open the outline "house.olai"
    And I mark the page
    When I hold a finger on the bullet of "kitchen" and keep it there
    Then the row "kitchen" is in the air
    And the node menu is closed
    And no row is being edited
    When I let the finger go
    Then no row is in the air
    # The click a lift synthesises, eaten: under this finger is an `<a href>`.
    And the address is "/house.olai"
    And the page has not reloaded
    # ...and only that one. A plain tap is still the navigation it always was.
    When I tap the bullet of "kitchen"
    Then the zoomed node is "kitchen"

  @scratch:good @phone
  Scenario: A held row follows the finger and lands where it is let go
    Given I open the outline "house.olai"
    And I mark the page
    When I hold a finger on the bullet of "knobs" and keep it there
    And I drag that finger above the title of "handles"
    Then the drop line would put it under "install"
    And the drop line would put it first
    When I let the finger go
    Then the node "knobs" comes before "handles"
    And the address is "/house.olai"
    And there should be no page errors

  @corpus:good @phone
  Scenario: A flick that STARTS on the bullet still scrolls the page
    # The cost this design refused to pay. Claiming the handle with
    # `touch-action: none` would have passed every scenario above and left a
    # 28px dead strip down the left of every outline — so the claim is a
    # non-passive `touchmove` put up at the DEADLINE instead, and a finger that
    # moved before it never reaches one. Sister of the row's own fence below,
    # aimed at the one cell that could have broken it.
    Given I open the outline "house.olai"
    And the screen is shorter than the outline
    When I flick the bullet of "kitchen" up the screen
    Then the outline has scrolled
    And no row is in the air
    And the node menu is closed

  @corpus:good @phone
  Scenario: A tap on an outline entry opens that outline
    Given I open the outline "house.olai"
    When I tap the burger
    And I tap the outline "garden.olai"
    Then the address is "/garden.olai"
    And the node "herbs" is shown

  @corpus:journal @phone
  Scenario: A tap on a day of the month opens that day
    Given I open the day "2019-11-05"
    When I tap the burger
    And I tap the day "2019-11-06"
    Then the day open is "2019-11-06"
    And the address is "/d/2019-11-06"

  @corpus:good @phone
  Scenario: The page knows how much of itself the browser is showing
    # An on-screen keyboard covers the bottom of the viewport without
    # shrinking it, so the page measures the visible strip itself and
    # publishes it — that is what keeps anything anchored to the bottom above
    # the keyboard. With nothing in the way it is the whole viewport, which is
    # what this asserts; a keyboard cannot be raised from a test, and there is
    # nothing on this page to type into yet.
    Given I open the outline "house.olai"
    Then the page reports the visible strip as the whole viewport
