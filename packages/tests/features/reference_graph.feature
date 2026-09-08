@share-scratch
@scratch:good
Feature: The reference graph — every way a page finds where a record is talked about
  The directory holds one table of references, and until the graph it was
  read only backwards: a zoomed node's Referenced by, a document's namesake
  section — both half of the same fold. The graph is the FORWARD half, drawn:
  every `see`, every `doc` attachment, every link in a note, every `@id`
  mention, around whichever vertex the address names — or over the whole
  reading when it names none.

  The address IS the page's request: `/graph` draws the whole reading,
  `/graph/<address>` draws the neighbourhood of one vertex, and `?hops=2`
  widens it — the hand's own rule, which is why Back undoes a horizon jump
  and a copy of the URL is a copy of the view.

  Four rulings the drawing stands on, restated once: a mirror is a view and
  opens no second dot; what is put away is at neither end; an `after` line is
  the ordering graph and is not a reference; a vertex is the record pointed
  AT, however many ways one writer wrote the pointing.

  `@scratch:` because these scenarios put rows on the disk they are served,
  as another editor would. They share one copy per worker (`@share-scratch`);
  the corpus is restored between scenarios.

  Background:
    Given the outline "house.olai" holds a row whose see points at the herb bed
    And the note "notes/brief.md" links the herb bed and the house
    And the record "labels" is put away

  # ── what the neighbourhood draws ─────────────────────────────────────

  Scenario: A node's neighbourhood draws every way, both grains
    # `herbs` is seen by `order` (a plain `see`), by `worktop` (both a `see`
    # and the `@id` in its own title), and is linked by the note — a picture
    # of every arrow kind a single page meets.
    Given I open the reference graph around "#herbs"
    Then the dot "#herbs" is the graph's centre
    And the graph shows the dot "#order"
    And the graph shows the dot "#worktop"
    And the graph shows the dot "notes/brief.md"
    # The note is the OTHER grain a vertex can have: a document's dot is not
    # a record's dot.
    And the dot "notes/brief.md" has the grain "document"
    And the arrow runs from "#order" to "#herbs" the see way
    And the arrow runs from "#worktop" to "#herbs" the see+mention way
    And the arrow runs from "notes/brief.md" to "#herbs" the link way
    And there should be no page errors

  Scenario: A document's neighbourhood — a note that links is its own vertex
    Given I open the reference graph around "notes/brief.md"
    Then the dot "notes/brief.md" is the graph's centre
    And the dot "notes/brief.md" has the grain "document"
    And the graph shows the dot "#herbs"
    And the graph shows the dot "house.olai"
    And the graph shows the dot "#order"
    # The outline the note names is itself a vertex — a file is a neighbour.
    And the dot "house.olai" has the grain "outline"
    And the arrow runs from "notes/brief.md" to "#herbs" the link way
    And the arrow runs from "notes/brief.md" to "house.olai" the link way
    And the arrow runs from "notes/brief.md" to "#order" the mention way
    And there should be no page errors

  Scenario: A dot opens its page, a document dot opens the document
    # The half of the graph that is a directory: following a dot is the
    # same press as following its reference inline.
    Given I open the reference graph around "#herbs"
    When I follow the graph dot "#worktop"
    Then the address is "#worktop"
    Given I open the reference graph around "#herbs"
    When I follow the graph dot "notes/brief.md"
    Then the address is "notes/brief.md"
    And there should be no page errors

  Scenario: Pointing at a dot says where it sits, and Centre here re-centres
    # The caption is one sentence that is also a move: the pointed dot can
    # become the page's centre without a round-trip through its record.
    Given I open the reference graph around "#herbs"
    When I hover the graph dot "#worktop"
    Then the graph's caption reads "seal the worktop like @herbs — kitchen remodel #home — house.olai"
    When I press centre here
    Then the address is "/graph/#worktop"
    And the dot "#worktop" is the graph's centre
    And there should be no page errors

  Scenario: Two hops, and the address says so
    # One hop out of `herbs` are only its speakers; `house.olai` — the note's
    # other link — arrives with the second one.
    Given I open the reference graph around "#herbs"
    And the graph shows no dot "house.olai"
    When I set the horizon to 2 hops
    Then the graph is at 2 hops
    And the address is "/graph/?hops=2#herbs"
    And the graph shows the dot "house.olai"
    # A jump is a PUSH: Back undoes it the way Back undoes any page.
    When I go back
    Then the address is "/graph/#herbs"
    And the graph shows no dot "house.olai"
    And there should be no page errors

  # ── that it stays itself while the directory moves ───────────────────

  Scenario: A reference written elsewhere arrives on an open graph
    # Not a reload — the same picture picks the new dot up, because the
    # drawing is the listener's own reaction to the wire.
    Given I open the reference graph around "#herbs"
    And I mark the page
    When another writer makes "slugs" see "herbs"
    Then the graph shows the dot "#slugs"
    And the arrow runs from "#slugs" to "#herbs" the see way
    And the page has not reloaded
    And there should be no page errors

  Scenario: A retitle moves nothing
    # The picture is the reading's shape, not its words: a record keeping its
    # id keeps its placement through a renaming — otherwise every live title
    # would be a page that rearranges itself under a hovering hand.
    Given I open the reference graph around "#herbs"
    And I record the position of the graph dot "#worktop"
    When another writer retitles "worktop" to "seal the worktop with mineral oil like @herbs"
    Then the graph dot "#worktop" has not moved
    And the dot "#worktop" labels its new title "seal the worktop with mineral oil like @herbs"
    And there should be no page errors

  # ── the rulings, as the page holds them ──────────────────────────────

  Scenario: What is put away is at neither end, the centre included
    # `labels` went to the Trash before any of these runs: it is OUT of the
    # reading rather than at its margins — and asked for by name, its own
    # page says where it went rather than drawing a ghost.
    Given I open the reference graph around "#labels"
    Then the graph says "#labels is in the Trash, which is the one page that draws it. Open the Trash."
    When I follow the link in the graph's sentence
    Then the address is "_olai/Trash.olai"
    And there should be no page errors

  Scenario: A placement is not a reference, and one made through it is
    # `kitchen-herbs` is a mirror — a second VIEW of the one record. No edge
    # has it at an end, and a `see` onto it lands on the record it shows.
    Given I open the outline "garden.olai"
    And I open the reference graph around "#herbs"
    Then the graph shows no dot "#kitchen-herbs"
    When another writer makes "slugs" see "kitchen-herbs"
    Then the arrow runs from "#slugs" to "#herbs" the see way
    And there should be no page errors

  Scenario: An ordering edge is not a reference
    # `hinges` is after both `handles` and `order` — the ordering table,
    # whose two directions are already on the node page. The graph is the
    # referral table, so a page around `hinges` meets none of them.
    Given I open the reference graph around "#hinges"
    Then the graph shows no dot "#handles"
    And the graph shows no dot "#order"
    And no arrow runs from "#hinges" to "#handles"
    And the graph says "Nothing refers to this one, and it refers to nothing — no `see` written out and none pointed back."
    And there should be no page errors

  # ── the two arms that have no picture ────────────────────────────────

  Scenario: A node nothing refers to says so
    # The centre stays: the page is ABOUT `labels`, matched or not — so its
    # own sentence names the fact rather than offering to forget the visit.
    Given I open the reference graph around "#basil"
    Then the dot "#basil" is the graph's centre
    And the graph says "Nothing refers to this one, and it refers to nothing — no `see` written out and none pointed back."
    And there should be no page errors

  Scenario: An address that names nothing is a page that says so
    Given I open the reference graph around "#nobody"
    Then the graph says "No node is called #nobody — it was deleted, or the outline holding it is no longer served."
    Given I open the reference graph around "notes/nothere.md"
    Then the graph says "No file at notes/nothere.md — it was moved, renamed, or is no longer one of the served kinds."
    And there should be no page errors

  # ── the whole reading, and the pick that prunes it ───────────────────

  Scenario: The whole reading is the directory's vertices, not its corpus
    # Its files are not on it, only the ones in play: no `garden` for being
    # a file, no `quarter.html` for being served, no `kitchen` for being a
    # parent. The labels naming the landscape belong to the two outlines —
    # records' own files; files a document drew, unlabelled.
    Given I open the reference graph
    Then the graph shows the dot "#herbs"
    And the graph shows the dot "#order"
    And the graph shows the dot "#worktop"
    And the graph shows the dot "#install"
    And the graph shows the dot "notes/brief.md"
    And the graph shows the dot "finishes.md"
    And the graph shows the dot "house.olai"
    And the graph shows the dot "report.html"
    And the graph shows no dot "#kitchen"
    And the graph shows no dot "quarter.html"
    And the graph names the file "garden.olai"
    And the graph names the file "house.olai"
    And the graph names no file "notes/brief.md"
    And the graph names no file "finishes.md"
    And every way the reading knows is in the legend
    And there should be no page errors

  Scenario: A pick takes dots away and keeps the centre; a word in a body keeps a document
    # Filtering prunes the drawing, not the page: `is:done` cuts everything
    # but the still-showing centre (which no verdict can select), and the
    # reverse — a word the note holds — is what keeps THAT vertex.
    Given I open the reference graph around "#herbs"
    When I filter the page by "is:done"
    Then the graph shows no dot "#worktop"
    And the graph shows no dot "notes/brief.md"
    And the dot "#herbs" is the graph's centre
    And the graph shows no dot "#order"
    When I clear the filter
    And I filter the page by "bed"
    Then the graph shows the dot "#herbs"
    And the graph shows the dot "notes/brief.md"
    And the graph shows no dot "#worktop"
    When I clear the filter
    Then the graph draws exactly 4 dots
    And there should be no page errors

  Scenario: Hiding finished work takes the arrows with the dots, and re-settles; the centre stays
    # The whole graph earring: order's dot, its TWO arrows and the ones
    # pointing AT it all leave — and herbs, itself finished, pastes back in
    # because a centre cannot be filtered out of its own page.
    Given I open the outline "house.olai"
    And I open the node menu of "order"
    And I choose "Complete" from the node menu
    And I open the outline "garden.olai"
    And I choose "Complete" from the node menu
    # `herbs` is the centre of the page being asked about: it stays, done or
    # no, because a page may not lose the vertex it is about.
    Given I open the reference graph around "#herbs"
    And the graph shows the dot "#order"
    When I hide the done nodes
    Then the graph shows no dot "#order"
    And no arrow runs from "#order" to "#herbs"
    And no arrow runs from "notes/brief.md" to "#order"
    And the dot "#herbs" is the graph's centre
    And the arrow runs from "#worktop" to "#herbs" the see+mention way
    And the arrow runs from "notes/brief.md" to "#herbs" the link way
    And there should be no page errors

  # ── the drawing machine ──────────────────────────────────────────────

  Scenario: The camera: fitted on open, closer, fitted again, and the pane is the page
    # The lens starts at the whole picture, neither nearer nor wider. This
    # is the one arithmetic claim the rest of the feature leans on: a scale
    # that OPENED at 1.00, one press closer, and the same picture coming out
    # of the lens the same size it went in.
    Given I open the reference graph
    Then the graph's camera reads "1.00"
    When I press the graph's closer control
    Then the graph is closer than fitted
    When I press the graph's fit control
    Then the graph's camera reads "1.00"
    And the graph's canvas fills the pane and the page does not scroll
    And there should be no page errors

  Scenario: The graph door is COLD, from the address bar
    # Permalink, full stop — what "the same page twice" bootstrapping the
    # link into a hand that has never seen the app looks like.
    Given I open the reference graph
    Then the graph door is drawn below the files
    When I press the palette shortcut
    Then the palette offers "Go to the graph"
    And I press the palette scrim
    And there should be no page errors

  @scratch:tangled
  Scenario: A crowded graph names only the labels that fit, and pointing names any dot
    # Tangled: the fixture the declutter is only honest about, because every
    # other one is spare — three outlines in one holding pattern until the
    # reader has to zoom to read it without help.
    Given I open the reference graph
    Then the graph draws every dot, naming only the ones that fit
    And there should be no page errors
