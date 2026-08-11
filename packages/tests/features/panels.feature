Feature: Toggleable & resizable panels
  Every panel has exactly two states — open, or minimized-with-signal. The
  reader owns the widths. Nothing closes to nowhere.

  Desktop: the sidebar collapses to an icon rail and drag-resizes when open;
  the chat dock drag-resizes; minimized chat is a bottom-right pill with the
  last agent message. ⌘K opens the palette shell; ⌘\ and ⌘J toggle the panels.

  Mobile: the directory is a slide-over drawer with scrim under the header;
  chat is a bottom sheet with half/full snap points, collapsed to a strip
  above the thumb.

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
  Scenario: Dragging the sidebar handle changes its width
    Given I open the outline "house.jsonl"
    When I drag the sidebar wider by 40px
    Then the sidebar is at least 40px wider than the default
    When I reload the page
    Then the sidebar width survived the reload

  @scratch:chat
  Scenario: The pill pulses while a turn runs
    Given I open the app
    And the agent panel is open
    When I ask the agent "slow"
    Then the agent is working
    When I minimize the agent panel
    Then the chat pill is showing
    And the chat pill is busy
    When the agent is released
    And I wait for the agent to go idle

  @scratch:chat
  Scenario: The pill carries the last agent message after a turn
    # The open panel samples the last agent row into a module snapshot; the
    # pill never subscribes the transcript. So the message is remembered from
    # the turn that ran while open, then shown after minimize.
    Given I open the app
    And the agent panel is open
    When I ask the agent "done order"
    Then the agent's answer mentions "marked"
    When I minimize the agent panel
    Then the chat pill is showing
    And the chat pill shows the last agent message

  @scratch:chat
  Scenario: The palette > prefix sends to the agent
    Given I open the app
    And the agent panel is open
    When I minimize the agent panel
    And I press the palette shortcut
    And I ask the palette "> what is a garden"
    Then the agent panel is showing
    And the chat eventually shows "you said: what is a garden"

  @no-agent @scratch:chat
  Scenario: A palette > ask that fails is shown, not swallowed
    Given I open the app
    When I press the palette shortcut
    And I ask the palette "> please do the thing"
    Then the palette shows an ask error
    And the command palette is open

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
  Scenario: On a phone the directory is a fixed drawer under the header
    Given I open the outline "house.jsonl"
    Then the sidebar is put away
    When I tap the burger
    Then the directory drawer is open with a scrim
    And the header chrome stays tappable over the drawer
    When I tap the directory scrim
    Then the sidebar is put away

  @scratch:chat @phone
  Scenario: On a phone chat is a bottom sheet under the header
    Given I open the app
    Then the chat strip is showing
    When I tap the agent toggle
    Then the agent panel is showing
    And the chat sheet sits under the header
    And the chat sheet is at snap "half"
    When I drag the chat sheet handle up
    Then the chat sheet is at snap "full"
    When I tap the header agent toggle
    Then the agent panel is minimized
    And the chat strip is showing
