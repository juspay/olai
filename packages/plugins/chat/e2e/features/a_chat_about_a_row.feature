@scratch:chat
Feature: A chat row titled with a row's address is that row's chat
  `/#order` is an address like any other, so a chat row titled with it is the
  chat OF the row `order`: that row wears the mark, the fold under it holds the
  conversation, and the row's own page draws it. Nothing moves on disk — the
  conversation is still the node agent for the chat row it was filed as, and
  its memory goes under that row rather than under `order`.

  Scenario: The row's mark, fold and page are the stand-in's conversation, and its memory stays on the chat row
    Given I open the outline "house.olai"
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "/#order"
    And I send the new chat draft
    Then the chat child under "chats" in "_olai/Inbox.olai" is titled "/#order"
    And the conversation says it is about "/#order"
    And the conversation is the node agent for "new-chat" in "_olai/Inbox.olai"
    When I open the outline "house.olai"
    And I unfold the chat on row "order"
    Then the fold on row "order" is the conversation "new-chat"
    When I ask the agent "from the row's fold"
    Then the agent's answer mentions "you said: from the row's fold"
    # ... and the same conversation on the row's own page.
    When I open the address "/zoom/#order"
    Then the node page conversation is ready for "order"
    And the conversation is the node agent for "new-chat" in "_olai/Inbox.olai"
    And the agent's answer mentions "you said: from the row's fold"
    # THE MEMORY IS THE CHAT ROW'S: `order` has no conversation filed under it,
    # and the Inbox holds the one that was made.
    And node "order" has no chat children
    And the Inbox has 1 filed conversations
    # ... and the sidebar calls it by the row it stands for.
    And the Chats row "new-chat" reads "order the new cabinets" with a place mark
    And there should be no page errors
