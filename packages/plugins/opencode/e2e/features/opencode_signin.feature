@opencode @scratch:chat
Feature: Signing in to opencode from inside olai
  opencode's sign-in is an interactive wizard. `acp --login` and `auth login`
  both answer `Pass an integration ID or name when running without an
  interactive terminal` and exit 1 the moment they find no TTY, and even
  `auth login <target> --method key` wants the key typed at a terminal — the
  `--answer` flag fills a provider's form and never the key (2.2.7, captured).
  Olai's sign-in card is a pipe and a paste box, so there is no shape of it
  that could finish this one. What it draws instead is the command, with the
  binary the probe found in front of it, because an engine olai reached
  through its own agent search path is not on that person's shell `PATH`
  either.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"

  @signin
  Scenario: A sign-in that cannot finish here is words, not a button
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    When I type "/login" into the chat
    And I send the chat message
    Then the panel offers a sign-in
    # THE WHOLE CLAIM, in three parts: the method is drawn and it has no
    # button; the command names the FILE the probe found rather than the bare
    # word opencode writes into its own `_meta` corner; and nothing was run.
    # The third is the one the previous round got wrong — the fake writes a
    # marker the instant anybody starts it with `--login`, so its absence is
    # evidence rather than a card that merely looks right.
    And the sign-in shows "opencode-login" as a command to run by hand
    And the command to run by hand includes "e2e/fake/opencode auth login --standalone"
    And no sign-in process was started
    # ... and the chooser stays what it is: nothing is running, so there is no
    # output, no paste box and nothing to cancel.
    And the panel offers a sign-in
