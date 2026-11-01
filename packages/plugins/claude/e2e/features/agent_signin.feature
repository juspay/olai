@claude @scratch:chat
Feature: Signing in to Claude from inside olai
  The adapter hands the panel a command to run instead of a login of its own,
  and the panel is what prints it, reads the code off a person and reports what
  became of it. Nothing here leaves the app: the URL the command prints is the
  only step that does, and it is a link a person clicks.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"

  @signin
  Scenario: The login the adapter handed over runs, prints its URL and reads the code
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    Then the panel offers a sign-in
    And the sign-in offers "claude-ai-login"
    And the sign-in offers "console-login"
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    # THE CHIP IS A LABEL WHILE A ROW IS ON SCREEN: pressing it would replace
    # this quietly-waiting login with a chooser.
    And the account in the agent line is not a button
    And the sign-in says "https://claude.ai/fake-login?code=abc123"
    And the sign-in makes a link of "https://claude.ai/fake-login?code=abc123"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the agent is idle

  @signin
  Scenario: The agent line says which account the agent is signed in as
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    # WHO a conversation is about to run as, before anybody types into it —
    # the fact two Claude Code accounts made worth showing.
    Then the agent line says who is signed in as "Claude Max · you@example.com"
    # ... AND THE CHIP IS THE WAY TO SWITCH: the same chooser `/login` asks
    # for, naming the account it would change.
    And the account in the agent line is a button
    When I press the account in the agent line
    Then the panel offers a sign-in
    And the sign-in names the current account "Claude Max · you@example.com"
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    # THE LOGIN REWROTE THE ACCOUNT, and the chip is where a person sees it:
    # the read that notices is the reopen the sign-in ends with.
    And the agent line says who is signed in as "Claude Max · signed-in@example.com"

  @signin
  Scenario: An agent that reports an account but offers no way in draws a label
    # A GATEWAY OR A THIRD-PARTY BACKEND: the account is a fact, the chooser is
    # not a gesture, so the chip is text rather than a button. Armed before the
    # handshake, because the methods are heard exactly once.
    Given the agent offers no way in but still reports its account
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the agent line says who is signed in as "Claude Max · you@example.com"
    And the account in the agent line is not a button

  @signin
  Scenario: An account switched elsewhere is what the next turn runs as
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    Then the agent line says who is signed in as "Claude Max · you@example.com"
    # A `/login` IN ANOTHER TERMINAL, modelled as the account the agent would
    # read on its next probe. Nothing tells the panel until the prompt starts,
    # which is exactly when the real adapter reads its identity again.
    When the agent reports it is signed in as:
      """
      {"kind":"account","label":"Claude Max","account":{"email":"work@example.com","plan":"max"}}
      """
    And I ask the agent "hello"
    Then the agent line says who is signed in as "Claude Max · work@example.com"
    # ... AND A KNOWN LOGGED-OUT STATE IS A REPORT, not silence: the chip says
    # so rather than vanishing, which is what an engine that does not report
    # looks like.
    When the agent reports it is signed in as:
      """
      {"kind":"none","label":"Not logged in"}
      """
    And I ask the agent "hello"
    Then the agent line says nobody is signed in

  @signin
  Scenario: A code the command does not accept is answered and asked for again
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "console-login"
    Then the sign-in is running "console-login"
    When I type "000000" into the sign-in
    Then the sign-in says "Invalid code. Please try again."
    # THE PROCESS IS STILL UP, which is what "asked again" means: a client that
    # treated the first output as the end would have taken the row down here.
    And the sign-in is running "console-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the agent is idle

  @signin
  Scenario: A sign-in that fails says so and can be tried again
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "expired" into the sign-in
    Then the sign-in says "This code has expired. Run the login again."
    And the sign-in has stopped
    When I press the way to try the sign-in again
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the agent is idle

  @signin
  Scenario: Cancelling takes the row away and stops what it was running
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I cancel the sign-in
    Then the panel offers no sign-in
    # ... AND THE PROCESS IS GONE, which the second attempt is the proof of: an
    # attempt still in flight answers a second press by attaching to it, so a
    # row that comes back is a row that was started afresh.
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the agent is idle

  @signin
  Scenario: Two browser tabs watch one sign-in, and either can finish it
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I open another browser tab
    And I unfold node agent "kitchen"
    # THE SAME ATTEMPT: one process, one output stream, drawn in both tabs —
    # which is why the attempt belongs to the agent and not to a tab.
    Then the sign-in is running "claude-ai-login"
    And the sign-in says "https://claude.ai/fake-login?code=abc123"
    # THE ACCOUNT IS THE AGENT'S TOO, so the second tab reads the same chip as
    # the first — the same reason one sign-in is drawn in both.
    And the agent line says who is signed in as "Claude Max · you@example.com"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    When I use the original browser tab
    Then the panel offers no sign-in
    # ... AND THE CHANGE LANDS IN BOTH: the process said who it is now, and
    # neither tab is the authority on that.
    And the agent line says who is signed in as "Claude Max · signed-in@example.com"
    And the agent is idle

  @signin
  Scenario: A turn the agent would not take for want of a signature comes back
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    # ARMED AFTER THE CONVERSATION IS OPEN, so it is the TURN that is refused
    # and not the open — the case where there is a transcript, a message of
    # somebody's own on it, and a composer to put it back in.
    And the agent needs a sign-in
    When I ask the agent "hello"
    Then the panel offers a sign-in
    And the chat shows my message "hello" as "refused"
    And the chat input reads "hello"
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    # THE CONVERSATION COMES BACK, and the words are still the person's: the
    # sign-in reopens the SAME conversation, so what they typed is in the box
    # rather than in a transcript nobody is in any more.
    And the agent is idle
    And the chat input reads "hello"
    When I send the chat message
    Then the agent's answer mentions "you said: hello"

  @signin
  Scenario: A sign-in stops with the agent it belongs to
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    # THE SCOPE GOING AWAY MID-LOGIN, which is the one claim about a sign-in that
    # no row can be read for: the process is the agent's, so the agent going
    # takes it — and the command wrote down which process it is, so the suite
    # asks the OPERATING SYSTEM whether it is still there rather than trusting
    # how it was asked to die.
    #
    # THE ENGINE SWITCHED OFF is the gesture that does it, and that is a fact
    # worth pinning: CLOSING THE AGENT (the fold's own control) releases the
    # node's binding and leaves the scope to be evicted, so the subprocess — and
    # this login with it — is still there afterwards. A test that closed the
    # agent and then looked for a dead process would be asserting a disposal
    # nobody made.
    When I open the plugins panel
    And I switch the plugin "claude" off
    Then the panel offers no sign-in
    # ... AND THE ACCOUNT GOES WITH THE PROCESS IT DESCRIBED: the chip named
    # the subprocess that was just stopped, so nothing about it may stay.
    And the agent line names no account
    # AND PUT BACK: the switch is a preference the scratch vault remembers, so a
    # scenario that left the engine off would take the engine out from under the
    # ones after it. The process stays gone, which is what the next line asks.
    When I switch the plugin "claude" on
    Then the login command was stopped

  @signin
  Scenario: An agent that advertises no way in is not a `/login` anybody can press
    # BOTH BEFORE THE AGENT STARTS: "advertises nothing" is heard exactly once,
    # at the handshake.
    When the agent advertises nothing about itself
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    # IT GOES AS A MESSAGE, which is what `/login` means to every agent that
    # never said it could be signed in to, and no row is offered.
    Then the agent's answer mentions "you said: /login"
    And the panel offers no sign-in

  @signin
  Scenario: A page an agent sends somebody to is drawn as a card, outside any sign-in
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I ask the agent "oauth example"
    Then the card sends them to "example.example"
    And the card links to "https://example.example/oauth?state=fake"
    And the card says "Authenticate with MCP server example"
    When the person finishes signing in
    Then the card is done with
    And the agent's answer mentions "signed in to example"

  @signin
  Scenario: A new chat refused for auth runs the terminal login and then opens
    Given the agent needs a sign-in
    When I press new chat in Chats
    And I choose the new chat place "default"
    And I type new chat draft "sign in first"
    And I send the new chat draft
    Then the pending Inbox conversation is unfolded as "new-chat" with engine "claude"
    And the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "Authentication required"
    And the panel offers a sign-in
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the new Inbox conversation is unfolded as "new-chat" with engine "claude"

  @signin @agent-stored
  Scenario: A listed Claude chat resumes after terminal sign-in
    Given the agent needs a sign-in
    When I open the filed conversation "the last conversation" as node "listed-chat"
    Then the panel says the conversation could not be opened
    And the panel offers a sign-in
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the open conversation has session id "fake-stored-new"

  @signin
  Scenario: An untouched node opens its first Claude session after terminal sign-in
    Given the agent needs a sign-in
    When I open the "claude" agent on node "kitchen"
    Then the panel says the conversation could not be opened
    And the panel offers a sign-in
    # NOBODY IS SIGNED IN, and the fake says so: a chooser a refusal produced
    # names no current account, rather than claiming one over the very
    # signature that is missing.
    And the sign-in names no current account
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I open another browser tab
    And I unfold node agent "kitchen"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the open conversation has session id "fake-session-1"
    When I use the original browser tab
    Then the panel offers no sign-in
    And the open conversation has session id "fake-session-1"
