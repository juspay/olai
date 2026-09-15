Feature: A Gmail account is a pill and a row, and both are readings of one cell

  The row is off by default: a Gmail account needs an OAuth client this machine
  may not have, and a pill in every bar for an integration nobody pointed at is
  the wrong default. What these scenarios hold is the account's three arms and
  every door between them — the two credential variables, the pinned binary the
  serve spawns, the consent that comes back to this serve's own listener, the
  record that outlives the process, Google's refusal, and the disconnect that
  gives all of it back.

  Every scenario owns its server (`@scratch:mail`) and turns the row on
  (`@rows-on:mail`), and two tags above it point that server at fakes: the
  Himalaya it spawns (`@mail-himalaya:<fixture>`) and the Google it talks to
  (`@mail-google:<fixture>`). `@mail-doors` is whether the two credentials are
  in the environment at all — WITHOUT it they are unset, which is a scenario of
  its own rather than a gap.

  What each arm SAYS is asserted as the `data-` attributes `../src/testids.ts`
  declares: never a colour, never a class. The two exceptions are the row's own
  refusal sentences, which name things a person has to act on.

  @scratch:mail
  Scenario: A serve nobody pointed at Gmail holds no account and draws nothing
    Given I open the app
    When I open the plugins panel
    # OFF IS THE BUILD'S DEFAULT (`packages/bundle/olai.yml` declares the row
    # `disabled: true`), and the row is still ON THE PANEL with a switch under
    # it — a disabled row is a row a person can find and turn on.
    Then the mail row is off
    And the mail pill is not drawn
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox
  Scenario: With no OAuth credentials the row names the two doors and offers nothing
    Given I open the app
    When I open the plugins panel
    Then the mail row's sentence names "OLAI_MAIL_OAUTH_CLIENT"
    And the mail row's sentence names "OLAI_MAIL_OAUTH_SECRET"
    # NO BUTTON, because a Connect that can only fail teaches a person the
    # feature is broken (`../src/browser/Row.tsx`), and no Connect is what the
    # absence of the action says.
    And the mail row offers no Connect action
    # ...AND IT IS ASKING NOBODY. Only one group holds a row, so the group it
    # IS filed under is how "not under Needs you" is said: the answer to a
    # missing credential is an operator's, not a press.
    And the plugins panel groups "mail" under "Appliances"
    And the mail pill reads absent
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: A connect opens Google in a new tab and the pill names the mailbox
    Given I open the app
    When I open the plugins panel
    # ASKING FOR A PERSON: no account and both doors set, so the row is filed
    # where somebody looks for what is stuck, it offers the press, and it draws
    # the one URI that has to be registered in Google Cloud by hand.
    Then the plugins panel groups "mail" under "Needs you"
    And the mail row offers the connect action
    And the mail row draws the redirect URI
    When I press Connect in the mail row
    # THE TAB THE PRESS OPENED, and where it landed: Google's consent screen,
    # which answers with a redirect to this serve's own listener — the landing
    # page is the route's, and its heading names the mailbox.
    Then the consent tab says it connected as "you@gmail.com"
    And the mail pill reads connected
    And the mail pill names the address "you@gmail.com"
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: A restart remembers the account, because the record is a file
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    # THE PROCESS IS REPLACED UNDER AN OPEN PAGE, and the new one comes back
    # holding nothing in memory: the refresh token was written to core's memory
    # file, the boot reads it back, refreshes it against Google and asks the
    # pinned binary which mailbox that token turns out to be for. No second
    # press is offered — a `connected` row offers Disconnect — so a pill that
    # reads `connected` here could not have been put there by a person.
    When the server stops
    And the server starts again on the same port
    And I reload the page
    Then the mail pill reads connected
    And the mail pill names the address "you@gmail.com"
    # NO `no page errors` HERE, and this is the one place in this feature that
    # owes an explanation: the restart killed the socket of the page that was
    # open, so the browser reports the refused redial it was always going to
    # report. That is the restart working, not a page defect — and the same
    # reason `the_connection.feature` reads the server's own log instead.

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:refused @mail-doors
  Scenario: A revoked grant is a fault, and a Reconnect is the whole repair
    Given I open the app
    When I open the plugins panel
    # THE CONSENT ITSELF SUCCEEDS. What the fake refuses is the REFRESH, so the
    # connect leg writes its record exactly as it does against a Google that
    # grants everything — which is what makes the fault below a fault about the
    # GRANT rather than about connecting.
    And I press Connect in the mail row
    Then the mail pill reads connected
    # A RESTART IS WHAT ASKS GOOGLE TO REFRESH: the boot brings the record up,
    # the token endpoint answers `invalid_grant`, and the row says Google's own
    # word for a grant somebody revoked — one of the three arms of the account.
    When the server stops
    And the server starts again on the same port
    And I reload the page
    Then the mail pill reads fault
    When I open the plugins panel
    Then the mail row's sentence names "invalid_grant"
    # ...AND THE SAME ACTION, DRAWN UNDER THE ROW'S OWN WORD FOR IT. A faulted
    # row's button is the connect action labelled `Reconnect`
    # (`../src/browser/Row.tsx`), and the attribute is what a scenario grips.
    And the mail row offers the connect action
    # THE REPAIR IS A PERSON CONSENTING AGAIN, which is the whole reason a
    # revoked grant is a fault and not something this serve can fix by itself:
    # the fixture moves back to a grant Google honours, and the press is what
    # turns the row around.
    When the mail Google fixture is granted
    And I press Connect in the mail row
    Then the consent tab says it connected as "you@gmail.com"
    And the mail pill reads connected

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Disconnect revokes at Google and offers a Connect again
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    # THE PANEL IS REOPENED, because the tab the press opened took it down: the
    # drawer is portalled with a click-away, and focus going to the consent tab
    # is a click away as far as it is concerned.
    When I open the plugins panel
    And I press Disconnect in the mail row
    Then the mail pill reads absent
    And the mail row offers the connect action
    # THE GRANT IS REVOKED AT GOOGLE, which is what pressing Disconnect means
    # to the person pressing it — the half a forget-it-here implementation would
    # silently skip, and the half a mailbox left granted to a serve that has
    # stopped using it costs.
    And Google was asked to revoke the grant
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-doors
  Scenario: The callback route belongs to the row and leaves with it
    Given I open the app
    When I open the plugins panel
    # ON, THE ROUTE IS THIS PLUGIN'S. A plain GET carries no code and no state,
    # and the route answers its own refusal page rather than the listener's 404
    # — it is registered, and what it says is that this is not an authorization
    # this serve is waiting for.
    Then the mail callback route answers 400
    # OFF, THE ROUTE IS GONE WITH THE FIBER THAT REGISTERED IT: it was added to
    # the serve's own listener passively, so the switch withdraws it, which is
    # the property a person expects from a switch and the one a plugin with a
    # second listener would break. What answers the URL afterwards is the APP —
    # byte for byte what it answers a path nobody claims, because this app
    # serves its own shell for anything it does not know rather than a 404.
    When I switch the plugin "mail" off
    Then the mail callback URL is the app's answer, not mail's
    And the mail pill is not drawn
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-doors
  Scenario: Without the pinned binary the row names the Nix build
    Given I open the app
    # NO `@mail-himalaya:` TAG, so the harness hands the serve the empty string
    # — the row's own off switch — and a serve that was not started from the Nix
    # build is what that stands for. It is a FAULT and not a failed activation,
    # deliberately: a plugin that refused to load would take its own diagnosis
    # away with it (`../src/himalaya/run.ts`).
    Then the mail pill reads fault
    When I open the plugins panel
    Then the mail row's sentence names "Nix build"
    # ...AND NO BUTTON, because a press could not work: the cell's `canConnect`
    # is false and the row draws nothing a person can press
    # (`../src/browser/Row.tsx`). A Reconnect here would land its own sentence
    # under itself, which is the one thing the row's header forbids.
    And the mail row offers no Connect action
    And there should be no page errors
