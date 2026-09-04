Feature: A plugin is turned on and off while the serve runs
  Until this phase, which plugins a serve ran was decided once, before anything
  started: `--plugins` at the command line, the same flag from the nix module,
  or the row's own default in `olai.yml`. The panel drew the answer and could
  not move it — every row frozen, and a sentence under each one saying where the
  decision actually lived.

  The rulings that ended that (the human, 2026-09-04): the panel gets a SWITCH;
  a flip is SESSION-ONLY and writes nothing; there is no CLI verb against a
  running serve; `--dump-config` is dropped. So a restart still comes back to
  the flag, the nix option and the rows, and what a person can do between two
  restarts is turn one off and see everything that leaned on it follow.

  THE REACTIVE HALF IS WHAT MAKES IT ONE VERB rather than a restart, and these
  two scenarios are where that is benched rather than argued. A plugin is a
  fiber; every registration it made is a finalizer on its own scope; so turning
  a row off unwinds its kinds, its wake, its sibling surface and any door it
  stood behind — and revoking a door unloads every fiber that named it. Turning
  it back on re-applies all of them.

  THE TWO ROWS ARE CHOSEN FOR WHAT THEY REACH. Kolu contributes a property KIND
  and a sibling surface, so its flip is visible in the vault's own reading: the
  door on a `terminal` value is drawn because a kind judges that value, and a
  kind that has left takes the door with it. Chat OFFERS four services, so its
  flip is the only one in this build that moves other rows — the engines and
  both tenants name one of its doors, and go `waiting` on the tag while it is
  away.

  Both scenarios press the switch and then read the page, never a reload: what
  the roster moving is FOR is that every open tab redials and rebuilds itself
  around the answer.

  @scratch:lanes @padi:lanes
  Scenario: Kolu's kind leaves with its fiber, and comes back with it
    # THE VOCABULARY FOLLOWS THE FIBERS, which is the claim `propKinds` made the
    # opposite of for two phases: it was read once at boot and the store's codec
    # held it for the life of the process, so a plugin that unloaded left its
    # words behind. It is a live reading now, and the store is asked to look
    # again once the bundle has settled — because nothing on disk moved, so
    # nothing else in the process would ever re-judge the values.
    Given I open the outline "lanes.olai"
    And I show the done nodes
    # THE DOOR IS DRAWN because a kind kolu contributes judges this value. That
    # is the whole chain in one assertion: the row is declared `kolu-terminal`,
    # the word is in the enabled vocabulary, so the value wears kolu's own Dock
    # row rather than being the text somebody typed.
    Then the terminal row on "door-implement" is working

    When I open the plugins panel
    # A ROW THAT IS RUNNING AND CARRIES NOBODY SAYS NOTHING, which is the panel
    # this phase rewrote: the switch already says On, and a paragraph repeating
    # it under every row is how the panel became a column of the same sentence
    # eight times.
    Then the plugins panel says nothing more about "kolu"
    # ...and where this serve was STARTED is the panel's line, said once.
    And the plugins panel was started "lasts as long as this server runs"

    When I switch the plugin "kolu" off
    # NOT A RELOAD. The sibling left the wire, the roster moved, the tab
    # redialled and rebuilt its tree — and the value is what it always was on
    # disk, judged by a vocabulary that no longer has a word for it. An
    # undeclared key is plain text, which is the state every vault that never
    # heard of kolu is already in: no door, no sentence about a missing one, and
    # nothing red anywhere, because nothing is wrong.
    Then "door-implement" wears no terminal door at all
    And there should be no page errors

    When I switch the plugin "kolu" on
    # ...AND BACK, which is the half a dispose alone cannot show. The module is
    # re-imported, the `apply` runs again, the kind is claimed again — the
    # registry's claims are suspended precisely so a plugin that unloaded and
    # came back is claiming rather than claiming twice — and the door is drawn
    # off a padi this scenario never restarted.
    Then the terminal row on "door-implement" is working
    And there should be no page errors

  @scratch:lanes
  Scenario: Turning the chat row off takes every row that named its doors
    # THE ROW WHOSE FLIP MOVES THE MOST. `agents`, `deliveries`, `watching` and
    # `session-start` are chat's to offer and core provides none of them, so
    # every engine and both tenants are standing on a door this one row holds
    # open. That is the paper's rule and the ruling that took phase 7 accepted
    # its cost; what this scenario asks is whether the cost is PAYABLE at a
    # panel rather than only at a restart.
    Given I open the outline "lanes.olai"
    # THE CONVERSATION IS HERE, which is the state this scenario takes away and
    # gives back. The header's toggle is chat's own, drawn by chat's browser
    # half off the sibling its server half serves — so its presence is the one
    # assertion on the page that answers whether `surface/chat/` is on the wire.
    Then the conversation is in the header
    When I open the plugins panel
    # THE SENTENCE A SWITCH OWES BEFORE IT IS PRESSED. It is the other end of
    # the `waiting` line: that one is a row saying what it is short of after the
    # fact, and this is the row that HAS it saying so while there is still a
    # decision to make. Read off two live tables — who stands behind which door,
    # and which doors each running fiber names — so a plugin added to this build
    # reaches this sentence with nothing anywhere moving.
    Then the plugins panel says "chat" is "Turning it off also stops"
    And the plugins panel says "chat" is "kolu"

    When I switch the plugin "chat" off
    # KOLU NAMES BOTH ITS DOORS, because it names two and a sentence that owned
    # up to one would send somebody to fix half of it. This is the same reading
    # `the_doorbell_rings.feature` gets from a serve BOOTED without chat — the
    # point here is that a serve which had chat a moment ago arrives at the
    # identical state, which is what "disabled means absent at every moment
    # rather than only at boot" comes to.
    Then the plugins panel says "kolu" is "Waiting for deliveries, session-start"
    And the plugins panel says "kolu" is "no plugin in this build offers them"
    # ...AND CHAT'S OWN CHROME IS GONE, not disabled. The members left the wire,
    # so the tab loaded no chunk for them and mounted nothing — which is the
    # browser's exact twin of *no fiber, no surface, no handler*.
    And the conversation is gone-from the header
    # THE OUTLINER IS WHOLE, which is the other half of the ruling: what a serve
    # without chat gives up is the conversation, not the product.
    And the outline list is shown
    And there should be no page errors

    When I switch the plugin "chat" on
    # ...AND EVERY ONE OF THEM RE-APPLIES. Kolu was never pressed: it went
    # `waiting` because a service it names was revoked, and it comes back
    # because the same service was provided again — which is the reactive half
    # doing the whole of the work this phase is about.
    Then the plugins panel says nothing more about "kolu"
    And the plugins panel says "chat" is "Turning it off also stops"
    And the conversation is in the header
    And there should be no page errors
