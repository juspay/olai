@phone
Feature: the agent panel on a phone

  A phone has no room for two columns, so below phone-max the panel stops
  being a side panel and becomes a sheet over the outline (web/chat-panel,
  sheet mode). These are the desktop panel's geometry scenarios read the
  other way round — the outline gives up no gutter, because it is covered —
  plus the two things a finger and an on-screen keyboard need.

  Every scenario here runs on a 390x844 screen, which the tag above the
  feature is what asks for (support/world.js, PHONE_VIEWPORT).

  Scenario: the panel is a sheet over the outline, not a column beside it
    When I open the home page
    And I press the agent toggle
    Then the chat panel is open
    And the chat panel is as wide as the screen
    And the outline reserves no gutter for the chat panel

  # The floating toggle is under the open sheet, so the header's × is the ONLY
  # way out of it — and it was a 25x20 box around an 11px glyph. The input's
  # type is the other number: iOS Safari zooms the page in on a focused input
  # smaller than 16px and does not zoom back out.
  Scenario: everything you have to hit is a target for a finger
    When I open the home page
    And I press the agent toggle
    Then every chat control is at least 44 pixels tall
    And the chat input is at least 16 pixels of type

  # The report this feature comes from. The panel is position:fixed, so it is
  # placed against the LAYOUT viewport — and an on-screen keyboard covers the
  # bottom of that without shrinking it, which put the input row 354px below
  # the last visible pixel on an iPhone 14. You typed into a box you could not
  # see.
  Scenario: the keyboard does not take the input row down with it
    When I open the home page
    And I press the agent toggle
    And the on-screen keyboard covers the bottom of the screen
    Then the chat input is on screen
    And the chat panel stops above the keyboard
