Feature: The events drawer's foot — the door onto the watch's config

  The drawer's last line is not an event: `_olai/Kolu.olai` is the one file
  that paces the watch, and the foot is the proof of it without leaving the
  drawer — a wrench that opens the WHOLE config as the ordinary outline it
  is.

  The file is found by NAME — off the served outlines, not the nodes: a
  config that parses to nothing still names itself, because the wrench is
  the door by which a person would go and UNTERR it. No file at all is no
  foot, because defaults have no page to open.

  IT NAMED WHO WAS SILENCED, TOO, until the second doorbell (2026-08-31):
  a `2 muted · …` line off the same cell, and five scenarios pinning which
  mutes the watcher could vouch for. The mute list left `_olai/Kolu.olai`
  with that PR — a conversation's wake FILTER FILE is the silence control
  now — so the line and its scenarios went and the door stayed.

  These run the ordinary corpus: the file's states are a reading of the
  VAULT, no daemon required.

  @scratch:good
  Scenario: A config that decides nothing but the knobs still offers its door
    Given I open the outline "house.olai"
    # The wrench's state alone, which is now its only state: thresholds a
    # reader may want, and a door onto them.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      """
    And I press the padi pill
    Then the drawer's foot offers the wrench
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
    # The door the whole design exists for: the foot IS the file, openable
    # like any page — no special case, because the `_olai/` outlines have a
    # sidebar home now rather than a hiding switch.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"30s"}}
      {"id":"nag","ord":"a1","title":"a note beside it"}
      """
    And I press the padi pill
    And I press the drawer's wrench
    Then the address is "/_olai/Kolu.olai"
    And the drawer is closed
    And the outline has 2 rows
    And the vault group links to "_olai/Kolu.olai"
    And there should be no page errors

  @scratch:good
  Scenario: A torn config still names itself, and the wrench still opens it
    Given I open the outline "house.olai"
    # The wrench is the DOOR BY WHICH A PERSON WOULD FIX the config, so it
    # may not fall away with the nodes the parse withheld: the file is found
    # by NAME off the served outlines, and the foot has nothing else to say.
    When I rewrite "_olai/Kolu.olai" as:
      """
      {"id":"watch","ord":"a0","title":"watch"
      """
    And I press the padi pill
    Then the drawer's foot offers the wrench
    And there should be no page errors
