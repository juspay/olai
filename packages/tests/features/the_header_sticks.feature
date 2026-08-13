Feature: The header sticks
  The app header is CHROME, not part of the page. The wordmark, the connection
  dot, the commit pill (which is also the one thing that answers for git), the
  agent toggle and the preferences are permanent answers about the APP — that
  is the whole argument for the bar existing rather than for those pills living
  beside the things they are about.

  This app scrolls the DOCUMENT, so a bar in normal flow left the screen with
  the first flick of a wheel, and a permanent answer you have to scroll back up
  for is not one. (Filed by the human against his own vault, with a recording
  of the bar going.) So it sticks to the top of the viewport, on every page and
  at both widths — the pages differ in what they draw, and the bar above them is
  one component, which is exactly the kind of claim that is easy to lose to a
  later layout rework and impossible to notice in a screenshot of the top of a
  page.

  The other half is the SEAM. The mobile drawer, its scrim and both faces of the
  chat panel are `fixed` at `top: var(--height-header)` — a viewport coordinate,
  and therefore the bottom edge of the bar only while the bar is at the top of
  the viewport. Scrolled away, they were hanging 3rem below nothing with a strip
  of page showing above them. So the panel geometry is asserted here AFTER a
  scroll, not only at the top of a page where it cannot fail.

  The window is made short rather than the fixtures long, for the reason
  `zoom_and_navigate.feature` gives at the step both features share: how tall a
  page is belongs to the stylesheet, and a corpus grown until it happened to
  overflow is a scenario that stops testing anything the day a margin changes.

  @corpus:good
  Scenario Outline: The bar is still on screen at the bottom of a <kind>
    Given the window is shorter than the page
    And I open the <kind> "<name>"
    When I scroll to the bottom of the page
    Then the app header is at the top of the viewport
    And the header chrome takes the pointer where the page runs under it
    And there should be no page errors

    Examples:
      | kind     | name            |
      | outline  | house.jsonl     |
      | node     | kitchen         |
      | document | kitchen-sink.md |

  # The fourth page kind, and the one corpus that has a day worth opening.
  @corpus:journal
  Scenario: The bar is still on screen at the bottom of a day
    Given the window is shorter than the page
    And I open the day "2019-11-05"
    When I scroll to the bottom of the page
    Then the app header is at the top of the viewport
    And the header chrome takes the pointer where the page runs under it

  # A jump lands at a heading, and the top of the viewport is not free space any
  # more — so the document reserves the bar's height (`scroll-padding-top`) and
  # the heading stops under it rather than behind it.
  @corpus:good
  Scenario: A jump to a heading lands below the bar, not behind it
    # A heading in the MIDDLE of the fixture, so the jump is a real one: near
    # the end the document runs out of itself and the browser stops short of
    # the target, which would pass this for the wrong reason.
    When I open the document "kitchen-sink.md"
    And I follow the contents line "Lists"
    Then the app header is at the top of the viewport
    And the heading "Lists" is clear of the header

  # A palette is a redefinition of eleven custom properties and the bar's
  # geometry knows nothing about it — but the CHIPS hang off the header, in the
  # preferences panel, and a positioned bar with a z-index is a stacking context
  # anything drawn inside it would be trapped in. (That is why the panel is
  # portalled out to the body; the chips' own popover was not, and rode at the
  # bar's own layer.) So the pick is made from the BOTTOM of a scrolled page:
  # the panel has to open over the page rather than under it for the chip to
  # take the click at all (Playwright refuses to click what something else would
  # receive), and the bar has to be in the same place afterwards as before.
  @corpus:good
  Scenario: The bar sticks in a dark palette, picked from a scrolled page
    Given the window is shorter than the page
    And I open the outline "house.jsonl"
    When I scroll to the bottom of the page
    And I pick the theme "dark"
    Then the page is in the theme "dark"
    And the app header is at the top of the viewport
    And the header chrome takes the pointer where the page runs under it

  @corpus:good
  Scenario: The agent dock still meets the bar after the page has scrolled
    Given the window is shorter than the page
    And I open the outline "house.jsonl"
    And the agent panel is open
    When I scroll to the bottom of the page
    Then the app header is at the top of the viewport
    And the agent dock sits under the header

  @corpus:good @phone
  Scenario: On a phone the bar stays put, and the drawer still meets it
    Given the window is shorter than the page
    And I open the outline "house.jsonl"
    When I scroll to the bottom of the page
    Then the app header is at the top of the viewport
    And the header chrome takes the pointer where the page runs under it
    # Opened from a scrolled page: the drawer and its scrim are measured against
    # the header's own box, which is what the seam is.
    When I tap the burger
    Then the directory drawer is open with a scrim
    And the header chrome stays tappable over the drawer
    And there should be no page errors
