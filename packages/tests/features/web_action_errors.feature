@scratch:chat
Feature: Web action errors stay with the web action
  A refused menu action must explain itself beside the node without adding
  an ACP transcript refusal. Agent tool refusals still belong in chat.
  These scenarios drive the real menu, WebSocket, write gate and chat plugin;
  only the ACP subprocess is scripted, as in the other chat scenarios.

  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "hello"
    Then the agent's answer mentions "you said: hello"
    And the chat shows no refusal

  Scenario: Trashing into a broken Trash file reports locally without leaking to chat
    When I rewrite "_olai/Trash.olai" as:
      """
      not JSON
      """
    Then the stale banner names "_olai/Trash.olai" as "unparsed"
    When I open the node menu of "install"
    And I choose "Move to Trash" from the node menu
    And I choose "Move to Trash" from the node menu
    Then the node menu of "install" says "`_olai/Trash.olai` has lines that do not parse, so its records are not loaded — writing it would drop that. Fix the file first."
    And "house.olai" holds the node "install"
    # A subsequent round trip through this same chat lets its prior events
    # render before the absence check, instead of racing the refusal frame.
    When I ask the agent "after trash"
    Then the agent's answer mentions "you said: after trash"
    And the chat shows no refusal

  Scenario: A refused status change reports locally without leaking to chat
    When I open the node menu of "demo"
    And I choose "Mark doing" from the node menu
    Then the node menu of "demo" says "`take out the old counters` is done. Undo that first — nothing should decide on your behalf that finished work is not finished."
    And the node "demo" has status "done"
    When I ask the agent "after status"
    Then the agent's answer mentions "you said: after status"
    And the chat shows no refusal

  Scenario: An agent tool refusal still appears in chat
    When I ask the agent "done nowhere"
    Then the chat shows a refusal
