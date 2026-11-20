Feature: The morning agenda — a plugin the vault defines, standing on a plugin the build shipped

  `a_plugin_the_vault_defines.feature` proves the last inch of the mechanism: a
  chunk this serve compiled out of a folder reaching a tab, and a face inside it
  drawing. This feature is about the OTHER thing a plugin can be — one that
  does something rather than draws something, and one whose whole reason to
  exist is a door another row stands behind.

  THE DOOR IS `journal.agenda`. The journal row already computes what is dated
  on a day and what is owed as of it, and until 12d only its own two pages could
  reach the answer. It offers it now with `Offers.own`, so the key is stamped
  from that fiber's own name, and a consumer — including one somebody wrote into
  the vault this morning — names `serviceTag(…)("journal.agenda")` in its
  `needs` and gets the reactive half for free: it waits while the journal is
  off, saying which key it is waiting on, and comes back when the journal does.

  THE CONSUMER IS `website/docs/dynamic-plugins.md`'s worked example — not a copy of it
  written to look like one: `plugins/morning-agenda/server.ts` is that page's
  block with two lines swapped, both of them the clock (it looks from midnight
  rather than seven, and beats every second rather than every five minutes,
  because a scenario cannot sit out either). That is not a promise made in
  prose. It is `morning_agenda.test.ts`, which substitutes the two lines back
  and asks the page whether it carries the result — so an improvement to the doc
  that never reaches this corpus is red, rather than quietly making the scenario
  evidence for source nobody is being shown.

  THE FOLDER IS TWO FILES, because a plugin that draws nothing needs no browser
  half, and the corpus carries no consent at all — so it arrives off and
  unapproved and a person turns it on at its page, which is the only place that
  press exists.

  WHY A NODE AGENT AND NO PICKER. A conversation seated on a node is in every
  plugin's delivery scope by derivation, from its own subtree
  (`olai-plugin-chat`'s `scoped.ts`), so this plugin declares no wake and nobody
  picks a file for it. That is the shape the design is written for: an agent
  writes a plugin into its own subtree and the plugin talks back to the agent.

  @scratch:morning-agenda
  Scenario: Approved, it reads the journal and speaks into the node agent's conversation
    Given a task is due today
    And I open the outline "work.olai"
    When I go to the plugin "morning-agenda"
    Then the plugin page is "review"
    And the plugin page's code tabs are "README.md, server.ts"
    And the plugin page says it uses "Uses what the `journal` plugin offers"

    When I press the plugin page verb
    Then the plugin page is "on"
    And the plugin page draws no banner

    When I click sidebar file "work.olai"
    And I open the node menu of "gardener"
    And I choose "Start an agent" from the node menu
    Then node agent "gardener" is unfolded
    And the panel header names the node agent "the gardener"

    Then the chat shows a sentence no person typed
    And that sentence was rung by "morning-agenda"
    And that sentence is not one of my own messages
    And that sentence names "Morning agenda for"
    And that sentence is one line, with its account folded away

    When I open that sentence
    Then that sentence names "dig the post holes"
    And that sentence names "pull the permit"
    And that sentence names "work.olai"
    And that sentence names "On today:"
    And that sentence names "sand the rails"
    And that sentence does not name "the timber arrives"
    And there should be no page errors

  @scratch:morning-agenda
  Scenario: The key is the journal's, so the plugin waits when the journal is switched off
    Given I open the outline "work.olai"
    When I approve the plugin "morning-agenda"
    And I open the plugins panel
    Then the plugins panel says nothing more about "morning-agenda"
    And the agent service catalog includes "journal.agenda"

    When I switch the plugin "journal" off
    Then the plugins panel says "morning-agenda" is "journal.agenda"
    And the agent service catalog excludes "journal.agenda"
    When I close the plugins panel
    And I go to the plugin "morning-agenda"
    Then the plugin page says "journal.agenda"

    When I open the plugins panel
    And I switch the plugin "journal" on
    Then the plugins panel says nothing more about "morning-agenda"
    And the agent service catalog includes "journal.agenda"
    And there should be no page errors
