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

  @scratch:lanes @padi:lanes
  Scenario Outline: The <chat> conversation hears its selected board without moving my draft
    Given I open the outline "lanes.olai"
    And I press the agent "door-live"
    And the node agent's fold is ready
    And I open the "<chat>" conversation for delivery
    # The default, and it is a ruling rather than an oversight: nobody is opted
    # in by a serve, so the control is drawn saying so.
    Then this conversation's "kolu" wake is on nothing
    When I point this conversation's "kolu" wake at "lanes.olai"
    Then this conversation's "kolu" wake is on "lanes.olai"
    # Half a thought in the box, unsent. Everything after this line is also a
    # claim about these words: the doorbell rides the wire a send rides and
    # never the composer.
    When I type "half a thought" into the chat
    And the watch is told to report a held terminal at once
    Then the chat shows a sentence no person typed
    And that sentence was rung by "kolu"
    # ... and says so by its face, before a word is read: the mark is kolu's own
    # logo, arriving through the same pin every @kolu/* source in this tree does.
    And that sentence wears "kolu"'s own logo
    And that sentence is not one of my own messages
    And that sentence offers no way to send it again
    # THE DELIVERY'S OWN PROMISE, asserted before anybody presses anything: the
    # words arrived and the composer did not move. Everything below this line is
    # about a gesture a person made on purpose, and a press taking the caret is
    # what a press is supposed to do.
    And the chat input still holds "half a thought"
    And the chat input still has the caret
    # FOLDED, which is the other half of the face. A delivery is one line a
    # glance absorbs; the ids and the derivation are a press away, the way a
    # tool row already keeps them. The AGENT was handed the whole body either
    # way — the fold is a fact about a reader's eye and not about the wire.
    And that sentence is one line, with its account folded away
    # ... and that line is pressable BEFORE the fold: the board row the wake was
    # derived from is the thing a person reaches for from the collapsed message.
    And that sentence can be pressed through to the board
    When I open that sentence
    # THE JOIN, and the id is asserted rather than the wording: every word of the
    # sentence is kolu's own and `doorbell.test.ts` pins them. What this line is
    # for is that the file a person picked, the un-done step in it, and a
    # terminal on the far end of a real socket are three separate facts, and this
    # is the one place they meet.
    Then that sentence names "22222222-2222-4222-8222-222222222222"
    And there should be no page errors

    Examples:
      | chat       |
      | node-bound |

    @agent-stored
    Examples:
      | chat       |
      | filed      |

  @scratch:lanes @rows:vault,kolu,ws,web-app,mcp,ui-renderer,layout,sidebar,preferences,theme,plugin-inspector,navigation,outlines,markdown,files,pins,capture,trash,vault-plugins
  Scenario: A serve that composed no chat row says which door kolu is waiting behind
    # THE RULING'S ACCEPTED COST, and the sentence that makes it payable.
    #
    # `deliveries`, `agents`, `watching` and `session-start` are the CHAT ROW's
    # to offer; core provides none of them. So a serve composed without chat is
    # a serve where kolu names a service nobody is behind, and the rule is that
    # it sits `waiting` — not `failed`, because nothing went wrong, and not
    # quietly running against a door that swallows every delivery, which is what
    # core standing in for the row used to give it.
    #
    # What makes that a cost somebody can pay rather than a mystery is the
    # panel. A row that says only *waiting for something it needs* sends a
    # person to the source; naming the door is naming the plugin one step
    # removed — a service is offered by a row — and that step is a person's to
    # take. The runtime has known which tags all along.
    Given I open the outline "lanes.olai"
    # THE OUTLINER IS WHOLE, which is the other half of the ruling: what a serve
    # without chat gives up is the conversation, not the product.
    Then the outline list is shown
    When I open the plugins panel
    # BOTH DOORS kolu named, because it names two and a sentence that owned up
    # to one would send somebody to compose a row that fixes half of it.
    Then the plugins panel says "kolu" is "Waiting for deliveries, session-start"
    And the plugins panel says "kolu" is "no plugin in this build offers them"
    # THE CHAT ROW ITSELF is a different absence and gets a different sentence:
    # nobody asked for it, so there is nothing to fix and nothing amber.
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
    And I choose "Start an agent session" from the node menu
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
