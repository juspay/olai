Feature: Confirming composed text does not invoke application shortcuts
  @scratch:chat
  Scenario: Confirming a chat word leaves it unsent until a later Enter
    Given I open the app
    And the agent panel is open
    When I type "discuss " into the chat
    And I confirm the IME text "日本語" in the focused field
    Then the chat input reads "discuss 日本語"
    When I press "Enter" in the chat
    Then the agent's answer mentions "you said: discuss 日本語"
    And there should be no page errors

  @scratch:good
  Scenario: Confirming a title word does not split the row
    Given I rewrite "ime.olai" as:
      """
      {"id":"ime-title","ord":"a0","title":"Original title"}
      """
    And I open the outline "ime.olai"
    When I click the title of "ime-title"
    And I select all and type ""
    And I confirm the IME text "日本語" in the focused field
    Then the row being typed holds "日本語"
    When I type " title"
    And I click away from the editor
    Then "ime.olai" holds a node titled "日本語 title"
    And the node "ime-title" has the title "日本語 title"
    And the outline "ime.olai" shows exactly the nodes "ime-title"
    And there should be no page errors

  @scratch:good
  Scenario Outline: Confirming a new <kind> filename leaves creation pending
    Given I open the outline "house.olai"
    When I open the new <kind> box
    And I confirm the IME text "日本語" in the focused field
    Then the new <kind> box still holds "日本語"
    And the file "日本語.<suffix>" has not been created
    When I press "Enter"
    Then the file "日本語.<suffix>" has been created
    And the address is "/%E6%97%A5%E6%9C%AC%E8%AA%9E.<suffix>"
    And there should be no page errors

    Examples:
      | kind     | suffix |
      | outline  | olai   |
      | document | md     |

  @scratch:good
  Scenario: Confirming a capture word leaves the palette open until submission
    Given I open the outline "house.olai"
    When I press the palette shortcut
    And I type "+ " into the palette
    And I confirm the IME text "日本語" in the focused field
    Then the palette box holds "+ 日本語"
    When I press "Enter"
    Then "_olai/Inbox.olai" holds a node titled "日本語"
    And there should be no page errors
