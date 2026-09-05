@scratch:lanes @agent-stored
Feature: Retrying a refused session belongs to the node shown by that tab
  Scenario: An outdated try-again button cannot reopen another node's refused session
    Given incoming updates to this browser tab can be held
    And I rewrite "lanes.olai" as:
      """
      {"id":"install","ord":"a0","title":"install the cabinets","doing":true,"custom":{"agent-session":"claude:install-session"}}
      {"id":"order","ord":"a1","title":"order the cabinets","doing":true,"custom":{"agent-session":"claude:order-session"}}
      """
    And I open the outline "lanes.olai"
    And the agent panel is open
    When the agent refuses to load a conversation
    And I press the agent "install"
    Then the panel says the conversation could not be opened
    When I hold incoming updates to the original browser tab
    And I open another browser tab
    And I open the outline "lanes.olai"
    And I press the agent "order"
    Then the panel says the conversation could not be opened
    When the agent will load a conversation again
    And I use the original browser tab
    And I try to open it again
    And I release incoming updates to the original browser tab
    Then the chat says the click was refused, with "the conversation changed"
    And the panel says the conversation could not be opened
    When I try to open it again
    Then the agent is idle
    And the panel header names the node agent "order the cabinets"
    When I press the agent "install"
    Then the panel says the conversation could not be opened
    When I try to open it again
    Then the agent is idle
    And the panel header names the node agent "install the cabinets"
    And there should be no page errors
