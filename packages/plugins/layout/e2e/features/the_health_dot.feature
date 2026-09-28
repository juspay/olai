Feature: One health dot stands where the bar's pills stood
  The desktop bar used to stand nine things: the connection, the Commit
  readout, kolu, odu, mail and spaces pills, how long the server had been up,
  and two doors (plugins, preferences). Each was always there, because a bar of
  chips cannot be trusted if the healthy ones vanish. The owner chose calm: the
  wordmark, search, ONE health dot, the preferences gear and who is looking.

  The dot keeps the old promise with one mark. It is always drawn; it wears
  the worst tone among everything reporting (healthy, notice, alarm); and when
  that is not healthy its name and tip say what is wrong in the readout's own
  words, so a dropped connection is heard without opening anything. Its
  popover draws every readout as a row — still that plugin's own face, so a
  row's press does what the pill's did — the uptime as a quiet last line, and
  the plugins door at its foot. A plugin switched off takes its row and its
  vote with it; switched back on, both return.

  A phone is untouched: no dot, no pills, news under the bar only when there
  is news (`on_a_phone.feature`).

  @scratch:lanes @padi:lanes
  Scenario: A healthy serve is one green dot, and its popover lists every readout
    Given I open the outline "lanes.olai"
    Then the desktop header holds only its calm controls
    And the health dot is "healthy"
    And the health dot says all is well
    When I open the health popover
    Then the health popover lists, in order:
      | connection      |
      | commit-pill     |
      | padi            |
      | uptime          |
      | plugins-trigger |
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A plugin switched off takes its row, and comes back with a fresh one
    # Picking the plugins row shuts the popover: the panel stands on its own,
    # and stays up through the rebuild each switch causes.
    Given I open the outline "lanes.olai"
    When I open the plugins panel
    Then the health popover is shut
    When I switch the plugin "kolu" off
    And I close the plugins panel
    And I open the health popover
    Then the health popover has no "padi" row
    And the health dot is "healthy"
    When I press Escape on the health dot
    And I open the plugins panel
    And I switch the plugin "kolu" on
    And I close the plugins panel
    And I open the health popover
    Then the health popover lists, in order:
      | connection |
      | padi       |
    And the padi indicator says "connected"
    And there should be no page errors

  @scratch:good
  Scenario: A dropped connection turns the dot amber and says so without a click
    Given I open the outline "garden.olai"
    And the connection is "live"
    Then the health dot is "healthy"
    When the browser goes offline
    Then the connection is "reconnecting"
    And the health dot is "notice"
    And the health dot names "reconnecting"
    When the browser comes back online
    Then the connection is "live"
    And the health dot is "healthy"
    And the health dot says all is well

  @scratch:good @git:repo
  Scenario: Writes waiting are a notice, and the Commit row still opens its panel
    Given I open the outline "garden.olai"
    Then the health dot is "healthy"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden #outdoors"}
      {"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed by the door","doing":"2026-07-20"}
      {"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil","done":"2026-07-20"}
      {"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","done":"2026-08-10"}
      {"id":"frames","parent":"garden","ord":"a1","title":"the cold frames"}
      {"id":"glazing","parent":"frames","ord":"a0","title":"replace the cracked pane","done":"2026-07-15"}
      {"id":"sowing","parent":"frames","ord":"a1","title":"sow the first trays","done":"2026-08-11"}
      {"id":"slugs","parent":"frames","ord":"a2","title":"the slugs got the seedlings last year"}
      {"id":"compost","parent":"garden","ord":"a2","title":"the compost heap"}
      {"id":"turned","parent":"compost","ord":"a0","title":"turn the pile","done":"2026-07-01"}
      {"id":"straw","parent":"compost","ord":"a1","title":"add the straw","done":"2026-07-02"}
      """
    Then the health dot is "notice"
    And the health dot names "1 uncommitted"
    When I open the health popover
    And I press the commit pill
    Then the commit panel is up
    # The row's own panel is the topmost layer: Escape shuts it first and the
    # caret goes back to the row; a second Escape shuts the popover and the
    # caret goes back to the dot.
    When I press Escape on the health dot
    Then the commit panel is shut
    And the health popover is open
    When I press Escape on the health dot
    Then the health popover is shut
    And the health dot has the focus
    And there should be no page errors

  @scratch:good @git:repo
  Scenario: An amber dot has an amber row under it
    # The owner's bug: the dot was amber for "2 uncommitted" while git's row
    # drew no dot, so nothing in the list explained the colour. Each row now
    # wears the one tone its readout states, and the dot is the worst of them.
    Given I open the outline "garden.olai"
    When I rewrite "garden.olai" as:
      """
      {"id":"garden","ord":"a0","title":"garden, rewritten"}
      """
    Then the health dot is "notice"
    When I open the health popover
    Then the "commit-pill" row wears a "notice" dot
    And a row of the health popover wears the health dot's tone
    And there should be no page errors

  @scratch:good
  Scenario: The dot is a keyboard control: Enter and Space open it, Escape hands the caret back
    Given I open the outline "garden.olai"
    When I focus the health dot
    And I press Enter on the health dot
    Then the health popover is open
    When I press Escape on the health dot
    Then the health popover is shut
    And the health dot has the focus
    When I press Space on the health dot
    Then the health popover is open
    When I press Escape on the health dot
    Then the health popover is shut
    And the health dot has the focus

  @scratch:good
  Scenario: The plugins panel opens from the popover's foot
    Given I open the outline "garden.olai"
    When I open the health popover
    Then the health popover lists, in order:
      | uptime          |
      | plugins-trigger |
    When I open the plugins panel
    Then the plugin "kolu" is running
    When I close the plugins panel
    Then the health popover is shut
    And there should be no page errors

  @scratch:good @phone
  Scenario: A phone header is unchanged: no dot, no pills
    Given I open the outline "garden.olai"
    Then the burger is on screen
    And the phone header is identity and search
