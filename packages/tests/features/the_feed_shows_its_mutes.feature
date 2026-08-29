@scratch:good
Feature: The events drawer's foot — who is silenced, and the door to the config

  The drawer's last line is not an event. `_olai/Kolu.olai` is the one mute
  list the watcher reads and the one config a reader may want to edit, and
  the drawer's foot is the proof of both without leaving it: a line naming
  WHO is silenced — the mutes' own titles, so "2 muted · …" reads as
  machines, not prefixes — and a wrench that opens the WHOLE config
  (thresholds and mutes) as the ordinary outline it is.

  The foot is re-answered off the same vault walk that hands the watcher
  its values, so a rename has no publish to wait for: the line IS the
  gate's own list, drawn. Nobody muted is the wrench ALONE — never a
  "0 muted" — and no config file at all is no foot at all, because the
  watcher's defaults have no page to open.

  The press is the pill's; these scenarios run with no padi behind the
  harness, on purpose: the foot is a reading of the VAULT, and a machine
  with no kolu is the ordinary one.

  Background:
    Given I open the outline "house.olai"

  Scenario: The foot names the mutes, as the outline names them
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the grok terminal","custom":{"terminal":"11111111"}}
      {"id":"c2","parent":"mutes","ord":"a1","title":"the pi terminal","custom":{"terminal":"22222222"}}
      """
    And I press the padi pill
    Then the drawer's foot says "2 muted · the grok terminal, the pi terminal"
    And the drawer's foot offers the wrench
    And there should be no page errors

  Scenario: An edit to the file moves the line, because it is the same walk
    # THE LIVE PROPERTY: what the line says is not a snapshot taken when the
    # drawer opened — rename a mute with the drawer already open and the new
    # name is there, on the frame the revision publishes.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the grok terminal","custom":{"terminal":"11111111"}}
      {"id":"c2","parent":"mutes","ord":"a1","title":"the pi terminal","custom":{"terminal":"22222222"}}
      """
    And I press the padi pill
    Then the drawer's foot says "2 muted · the grok terminal, the pi terminal"
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the grok terminal","custom":{"terminal":"11111111"}}
      {"id":"c2","parent":"mutes","ord":"a1","title":"the pi terminal that retired","custom":{"terminal":"22222222"}}
      """
    Then the drawer's foot says "2 muted · the grok terminal, the pi terminal that retired"
    And there should be no page errors

  Scenario: A config that mutes nobody says nothing about mutes
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

  Scenario: No config file, so no foot at all
    # The defaults' vault: nothing decided anything, and a wrench with no
    # page to open would be a door onto nothing.
    When I press the padi pill
    Then the drawer has no foot
    And there should be no page errors

  Scenario: The wrench lands on the config, an ordinary outline page
    # The door the whole design exists for: the foot's other half is the
    # file itself, openable like any page — no special case, because the
    # `_olai/` outlines have a sidebar home now rather than a hiding switch.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      {"id":"mutes","ord":"a1","title":"mutes"}
      {"id":"c1","parent":"mutes","ord":"a0","title":"the grok terminal","custom":{"terminal":"11111111"}}
      """
    And I press the padi pill
    And I press the drawer's wrench
    Then the address is "/_olai/Kolu.olai"
    And the drawer is closed
    And the outline has 3 rows
    And the vault group links to "_olai/Kolu.olai"
    And there should be no page errors
