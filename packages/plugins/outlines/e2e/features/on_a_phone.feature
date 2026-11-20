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
    Then the directory drawer is open with a scrim
    And there should be no page errors

  @scratch:good @phone
  Scenario: A live phone does not advertise health
    Given I open the outline "garden.olai"
    Then the burger is on screen
    And the phone header is identity and search

  @scratch:good @phone
  Scenario: Connecting freezes a phone too
    When I open the app held at connecting
    Then the app is frozen under the offline overlay

  @scratch:good @phone
  Scenario: A dead wire freezes a phone too
    Given I open the outline "garden.olai"
    When the server stops
    Then the app is frozen under the offline overlay
    When the server starts again on the same port
    Then the server rejected the stale tab
    And the connection is "retired"
    And the overlay offers a reload

  @corpus:good @phone
  Scenario: A tap on a bullet zooms into that node
    Given I open the outline "house.olai"
    And I mark the page
    When I tap the bullet of "kitchen"
    Then the zoomed node is "kitchen"
    And the address is "/zoom/#kitchen"
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
    Given I open the outline "house.olai"
    Then the collapse control of "kitchen" is revealed
    And the node menu of "kitchen" is not on the row

  @corpus:good @phone
  Scenario: Holding a finger on a row opens its ••• menu
    Given I open the outline "house.olai"
    And I mark the page
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    And the node menu offers "Zoom in"
    And the node menu offers "Mark"
    And the node menu offers "Move to Trash"
    And no row is being edited
    And the page has not reloaded
    And there should be no page errors

  @corpus:good @phone
  Scenario: A verb chosen with a thumb does what it says
    Given I open the outline "house.olai"
    And the node "kitchen" is expanded
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    When I tap "Zoom in" in the node menu
    Then the zoomed node is "kitchen"
    And the node menu is closed

  @corpus:good @phone
  Scenario: A thumb opens a submenu, and a verb in it does what it says
    Given I open the outline "house.olai"
    And I mark the page
    And the node "kitchen" is expanded
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    When I tap "More" open in the node menu
    Then the node menu's "More" is open
    And the node menu is open
    When I tap "More › Collapse all" in the node menu
    Then the node "kitchen" is collapsed
    And the children of "kitchen" are hidden
    And the node menu is closed
    And the address is "/house.olai"
    And the page has not reloaded

  @corpus:good @phone
  Scenario: A verb chosen with a thumb does not also press the row under it
    Given I open the outline "house.olai"
    And I mark the page
    When I hold a finger on the node "kitchen"
    Then the node menu is open
    When I tap "Move to Trash" in the node menu
    Then the node menu asks "Move “kitchen remodel #home” and the 7 rows under it to Trash? You can put them back from Trash in the sidebar."
    And the address is "/house.olai"
    And the page has not reloaded

  @corpus:good @phone
  Scenario: A finger that scrolls the page is not a finger that pressed
    Given I open the outline "house.olai"
    And the screen is shorter than the outline
    When I flick the node "kitchen" up the screen
    Then the outline has scrolled
    And the node menu is closed
    And no row is being edited

  @corpus:lanes @phone
  Scenario: A plugin's offer waits for the tapped row, and a standing always shows
    Given I open the outline "lanes.olai"
    Then the agent standing on "door-implement" is drawn
    And the agent offer on "lane-fresh" is not drawn
    And the agent offer on "lane-quiet" is not drawn
    When I tap the title of "lane-fresh"
    Then the agent offer on "lane-fresh" is drawn
    And the agent offer on "lane-quiet" is not drawn
    And the agent standing on "door-implement" is drawn
    And there should be no page errors

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
    And the address is "/house.olai"
    And the page has not reloaded
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
    Given I open the outline "house.olai"
    Then the page reports the visible strip as the whole viewport
