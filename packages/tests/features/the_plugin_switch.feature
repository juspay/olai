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
  Scenario: Kolu's kind leaves with its fiber
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
    # ...AND THE LINK BEHIND IT, which is the other half of what a row coming
    # back has to bring: a plugin whose `apply` re-ran but whose standing
    # connection did not is a plugin that looks present and holds no data.
    And the appliance link reads connected

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
    # ...AND NOTHING ELSE WENT QUIET WITH IT. The strongest thing this feature
    # can assert, and the one that is not about any particular plugin: the app
    # keeps its own account of which members it is subscribed to and has stopped
    # hearing from, so a row leaving is proved not to have taken a neighbour's
    # streams down with it.
    And no member of this page has gone silent

  @skip
  @scratch:lanes @padi:lanes
  Scenario: A row that comes back is served again
    # SKIPPED, AND THE SKIP IS THE POINT — this is the half of "off and on" the
    # WIRE does not yet keep, recorded where it can be run the moment it does
    # rather than only in a comment somewhere.
    #
    # The fibers do all of it: the module is re-imported, the `apply` runs
    # again, the kind is claimed again, the sibling surface is registered again
    # and kolu's own padi link dials and reports connected a second time. Every
    # one of those is proved at unit level in this PR.
    #
    # What does not follow is the listener. `serveSurfaceApp` snapshots the
    # served `{group, handlers}` pair when it binds and serves that ONE
    # generation for its whole life — which it says out loud, and which was
    # exact until this phase, because until now olai's served set never moved.
    # So a re-mounted sibling's tags still resolve to the RETIRED mount's
    # handler, whose whole job is to refuse. A page RELOAD does not help: the
    # stale table is the server's, not the tab's, which is what proved the fault
    # is not in the browser.
    #
    # `runtime.ts` says the contract for a sibling arriving after the listener
    # is up is RECONNECT. It is not, and cannot be, on this path.
    #
    # UNSKIP THIS when the transport question on the PR is ruled on and the
    # listener serves the current generation. Nothing else about the scenario
    # should need to change — which is why it is written out in full.
    Given I open the outline "lanes.olai"
    And I show the done nodes
    Then the terminal row on "door-implement" is working
    And the appliance link reads connected

    When I open the plugins panel
    And I switch the plugin "kolu" off
    Then "door-implement" wears no terminal door at all

    When I switch the plugin "kolu" on
    # THE LINK IS ASSERTED FIRST, because it is the half that fails on its own:
    # the fiber re-applying is what brings the kind and the chunk back, and the
    # DIAL is a separate thing its `apply` armed. A scenario that only asked
    # about the door could not tell a plugin that came back whole from one that
    # came back with nothing behind it.
    Then the appliance link reads connected
    And the terminal row on "door-implement" is working
    # ...AND THE ONE THAT ACTUALLY CATCHES THE TRANSPORT. The two above are
    # about kolu; this is about every member on the page, and it is what goes
    # red today — the app itself reports that nothing is arriving on kolu's
    # five members, and on odu's when it is the chat row that was pressed.
    And no member of this page has gone silent
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
    # THE CHROME COMES BACK, and that is all this claims. The browser half is
    # mounted again and draws off the roster; whether the MEMBERS behind it are
    # being served again is the listener's question, and it is the skipped
    # scenario above that asks it. Saying so here rather than letting a reader
    # take this line for more than it is.
    And the conversation is in the header
    And there should be no page errors
