@scratch:chat
Feature: Node agents recover their durable sessions after capacity eviction
  Scenario: Opening a ninth node lets an older idle node sleep and reopening resumes its session
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
    And I ask the agent "message for task 1"
    Then the agent has answered "message for task 1" exactly once
    When I remember this conversation as "first"
    When I open the node menu of "task-2"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 2"
    Then the agent has answered "message for task 2" exactly once
    When I open the node menu of "task-3"
    Then the node menu stays below the app header
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 3"
    Then the agent has answered "message for task 3" exactly once
    When I open the node menu of "task-4"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 4"
    Then the agent has answered "message for task 4" exactly once
    When I open the node menu of "task-5"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 5"
    Then the agent has answered "message for task 5" exactly once
    When I open the node menu of "task-6"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 6"
    Then the agent has answered "message for task 6" exactly once
    When I open the node menu of "task-7"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 7"
    Then the agent has answered "message for task 7" exactly once
    When I open the node menu of "task-8"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 8"
    Then the agent has answered "message for task 8" exactly once
    When I open the node menu of "task-9"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    And I ask the agent "message for task 9"
    Then the agent has answered "message for task 9" exactly once
    And the agent "task-1" stands "asleep"
    And the agent "task-9" stands "idle"
    When I press the agent "task-1"
    Then the panel is in the remembered conversation "first"
    And the panel header names the node agent "capacity task 1"
    And the agent has answered "message for task 1" exactly once
    And the agent "task-2" stands "asleep"
    When I ask the agent "continue after eviction"
    Then the agent has answered "continue after eviction" exactly once
    And the agent has answered "message for task 1" exactly once
    And there should be no page errors
