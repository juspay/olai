@scratch:chat
Feature: Chat references share the app link vocabulary
  Background:
    Given I open the outline "house.olai"
    And I show the done nodes
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I drop row "order" into the conversation
    And I ask the agent "context"
    Then the agent's answer says "order is the node titled order the new cabinets"

  Scenario Outline: Native reference anchors work with every in-app gesture
    When I activate the unified "<surface>" link with "<gesture>"
    Then the unified destination row "order" is selected in pane <pane>
    And there should be no page errors

    Examples:
      | surface | gesture | pane |
      | chat-code | click | 0 |
      | chat-code | Enter | 0 |
      | chat-code | Alt | 1 |
      | chat-code | Alt-Shift | 1 |
      | chat-reference | click | 0 |
      | chat-reference | Enter | 0 |
      | chat-reference | Alt | 1 |
      | chat-reference | Alt-Shift | 1 |

  Scenario Outline: Chat references retain browser modifiers, previews and menus
    Then the unified "<surface>" link leaves "Ctrl" to the browser
    And the unified "<surface>" link leaves "Meta" to the browser
    And the unified "<surface>" link leaves "middle" to the browser
    And the unified "<surface>" link previews "order the new cabinets"
    When I open the unified "<surface>" link menu
    Then the unified link menu offers Open in new tab

    Examples:
      | surface |
      | chat-code |
      | chat-reference |

  Scenario Outline: Written node links use the same reveal destination
    When I ask the agent "links"
    Then the agent's answer mentions "the order row"
    When I activate the unified "chat-written" link with "<gesture>"
    Then the unified destination row "order" is selected in pane <pane>
    And there should be no page errors

    Examples:
      | gesture | pane |
      | click | 0 |
      | Enter | 0 |
      | Alt | 1 |
      | Alt-Shift | 1 |

  Scenario Outline: The agent roster row is a reveal link
    When I activate the unified "roster" link with "<gesture>"
    Then the unified destination row "kitchen" is selected in pane <pane>
    And there should be no page errors

    Examples:
      | gesture | pane |
      | click | 0 |
      | Enter | 0 |
      | Alt | 1 |
      | Alt-Shift | 1 |

  Scenario: Written transcript links retain browser gestures, preview and the tab menu
    When I ask the agent "links"
    Then the agent's answer mentions "the order row"
    And the unified "chat-written" link leaves "Ctrl" to the browser
    And the unified "chat-written" link leaves "Meta" to the browser
    And the unified "chat-written" link leaves "middle" to the browser
    And the unified "chat-written" link previews "order the new cabinets"
    When I open the unified "chat-written" link menu
    Then the unified link menu offers Open in new tab

  Scenario: Roster anchors retain browser gestures, preview and the tab menu
    Then the unified "roster" link leaves "Ctrl" to the browser
    And the unified "roster" link leaves "Meta" to the browser
    And the unified "roster" link leaves "middle" to the browser
    And the unified "roster" link previews "kitchen"
    When I open the unified "roster" link menu
    Then the unified link menu offers Open in new tab

  Scenario Outline: Chat local fragments stay outside navigation and tab menus
    When I ask the agent "fragments"
    Then the agent's answer mentions "Local footnote"
    And the local "<kind>" fragment stays in its content
    Examples:
      | kind |
      | chat |
      | chat-footnote |

  Scenario: Ctrl-clicking the roster does not visit and unfold its conversation
    When I close the agent fold
    Then the unified "roster" link leaves "Ctrl" to the browser
    And the roster has not unfolded the conversation
