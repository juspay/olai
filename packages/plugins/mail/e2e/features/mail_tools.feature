Feature: Reading and acting on Gmail in a conversation

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Inbox lists three threads with unread state
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "list my inbox"
    Then the mail inbox story says "3 threads in INBOX"
    And the agent's answer mentions "\"unread\":true"
    And the agent's answer mentions "\"unread\":false"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Search finds the unread thread
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "search mail for is:unread"
    Then the mail search story says "1 threads for"
    And the agent's answer mentions "Q3 invoice"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: HTML-only thread preserves its body and sender
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "read mail thread a2"
    Then the mail thread story says "Nix meetup · Ravi"
    And the agent's answer mentions "<p>Meetup on October 2</p>"
    And the agent's answer mentions "\"text\":null"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Attachment is temporary and removed when mail stops
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "read mail thread a3"
    Then the mail thread story says "2 messages"
    When I ask the agent "save mail attachment a32 attachment_1"
    Then the mail attachment story says "invoice.pdf · 12 KiB"
    And the mail attachment is outside the vault under the runtime directory
    When the non-UI controller sets plugin "mail" off
    Then the saved mail attachment is gone

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Unknown thread names the connected account
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "read mail thread ffff"
    Then the mail refused story says "this thread is not in you@gmail.com"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Archive removes a thread from inbox
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "archive mail thread a1"
    Then the mail archive story says "archived"
    When I ask the agent "list my inbox"
    Then the mail inbox story says "2 threads in INBOX"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Labels resolve names and reject an unknown label
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "label mail thread a2 with nonexistent"
    Then the mail refused story says "this mailbox has no label"
    And the fake mailbox has received no modify calls
    When I ask the agent "label mail thread a2 with waiting"
    Then the mail label story says "+waiting"
    When I ask the agent "read mail thread a2"
    Then the mail thread story says "Nix meetup"
    And the agent's answer mentions "waiting"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Trash and restore change trash search results
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "trash mail thread a2"
    Then the mail trash story says "trashed"
    When I ask the agent "search mail for in:trash"
    Then the mail search story says "1 threads for"
    When I ask the agent "untrash mail thread a2"
    Then the mail untrash story says "restored from Trash"
    When I ask the agent "search mail for in:trash"
    Then the mail search story says "0 threads for"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Read marks flip unread both ways
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "mark mail thread a1 read"
    Then the mail read story says "marked read"
    When I ask the agent "search mail for is:unread"
    Then the mail search story says "0 threads for"
    When I ask the agent "mark mail thread a1 unread"
    Then the mail read story says "marked unread"
    When I ask the agent "search mail for is:unread"
    Then the mail search story says "1 threads for"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Every tool refuses without an account and spawns nothing
    Given I open the app
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "list my inbox"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 1 mail refusal stories
    When I ask the agent "search mail for is:unread"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 2 mail refusal stories
    When I ask the agent "read mail thread a1"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 3 mail refusal stories
    When I ask the agent "save mail attachment a32 attachment_1"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 4 mail refusal stories
    When I ask the agent "archive mail thread a1"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 5 mail refusal stories
    When I ask the agent "trash mail thread a1"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 6 mail refusal stories
    When I ask the agent "untrash mail thread a1"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 7 mail refusal stories
    When I ask the agent "label mail thread a1 with waiting"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 8 mail refusal stories
    When I ask the agent "mark mail thread a1 read"
    Then the mail refused story says "connect one in"
    And the agent's answer mentions "connect one in"
    And the conversation has 9 mail refusal stories
    And the fake mailbox has received no tool calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:refused @mail-doors
  Scenario: A revoked grant refuses tools with the account reason
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    When the server stops
    And the server starts again on the same port
    And I reload the page
    Then the mail pill reads fault
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "list my inbox"
    Then the mail refused story says "invalid_grant"
    And the fake mailbox has received no tool calls
