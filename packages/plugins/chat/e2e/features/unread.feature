@scratch:chat
Feature: The conversations you have not read yet
  An agent that answers while nobody is looking at its conversation goes on
  saying so: its row in the sidebar is drawn bold and marked, and a tab holding
  that conversation wears a quieter dot than the one for a question. Looking at
  it takes both away — in every tab at once, and across a reload — and a turn
  that finishes in front of you is read as it lands.

  Nothing rings for either. A turn merely FINISHING is silent on purpose, and
  the mark is bookkeeping about a person's attention rather than a request, so
  no chime, no system notification and no icon mark come of one.

  What "looking at it" means is chat's own answer, shared with the alerts: the
  conversation is the page in FRONT of this window, in a document the browser is
  showing. A folded conversation, a tab behind another tab and a window behind
  an editor are all the same thing here.

  Background:
    Given I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And the notification worker is ready

  @scratch:chat @alerts @wire
  Scenario: An answer that arrives behind a closed fold is unread, and opening it reads it
    # NOTHING RINGS FOR AN UNREAD MARK, which is the half of this feature that
    # is a ruling rather than a design: the chime and the notification are the
    # question's, and a finished turn has never had one.
    When I ask the agent "hold"
    And I mark the wire
    And I close the agent fold
    And the agent is released
    Then the Chats row "kitchen" is unread
    And the Chats row "kitchen" says it is unread
    And the Chats row "kitchen" wears no dot
    And the tab has not marked the conversation as read
    And no chime rang
    And no notification has been raised
    # ...AND OPENING IT IS THE WHOLE OF READING IT. The tab's own call is what
    # says so, and the row clearing behind it is that round trip landing.
    When I mark the wire
    And I unfold node agent "kitchen"
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread

  @scratch:chat @alerts @wire
  Scenario: A tab holding that conversation wears the quieter dot while you are elsewhere
    # THE DOT IS FOR THE TAB THAT HAS IT AND IS NOT BEING LOOKED AT. The fold
    # stays UNFOLDED, so this page is the conversation's page by chat's own
    # predicate — and the tab in front is another file's, so nobody is looking.
    When I ask the agent "hold"
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And I press tab 1
    And I mark the wire
    And the agent is released
    Then the Chats row "kitchen" is unread
    And tab 0 wears the unread dot
    And the tab has not marked the conversation as read
    # COMING BACK TO IT IS WHAT READS IT, and it reads it where the mark is: the
    # row and the dot both go, in this tab and in every other one.
    When I mark the wire
    And I press tab 0
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    And tab 0 wears no dot

  @scratch:chat @alerts @wire
  Scenario: Another tab reading the conversation reads it for this one
    # THREE TABS IS WHAT MAKES THIS A CLAIM ABOUT A TAB THAT IS NOT FRONT: the
    # node's own page (the other page a conversation is drawn on) and a file's
    # page are opened behind, and the FILE is brought forward — so the tab that
    # holds the conversation is behind another one, and the read comes from a tab
    # whose page has no dot of its own to lose.
    When I ask the agent "hold"
    And I open node "kitchen" in another tab
    And I choose "Open in new tab" from the menu of the outline link "yard.olai"
    And there are 3 tabs
    And I press tab 1
    And I mark the wire
    And the agent is released
    Then the Chats row "kitchen" is unread
    And tab 0 wears the unread dot
    And the tab has not marked the conversation as read
    # AND THE THIRD TAB READS IT FOR THE FIRST, which the first one's own dot is
    # what says: nobody is looking, the mark is up, and the acknowledgement comes
    # from a tab that has the same conversation on screen instead.
    When I mark the wire
    And I press tab 2
    Then the node page conversation is ready for "kitchen"
    And the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    And tab 0 wears no dot

  @scratch:chat @alerts @wire
  Scenario: What you have read stays read after a reload
    # THE RELOAD IS THE ASSERTION, and it is why this is not the scenario above:
    # after it there is no fold, so no tab is looking — a row that came back
    # unread would be a record kept in the tab that did the looking rather than
    # one the serve holds for every tab of this olai.
    When I ask the agent "hold"
    And I close the agent fold
    And the agent is released
    Then the Chats row "kitchen" is unread
    When I mark the wire
    And I unfold node agent "kitchen"
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    When I reload the page
    Then the Chats row "kitchen" is not unread

  @scratch:chat @alerts @wire
  Scenario: What you have NOT read is still unread after a reload
    # THE OTHER DIRECTION, and the one that pins where the record sits: a boot
    # that read the mark off the wrong pair, or acknowledged anything without a
    # conversation on screen, would come back with this row cleared. The wire is
    # counted ACROSS the reload (`@wire` records per socket, and a reload opens
    # another), so an acknowledgement on boot is a failure here rather than
    # something nobody looked for.
    When I ask the agent "hold"
    And I close the agent fold
    And the agent is released
    Then the Chats row "kitchen" is unread
    When I mark the wire
    And I reload the page
    Then the Chats row "kitchen" is unread
    And the tab has not marked the conversation as read

  @scratch:chat @alerts @wire
  Scenario: An answer that arrives in front of you is read as it lands
    # THE FOREGROUND CASE, and no mark survives it: the table is where the agent
    # answers, so the conversation is on screen, so the tab acknowledges the line
    # the moment the roster says there is one to read.
    When I mark the wire
    And I ask the agent "hold"
    And the agent is released
    And the agent's answer says "and done"
    Then the tab has marked the conversation as read
    And the Chats row "kitchen" is not unread
    And no chime rang
    And no notification has been raised
