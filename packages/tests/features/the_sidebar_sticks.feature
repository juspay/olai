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
  what is left of the viewport. The representative below is that pin at the
  bottom of each page kind, with the file tree and the collapse affordance
  still on screen.

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
      | outline  | house.olai      |
      | node     | kitchen         |
      | document | kitchen-sink.md |
