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
    When I open the plugins panel
    And I switch the plugin "mail" off
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
    When I ask the agent "draft mail to ravi@example.com subject Hello saying Hello"
    Then the mail refused story says "connect one in"
    And the conversation has 10 mail refusal stories
    And the agent's answer mentions "connect one in"
    When I ask the agent "update mail draft draft_1 saying Hello again"
    Then the mail refused story says "connect one in"
    And the conversation has 11 mail refusal stories
    And the agent's answer mentions "connect one in"
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
    When I ask the agent "draft mail to ravi@example.com subject Hello saying Hello"
    Then the conversation has 2 mail refusal stories
    And the agent's answer mentions "invalid_grant"
    And the fake mailbox has received no tool calls

  @scratch:mail @rows-on:mail @mail-himalaya:stale @mail-google:granted @mail-doors
  Scenario: Deleted and unlisted label ids remain readable
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
    And the agent's answer mentions "Label_deleted"
    When I ask the agent "search mail for is:unread"
    Then the mail search story says "1 threads for"
    And the agent's answer mentions "SYSTEM_UNKNOWN"
    When I ask the agent "read mail thread a1"
    Then the mail thread story says "Q3 invoice"
    And the agent's answer mentions "Label_deleted"

  @scratch:mail @rows-on:mail @mail-himalaya:stale @mail-google:granted @mail-doors
  Scenario: A vanished attachment names the attachment in its refusal
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
    Then the mail refused story says "this attachment is not on that message"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: New draft preserves Unicode and is fully replaced
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft mail to ravi@example.com subject Café meetup saying Count me in"
    Then the mail draft story says "draft to ravi@example.com · Café meetup"
    And the saved mail draft "draft_1" has header "From" equal to "you@gmail.com"
    And the saved mail draft "draft_1" has header "To" equal to "ravi@example.com"
    And the saved mail draft "draft_1" has header "Subject" equal to "Café meetup"
    And the saved mail draft "draft_1" has body "Count me in"
    And the mail draft "draft_1" was passed as a message file after the separator
    And the mail draft "draft_1" message file is under the runtime directory
    And the mail draft "draft_1" message file is gone
    And the fake mailbox has received no send calls
    When I ask the agent "update mail draft draft_1 saying See you tomorrow"
    Then the mail draft_update story says "draft updated · Revised"
    And the saved mail draft "draft_1" has header "Subject" equal to "Revised"
    And the saved mail draft "draft_1" has body "See you tomorrow"
    And the mail draft "draft_1" was passed as a message file after the separator
    And the mail draft "draft_1" message file is under the runtime directory
    And the mail draft "draft_1" message file is gone
    And the fake mailbox has received no send calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: A draft carries vault files, and an update replaces then drops them
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft mail to ravi@example.com subject Q3 invoice saying Both files are attached attaching invoice.pdf, notes.txt"
    Then the mail draft story says "draft to ravi@example.com · Q3 invoice · 2 attachments"
    And the saved mail draft "draft_1" has header "To" equal to "ravi@example.com"
    And the saved mail draft "draft_1" has body "Both files are attached"
    And the saved mail draft "draft_1" has 2 attachments
    And the saved mail draft "draft_1" has attachment "invoice.pdf" of type "application/pdf"
    And the saved mail draft "draft_1" has attachment "notes.txt" of type "text/plain"
    And the saved mail draft "draft_1" attachment "invoice.pdf" is the vault file "invoice.pdf"
    And the saved mail draft "draft_1" attachment "notes.txt" is the vault file "notes.txt"
    And the mail draft "draft_1" was passed as a message file after the separator
    And the mail draft "draft_1" message file is gone
    And the fake mailbox has received no send calls
    When I ask the agent "update mail draft draft_1 saying Just the notes now attaching notes.txt"
    Then the mail draft_update story says "draft updated · Revised · 1 attachment"
    And the saved mail draft "draft_1" has body "Just the notes now"
    And the saved mail draft "draft_1" has 1 attachments
    And the saved mail draft "draft_1" has attachment "notes.txt" of type "text/plain"
    And the mail draft "draft_1" message file is gone
    When I ask the agent "update mail draft draft_1 saying Nothing attached any more"
    Then the mail draft_update story says "draft updated · Revised"
    And the saved mail draft "draft_1" has body "Nothing attached any more"
    And the saved mail draft "draft_1" has 0 attachments
    And the fake mailbox has received no send calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: A file that is not there names itself and writes nothing
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft mail to ravi@example.com subject Q3 invoice saying See attached attaching nowhere.pdf"
    Then the mail refused story says "there is no file to attach at"
    And the mail refused story says "nowhere.pdf"
    And the agent's answer mentions "nowhere.pdf"
    And the fake mailbox has received no tool calls
    When I ask the agent "draft reply to mail thread a2 saying Count me in"
    Then the mail draft story says "Re: Nix meetup"
    And the saved mail draft "draft_1" has 0 attachments

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Reply draft uses sender only and preserves threading
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft reply to mail thread a2 saying Count me in"
    Then the mail draft story says "Re: Nix meetup"
    And the saved mail draft "draft_1" has header "To" equal to "ravi@example.com"
    And the saved mail draft "draft_1" has header "In-Reply-To" equal to "<a21@example.com>"
    And the saved mail draft "draft_1" has header "References" equal to "<earlier@example.com> <a21@example.com>"
    And the saved mail draft "draft_1" belongs to thread "a2"
    And the saved mail draft "draft_1" has no "Cc" header
    And the saved mail draft "draft_1" has no "Bcc" header
    And the saved mail draft "draft_1" has body "Count me in"
    And the mail draft "draft_1" was passed as a message file after the separator
    And the mail draft "draft_1" message file is under the runtime directory
    And the mail draft "draft_1" message file is gone
    And the fake mailbox has received no send calls
    When I ask the agent "update mail draft draft_1 on thread a2 saying See you tomorrow"
    Then the mail draft_update story says "draft updated · Re: Nix meetup"
    And the saved mail draft "draft_1" belongs to thread "a2"
    And the saved mail draft "draft_1" has header "In-Reply-To" equal to "<a21@example.com>"
    And the saved mail draft "draft_1" has header "References" equal to "<earlier@example.com> <a21@example.com>"
    And the saved mail draft "draft_1" has body "See you tomorrow"
    And the mail draft "draft_1" message file is gone
    And the fake mailbox has received no send calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Missing reply thread cannot create a draft
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft reply to mail thread ffff saying Count me in"
    Then the mail refused story says "this thread is not in you@gmail.com"
    And the fake mailbox has received no drafts.create calls
    And the fake mailbox has received no drafts.update calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Invalid addresses and header injection cannot spawn
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft mail to invalid subject Hello saying Hi"
    Then the mail refused story says "malformed mail address"
    And the fake mailbox has received no tool calls
    When I ask the agent "draft mail to ravi@example.com subject Hello\\nBcc: victim@example.com saying Hi"
    Then the mail refused story says "mail headers cannot contain"
    And the fake mailbox has received no tool calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Missing draft is refused in the account words
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "update mail draft unknown saying Hello again"
    Then the mail refused story says "this draft is not in you@gmail.com"
    And the fake mailbox has received no drafts.create calls
    And the fake mailbox has received no send calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Following up on my own message uses its To recipients
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft reply to mail thread a6 saying Following up"
    Then the mail draft story says "draft to ravi@example.com, jane@example.com · Re: Follow up"
    And the saved mail draft "draft_1" has header "To" equal to "ravi@example.com, jane@example.com"
    And the saved mail draft "draft_1" has no "Cc" header
    And the saved mail draft "draft_1" belongs to thread "a6"
    And the saved mail draft "draft_1" has header "In-Reply-To" equal to "<a62@example.com>"
    And the saved mail draft "draft_1" has header "References" equal to "<a61@example.com> <a62@example.com>"
    And the saved mail draft "draft_1" has body "Following up"
    And the mail draft "draft_1" message file is gone
    And the fake mailbox has received no send calls

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Reply-all copies only the explicitly requested recipients
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I close the plugins panel
    And I open the outline "mail.olai"
    And I mark the page
    And I open the "claude" agent on node "mail-work"
    And the node agent's fold is ready
    When I ask the agent "draft reply to mail thread a2 cc jane@example.com, team@example.com saying Count us in"
    Then the mail draft story says "draft to ravi@example.com · Re: Nix meetup"
    And the saved mail draft "draft_1" has header "To" equal to "ravi@example.com"
    And the saved mail draft "draft_1" has header "Cc" equal to "jane@example.com, team@example.com"
    And the saved mail draft "draft_1" has no "Bcc" header
    And the saved mail draft "draft_1" belongs to thread "a2"
    And the saved mail draft "draft_1" has body "Count us in"
    And the mail draft "draft_1" message file is gone
    And the fake mailbox has received no send calls
