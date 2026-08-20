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

  The representative below is the bar still on screen at the bottom of each
  page kind. The window is made short rather than the fixtures long, for the
  reason `zoom_and_navigate.feature` gives at the step both features share:
  how tall a page is belongs to the stylesheet, and a corpus grown until it
  happened to overflow is a scenario that stops testing anything the day a
  margin changes.

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
      | outline  | house.olai      |
      | node     | kitchen         |
      | document | kitchen-sink.md |
