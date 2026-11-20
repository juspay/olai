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

  @corpus:good
  Scenario: A jump to a heading lands below the bar, not behind it
    When I open the document "kitchen-sink.md"
    And I follow the contents line "Lists"
    Then the app header is at the top of the viewport
    And the heading "Lists" is clear of the header

  @corpus:good @abp
  Scenario: A jump to a row lands below the pinned section, not behind it
    When I open the outline "house.olai"
    And the window is shorter than the page
    And a jump lands the row "install" at the top of the window
    Then the app header is at the top of the viewport
    And the row "install" is clear of the pinned section "kitchen"
    And there should be no page errors

  @corpus:good @phone @abp
  Scenario: A jump to a row lands below the pinned section on a phone, not behind it
    When I open the outline "house.olai"
    And the window is shorter than the page
    And a jump lands the row "install" at the top of the window
    Then the app header is at the top of the viewport
    And the row "install" is clear of the pinned section "kitchen"
    And there should be no page errors

  @scratch:good @phone
  Scenario: A jump clears a pinned section whose title wraps
    When I open the outline "house.olai"
    And I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel, all of it: counters out, cabinets ordered and hung, handles and hinges picked, and the herbs on the sill #home","doing":"2026-08-01"}
      {"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","doing":"2026-08-05","date":"2026-08-10","desc":"Two ways to go:\n\n- **walnut** — six week lead time\n- *birch* — in stock today\n\nMeasure the alcove before ordering.","after":["demo"]}
      {"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets","after":["order"]}
      {"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}
      {"id":"hinges","parent":"install","ord":"a1","title":"pick the hinges","todo":"2026-08-11","after":["handles","order"]}
      {"id":"knobs","parent":"install","ord":"a2","title":"pick the knobs","todo":"2026-08-11"}
      """
    Then the title of "kitchen" wraps onto more than one line, cut off nowhere
    And the window is shorter than the page
    And a jump lands the row "install" at the top of the window
    Then the row "install" is clear of the pinned section "kitchen"
    And there should be no page errors
