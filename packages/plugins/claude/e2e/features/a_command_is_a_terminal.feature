@claude @scratch:chat
Feature: A shell command is a terminal pane, named by its command
  Three facts about one row, and the adapter gets each of them to olai in its
  own way.

  The announcement arrives the moment a tool use starts — before a byte of the
  model's arguments has parsed — so it carries no input and a title derived
  from none: the bare word "Terminal". The refining frame that follows carries
  the command, and that is what the row is called.

  The output is a TERMINAL, not prose, and only because olai asks: with
  `_meta.terminal_output` on the handshake the adapter reports the bytes and
  the exit code as terminal metadata; without it, it fences the whole thing
  into a markdown block and a person reads backticks. The fake answers the
  handshake it was given, so a leg that stopped asking fails here.

  And what a command's arguments do when they are longer than the pane is
  WRAP. The fold is inside a conversation that scrolls the other way.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: The command names the row, and the placeholder never does
    When I ask the agent "bash"
    Then the chat shows a completed tool call
    And the chat shows a tool call named "echo hello"
    # The word the announcement carried is nowhere on the row — not as its
    # name, and not left behind beside the one it got.
    And the tool call says nothing of "Terminal"
    # ... and the rule is not repealed: the result frame moves the title to the
    # tool's own name, and a row that has been named does not take it.
    And the agent is idle
    And the chat shows a tool call named "echo hello"
    And the tool call says nothing of "Bash"

  Scenario: The output is a terminal pane with its exit code, not a markdown fence
    When I ask the agent "bash"
    Then the chat shows a completed tool call
    And terminal output contains "hello"
    And terminal output contains "Exit 0"
    When I unfold the tool call
    # The fence, where it would land if olai stopped asking for terminals: the
    # call's content block, drawn as what the call is saying while it runs.
    Then the tool call says nothing of "```"

  Scenario: An argument longer than the pane wraps in the fold
    When I ask the agent "bash long"
    Then the chat shows a completed tool call
    And the chat shows a tool call named "cat notes.txt"
    When I unfold the tool call
    # The description is in the FOLD and never on the row: the row is the
    # command, the fold is everything that was asked for.
    Then the tool call's detail mentions "cat notes.txt"
    And the tool call does not scroll sideways
