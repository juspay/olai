Feature: On a phone
  The same app, on a screen 390 points wide and read with a thumb.

  Two things change and nothing else does. There is no second column to put
  the sidebar in, so the DIRECTORY (calendar + file tree) goes behind a
  BURGER in the app header as a slide-over DRAWER with scrim: shut, the
  outline has the whole screen under the header; open, the drawer covers the
  left with a dim scrim over the page. App chrome — connection, agent,
  preferences — lives in the header and is never behind the burger. Chat is a bottom
  sheet (half/full snap) rather than a side dock; minimized it is a strip
  above the thumb. And what a finger aims at gets bigger: 44px, the number
  both mobile platforms print in their guidelines.

  An always-open capped header of the whole sidebar was the first answer here
  and it was worse in both directions: it took a third of the screen from the
  outline to show a list nobody had asked for, and the one control that HAS
  to be reachable — the way into the agent — ended up somewhere down inside a
  strip that scrolled. With the agent in the app header it is one tap; two
  taps is still the budget for anything in the directory drawer.

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
    Given I open the outline "house.jsonl"
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
    # The one control that has to be reachable. It lives in the app header
    # with the connection pill — never behind the burger — so a thumb can
    # open the panel without opening the directory sheet first.
    Given I open the app
    Then the burger is on screen
    When I tap the agent toggle
    Then the agent panel is showing
    And I can type into the chat

  @scratch:good @phone
  Scenario: Header chrome stays inside the bar while connecting
    # `connecting` is the state of every first paint. A real dial races past it
    # before a poll can sample (0/8 on the reviewer's machine), so this holds
    # WebSocket in CONNECTING — the indicator must say connecting or the step
    # fails, and only then is geometry checked.
    When I open the app held at connecting
    Then the connection is "connecting"
    And the app chrome is inside the header

  @scratch:good @phone
  Scenario: Header chrome stays inside the bar after the wire is live
    # live, reconnecting, and retired (the longest label, and the state that
    # must never look healthy). Sister of the held-connecting scenario.
    Given I open the outline "garden.jsonl"
    Then the connection is "live"
    And the app chrome is inside the header
    # Five things do not fit at 390pt, so the bar gives way in a stated order
    # (AppHeader.tsx) and this label is the end of it. `one-git-indicator` first
    # shipped with the order wrong — `live` squeezed to `l…` beside a theme name
    # drawn in full — and a screenshot is how that was found. (The theme name is
    # not in the bar at all any more; the order it broke still is.) This is the fence,
    # and it is asserted in every state rather than only in the short one: the
    # bar is not full at `live`, so `live` alone would pass with the rule
    # removed. `reconnecting` and `server restarted` are what fill it.
    And the connection's label is whole
    When the server stops
    Then the connection is "reconnecting"
    And the app chrome is inside the header
    And the connection's label is whole
    When the server starts again on the same port
    Then the connection is "retired"
    And the app chrome is inside the header
    And the connection's label is whole

  @corpus:good @phone
  Scenario: A tap on a bullet zooms into that node
    Given I open the outline "house.jsonl"
    And I mark the page
    When I tap the bullet of "kitchen"
    Then the zoomed node is "kitchen"
    And the address is "/n/kitchen"
    And the page has not reloaded

  @corpus:good @phone
  Scenario: A tap on a toggle folds and unfolds
    Given I open the outline "house.jsonl"
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
    Given I open the outline "house.jsonl"
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
    Given I open the outline "house.jsonl"
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
    Given I open the outline "house.jsonl"
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
    Given I open the outline "house.jsonl"
    And I mark the page
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    When I tap "Move to Trash" in the node menu
    Then the node menu asks "Move “kitchen remodel #home” and the 7 rows under it to the Trash? They keep their ids, and the Trash in the sidebar is where to put them back."
    And the address is "/o/house.jsonl"
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
    Given I open the outline "house.jsonl"
    And the screen is shorter than the outline
    When I flick the node "kitchen" up the screen
    Then the outline has scrolled
    And the node menu is closed
    And no row is being edited

  @corpus:good @phone
  Scenario: The press does not also press the row it landed on
    # A finger lifting after a long press still produces a click, and under it
    # is a link: the bullet zooms. So the press that opened the menu eats that
    # one tap — and only that one, which is what the last two steps are for.
    Given I open the outline "house.jsonl"
    When I hold a finger on the bullet of "kitchen"
    Then the node menu is open
    And the address is "/o/house.jsonl"
    And no row is being edited
    When I tap away from the node menu
    Then the node menu is closed
    When I tap the bullet of "kitchen"
    Then the zoomed node is "kitchen"

  @corpus:good @phone
  Scenario: A tap on an outline entry opens that outline
    Given I open the outline "house.jsonl"
    When I tap the burger
    And I tap the outline "garden.jsonl"
    Then the address is "/o/garden.jsonl"
    And the node "herbs" is shown

  @corpus:journal @phone
  Scenario: A tap on a day of the month opens that day
    Given I open the day "2019-11-05"
    When I tap the burger
    And I tap the day "2019-11-06"
    Then the day open is "2019-11-06"
    And the address is "/d/2019-11-06"

  @corpus:good @phone
  Scenario: What a finger aims at is big enough to aim at
    Given I open the outline "house.jsonl"
    When I tap the burger
    Then every "outline entry" is at least 44px tall and 44px wide
    # A document in the sidebar is the same kind of thing as an outline in it.
    And every "document entry" is at least 44px tall and 44px wide
    # A folder row is a new target the file tree added; the enumeration being
    # exhaustive is the point of this scenario.
    And every "folder toggle" is at least 44px tall and 44px wide
    And every "collapse toggle" is at least 44px tall and 28px wide
    And every "zoom bullet" is at least 44px tall and 28px wide
    When I open the preferences
    Then every "done choice" is at least 44px tall and 44px wide

  @corpus:journal @phone
  Scenario: The month is a grid of targets, not of numbers
    Given I open the day "2019-11-05"
    When I tap the burger
    Then every "calendar day" is at least 44px tall and 44px wide
    And every "month step" is at least 44px tall and 44px wide

  @corpus:good @phone
  Scenario: The page knows how much of itself the browser is showing
    # An on-screen keyboard covers the bottom of the viewport without
    # shrinking it, so the page measures the visible strip itself and
    # publishes it — that is what keeps anything anchored to the bottom above
    # the keyboard. With nothing in the way it is the whole viewport, which is
    # what this asserts; a keyboard cannot be raised from a test, and there is
    # nothing on this page to type into yet.
    Given I open the outline "house.jsonl"
    Then the page reports the visible strip as the whole viewport

  # A laptop, on purpose: the burger is a fact about the WIDTH, so above 48rem
  # there is a column, everything is in it, and there is nothing to press.
  @corpus:good
  Scenario: On a laptop the same controls stay compact
    Given I open the outline "house.jsonl"
    Then every "collapse toggle" is smaller than 44px tall
    And every "outline entry" is smaller than 44px tall
    And there is no burger

  # Desktop geometry (default 1440×900). Short page + full-height column: the
  # grid floor used to resolve to 0 (`min-h-full` against auto height) and left
  # the sidebar rule hanging at y≈777 on a 900px viewport.
  @corpus:good
  Scenario: The directory column reaches the bottom of a short page
    Given I open the outline "house.jsonl"
    Then the sidebar reaches the bottom of the viewport
