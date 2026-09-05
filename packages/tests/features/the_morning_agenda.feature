Feature: The morning agenda — a plugin the vault defines, standing on a plugin the build shipped

  `a_plugin_the_vault_defines.feature` proves the last inch of the mechanism: a
  chunk this serve compiled out of a note reaching a tab, and a face inside it
  drawing. This feature is about the OTHER thing a definition can be — one that
  does something rather than draws something, and one whose whole reason to
  exist is a door another row stands behind.

  THE DOOR IS `journal.agenda`. The journal row already computes what is dated
  on a day and what is owed as of it, and until 12d only its own two pages could
  reach the answer. It offers it now with `Offers.own`, so the key is stamped
  from that fiber's own name, and a consumer — including one somebody wrote into
  the vault this morning — names `serviceTag(…)("journal.agenda")` in its
  `needs` and gets the reactive half for free: it waits while the journal is
  off, saying which key it is waiting on, and comes back when the journal does.

  THE CONSUMER IS `docs/dynamic-plugins.md`'s worked example — not a copy of it
  written to look like one: the fixture's source is that page's block with two
  lines swapped, both of them the clock (it looks from midnight rather than
  seven, and beats every second rather than every five minutes, because a
  scenario cannot sit out either). That is not a promise made in prose. It is
  `morning_agenda.test.ts`, which substitutes the two lines back and asks the
  page whether it carries the result — so an improvement to the doc that never
  reaches this corpus is red, rather than quietly making the scenario evidence
  for source nobody is being shown.

  WHY A NODE AGENT AND NO PICKER. A conversation seated on a node is in every
  plugin's delivery scope by derivation, from its own subtree
  (`olai-plugin-chat`'s `scoped.ts`), so this plugin declares no wake and nobody
  picks a file for it. That is the shape the design is written for: an agent
  writes a plugin into its own subtree and the plugin talks back to the agent.

  @scratch:morning-agenda
  Scenario: Approved, it reads the journal and speaks into the node agent's conversation
    Given I open the outline "work.olai"
    And I open the plugins panel
    # A DEFINITION IS A ROW AND NOT A FIBER until somebody decides — and the
    # source is on the panel because approving is reading.
    Then the plugins panel says "morning-agenda" is "read the source below and approve it"
    # ...and only ONE half, because a plugin that draws nothing is a whole
    # plugin: `browser.tsx` is optional and this one has none.
    And the plugins panel shows only the server half of "morning-agenda"

    When I approve the plugin "morning-agenda"
    # RUNNING, not waiting: the journal is a row in this build and is behind the
    # key this definition named. Nothing in core knows the two are connected.
    Then the plugins panel says nothing more about "morning-agenda"

    When I close the plugins panel
    And I open the node menu of "gardener"
    And I choose "Start an agent session" from the node menu
    And the agent panel is open
    Then the panel header names the node agent "the gardener"

    # ...AND THE SENTENCE ARRIVES, in the lane a person's own words go out on,
    # wearing a face that is not theirs. Nobody pointed this doorbell at a file:
    # a seated conversation is in scope by derivation, so the plugin's tick found
    # it the moment the session existed.
    Then the chat shows a sentence no person typed
    And that sentence was rung by "morning-agenda"
    And that sentence is not one of my own messages
    # ONE LINE, and the account behind a press — the same fold every delivered
    # row draws, and the byline is the plugin's own first line rather than a
    # label this client composed.
    And that sentence names "Morning agenda for"
    And that sentence is one line, with its account folded away

    When I open that sentence
    # THE JOIN, which is the whole point of the door: work dated in 2019 on a
    # board this plugin cannot read, reached through a reading it never looked
    # inside, in a sentence it wrote itself.
    Then that sentence names "dig the post holes"
    And that sentence names "pull the permit"
    # ...AND THE FILE, which is the field only a structural consumer reads. The
    # fixture's plugin spells the answer's shape by hand — it cannot import the
    # format — so it is the one reader in this tree that a renamed field would
    # break silently: the title is asserted by the journal's own bench, and
    # `in undefined` on this line would be asserted by nothing else at all.
    And that sentence names "work.olai"
    # ...and an OCCURRENCE is not owed. A date with no mark is a thing that
    # happened, not work somebody is late on, so the timber does not appear on
    # an overdue line — the format's own rule, spent one plugin further out.
    And that sentence does not name "the timber arrives"
    And there should be no page errors

  @scratch:morning-agenda
  Scenario: The key is the journal's, so the row waits when the journal is switched off
    Given I open the outline "work.olai"
    And I open the plugins panel
    When I approve the plugin "morning-agenda"
    Then the plugins panel says nothing more about "morning-agenda"
    # DISCOVERY IS LIVE, which is what makes `inspect_plugins` an answer rather
    # than a description: the key is on the catalog because a row is behind it
    # right now.
    And the agent service catalog includes "journal.agenda"

    When I switch the plugin "journal" off
    # WAITING, NOT FAILED — nothing went wrong — and the sentence NAMES the key,
    # because "waiting for something it needs" sends a person to the source and
    # a key sends them to the row that offers it.
    Then the plugins panel says "morning-agenda" is "journal.agenda"
    And the agent service catalog excludes "journal.agenda"

    When I switch the plugin "journal" on
    Then the plugins panel says nothing more about "morning-agenda"
    And the agent service catalog includes "journal.agenda"
    And there should be no page errors
