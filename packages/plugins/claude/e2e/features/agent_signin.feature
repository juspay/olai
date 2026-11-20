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
    Then the agent line says who is signed in as "Claude Max · you@example.com"
    And the account in the agent line is a button
    When I press the account in the agent line
    Then the panel offers a sign-in
    And the sign-in names the current account "Claude Max · you@example.com"
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the agent line says who is signed in as "Claude Max · signed-in@example.com"

  @signin
  Scenario: An agent that reports an account but offers no way in draws a label
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
    When the agent reports it is signed in as:
      """
      {"kind":"account","label":"Claude Max","account":{"email":"work@example.com","plan":"max"}}
      """
    And I ask the agent "hello"
    Then the agent line says who is signed in as "Claude Max · work@example.com"
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
    Then the sign-in is running "claude-ai-login"
    And the sign-in says "https://claude.ai/fake-login?code=abc123"
    And the agent line says who is signed in as "Claude Max · you@example.com"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    When I use the original browser tab
    Then the panel offers no sign-in
    And the agent line says who is signed in as "Claude Max · signed-in@example.com"
    And the agent is idle

  @signin
  Scenario: A turn the agent would not take for want of a signature comes back
    When I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    And the agent needs a sign-in
    When I ask the agent "hello"
    Then the panel offers a sign-in
    And the chat shows my message "hello" as "refused"
    And the chat input reads "hello"
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
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
    When I open the plugins panel
    And I switch the plugin "claude" off
    Then the panel offers no sign-in
    And the agent line names no account
    When I switch the plugin "claude" on
    Then the login command was stopped

  @signin
  Scenario: An agent that advertises no way in is not a `/login` anybody can press
    When the agent advertises nothing about itself
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
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
    And I type "kitchen" into the palette
    And I choose the new chat item "kitchen"
    And I type new chat draft "sign in first"
    And I send the new chat draft
    Then the pending conversation is unfolded as "new-chat" with engine "claude"
    And the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "Authentication required"
    And the panel offers a sign-in
    When I press the sign-in for "claude-ai-login"
    Then the sign-in is running "claude-ai-login"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the new conversation is unfolded as "new-chat" with engine "claude"

  @signin @agent-stored
  Scenario: A stored Claude chat resumes after terminal sign-in
    Given the agent needs a sign-in
    And node "kitchen" in "house.olai" is tied to the stored "claude" conversation "the last conversation"
    When I press the agent "kitchen"
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
