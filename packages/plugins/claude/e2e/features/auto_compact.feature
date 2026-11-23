@claude @scratch:chat @agent-stored
Feature: A Claude chat is told where to compact its conversation, or left to its own settings
  Chat's `auto-compact` switch and `compact-at` setting decide what a Claude
  session open says about compaction. `compact-at` is `200k`, `model-limit`
  (the default) or a size a person types under `custom`, from `100k` to
  `1000k`. With a size, olai puts auto-compaction on at the size plus the 33k
  Claude Code keeps in reserve, into the settings every session open carries.
  With `model-limit`, the open carries nothing. Either way olai takes away the
  host variables that would override what decides. Off, olai says nothing and
  takes nothing away.

  The fake answers `compaction <label>` with what its last session open said
  and which overriding variables its own spawn sees, so each check reads what
  crossed to the agent. The harness arms one such variable on the server
  (`DISABLE_AUTO_COMPACT`, the descriptor's `env`), the way a host might.

  A change to either setting restarts the chat row, on the server and then in
  the tab, and the tab's rebuild closes the conversation's fold. So every
  change below waits for the old composer to be gone from the page and for
  the agent to be asked to reopen the conversation, then opens the fold again
  before the next message: that message must reach the agent the new value
  opened. Pressing `custom` saves nothing, so it restarts nothing.

  Background:
    Given I open the app
    And I show the done nodes
    And I open the outline "house.olai"
    And I open the "claude" agent on node "kitchen"
    And the node agent's fold is ready

  Scenario: Nothing set: olai names no size, and the host's override does not reach the agent
    When I ask the agent "compaction first"
    Then the agent is idle
    And the agent's answer mentions "compaction first: not set; overrides seen: none"
    When I open the plugins panel
    Then the "chat" setting "compact-at" shows "model-limit" pressed
    And the plugin "chat" marks "compact-at" as authored by "default"
    And the "chat" setting "compact-at" is described as "Where a conversation is compacted: model-limit"
    And there should be no page errors

  Scenario: A size rides the call that loads the conversation
    When I ask the agent "keep this conversation"
    Then the agent is idle
    When I remember this conversation as "kept"
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    And I open the plugins panel
    And I pick "200k" for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "200k"
    And the "chat" setting "compact-at" shows "200k" pressed
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    And the panel is in the remembered conversation "kept"
    When I ask the agent "compaction resumed"
    Then the agent is idle
    And the agent's answer mentions "compaction resumed: on at window 233000; overrides seen: none; opened by session/load"
    And there should be no page errors

  Scenario: Switched off, olai says nothing and strips nothing; switched on, it strips again
    When I ask the agent "before the switch"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I expand the plugin "chat"
    And the "chat" setting "auto-compact" is described as "Off, olai sends nothing and leaves the host's variables alone"
    And I toggle "chat" setting "auto-compact"
    Then file "_olai/Settings.olai" has namespace "chat" setting "auto-compact" as "no"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction off"
    Then the agent is idle
    And the agent's answer mentions "compaction off: not set; overrides seen: DISABLE_AUTO_COMPACT"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I toggle "chat" setting "auto-compact"
    And I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction on again"
    Then the agent is idle
    And the agent's answer mentions "compaction on again: not set; overrides seen: none"
    And there should be no page errors

  Scenario: A typed size is saved on Enter, and the default puts model-limit back
    When I ask the agent "before the size"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I press custom for "chat" setting "compact-at"
    # PRESSING IT SAVES NOTHING: it opens an empty field, with the caret in it
    # and the sentence that says what to type.
    Then the "chat" setting "compact-at" shows custom pressed with "" in its field
    And the "chat" setting "compact-at" has focus
    And the "chat" setting "compact-at" suggests "a whole number of thousands from 100k to 1000k"
    And file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "<absent>"
    When I type "500k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "500k"
    And the "chat" setting "compact-at" shows custom pressed with "500k" in its field
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction typed"
    Then the agent is idle
    And the agent's answer mentions "compaction typed: on at window 533000; overrides seen: none"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I use the default for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "<absent>"
    And the "chat" setting "compact-at" shows "model-limit" pressed
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction default"
    Then the agent is idle
    And the agent's answer mentions "compaction default: not set; overrides seen: none"
    And there should be no page errors

  Scenario: A typed size is saved by leaving the field
    When I ask the agent "before leaving"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I press custom for "chat" setting "compact-at"
    And I type "250k" into "chat" setting "compact-at"
    And I leave "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "250k"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction left"
    Then the agent is idle
    And the agent's answer mentions "compaction left: on at window 283000; overrides seen: none"
    And there should be no page errors

  Scenario: The largest and smallest sizes are taken, and a size off the bounds or without its k is refused
    When I ask the agent "before the bounds"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I press custom for "chat" setting "compact-at"
    And I type "1000k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "1000k"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction largest"
    Then the agent is idle
    And the agent's answer mentions "compaction largest: on at window 1033000; overrides seen: none"
    # EACH REFUSAL IS THE SERVER'S, drawn under the knob, and nothing is
    # written: the file still says 1000k.
    When I open the plugins panel
    And I remember the settings file "_olai/Settings.olai"
    And I type "250" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then the "chat" setting "compact-at" problem says "a whole number of thousands from 100k to 1000k"
    And the remembered settings file is unchanged
    When I type "99k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then the "chat" setting "compact-at" problem says "a whole number of thousands from 100k to 1000k"
    And the remembered settings file is unchanged
    When I type "1001k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then the "chat" setting "compact-at" problem says "a whole number of thousands from 100k to 1000k"
    And the remembered settings file is unchanged
    # ESCAPE DROPS THE DRAFT: the field reads the saved size again.
    When I press "Escape" in "chat" setting "compact-at"
    Then the "chat" setting "compact-at" shows custom pressed with "1000k" in its field
    And the "chat" setting "compact-at" has no problem
    And the remembered settings file is unchanged
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I type "100k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "100k"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction smallest"
    Then the agent is idle
    And the agent's answer mentions "compaction smallest: on at window 133000; overrides seen: none"
    And there should be no page errors

  Scenario: Choosing model-limit from a size stops sending one
    When I ask the agent "before the choice"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I pick "200k" for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "200k"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction at 200k"
    Then the agent is idle
    And the agent's answer mentions "compaction at 200k: on at window 233000; overrides seen: none"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I pick "model-limit" for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "model-limit"
    And the "chat" setting "compact-at" shows "model-limit" pressed
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction at the limit"
    Then the agent is idle
    And the agent's answer mentions "compaction at the limit: not set; overrides seen: none"
    And there should be no page errors

  Scenario: A size saved before custom existed carries on, and is drawn as custom
    # `300k` was one of the four sizes on the old list; written into the file
    # the way it was then, it means what it meant.
    When I ask the agent "before the carry-over"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I write "300k" for the "chat" setting "compact-at" on disk
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction carried"
    Then the agent is idle
    And the agent's answer mentions "compaction carried: on at window 333000; overrides seen: none"
    When I open the plugins panel
    Then the "chat" setting "compact-at" shows custom pressed with "300k" in its field
    And the "chat" setting "compact-at" has no problem
    And there should be no page errors

  Scenario: 200k typed into the field is the 200k on the list
    When I ask the agent "before the typed word"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I press custom for "chat" setting "compact-at"
    And I type "200k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "200k"
    And the "chat" setting "compact-at" shows "200k" pressed
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction typed 200k"
    Then the agent is idle
    And the agent's answer mentions "compaction typed 200k: on at window 233000; overrides seen: none"
    And there should be no page errors

  Scenario: A draft in the field, then a press on the list: the press is what is saved
    # THE PRESS BLURS THE FIELD, and that blur is not a leave: saving the draft
    # first would disable the segments and lose the press.
    When I ask the agent "before the draft"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I press custom for "chat" setting "compact-at"
    And I type "250k" into "chat" setting "compact-at"
    And I pick "200k" for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "200k"
    And the "chat" setting "compact-at" shows "200k" pressed
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction pressed"
    Then the agent is idle
    And the agent's answer mentions "compaction pressed: on at window 233000; overrides seen: none"
    And there should be no page errors

  Scenario: A size written in the file that is refused falls back to model-limit
    # FROM 300k, so the refusal is a change the row restarts for: the refused
    # value falls back to model-limit, which is not where the agent was.
    When I ask the agent "before the file"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I write "300k" for the "chat" setting "compact-at" on disk
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction at 300k"
    Then the agent is idle
    And the agent's answer mentions "compaction at 300k: on at window 333000"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I write "42" for the "chat" setting "compact-at" on disk
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction after the typo"
    Then the agent is idle
    And the agent's answer mentions "compaction after the typo: not set; overrides seen: none"
    When I open the plugins panel
    Then the "chat" setting "compact-at" shows refused file text "42" inline with default "model-limit"
    And there should be no page errors

  Scenario: A setting changed under an open conversation: the conversation carries on in place
    Given I mark the page
    When I ask the agent "the first message"
    Then the agent is idle
    And the agent's answer mentions "you said: the first message"
    When I remember this conversation as "ongoing"
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    And I open the plugins panel
    And I press custom for "chat" setting "compact-at"
    And I type "100k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "100k"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    And the panel is in the remembered conversation "ongoing"
    When I ask the agent "the next message"
    Then the agent is idle
    And the agent's answer mentions "you said: the next message"
    When I ask the agent "compaction smaller"
    Then the agent is idle
    And the agent's answer mentions "compaction smaller: on at window 133000"
    And the page has not reloaded
    And there should be no page errors

  Scenario: After a reload the panel draws what the file says
    When I open the plugins panel
    And I press custom for "chat" setting "compact-at"
    And I type "250k" into "chat" setting "compact-at"
    And I press "Enter" in "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "250k"
    When I reload the page
    And I open the plugins panel
    Then the "chat" setting "compact-at" shows custom pressed with "250k" in its field
    When I pick "model-limit" for "chat" setting "compact-at"
    Then file "_olai/Settings.olai" has namespace "chat" setting "compact-at" as "model-limit"
    When I reload the page
    And I open the plugins panel
    Then the "chat" setting "compact-at" shows "model-limit" pressed
    And there should be no page errors

  Scenario: Switched off with a typed size saved, olai says nothing and strips nothing
    When I ask the agent "before the typed size"
    Then the agent is idle
    And the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I write "250k" for the "chat" setting "compact-at" on disk
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction at 250k"
    Then the agent is idle
    And the agent's answer mentions "compaction at 250k: on at window 283000; overrides seen: none"
    Given the agent notes every conversation it loads
    And I remember the chat composer before leaving
    When I open the plugins panel
    And I toggle "chat" setting "auto-compact"
    Then file "_olai/Settings.olai" has namespace "chat" setting "auto-compact" as "no"
    When I close the plugins panel
    Then the remembered chat composer is detached
    And the agent has reopened the conversation on node "kitchen" in "house.olai"
    And the node agent's fold is ready
    When I ask the agent "compaction off at 250k"
    Then the agent is idle
    And the agent's answer mentions "compaction off at 250k: not set; overrides seen: DISABLE_AUTO_COMPACT"
    And there should be no page errors
