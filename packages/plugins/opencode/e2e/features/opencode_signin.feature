@opencode @scratch:chat
Feature: Signing in to opencode from inside olai
  opencode is an engine olai FINDS rather than ships, which is what makes its
  sign-in a different problem from the shipped agent's: the binary is wherever
  the agent search path says it is, and the server's own `PATH` has never heard
  of it. This feature is that one difference, walked end to end.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"

  @signin
  Scenario: The sign-in runs the binary the probe found, not a word off the server's PATH
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    Then the panel offers a sign-in
    And the sign-in offers "opencode-login"
    When I press the sign-in for "opencode-login"
    # THE WHOLE CLAIM. opencode advertises its sign-in twice: the protocol's
    # own `args: ["--login"]`, which mean "the agent binary with these", and a
    # `_meta` corner reading `{ command: "opencode", args: ["auth","login"] }`.
    # Olai used to prefer the corner and spawn that bare word, which on this
    # deployment — the engine reachable only through the agent search path —
    # resolves to nothing: a person pressing sign-in got
    # `Executable not found in $PATH: "opencode"` for the very binary olai was
    # holding a session with. The protocol's spelling has no such hole, so that
    # is the one this engine's leg says to read.
    #
    # The fake prints its own path, so the words on the card name the file that
    # ran: a client that had looked the bare word up would never have reached
    # this line at all.
    Then the sign-in is running "opencode-login"
    And the sign-in says "signed in by"
    And the sign-in says "e2e/fake/opencode"
    # ... and the rest is the ordinary flow: the URL it printed is a link, and
    # the code goes back down the same pipe.
    And the sign-in makes a link of "https://opencode.ai/fake-login?code=abc123"
    When I type "123456" into the sign-in
    Then the panel offers no sign-in
    And the agent is idle
