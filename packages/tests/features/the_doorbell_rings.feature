Feature: The second doorbell — a plugin rings a conversation somebody scoped

  A plugin may put a whole sentence into a conversation the way a person does.
  kolu's watcher sees a terminal that has been sitting in a state only a person
  can carry, and says so — in its own words, down the human's own lane, because
  that is the lane a prompt goes out on and the one every word about its fate is
  already written for.

  WHICH unassigned conversation hears it is one person's answer, given in one
  place. The wake strip under the panel's other two is that place: a file per
  conversation, picked by hand. A node agent instead inherits its own subtree
  and has no picker. No serve scopes an unassigned conversation, and one nobody
  has scoped hears nothing — which is why the strip's ordinary state is `off`
  and is still drawn.

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

  @agent-stored @scratch:lanes @padi:lanes
  Scenario: The conversation I pointed at the board hears from it, and my half-typed message does not move
    Given I open the outline "lanes.olai"
    And the agent panel is open
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

  @scratch:lanes @plugins:kolu
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
    And the plugins panel says "chat" is "was not asked for"
