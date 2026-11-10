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
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 1"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-1" stands "needs-you"
    When I open the node menu of "task-2"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 2"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-2" stands "needs-you"
    When I open the node menu of "task-3"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 3"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-3" stands "needs-you"
    When I open the node menu of "task-4"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 4"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-4" stands "needs-you"
    When I open the node menu of "task-5"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 5"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-5" stands "needs-you"
    When I open the node menu of "task-6"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 6"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-6" stands "needs-you"
    When I open the node menu of "task-7"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 7"
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-7" stands "needs-you"
    When I open the node menu of "task-8"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 8"
    And the node agent's fold is ready
    And I remember this conversation as "eighth"
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-8" stands "needs-you"
    And I open the node menu of "task-9"
    And I choose "Start an agent" from the node menu
    Then the node menu of "task-9" says "All 8 agents are awake — put one to sleep in Chats."
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
    When I close the agent fold
    And I open the outline "yard.olai"
    And I open the outline "capacity.olai"
    When I press the agent "task-8" in its outline
    And I open the node menu of "task-9"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 9"
    And the node agent's fold is ready
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

  Scenario: A ninth chat waits for a seat and opens itself when one is freed from the sidebar
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
    # THE NINTH CHAT IS A REAL ONE, started while there was still room and then
    # left alone: when the eighth agent starts, the pool takes the oldest quiet
    # seat, which is this one.
    When I open the node menu of "task-9"
    And I choose "Start an agent" from the node menu
    Then the panel header names the node agent "capacity task 9"
    And the node agent's fold is ready
    And I ask the agent "message for task 9"
    Then the agent has answered "message for task 9" exactly once
    When I remember this conversation as "ninth"
    And I close the agent fold
    And I open the outline "yard.olai"
    And I open the outline "capacity.olai"
    # ...AND THEN EIGHT AGENTS THAT ARE ALL WAITING ON AN ANSWER. Not one of
    # them may be reaped, so nothing frees a seat on its own from here.
    When I open the node menu of "task-1"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I open the node menu of "task-2"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I open the node menu of "task-3"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I open the node menu of "task-4"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I open the node menu of "task-5"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I open the node menu of "task-6"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I open the node menu of "task-7"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    When I open the node menu of "task-8"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "askstrict"
    Then the chat shows a question
    And the agent "task-9" stands "asleep"
    # A PERSON OPENS THE SLEEPING CHAT and is told the one thing that is true
    # about it. No alarm, because nothing is wrong with this chat, and nothing
    # to press, because the server is holding the attempt.
    When I press the agent "task-9"
    Then the panel is waiting for a seat, saying "All 8 agents are awake — put one to sleep in Chats."
    # ...AND THE WAY OUT IS THE COLUMN THE SENTENCE NAMES. Nothing is pressed
    # in the panel afterwards: a seat frees, and the chat opens itself.
    When I open the Chats menu of "task-1"
    And I choose "Put to sleep" from the Chats menu
    Then the agent "task-1" stands "asleep"
    And the panel is in the remembered conversation "ninth"
    And the agent has answered "message for task 9" exactly once
    When I ask the agent "the ninth chat carried on"
    Then the agent has answered "the ninth chat carried on" exactly once
    And there should be no page errors
