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
    And the sign-in offers "chat-gpt-device-code"
    # AN `env_var` METHOD IS NOT OFFERED: a credential box is a feature this
    # panel does not have, and a button that could not finish what it started
    # would be worse than no button.
    And the sign-in does not offer "api-key"
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    And the card links to "https://chatgpt.com/device"
    And the card says "Sign in to ChatGPT and enter this code: WXYZ-12345"
    When the person finishes signing in
    # NO "THE CARD IS DONE WITH" HERE, and its absence is the point: the agent
    # answers the request the moment its own login lands, so the row goes — with
    # the card in it — rather than ever drawing the completed state. That state
    # belongs to a card nobody's sign-in is waiting on, which is the scenario
    # the Claude feature drives (an MCP server's OAuth, in a conversation).
    Then the panel offers no sign-in
    # THE CONVERSATION OPENS ITSELF once the agent has what it was missing, and
    # the face that said it could not be opened goes with it.
    And the panel shows no such refusal
    And the agent is idle

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
    # The agent's own answer to a cancelled login is a refusal, and it must not
    # put the row back: the press is what a person meant, and the row went when
    # they made it. A second attempt proves the first is over.
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
    # THE SCOPE GOING AWAY MID-LOGIN. The engine is switched off — the gesture
    # that actually stops the scope; closing the agent releases the node's
    # binding and leaves it to be evicted — and what the panel can be held to is
    # its own face: no row, because the agent it belonged to is gone.
    When I open the plugins panel
    And I switch the plugin "codex" off
    Then the panel offers no sign-in
    # Back on, for the scenarios after this one: the switch is remembered by the
    # scratch vault. The agent the card belonged to does not come back with it.
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
    And I choose the new chat place "default"
    And I choose new chat engine "Codex"
    And I type new chat draft "sign in first"
    And I send the new chat draft
    Then the pending Inbox conversation is unfolded as "new-chat" with engine "codex"
    And the panel says the conversation could not be opened
    And the refusal is in the agent's own words, "Authentication required"
    And the panel offers a sign-in
    When I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the panel shows no such refusal
    And the agent is idle
    And the new Inbox conversation is unfolded as "new-chat" with engine "codex"
    When I ask the agent "opened after signing in"
    Then the agent has answered "opened after signing in" exactly once

  @signin
  Scenario: A listed Codex chat resumes its own session after signing in
    Given I open the app
    And I show the done nodes
    And the agent needs a sign-in
    When I open the filed "codex" conversation "the last conversation" as node "listed-chat"
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
