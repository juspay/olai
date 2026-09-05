Feature: Application completions wait until IME candidate selection has finished
  @scratch:chat
  Scenario: Confirming a composed file query does not choose the offered path
    Given I rewrite "日本語.md" as:
      """
      # A file to discuss
      """
    And I open the app
    And the agent panel is open
    When I type "read @" into the chat
    And I start composing the IME text "日本" in the focused field
    Then the completion offers "日本語.md"
    When I confirm the IME text "日本" in the focused field
    Then the chat input reads "read @日本"
    And the completion offers "日本語.md"
    When I accept the completion
    Then the chat input reads "read @日本語.md "
    When I send the chat message
    Then the agent's answer mentions "you said: read @日本語.md"
    And there should be no page errors

  @scratch:good
  Scenario: Confirming a composed tag prefix does not accept the longer suggestion
    Given I rewrite "tag-source.olai" as:
      """
      {"id":"tag-source","ord":"a0","title":"source #nihongo"}
      """
    And I open the outline "house.olai"
    When I click the title of "handles"
    And I type " #"
    And I start composing the IME text "nihon" in the focused field
    Then the completions list "#nihongo"
    When I confirm the IME text "nihon" in the focused field
    Then the row being typed holds "choose the handles #nihon"
    And the completions list "#nihongo"
    When I press "Enter"
    And I click away from the editor
    Then "house.olai" holds a node titled "choose the handles #nihongo"
    And there should be no page errors
