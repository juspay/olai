Feature: A node's engine is the one its panel acts on
  # Three faces, one rule: what a node runs is the node's property, and the
  # machine's list is what it is READ against — never a substitute for it.

  @codex @scratch:chat
  Scenario: The fresh-start menu opens on the engine this node already runs
    Given I open the outline "house.olai"
    When I open the "codex" agent on node "kitchen"
    And the node agent's fold is ready
    And I open the fresh-session engine menu
    # Codex is SECOND in bundle order, so first here is the hoist and not the
    # list: the press a person is most likely to mean is another conversation
    # with the agent they are already talking to, and it is the one their eye
    # lands on. Claude is still offered, one row down.
    Then the engine menu offers "codex" first, above "claude"

  @opencode @scratch:chat
  Scenario: A node whose engine has gone refuses a fresh start rather than changing engine
    Given I open the outline "house.olai"
    When I open the "opencode" agent on node "kitchen"
    And the node agent's fold is ready
    And I remember this conversation as "opencode kitchen"
    And I mark the page
    When I open the plugins panel
    And I switch the plugin "opencode" off
    And I close the plugins panel
    # ONE engine answers now, so the press takes no menu — and what it sends is
    # this node's OWN engine, which is gone. The refusal is the whole point: a
    # press that sent the survivor instead would migrate somebody's node onto
    # another agent with no menu to notice it in and no way back to the
    # conversation it named.
    And I start a fresh session
    Then the fresh-session control refuses "opencode" and allows retry
    And node "kitchen" still binds remembered conversation "opencode kitchen" in "house.olai"
    And the page has not reloaded
    And there should be no page errors

  @scratch:chat
  Scenario: A node bound to an engine this machine has not got is told about that engine
    Given node "install" in "house.olai" names the "omp" engine with no session
    And I open the plain node composer for "install"
    # The composer draws the ONE row it is about. Claude is installed and
    # running on this serve, so "this machine has no agent installed" would be
    # a false sentence at the one face a person reads when their node will not
    # start — and the engine's own sentence is the only one that tells them
    # what to do about it.
    Then the plain node composer explains the missing "omp" engine
    And the plain node composer draws no machine-wide engine absence
    And there should be no page errors
