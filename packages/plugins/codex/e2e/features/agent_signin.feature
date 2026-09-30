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
    # THE BINDING IS IN THE VAULT, so this node HAS a conversation before
    # anything is started or refused: the marker can then be armed and the BOOT
    # that opens it refused, which is the case with no transcript at all for the
    # row to live in. Starting an agent on an untouched node cannot show it —
    # the start gesture's own procedure never gets its conversation, so a
    # refusal leaves no binding and no fold to draw a row in.
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
    # THE SCOPE GOING AWAY MID-LOGIN. What the panel can be held to here is its
    # own face — the fold is gone, because the agent the row belonged to is —
    # and the adapter this attempt was driven from is that same agent's process,
    # so the wait for the card is a wait on a process that no longer exists.
    When I take the agent away
    Then the panel offers no sign-in
    # ... AND A FRESH AGENT ON THE SAME NODE IS SIGNED IN TO FROM SCRATCH.
    When I open the "codex" agent on node "lane-fresh"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    And I press the sign-in for "chat-gpt-device-code"
    Then the card sends them to "chatgpt.com"
    When the person finishes signing in
    Then the panel offers no sign-in
    And the agent is idle

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
