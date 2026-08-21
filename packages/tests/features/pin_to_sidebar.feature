@share-scratch
@scratch:good
Feature: Pinning a page to the sidebar
  A shelf of doors at the top of the directory column: any node, any document,
  and the page a reader has narrowed with a query, one click away.

  The whole of it is STORED IN THE DIRECTORY and nothing about it is
  browser-local — `Pins.olai`, one ordinary node per pin, whose title is the
  ADDRESS the pin opens. That is what makes the shelf something an agent can
  read and write with the tools it already has (`add_node`, `move_node`,
  `trash_node`), and it is why these scenarios assert on the FILE as often as
  on the column.

  Two promises a screenshot cannot make are here as scenarios: a click lands on
  the page WITH its query, and a node renamed anywhere else says its new name
  on the shelf — because the shelf keeps no copy of it to go stale.

  `@scratch:` because these write the directory they are served. They share
  one copy per worker (`@share-scratch`); the corpus is restored between
  scenarios.

  Background:
    Given I open the outline "house.olai"
    And I mark the page

  Scenario: A node pinned from the row menu appears on the shelf, and in the file
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    Then the pinned shelf holds "/#order"
    # Minted where olai puts the files it names itself, not at the top level of
    # somebody else’s directory.
    And "_olai/Pins.olai" holds a node titled "/#order"
    And the pin "/#order" is named "order the new cabinets"
    And there should be no page errors

  Scenario: The shelf says the node's name RIGHT NOW, not the one it was pinned under
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    And the file "house.olai" renames "order" to "order the walnut ones"
    Then the pin "/#order" is named "order the walnut ones"

  Scenario: A pinned node is offered the way off the shelf instead
    When I open the node menu of "order"
    And I choose "Pin to sidebar" from the node menu
    And I open the node menu of "order"
    Then the node menu offers "Unpin from sidebar"
    And the node menu does not offer "Pin to sidebar"

  Scenario: The page a reader has narrowed is pinned WITH its query, and opens with it
    When I filter the page by "is:todo"
    And I pin the page
    # A narrowed page is the one address nothing in the set can name, so the
    # chord asks what to call it — and ENTER WITH NOTHING is the bare pin this
    # app has always written, one keystroke from where the caret already is.
    Then the palette asks "a name for this pin — Enter with nothing pins it unnamed"
    When I name the pin ""
    Then the pinned shelf holds "/house.olai?q=is%3Atodo"
    And "_olai/Pins.olai" holds a node titled "/house.olai?q=is%3Atodo"
    When I open the outline "garden.olai"
    And I mark the screen
    And I follow the pin "/house.olai?q=is%3Atodo"
    # The WHOLE bar, not the path: a door that dropped the query would pass a
    # step that only read the path, and would open a different page.
    Then the address is exactly "/house.olai?q=is%3Atodo"
    And the filter box holds "is:todo"
    # AND IT ARRIVES NARROWED. `demo` is done, so the query the pin carries
    # leaves it out — and a page that drew it and took it away again is the
    # whole outline on screen in front of somebody who asked for four rows of
    # it. It used to be: the question was gated on the page having rows, that
    # collapsed for the length of the navigation, and the query in the address
    # was thrown away and re-debounced from the frame the page landed
    # (docs/brainstorming/reactivity-after-the-flip.md §3.1's 1.6).
    And the node "demo" was never drawn
    # AND IT NEVER EMPTIED ON THE WAY, which is the SAME seam read from the
    # other side. The page and its narrowing are two members and two frames; the
    # claim above is the order where the PAGE lands first, and this is the order
    # where the ANSWER does — house's ids spent on the garden page still on
    # screen name nothing on it, so every row goes. That order is measured not to
    # happen and is promised by nothing, which is why the pane spends an answer
    # only on the page it is ABOUT (`client/pane/PageView.tsx`'s `together`):
    # this line asserts an invariant rather than watching a race.
    And the pane was never empty

  Scenario: A saved search is NAMED where the thought arrives, and comes back named
    # The gap this closes: a reader who has just narrowed a page had to pin it
    # unnamed and then go and find `Pins.olai` to call it anything. The name is
    # typed in the palette's own box — the shape `+ a line` already taught —
    # and what lands is one op: the row an agent would write by hand.
    When I filter the page by "is:todo"
    And I pin the page
    And I name the pin "What is late"
    Then the pin "/house.olai?q=is%3Atodo" is named "What is late"
    # The name renames the PIN and never the destination, so the query is still
    # drawn beside it — a door onto a narrowed page that did not say so would
    # promise something it does not open.
    And the pin "/house.olai?q=is%3Atodo" carries the query "is:todo"
    And "_olai/Pins.olai" holds a node titled "[What is late](/house.olai?q=is%3Atodo)"
    When I open the outline "garden.olai"
    And I follow the pin "/house.olai?q=is%3Atodo"
    Then the address is exactly "/house.olai?q=is%3Atodo"
    And the filter box holds "is:todo"
    And there should be no page errors

  Scenario: Escape backs out of the name, and out of the pin with it
    # The third of the three keys this slice rules, and the only one whose
    # claim is that NOTHING happened: the question is up BEFORE the write, so
    # backing out of it backs out of the whole gesture (grok and opencode both
    # asked for this one, on #282).
    When I filter the page by "is:todo"
    And I pin the page
    Then the palette asks "a name for this pin — Enter with nothing pins it unnamed"
    When I press "Escape"
    Then the pinned shelf is not drawn
    # The FILE, not just the column: a shelf olai never minted is the proof
    # that no write went out — and a minted-but-empty one would be the file
    # this resolver's ONE op exists to prevent.
    And "_olai/Pins.olai" holds nothing
    # …and backing out is not a mode: the chord still works after it.
    When I pin the page
    And I name the pin ""
    Then the pinned shelf holds "/house.olai?q=is%3Atodo"
    And there should be no page errors

  Scenario: The question owns the modal, so a second press does not wipe the name
    # ⌘⇧P is live while the caret is in the filter box, which is also where a
    # hand is while it is typing a name — and pressing it again used to raise
    # the same question a second time, handing the box back its opening words
    # (opencode, on #282). A question is answered or backed out of; nothing
    # pressed elsewhere becomes its answer or writes past it.
    When I filter the page by "is:todo"
    And I pin the page
    And I type "What is late" into the palette
    And I pin the page
    Then the palette box holds "What is late"
    And the palette asks "a name for this pin — Enter with nothing pins it unnamed"
    # …and the words that survived are the ones that land.
    When I name the pin "What is late"
    Then the pin "/house.olai?q=is%3Atodo" is named "What is late"
    And there should be no page errors

  Scenario: A pin is renamed from the shelf, and ⌘Z takes the name back
    # Renaming is `set_title` on the pin's own row — the op an agent sends and
    # the one the undo stack already knows — so the shelf's door onto it needs
    # no verb of its own.
    Given the directory has the pins:
      | /#order |
    When I rename the pin "/#order"
    Then the palette asks "a name for this pin — Enter with nothing takes the name off"
    When I name the pin "Kitchen project"
    Then the pin "/#order" is named "Kitchen project"
    And "Pins.olai" holds a node titled "[Kitchen project](/#order)"
    When I press "ControlOrMeta+z"
    # Back to a bare address, which is drawn by what it points at — live.
    Then the pin "/#order" is named "order the new cabinets"
    And there should be no page errors

  Scenario: A document is a door like any other
    When I open the document "finishes.md"
    And I pin the page
    Then the pinned shelf holds "/finishes.md"
    And the pin "/finishes.md" is named "finishes.md"

  Scenario: The chord is a toggle over one address, and mints the shelf under _olai/
    When I pin the page
    Then the pinned shelf holds "/house.olai"
    # WHERE a shelf is minted: a file olai made because somebody pressed
    # something is not one of the reader's own, and the top level of a served
    # directory is theirs.
    And "_olai/Pins.olai" holds a node titled "/house.olai"
    When I pin the page
    Then the pinned shelf is not drawn
    # Unpinning is the set's own removal, so it is reversible rather than gone.
    And "_olai/Trash.olai" holds a node titled "/house.olai"

  Scenario: A pin is taken off the shelf from the shelf
    When I pin the page
    And I unpin "/house.olai"
    Then the pinned shelf is not drawn

  Scenario: Pins are ordered by the file, and a drag reorders them
    Given the directory has the pins:
      | /#order  |
      | /#demo   |
      | /agenda   |
    Then the pinned shelf reads "/#order /#demo /agenda"
    When I drag the pin "/agenda" above "/#order"
    Then the pinned shelf reads "/agenda /#order /#demo"
    And there should be no page errors

  Scenario: Pins.olai opened as an outline reads like an outline
    # The shelf is an ordinary file you are invited to browse and edit — so the
    # page must not show the plumbing the shelf resolves. A title that is
    # NOTHING BUT an address is drawn as the page it names, wherever it is
    # drawn, which is one resolver rather than a case per page.
    Given the directory has the pins:
      | /finishes.md |
      | /#order         |
    When I open the outline "Pins.olai"
    Then the node "p0" reads "finishes.md"
    And the node "p1" reads "order the new cabinets"
    # …and it is still the address underneath: what the editor opens is the
    # source, exactly as it is for a markdown title.
    When I click the title of "p1"
    Then the editor holds "/#order"
    And there should be no page errors

  Scenario: A pin written as a link draws its NAME, and pressing it opens the address
    # Renaming a pin is editing the row's text — no op, no field. The label is
    # what somebody chose, so it is drawn as the words they chose; the query is
    # drawn beside it either way, because a name renames the PIN and never the
    # destination.
    Given the directory has the pins:
      | [Kitchen project](/#order)          |
      | [What is late](/agenda?q=is%3Atodo)  |
    Then the pin "/#order" is named "Kitchen project"
    And the pin "/agenda?q=is%3Atodo" is named "What is late"
    And the pin "/agenda?q=is%3Atodo" carries the query "is:todo"
    When I open the outline "Pins.olai"
    # Marked HERE: opening an outline is a real navigation, so the claim below
    # is about the LABEL press and nothing before it.
    And I mark the page
    Then the node "p0" reads "Kitchen project"
    And the node "p1" reads "What is late is:todo"
    When I press the name of "p0"
    Then the address is "/#order"
    And the page has not reloaded

  Scenario: A label is the words somebody chose, not markup
    # A hash-tag in a label stays those characters: the label names a door, and
    # a face that restyled part of it would be making a claim about the
    # directory out of somebody's punctuation.
    Given the directory has the pins:
      | [Kitchen #home](/#order) |
    Then the pin "/#order" is named "Kitchen #home"
    When I open the outline "Pins.olai"
    Then the node "p0" reads "Kitchen #home"
    And the node "p0" draws no tag

  Scenario: A reorder lands where the pointer is, though the page moved under it
    # The shelf is in a STICKY column: its rows do not move when the document
    # does. Answered in document coordinates, a drag freezes its midpoints at
    # the scroll position of the lift and then reads the pointer against a
    # newer one — so it writes a gap nobody aimed at. The page is scrolled
    # MID-DRAG here, which is what the window-edge autoscroll used to do on the
    # reader's behalf.
    Given the directory has the pins:
      | /#order  |
      | /#demo   |
      | /agenda   |
    When I open the document "kitchen-sink.md"
    And I drag the pin "/agenda" above "/#order" while the page scrolls
    Then the pinned shelf reads "/agenda /#order /#demo"
    And there should be no page errors

  Scenario: A title spelled with an escape nothing can read takes nothing down
    # `Pins.olai` is a file the format invites a hand and an agent to edit, and
    # `decodeURIComponent("%")` throws — which during render is the whole
    # sidebar, not one skipped row.
    Given the directory has the pins:
      | /#%     |
      | /#order |
    Then the pinned shelf reads "/#order"
    And the outline list links to "house.olai"
    And there should be no page errors

  Scenario: A pin an agent wrote arrives without a reload
    When the directory grows a pin to "/agenda"
    Then the pinned shelf holds "/agenda"
    And the page has not reloaded
