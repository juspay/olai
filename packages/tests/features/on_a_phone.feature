Feature: On a phone
  The same app, on a screen 390 points wide and read with a thumb.

  Two things change and nothing else does. There is no second column to put
  the sidebar in, so the DIRECTORY (calendar + file tree) goes behind a
  BURGER in the app header: shut, the outline has the whole screen under the
  header; open, the sheet is capped and scrolling so the outline is still
  under it. App chrome — connection, agent, theme — lives in the header and
  is never behind the burger. And what a finger aims at gets bigger: 44px,
  the number both mobile platforms print in their guidelines.

  An always-open capped header of the whole sidebar was the first answer here
  and it was worse in both directions: it took a third of the screen from the
  outline to show a list nobody had asked for, and the one control that HAS
  to be reachable — the way into the agent — ended up somewhere down inside a
  strip that scrolled. With the agent in the app header it is one tap; two
  taps is still the budget for anything in the directory sheet.

  The tree's gutter is the one exception, and it is a deliberate one: a
  44px-wide toggle AND a 44px-wide bullet at every level of indent leave a
  390px screen no room for the title they are in front of. So those two take
  the full 44px in HEIGHT — the axis where a miss lands on the wrong node —
  and 28px across, which is what the racket original used for the same control
  on the same screen.

  The last scenario is a laptop, on purpose: this is a rule about the pointer,
  not about the app, and a control that grew everywhere would be a regression
  in the other direction.

  @corpus:good @phone
  Scenario: One column — the sidebar is behind a burger, above the outline
    Given I open the outline "house.jsonl"
    Then the burger is on screen
    And the sidebar is put away
    When I tap the burger
    Then the outline list is above the tree, not beside it
    # Capped, and scrolling inside itself: whatever is in the sheet, the
    # outline it is a header FOR has to still be on screen under it.
    And the outline is on screen under it
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
    And every "done switch" is at least 44px tall and 44px wide

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
