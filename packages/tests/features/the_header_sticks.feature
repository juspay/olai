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
      | outline  | house.org      |
      | node     | kitchen         |
      | document | kitchen-sink.md |

  # A jump lands at a heading, and the top of the viewport is not free space any
  # more — so the document reserves the bar's height (`scroll-padding-top`) and
  # the heading stops under it rather than behind it. The geometry IS the
  # feature: a CSS rule plus the browser's own `#heading` scroll is not a unit
  # test, and the Outline above never jumps anywhere.
  @corpus:good
  Scenario: A jump to a heading lands below the bar, not behind it
    # A heading in the MIDDLE of the fixture, so the jump is a real one: near
    # the end the document runs out of itself and the browser stops short of
    # the target, which would pass this for the wrong reason.
    When I open the document "kitchen-sink.md"
    And I follow the contents line "Lists"
    Then the app header is at the top of the viewport
    And the heading "Lists" is clear of the header

  # The bar is not all that pins. On a page that draws a tree, a SECTION row
  # holds its place under the bar while its branch scrolls past
  # (`client/Tree.tsx`) — ~40px of the reading here, ~58px on a phone, that is
  # not free space. A jump landing a row in that band used to leave the reader
  # looking at it through the back of the pinned heading (measured: the row
  # would stop at y=71.5px, ON the pinned `kitchen` row's span, versus ≥134px
  # after the fix). The reserve therefore accounts for whatever is actually
  # pinned: the bar alone on non-tree pages, bar + section row on tree pages
  # (`styles.css`'s `scroll-padding-top`), and the row height it accounts for
  # is the taller of the two faces the sticky line has.
  #
  # THE REVERT CHECK: with the extra reserve removed (the sole
  # `--height-pinned-section` override gone), BOTH this scenario and its phone
  # twin below turn deterministically red — the row stops at the bar's bottom
  # edge and `elementFromPoint` at its top names `/kitchen`, the pinned row
  # itself: 0/10 luck involved. The window must be short like the Outline's
  # for the same reason it gives there: a window taller than the page has
  # nothing pinned to assert against.
  @corpus:good @abp
  Scenario: A jump to a row lands below the pinned section, not behind it
    # A row deep enough in the fixture that the window still has room to put
    # past it: `install` is mid-tree, and near the end the browser would stop
    # short and pass for the wrong reason.
    When I open the outline "house.org"
    And the window is shorter than the page
    And a jump lands the row "install" at the top of the window
    Then the app header is at the top of the viewport
    And the row "install" is clear of the pinned section "kitchen"
    And there should be no page errors

  # ...and the face the first cut of the reserve actually missed: below `md`
  # the sticky line is h-11 + py-1 — 3.25rem to the laptop's ~2.2, so a
  # reserve sized off the laptop's measurement still stops 0.75rem short of
  # the phone's pinned bottom (measured on a 390px window: the pinned
  # `kitchen` row spans y=72–130.5, and a 2.5rem reserve landed the target at
  # 116.5). Same scenario, handset context; the window-shortening step keeps
  # the 390px width, which is what makes `h-11` fire and this pin mean
  # anything.
  @corpus:good @phone @abp
  Scenario: A jump to a row lands below the pinned section on a phone, not behind it
    When I open the outline "house.org"
    And the window is shorter than the page
    And a jump lands the row "install" at the top of the window
    Then the app header is at the top of the viewport
    And the row "install" is clear of the pinned section "kitchen"
    And there should be no page errors
