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
