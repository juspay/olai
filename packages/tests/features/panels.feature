Feature: Toggleable & resizable panels
  Every panel has exactly two states — open, or minimized-with-signal. The
  reader owns the widths. Nothing closes to nowhere.

  Desktop: the sidebar collapses to an icon rail and drag-resizes when open;
  the chat dock drag-resizes; minimized chat is a bottom-right pill with the
  last agent message. ⌘K opens the palette shell; ⌘\ and ⌘J toggle the panels.

  Mobile: the directory is a slide-over drawer with scrim; chat is a bottom
  sheet with half/full snap points, collapsed to a strip above the thumb.

  @corpus:good
  Scenario: Collapsing the sidebar leaves an icon rail
    Given I open the outline "house.jsonl"
    Then the sidebar is open on desktop
    When I collapse the sidebar
    Then the sidebar rail is showing
    And the outline "house.jsonl" is still on screen
    When I expand the sidebar from the rail
    Then the sidebar is open on desktop

  @corpus:good
  Scenario: The sidebar and chat docks expose resize handles
    Given I open the outline "house.jsonl"
    And the agent panel is open
    Then the sidebar has a resize handle
    And the agent panel has a resize handle

  @scratch:chat
  Scenario: Minimizing chat leaves a pill, not nothing
    Given I open the app
    And the agent panel is open
    When I minimize the agent panel
    Then the agent panel is minimized
    And the chat pill is showing
    When I open the agent from the pill
    Then the agent panel is showing

  @corpus:good
  Scenario: The command palette opens from the keyboard
    Given I open the outline "house.jsonl"
    When I press the palette shortcut
    Then the command palette is open
    When I pick the palette item "Toggle sidebar"
    Then the sidebar rail is showing

  @corpus:good
  Scenario: Keyboard toggles the sidebar and the chat
    Given I open the outline "house.jsonl"
    When I press the sidebar shortcut
    Then the sidebar rail is showing
    When I press the sidebar shortcut
    Then the sidebar is open on desktop
    When I press the chat shortcut
    Then the agent panel is showing
    When I press the chat shortcut
    Then the agent panel is minimized

  @corpus:good @phone
  Scenario: On a phone the directory is a drawer with a scrim
    Given I open the outline "house.jsonl"
    Then the sidebar is put away
    When I tap the burger
    Then the directory drawer is open with a scrim
    When I tap the directory scrim
    Then the sidebar is put away

  @scratch:chat @phone
  Scenario: On a phone chat is a bottom sheet over a strip
    Given I open the app
    Then the chat strip is showing
    When I tap the agent toggle
    Then the agent panel is showing
    And the chat sheet is at snap "half"
    When I tap the chat sheet handle
    Then the chat sheet is at snap "full"
    When I tap the chat sheet scrim
    Then the agent panel is minimized
    And the chat strip is showing
