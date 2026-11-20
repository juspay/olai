Feature: The second doorbell — a plugin rings a conversation somebody scoped

  A plugin may put a whole sentence into a conversation the way a person does.
  kolu's watcher sees a terminal that has been sitting in a state only a person
  can carry, and says so — in its own words, down the human's own lane, because
  that is the lane a prompt goes out on and the one every word about its fate is
  already written for.

  Each conversation chooses its own file for each plugin, including chats
  bound to nodes. New conversations are off. Clearing the file turns that
  plugin's notifications off without changing any other conversation or plugin.

  ONE SCENARIO, and the whole of the rest is unit-tested. What a filter file
  CLAIMS, what a wake MEANS and what the sentence says are pure functions over a
  parsed vault (`olai-plugin-kolu`'s `doorbell.test.ts`); the arms of the
  delivery — taken at once by an idle agent, HELD through a running turn,
  coalesced under one key, flushed at the boundary — are driven through a real
  chat and a real subprocess agent (`@olai/chat`'s `deliveries.test.ts`). None of
  that earns a Chromium. What only a browser can say is the MECHANICS: that a
  sentence nobody typed arrives in the transcript, wearing a face that is not the
  person's, without the composer they were half way through typing in moving
  under them.

  The far end is this suite's own padi (`@padi:lanes`) and the board is the
  ordinary `lanes.olai`: its `review: grok` step is `todo` and claims a terminal
  padi says is blocked on a person, which is the digest arm of the two.

  THE RING IS CAUSED, NOT WAITED FOR. `held-for` is a debounce, and lowering it
  re-arms a hold that is already standing — so writing the config is the gesture
  that fires the watcher, and this scenario never sits out a clock.

  @scratch:lanes @padi:lanes @agent-stored
  Scenario Outline: The <chat> conversation hears its selected board without moving my draft
    Given I open the outline "lanes.olai"
    And node "lane-fresh" in "lanes.olai" is tied to the stored "claude" conversation "the last conversation"
    And I press the agent "door-live"
    And the node agent's fold is ready
    And I press the agent "<chat>"
    And the node agent's fold is ready
    Then this conversation's "kolu" wake is on nothing
    When I point this conversation's "kolu" wake at "lanes.olai"
    Then this conversation's "kolu" wake is on "lanes.olai"
    When I type "half a thought" into the chat
    And the watch is told to report a held terminal at once
    Then the chat shows a sentence no person typed
    And that sentence was rung by "kolu"
    And that sentence wears "kolu"'s own logo
    And that sentence is not one of my own messages
    And that sentence offers no way to send it again
    And the chat input still holds "half a thought"
    And the chat input still has the caret
    And that sentence is one line, with its account folded away
    And that sentence can be pressed through to the board
    When I open that sentence
    Then that sentence names "22222222-2222-4222-8222-222222222222"
    And there should be no page errors

    Examples:
      | chat       |
      | door-live  |
      | lane-fresh |

  @scratch:lanes @rows:vault,olai,kolu,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A serve that composed no chat row says which door kolu is waiting behind
    Given I open the outline "lanes.olai"
    Then the outline list is shown
    When I open the plugins panel
    Then the plugins panel says "kolu" is "Can't start: another plugin it needs isn't running (deliveries, session-start)."
    And the plugin "chat" is off without prose


  @scratch:lanes
  Scenario: Node conversations control each doorbell and remember off across restart
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    Then the agent "door-live" stands "idle"
    And this conversation's "kolu" wake is on nothing
    And this conversation's "odu" wake is on nothing
    When I point this conversation's "kolu" wake at "lanes.olai"
    And I point this conversation's "odu" wake at "backlog.olai"
    Then this conversation's "kolu" wake is on "lanes.olai"
    And this conversation's "odu" wake is on "backlog.olai"
    When I point this conversation's "kolu" wake at "backlog.olai"
    Then this conversation's "kolu" wake is on "backlog.olai"
    And this conversation's "odu" wake is on "backlog.olai"
    When I clear this conversation's "kolu" wake
    Then this conversation's "kolu" wake is on nothing
    And this conversation's "odu" wake is on "backlog.olai"
    When I leave the app
    And the server stops
    And the server starts again on the same port
    And I open the app
    And the node agent's fold is ready
    Then this conversation's "kolu" wake is on nothing
    And this conversation's "odu" wake is on "backlog.olai"
    When I clear this conversation's "odu" wake
    Then this conversation's "odu" wake is on nothing
    When I point this conversation's "kolu" wake at "lanes.olai"
    Then this conversation's "kolu" wake is on "lanes.olai"
    And this conversation's "odu" wake is on nothing
    And there should be no page errors


  @scratch:lanes
  Scenario: Wake choices survive a plugin leaving and returning through Cordis
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When I point this conversation's "kolu" wake at "lanes.olai"
    And I point this conversation's "odu" wake at "backlog.olai"
    And I open the plugins panel
    And I switch the plugin "kolu" off
    And I close the plugins panel
    Then this conversation offers no "kolu" wake control
    And this conversation's "odu" wake is on "backlog.olai"
    When I open the plugins panel
    And I switch the plugin "kolu" on
    And I close the plugins panel
    Then this conversation's "kolu" wake is on "lanes.olai"
    And this conversation's "odu" wake is on "backlog.olai"
    When I clear this conversation's "kolu" wake
    And I reload the page
    And the node agent's fold is ready
    Then this conversation's "kolu" wake is on nothing
    And this conversation's "odu" wake is on "backlog.olai"
    And there should be no page errors


  @scratch:chat
  Scenario: A fresh node session starts off and its history keeps separate wake choices
    Given the harness keeps distinct sessions on disk
    And I open the outline "house.olai"
    When I open the node menu of "install"
    And I choose "Start an agent" from the node menu
    And the node agent's fold is ready
    And I ask the agent "wake history"
    Then the agent has answered "wake history" exactly once
    When I remember this conversation as "first"
    And I point this conversation's "kolu" wake at "house.olai"
    And I point this conversation's "odu" wake at "yard.olai"
    And I start a fresh session
    Then the panel is ready in a new conversation after "first"
    And this conversation's "kolu" wake is on nothing
    And this conversation's "odu" wake is on nothing
    When I remember this conversation as "current"
    And I point this conversation's "kolu" wake at "yard.olai"
    And I open the fold history
    And I open the past session "wake history"
    Then the panel is in the remembered conversation "first"
    And this conversation's "kolu" wake is on "house.olai"
    And this conversation's "odu" wake is on "yard.olai"
    When I clear this conversation's "odu" wake
    And I return to the node agent's current session
    Then the panel is in the remembered conversation "current"
    And this conversation's "kolu" wake is on "yard.olai"
    And this conversation's "odu" wake is on nothing
    And there should be no page errors


  @scratch:lanes
  Scenario Outline: Clearing a node wake discards its queued missing-file warning
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When I point this conversation's "<plugin>" wake at "backlog.olai"
    And I ask the agent "hold"
    Then the agent is working
    When I remove the served file "backlog.olai"
    Then this conversation's "<plugin>" missing-file warning is queued
    When I clear this conversation's "<plugin>" wake
    And the agent is released
    Then the agent is idle
    And the conversation has received no plugin messages
    And there should be no page errors

    Examples:
      | plugin |
      | kolu   |
      | odu    |


  @scratch:lanes
  Scenario Outline: Repointing a node wake discards its queued missing-file warning
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When I point this conversation's "<plugin>" wake at "backlog.olai"
    And I ask the agent "hold"
    Then the agent is working
    When I remove the served file "backlog.olai"
    Then this conversation's "<plugin>" missing-file warning is queued
    When I point this conversation's "<plugin>" wake at "lanes.olai"
    And the agent is released
    Then the agent is idle
    And the conversation has received no plugin messages
    And there should be no page errors

    Examples:
      | plugin |
      | kolu   |
      | odu    |


  @scratch:lanes
  Scenario Outline: A plugin reload preserves the pick and revokes its queued warning
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    When I point this conversation's "<plugin>" wake at "backlog.olai"
    And I ask the agent "hold"
    Then the agent is working
    When I remove the served file "backlog.olai"
    Then this conversation's "<plugin>" missing-file warning is queued
    When I open the plugins panel
    And I switch the plugin "<plugin>" off
    And I switch the plugin "<plugin>" on
    And I close the plugins panel
    Then this conversation's "<plugin>" wake is on "backlog.olai"
    When the agent is released
    Then the agent is idle
    And the conversation has received no plugin messages
    And there should be no page errors

    Examples:
      | plugin |
      | kolu   |
      | odu    |
