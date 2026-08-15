Feature: The directory column sticks too
  The sidebar is the DIRECTORY — the agenda, the month and the file tree — and
  it is the other half of the chrome the header carries. Both are permanent
  answers rather than parts of the page: where you are in the corpus, what is
  owed, and what else there is to open.

  This app scrolls the DOCUMENT, so a column in normal flow is as tall as the
  page and leaves the screen with it. Once the header started sticking (#115)
  that was the last piece of chrome still going, and it was visible in that PR's
  own evidence as an empty directory column beside a scrolled page — flagged
  there as deliberately out of scope, filed as its own bug, and answered by the
  human with: pin it.

  So on desktop the column is pinned under the header and exactly as tall as
  what is left of the viewport, and a directory taller than that scrolls WITHIN
  the column. Both halves are asserted, because they are two different claims
  and the second is the one that makes the first worth having: a pinned column
  whose overflow still belongs to the page has moved the problem rather than
  solved it. The COLLAPSED face is asserted on the same terms — the rail is the
  directory's other face, and its first button is the way back to the column,
  which is not chrome if a reader has to scroll up to reach it.

  What must not change is the rest of it: #105's collapse (the same control, the
  same corner), ⌘\, and the phone, where the directory is a fixed drawer with a
  scrim and always was. The phone scenario here is a FENCE rather than a
  diagnostic — it passes on the pre-change client too, and it is here so that a
  pin leaking below 48rem fails in the feature about the pin.

  The window is made short rather than the fixtures long, for the reason
  `zoom_and_navigate.feature` gives at the step all three features share.

  @corpus:good
  Scenario Outline: The directory is still on screen at the bottom of a <kind>
    Given the window is shorter than the page
    And I open the <kind> "<name>"
    When I scroll to the bottom of the page
    Then the app header is at the top of the viewport
    And the directory column is pinned under the header
    And the file tree is still on screen
    And the collapse affordance is on screen
    And there should be no page errors

    Examples:
      | kind     | name            |
      | outline  | house.olai     |
      | node     | kitchen         |
      | document | kitchen-sink.md |

  # The half that makes the pin worth having. At the bottom of the page, where
  # up is the one direction the page could still move in.
  @corpus:good
  Scenario: A directory taller than the strip scrolls inside the column
    Given the window is shorter than the page
    And I open the outline "house.olai"
    When I scroll to the bottom of the page
    Then the directory takes the wheel, and the page stays where it is
    And the directory column is pinned under the header
    And there should be no page errors

  # The collapsed face. The rail's first button is the way back to the column,
  # and it is the only one — a rail that scrolled away puts the reader in a
  # directory-less page with no affordance in reach.
  @corpus:good
  Scenario: The icon rail is still on screen at the bottom of a page
    Given the window is shorter than the page
    And I open the outline "house.olai"
    And the sidebar is open on desktop
    When I collapse the sidebar
    And I scroll to the bottom of the page
    Then the directory rail is pinned under the header
    And the way back to the directory takes the pointer
    When I expand the sidebar from the rail
    Then the sidebar is open on desktop
    And the directory column is pinned under the header
    And there should be no page errors

  # #105's keyboard toggle, exercised from where the column's geometry is now
  # decided rather than at the top of a page where it cannot fail.
  @corpus:good
  Scenario: The sidebar shortcut still toggles from the bottom of a page
    Given the window is shorter than the page
    And I open the outline "house.olai"
    When I scroll to the bottom of the page
    And I press the sidebar shortcut
    Then the sidebar rail is showing
    And the directory rail is pinned under the header
    When I press the sidebar shortcut
    Then the sidebar is open on desktop
    And the directory column is pinned under the header
    And there should be no page errors

  # The phone is untouched: the directory is not a column here at all, pinned or
  # otherwise — it is a FIXED drawer that is away until the burger is tapped and
  # away again after the scrim. Asked from the bottom of a scrolled page, which
  # is the one place a desktop pin leaking down here would show.
  @corpus:good @phone
  Scenario: On a phone the directory is still a drawer that opens and shuts
    Given the window is shorter than the page
    And I open the outline "house.olai"
    Then the sidebar is put away
    When I scroll to the bottom of the page
    And I tap the burger
    Then the directory drawer is open with a scrim
    And the header chrome stays tappable over the drawer
    When I tap the directory scrim
    Then the sidebar is put away
    And there should be no page errors
