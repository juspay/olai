Feature: The events drawer's foot — who is silenced, and the door to the config

  The drawer's last line is not an event. `_olai/Kolu.olai` is the one mute
  list the watcher reads and the one config a reader may want to edit, and
  the drawer's foot is the proof of both without leaving it: a line naming
  WHO is silenced — the mutes' own titles, so "2 muted · …" reads as
  machines, not prefixes — and a wrench that opens the WHOLE config
  (thresholds and mutes) as the ordinary outline it is.

  THE LINE NAMES ONLY WHAT THE WATCHER CAN SAY. A mute's title goes on the
  line the moment its value resolves to exactly one live terminal, and
  comes off when it names nobody (a terminal that shut) — because the
  events the line would call silenced are the drawer's own rows, right
  above it. An ambiguous value keeps its own server-console sentence and
  never the line. With no padi at all the watcher silences nobody, and
  the foot is the wrench alone.

  The file, though, is found by NAME — off the served outlines, not the
  nodes: a config that parses to nothing still names itself, because the
  wrench is the door by which a person would go and UNTERR it. No file at
  all is no foot.

  The fleet behind the named scenarios is this suite's own (`@padi:lanes`),
  padi's real surface over a real socket — the mute VALUES below are real
  lanes ids for that reason. The rest run the ordinary corpus: the file's
  states are a reading of the VAULT, no daemon required.

  @scratch:lanes @padi:lanes
  Scenario: The foot names the mutes the watcher can say
    Given I open the outline "lanes.olai"
    # 11111111-… is lanes' claude terminal, 22222222-… its grok — both
    # live, so both prefixes resolve, and both titles ride the line.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the claude terminal","custom":{"terminal":"11111111"}}
      {"id":"c2","parent":"mutes","ord":"a1","title":"the grok terminal","custom":{"terminal":"22222222"}}
      """
    And I press the padi pill
    Then the drawer's foot says "2 muted · the claude terminal, the grok terminal"
    And the drawer's foot offers the wrench
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: A mute naming nobody live stays off the line
    Given I open the outline "lanes.olai"
    # THE TRUTH RULE: the dead terminal's prefix resolves to nothing the
    # watcher watches, so the line must not claim its quiet — the drawer's
    # own events are the witness it would have contradicted.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the claude terminal","custom":{"terminal":"11111111"}}
      {"id":"c2","parent":"mutes","ord":"a1","title":"the terminal that is gone","custom":{"terminal":"99999999"}}
      """
    And I press the padi pill
    Then the drawer's foot says "1 muted · the claude terminal"
    And there should be no page errors

  @scratch:lanes @padi:lanes
  Scenario: An edit to the file moves the line, because it is the same walk
    Given I open the outline "lanes.olai"
    # THE LIVE PROPERTY: what the line says is not a snapshot taken when the
    # drawer opened — rename a mute with the drawer already open and the new
    # name is there, on the frame the revision publishes.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the claude terminal","custom":{"terminal":"11111111"}}
      {"id":"c2","parent":"mutes","ord":"a1","title":"the grok terminal","custom":{"terminal":"22222222"}}
      """
    And I press the padi pill
    Then the drawer's foot says "2 muted · the claude terminal, the grok terminal"
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the claude terminal","custom":{"terminal":"11111111"}}
      {"id":"c2","parent":"mutes","ord":"a1","title":"the grok terminal that retired","custom":{"terminal":"22222222"}}
      """
    Then the drawer's foot says "2 muted · the claude terminal, the grok terminal that retired"
    And there should be no page errors

  @scratch:good
  Scenario: With no padi the watcher silences nobody, and the foot is the door alone
    Given I open the outline "house.olai"
    # The fleet is the fact the line would be truth ABOUT: nothing watched,
    # nothing said. The config still stands to be opened.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the claude terminal","custom":{"terminal":"11111111"}}
      """
    And I press the padi pill
    Then the drawer says nothing about mutes
    But the drawer's foot offers the wrench
    And there should be no page errors

  @scratch:good
  Scenario: A config that mutes nobody says nothing about mutes
    Given I open the outline "house.olai"
    # The wrench's state alone: thresholds a reader may still want, and
    # never a "0 muted" — noise about a noise that is not there.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      """
    And I press the padi pill
    Then the drawer says nothing about mutes
    But the drawer's foot offers the wrench
    And there should be no page errors

  @scratch:good
  Scenario: No config file, so no foot at all
    Given I open the outline "house.olai"
    # The defaults' vault: nothing decided anything, and a wrench with no
    # page to open would be a door onto nothing.
    When I press the padi pill
    Then the drawer has no foot
    And there should be no page errors

  @scratch:good
  Scenario: The wrench lands on the config, an ordinary outline page
    Given I open the outline "house.olai"
    # The door the whole design exists for: the foot's other half is the
    # file itself, openable like any page — no special case, because the
    # `_olai/` outlines have a sidebar home now rather than a hiding switch.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the claude terminal","custom":{"terminal":"11111111"}}
      """
    And I press the padi pill
    And I press the drawer's wrench
    Then the address is "/_olai/Kolu.olai"
    And the drawer is closed
    And the outline has 3 rows
    And the vault group links to "_olai/Kolu.olai"
    And there should be no page errors

  @scratch:good
  Scenario: A torn config still names itself, and the wrench still opens it
    Given I open the outline "house.olai"
    # The wrench is the DOOR BY WHICH A PERSON WOULD FIX the config, so it
    # may not fall away with the nodes the parse withheld: the file is found
    # by NAME off the served outlines, and the line simply has nothing true
    # to say.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch"
      """
    And I press the padi pill
    Then the drawer says nothing about mutes
    But the drawer's foot offers the wrench
    And there should be no page errors
