@scratch:chat @node-idle-fast
Feature: Node agent idle timers preserve foreground work and durable conversations
  Background:
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "install the cabinets"
    And the agent panel is open
    When I remember this conversation as "cabinet"
    And I mark the page

  Scenario: An idle background node sleeps and resumes the same transcript and subtree boundary
    When I ask the agent "before idle eviction"
    Then the agent has answered "before idle eviction" exactly once
    When I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "order the new cabinets"
    And the agent panel is open
    When I remember this conversation as "foreground"
    Then the agent "install" stands "asleep"
    And the agent "order" remains "idle" across two idle deadlines
    And the panel is in the remembered conversation "foreground"
    When I press the agent "install"
    Then the panel is in the remembered conversation "cabinet"
    And the agent has answered "before idle eviction" exactly once
    When I ask the agent "after idle eviction"
    Then the agent has answered "after idle eviction" exactly once
    When I ask the agent "done order"
    Then the agent is idle
    And the chat shows a refusal
    And node "order" is not done
    And the page has not reloaded
    And there should be no page errors

  Scenario: A background question prevents eviction and remains answerable past the idle deadline
    When I ask the agent "askstrict"
    Then the chat shows a question
    When I type "answer after idle deadlines" into the question's "note" box
    And I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "order the new cabinets"
    And the agent panel is open
    And the agent "install" remains "needs-you" across two idle deadlines
    When I press the agent "install"
    Then the panel is in the working conversation "cabinet"
    And the question's "note" box still reads "answer after idle deadlines"
    When I type "2" into the question's "howMany" box
    And I answer the question
    Then the agent is idle
    And the agent's answer mentions "answer after idle deadlines"
    When I press the agent "order"
    Then the panel header names the node agent "order the new cabinets"
    And the agent "install" stands "asleep"
    When I press the agent "install"
    Then the panel is in the remembered conversation "cabinet"
    And the agent's answer mentions "answer after idle deadlines"
    And the page has not reloaded
    And there should be no page errors

  Scenario: A background watcher prevents eviction until its completion is delivered
    When I ask the agent "watch"
    Then the agent is idle
    And the strip says "kolu fleet watch" is running
    When I open the node menu of "order"
    And I choose "Start an agent session" from the node menu
    Then the panel header names the node agent "order the new cabinets"
    And the agent panel is open
    And the agent "install" remains "idle" across two idle deadlines
    When I press the agent "install"
    Then the panel is in the remembered conversation "cabinet"
    And the strip says "kolu fleet watch" is running
    When the agent is released
    Then the chat says nothing is running in the background
    And the chat says that task ended "failed"
    When I press the agent "order"
    Then the agent "install" stands "asleep"
    When I press the agent "install"
    Then the panel is in the remembered conversation "cabinet"
    And the chat says nothing is running in the background
    And the page has not reloaded
    And there should be no page errors
