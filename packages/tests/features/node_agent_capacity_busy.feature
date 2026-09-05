@scratch:chat
Feature: A full pool of busy node agents refuses new work visibly
  Scenario: Capacity refusal keeps all pending questions intact and can be retried after one agent settles
    Given the harness keeps distinct sessions on disk
    And I rewrite "capacity.olai" as:
      """
      {"id":"task-1","ord":"a0","title":"capacity task 1"}
      {"id":"task-2","ord":"a1","title":"capacity task 2"}
      {"id":"task-3","ord":"a2","title":"capacity task 3"}
      {"id":"task-4","ord":"a3","title":"capacity task 4"}
      {"id":"task-5","ord":"a4","title":"capacity task 5"}
      {"id":"task-6","ord":"a5","title":"capacity task 6"}
      {"id":"task-7","ord":"a6","title":"capacity task 7"}
      {"id":"task-8","ord":"a7","title":"capacity task 8"}
      {"id":"task-9","ord":"a8","title":"capacity task 9"}
      """
    And I open the outline "capacity.olai"
    When I open the node menu of "task-1"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-1" stands "needs-you"
    When I open the node menu of "task-2"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-2" stands "needs-you"
    When I open the node menu of "task-3"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-3" stands "needs-you"
    When I open the node menu of "task-4"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-4" stands "needs-you"
    When I open the node menu of "task-5"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-5" stands "needs-you"
    When I open the node menu of "task-6"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-6" stands "needs-you"
    When I open the node menu of "task-7"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-7" stands "needs-you"
    When I open the node menu of "task-8"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I remember this conversation as "eighth"
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-8" stands "needs-you"
    And I open the node menu of "task-9"
    And I choose "Start an agent session" from the node menu
    Then the node menu of "task-9" says "8 node agents are already live; let one become idle before waking another"
    And the panel is in the working conversation "eighth"
    And the agent "task-1" stands "needs-you"
    And the agent "task-2" stands "needs-you"
    And the agent "task-3" stands "needs-you"
    And the agent "task-4" stands "needs-you"
    And the agent "task-5" stands "needs-you"
    And the agent "task-6" stands "needs-you"
    And the agent "task-7" stands "needs-you"
    And the agent "task-8" stands "needs-you"
    When I press the agent "task-1"
    And I type "settle the first task" into the question's "note" box
    And I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "settle the first task"
    When I press the agent "task-8"
    And I open the node menu of "task-9"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "ninth task after capacity recovered"
    Then the agent has answered "ninth task after capacity recovered" exactly once
    And the agent "task-1" stands "asleep"
    When I press the agent "task-8"
    Then the panel is in the working conversation "eighth"
    And the chat shows a question
    When I type "eighth question survived" into the question's "note" box
    And I type "3" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "eighth question survived"
    And there should be no page errors
