@codex @scratch:lanes @agent-stored
Feature: Signing in to Codex from inside olai
  Codex's adapter drives its own sign-in and asks the panel for one thing: a
  page, with the code the person has to type into it. That is ACP's URL
  elicitation, and it can arrive before any conversation exists — which is the
  whole reason the panel draws it in its own row rather than in a transcript.

  @signin
  Scenario: A conversation refused for want of a signature is signed in to and opened
    Given I open the app
    And I show the done nodes
    And I rewrite "lanes.olai" as:
      """
      {"id":"install","ord":"a0","title":"install the cabinets","doing":true,"custom":{"agent-session":"codex:install-session"}}
      """
    And I open the outline "lanes.olai"
    And the agent needs a sign-in
    When I press the agent "install"
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "Authentication required"
    And the panel offers a sign-in
    And the sign-in names no current account
    And the sign-in offers "chat-gpt-device-code"
    And the sign-in does not offer "api-key"
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    And the card links to "https://chatgpt.com/device"
    And the card says "Sign in to ChatGPT and enter this code: WXYZ-12345"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle

  @signin
  Scenario: The agent line says which account the agent is signed in as
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    When I open the "codex" agent on node "lane-fresh"
    And the node agent's fold is ready
    Then the agent line says who is signed in as "ChatGPT Plus · you@example.com"
    When I press the account in the agent line
    Then the panel offers a sign-in
    And the sign-in names the current account "ChatGPT Plus · you@example.com"
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the agent line says who is signed in as "ChatGPT Plus · signed-in@example.com"

  @signin
  Scenario: An account switched elsewhere is what the next turn runs as
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    When I open the "codex" agent on node "lane-fresh"
    And the node agent's fold is ready
    Then the agent line says who is signed in as "ChatGPT Plus · you@example.com"
    When the agent reports it is signed in as:
      """
      {"kind":"account","label":"ChatGPT Plus","account":{"email":"work@example.com","plan":"plus"}}
      """
    And I ask the agent "hello"
    Then the agent line says who is signed in as "ChatGPT Plus · work@example.com"
    When the agent reports it is signed in as:
      """
      {"kind":"none","label":"Not logged in"}
      """
    And I ask the agent "hello"
    Then the agent line says nobody is signed in

  @signin
  Scenario: Backing out of a device-code sign-in leaves nothing running
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    When I open the "codex" agent on node "lane-fresh"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When I cancel the sign-in
    Then the panel offers no sign-in
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the agent is idle

  @signin
  Scenario: A device-code sign-in stops with the agent it belongs to
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    When I open the "codex" agent on node "lane-fresh"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When I open the plugins panel
    And I switch the plugin "codex" off
    Then the panel offers no sign-in
    And the agent line names no account
    When I switch the plugin "codex" on

  @signin
  Scenario: A signature the agent wanted mid-conversation is asked for and given
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    When I open the "codex" agent on node "lane-fresh"
    And the node agent's fold is ready
    And the agent needs a sign-in
    When I ask the agent "hello"
    Then the panel offers a sign-in
    And the chat shows my message "hello" as "refused"
    When I press the sign-in for "chat-gpt-device-code"
    Then the card says "Sign in to ChatGPT and enter this code: WXYZ-12345"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the agent is idle
    And the chat input reads "hello"

  @signin
  Scenario: Chats plus keeps an auth-refused new conversation visible until it opens
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    And the agent needs a sign-in
    When I press new chat in Chats
    And I type "a lane nobody" into the palette
    And I choose the new chat item "lane-fresh"
    And I choose new chat engine "Codex"
    And I type new chat draft "sign in first"
    And I send the new chat draft
    Then the pending conversation is unfolded as "new-chat" with engine "codex"
    And the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "Authentication required"
    And the panel offers a sign-in
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the new conversation is unfolded as "new-chat" with engine "codex"
    When I ask the agent "opened after signing in"
    Then the agent has answered "opened after signing in" exactly once

  @signin
  Scenario: A stored Codex chat resumes its own session after signing in
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    And the agent needs a sign-in
    And node "lane-fresh" in "lanes.olai" is tied to the stored "codex" conversation "the last conversation"
    When I press the agent "lane-fresh"
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "Authentication required"
    And the panel offers a sign-in
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the open conversation has session id "fake-stored-new"

  @signin
  Scenario: Starting Codex on an untouched node offers sign-in before a session exists
    Given I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    And the agent needs a sign-in
    When I open the "codex" agent on node "lane-fresh"
    Then the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "Authentication required"
    And the panel offers a sign-in
    When I cancel the sign-in
    Then the panel offers no sign-in
    And the panel says the conversation could not be opened
    When I try to open it again
    Then the panel offers a sign-in
    When I reload the page
    And I unfold node agent "lane-fresh"
    Then the panel offers a sign-in
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the open conversation has session id "fake-session-1"
    And the vault node "lane-fresh" has property "agent-session" holding "codex:fake-session-1"

  @signin
  Scenario: An auth-refused fresh start retries new instead of resuming a stored chat
    Given the harness keeps distinct sessions on disk
    And I open the app
    And I show the done nodes
    And I open the outline "lanes.olai"
    When I open the "codex" agent on node "lane-fresh"
    And the node agent's fold is ready
    When I ask the agent "the previous conversation"
    Then the agent is idle
    And I remember this conversation as "before-sign-in"
    And the agent needs a sign-in
    When I open the fold history
    And I start a fresh session with "Codex"
    Then the panel says the conversation could not be opened
    And the panel offers a sign-in
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the panel has a different conversation from "before-sign-in"
