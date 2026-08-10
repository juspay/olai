Feature: On a phone
  The same app, on a screen 390 points wide and read with a thumb.

  Two things change and nothing else does. There is no second column to put
  the sidebar in, so it becomes a header above the outline — capped, and
  scrolling inside itself, so the outline is still on screen under it. And
  what a finger aims at gets bigger: 44px, the number both mobile platforms
  print in their guidelines.

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
  Scenario: One column — the sidebar is a header above the outline
    Given I open the outline "house.jsonl"
    Then the outline list is above the tree, not beside it
    # Capped, and scrolling inside itself: whatever is in the header, the
    # outline it is a header FOR has to still be on screen under it.
    And the outline is on screen under it
    And there should be no page errors

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
    When I tap the outline "garden.jsonl"
    Then the address is "/o/garden.jsonl"
    And the node "herbs" is shown

  @corpus:journal @phone
  Scenario: A tap on a day of the month opens that day
    Given I open the day "2019-11-05"
    When I tap the day "2019-11-06"
    Then the day open is "2019-11-06"
    And the address is "/d/2019-11-06"

  @corpus:good @phone
  Scenario: What a finger aims at is big enough to aim at
    Given I open the outline "house.jsonl"
    Then every "outline entry" is at least 44px tall and 44px wide
    And every "collapse toggle" is at least 44px tall and 28px wide
    And every "zoom bullet" is at least 44px tall and 28px wide
    And every "done switch" is at least 44px tall and 44px wide

  @corpus:journal @phone
  Scenario: The month is a grid of targets, not of numbers
    Given I open the day "2019-11-05"
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

  @corpus:good
  Scenario: On a laptop the same controls stay compact
    Given I open the outline "house.jsonl"
    Then every "collapse toggle" is smaller than 44px tall
    And every "outline entry" is smaller than 44px tall
