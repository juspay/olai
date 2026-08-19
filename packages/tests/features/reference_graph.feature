@scratch:good
Feature: The reference graph — the shape a directory's references make
  A zoomed node already says what points AT it. That is the right answer for a
  page about one node and the wrong one for the question behind it: which nodes
  are talking to each other, and where does this one sit among them.

  So there is a page that draws it. Dots are nodes, arrows are the references
  somebody wrote — a `see`, or an `@id` in a title or a note — pointing the way
  they were written, and a file's name is written under the nodes that landed
  together. Click a dot and you are on that node. Point at one and the line
  under the drawing says where it sits, which a bare title cannot.

  It is SCOPED: `/graph/<id>` is that node's own neighbourhood, one hop out by
  default and two on request, and `/graph` alone is the whole reference graph —
  every node that is IN it, which is not every node in the directory.

  Nothing is stored. It is the same two reverse indexes the `Referenced by …`
  section reads, plus the same reading forwards, so the drawing follows the disk
  with nothing reloaded — and the three rulings that section made hold here
  unchanged: a MIRROR is not a reference, an `after` is not one, and what is
  archived is drawn on the Trash and nowhere else.

  `@scratch:` because two scenarios write the directory they are served.

  # ── the neighbourhood ────────────────────────────────────────────────

  Scenario: A node's neighbourhood draws both kinds of reference
    # `order` (house.olai) SEES the herb bed; nothing in this corpus mentions it
    # yet, so another hand writes one — the same door `backlinks.feature` uses.
    Given another writer adds "look at @herbs before Tuesday" to "garden.olai"
    And I open the reference graph for "herbs"
    Then the graph is centred on "herbs"
    And the graph reaches 1 hops
    # Corpus order: garden.olai before house.olai, by line within each.
    And the graph draws the nodes "herbs, outsider, order"
    # Each arrow points the way it was WRITTEN — from the record that made the
    # reference to the node it named — and says how, so a `see` and a mention
    # are told apart without reading a colour.
    And the graph draws the arrows "outsider mention herbs, order see herbs"
    And the graph names the files "garden.olai, house.olai"
    And there should be no page errors

  Scenario: One record doing both is one arrow carrying both ways
    When I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order cabinets for @herbs","see":["herbs"]}
      """
    And I open the reference graph for "herbs"
    # THE EDGE FIRST and the prose after it, which is the format's own order.
    Then the graph draws the arrows "order see+mention herbs"
    And there should be no page errors

  Scenario: A dot is a link to the node
    Given I open the reference graph for "herbs"
    When I follow the graph to "order"
    Then the zoomed node is "order"
    And there should be no page errors

  Scenario: Pointing at a dot says where that node sits
    Given I open the reference graph for "herbs"
    # With nothing pointed at, the line says where the page's own node sits.
    Then the graph caption reads "the herb bed by the door — garden #outdoors"
    When I point at the graph node "order"
    Then the graph caption reads "order the new cabinets — kitchen remodel #home"
    # ...and the same sentence is on the dot itself, because a hover may never
    # be the only home of one.
    And the graph node "order" is labelled "order the new cabinets — kitchen remodel #home"
    And there should be no page errors

  # ── how far it reaches ───────────────────────────────────────────────

  Scenario: A second hop reaches the ring beyond, and the address says so
    Given another writer adds "look at @herbs before Tuesday" to "garden.olai"
    And I open the reference graph for "herbs"
    Then the graph draws 3 nodes
    When I rewrite "kitchen.olai" as:
      """
      {"id":"survey","ord":"a0","title":"measure the alcove","see":["order"]}
      """
    # `survey` sees `order`, which sees `herbs` — so it is two hops from the
    # centre and invisible at one.
    Then the graph draws 3 nodes
    When I set the graph horizon to 2 hops
    Then the graph reaches 2 hops
    And the address is "/graph/herbs"
    And the graph draws 4 nodes
    And the graph draws "survey" 2 hops out
    And there should be no page errors

  # ── what it says instead of drawing ──────────────────────────────────

  Scenario: A node nothing refers to says so rather than drawing a lone dot
    Given I open the reference graph for "compost"
    Then the graph says "Nothing refers to this node"
    And there should be no page errors

  Scenario: A permalink that names no node is the same answer /n/ gives
    Given I open the reference graph for "nowhere"
    Then a not-found is shown
    And there should be no page errors

  # ── the three rulings, inherited from the section ────────────────────

  Scenario: A placement is not a reference, and one made THROUGH a placement is
    # `kitchen-herbs` (house.olai) mirrors the herb bed. The mirror is nowhere
    # on the drawing — a view is not a claim — and asking for ITS graph lands on
    # the one graph the herb bed has, exactly as `/n/` on it lands on one page.
    Given I open the reference graph for "kitchen-herbs"
    Then the graph is centred on "herbs"
    And the graph draws the nodes "herbs, order"
    And there should be no page errors

  Scenario: An ordering edge is not a reference
    # `hinges` comes after `order`, and so does `install`. Neither is an arrow
    # here: the ordering graph is drawn on the node's own page, both ways.
    Given I open the reference graph for "order"
    Then the graph draws the arrows "order see herbs"
    And there should be no page errors

  Scenario: What is put away is at neither end
    When I rewrite "Archive.olai" as:
      """
      {"id":"retired","ord":"a0","title":"the old bed, see @herbs","see":["herbs"]}
      """
    And I open the reference graph for "herbs"
    Then the graph draws the nodes "herbs, order"
    And there should be no page errors

  # ── the whole of it ──────────────────────────────────────────────────

  Scenario: The corpus-wide reading is every node IN the graph, not every node
    Given I open the reference graph for the directory
    Then the graph is centred on nothing
    # `order` and `herbs` are the only two records in this corpus that refer or
    # are referred to. Everything else — the kitchen, the compost heap, every
    # task — is not part of the shape.
    And the graph draws the nodes "herbs, order"
    And there should be no page errors

  Scenario: The directory column opens it, and a node's own page opens its own
    Given I open the outline "house.olai"
    When I follow the Graph link in the sidebar
    Then the graph is centred on nothing
    When I open the node "herbs"
    And I follow the reference graph link
    Then the graph is centred on "herbs"
    And the address is "/graph/herbs"
    And there should be no page errors

  # ── live, which is the whole of "derived" ────────────────────────────

  Scenario: A reference written elsewhere arrives on a graph somebody is reading
    Given I open the reference graph for "herbs"
    And I mark the page
    Then the graph draws the nodes "herbs, order"
    When another writer adds "look at @herbs before Tuesday" to "garden.olai"
    Then the graph draws the nodes "herbs, outsider, order"
    And the graph draws the arrows "outsider mention herbs, order see herbs"
    And the page has not reloaded
    And there should be no page errors

  # ── narrowed, like every other page that draws nodes ─────────────────

  Scenario: A filter takes dots away and keeps the node the page is about
    Given another writer adds "look at @herbs before Tuesday" to "garden.olai"
    And I open the reference graph for "herbs"
    When I filter the page by "cabinets"
    # `order` matched; `outsider` did not and goes. The CENTRE stays whether or
    # not it matched — the page is that node's, and a neighbourhood with no
    # centre is a picture of nothing.
    Then the graph draws the nodes "herbs, order"
    And the graph draws the arrows "order see herbs"
    And the filter found "1 of 3"
    And there should be no page errors

  # ── the camera ───────────────────────────────────────────────────────

  Scenario: A page opens fitted, and the controls move the camera
    # FITTED is the camera doing nothing: the layout already puts the whole
    # graph in the frame, so `Fit` is a reset rather than a measurement.
    Given I open the reference graph for "herbs"
    Then the graph is fitted
    When I move the graph camera closer
    Then the graph is closer than fitted
    When I fit the graph
    Then the graph is fitted
    And there should be no page errors

  Scenario: A dot still opens its node once the camera has moved
    # The camera is applied to the POSITIONS, so a dot is the same link wherever
    # it has been moved to — which is the whole reason the nodes are HTML
    # anchors over the arrows rather than shapes inside them. The CENTRE is the
    # one this can name: a zoom is about the middle of the frame, so what was
    # there is still there, while a dot near the edge may have been moved off
    # the page entirely (and is then not drawn at all).
    Given I open the reference graph for "herbs"
    When I move the graph camera closer
    Then the graph is closer than fitted
    When I follow the graph to "herbs"
    Then the zoomed node is "herbs"
    And there should be no page errors

  Scenario: A crowded graph draws every dot and only the labels that fit
    # Twenty records all pointing at one node. Fitted, their titles would land
    # on each other — which is the picture this rule exists to have stopped —
    # so the dots are all drawn and the words are spent on what fits.
    When I rewrite "crowd.olai" as:
      """
      {"id":"hub","ord":"a0","title":"the node everything points at"}
      {"id":"c01","ord":"b01","title":"a referring node number one","see":["hub"]}
      {"id":"c02","ord":"b02","title":"a referring node number two","see":["hub"]}
      {"id":"c03","ord":"b03","title":"a referring node number three","see":["hub"]}
      {"id":"c04","ord":"b04","title":"a referring node number four","see":["hub"]}
      {"id":"c05","ord":"b05","title":"a referring node number five","see":["hub"]}
      {"id":"c06","ord":"b06","title":"a referring node number six","see":["hub"]}
      {"id":"c07","ord":"b07","title":"a referring node number seven","see":["hub"]}
      {"id":"c08","ord":"b08","title":"a referring node number eight","see":["hub"]}
      {"id":"c09","ord":"b09","title":"a referring node number nine","see":["hub"]}
      {"id":"c10","ord":"b10","title":"a referring node number ten","see":["hub"]}
      {"id":"c11","ord":"b11","title":"a referring node number eleven","see":["hub"]}
      {"id":"c12","ord":"b12","title":"a referring node number twelve","see":["hub"]}
      {"id":"c13","ord":"b13","title":"a referring node number thirteen","see":["hub"]}
      {"id":"c14","ord":"b14","title":"a referring node number fourteen","see":["hub"]}
      {"id":"c15","ord":"b15","title":"a referring node number fifteen","see":["hub"]}
      {"id":"c16","ord":"b16","title":"a referring node number sixteen","see":["hub"]}
      {"id":"c17","ord":"b17","title":"a referring node number seventeen","see":["hub"]}
      {"id":"c18","ord":"b18","title":"a referring node number eighteen","see":["hub"]}
      {"id":"c19","ord":"b19","title":"a referring node number nineteen","see":["hub"]}
      {"id":"c20","ord":"b20","title":"a referring node number twenty","see":["hub"]}
      """
    And I open the reference graph for "hub"
    Then the graph draws 21 nodes
    # Moved AWAY from, because that is what the rule is about: the frame is the
    # window now, so how many labels fit at rest is a fact about the reader's
    # screen rather than a promise. Two steps back and the titles would land on
    # each other, so only the ones that fit are written — and every dot is still
    # drawn.
    When I move the graph camera further away
    And I move the graph camera further away
    Then the graph draws 21 nodes
    And the graph names fewer dots than it draws
    # The CENTRE is named whatever else is dropped: it is what the page is about.
    And the graph names the dot "hub"
    And there should be no page errors

  Scenario: ...and pointing at a dot names it, whichever labels fit
    # The other half of decluttering: what a crowded view hides has to be one
    # gesture away, so a dot the reader points at is named at any scale.
    When I rewrite "crowd.olai" as:
      """
      {"id":"hub","ord":"a0","title":"the node everything points at"}
      {"id":"c01","ord":"b01","title":"a referring node number one","see":["hub"]}
      {"id":"c02","ord":"b02","title":"a referring node number two","see":["hub"]}
      {"id":"c03","ord":"b03","title":"a referring node number three","see":["hub"]}
      {"id":"c04","ord":"b04","title":"a referring node number four","see":["hub"]}
      {"id":"c05","ord":"b05","title":"a referring node number five","see":["hub"]}
      {"id":"c06","ord":"b06","title":"a referring node number six","see":["hub"]}
      {"id":"c07","ord":"b07","title":"a referring node number seven","see":["hub"]}
      {"id":"c08","ord":"b08","title":"a referring node number eight","see":["hub"]}
      {"id":"c09","ord":"b09","title":"a referring node number nine","see":["hub"]}
      {"id":"c10","ord":"b10","title":"a referring node number ten","see":["hub"]}
      {"id":"c11","ord":"b11","title":"a referring node number eleven","see":["hub"]}
      {"id":"c12","ord":"b12","title":"a referring node number twelve","see":["hub"]}
      {"id":"c13","ord":"b13","title":"a referring node number thirteen","see":["hub"]}
      {"id":"c14","ord":"b14","title":"a referring node number fourteen","see":["hub"]}
      {"id":"c15","ord":"b15","title":"a referring node number fifteen","see":["hub"]}
      {"id":"c16","ord":"b16","title":"a referring node number sixteen","see":["hub"]}
      {"id":"c17","ord":"b17","title":"a referring node number seventeen","see":["hub"]}
      {"id":"c18","ord":"b18","title":"a referring node number eighteen","see":["hub"]}
      {"id":"c19","ord":"b19","title":"a referring node number nineteen","see":["hub"]}
      {"id":"c20","ord":"b20","title":"a referring node number twenty","see":["hub"]}
      """
    And I open the reference graph for "hub"
    And I point at the graph node "c20"
    Then the graph names the dot "c20"
    And the graph caption reads "a referring node number twenty — crowd.olai"
    And there should be no page errors

  # ── the page is the picture ──────────────────────────────────────────

  Scenario: The drawing takes the pane, and nothing is left under it
    # Filed by the human from a screenshot: a small fixed box above a screenful
    # of nothing. The graph IS this page, so the canvas takes what the column
    # has left after the heading, the caption and the legend.
    Given I open the reference graph for "herbs"
    Then the graph fills the pane
    And the graph page does not scroll
    And there should be no page errors

  # ── finished work, hidden where the reader said to hide it ───────────

  Scenario: Hiding finished work takes it off the graph, and its arrows with it
    # The app's own switch rather than a control of this page's: "I do not want
    # to look at finished work" is a claim about the READER, so it applies to
    # every page that draws what the directory says now (docs/search.md).
    #
    # `basil` is done and mentions the herb bed; `order` is under way and sees
    # it. Hiding finished work leaves the second and takes the first — and the
    # arrow it drew goes with it, because an arrow to a dot nobody can see is
    # the arrow into the dark this drawing already refuses.
    When another writer adds "look at @herbs before Tuesday" to "garden.olai"
    And I rewrite "house.olai" as:
      """
      {"id":"kitchen","ord":"a0","title":"kitchen remodel"}
      {"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"see":["herbs"]}
      {"id":"sown","parent":"kitchen","ord":"a2","title":"sowed beside @herbs","done":"2026-07-20"}
      """
    And I open the reference graph for "herbs"
    Then the graph draws the nodes "herbs, outsider, order, sown"
    When I hide the done nodes
    Then the graph draws the nodes "herbs, outsider, order"
    And the graph draws no dot for "sown"
    And the graph draws the arrows "outsider mention herbs, order see herbs"
    When I show the done nodes
    Then the graph draws the nodes "herbs, outsider, order, sown"
    And there should be no page errors

  Scenario: ...and the node the page is about stays, finished or not
    # The centre survives for the reason a day page keeps its date: the page is
    # about that node, and a reader who opens a finished node's own graph is
    # asking about it. `herbs` is marked done here and `order` still sees it.
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","done":"2026-08-01"}
      """
    And I open the reference graph for "herbs"
    And I hide the done nodes
    Then the graph is centred on "herbs"
    And the graph draws the nodes "herbs, order"
    And there should be no page errors
