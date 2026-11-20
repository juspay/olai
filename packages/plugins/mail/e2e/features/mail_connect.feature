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
    Then the mail row is off
    And the mail pill is not drawn
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox
  Scenario: With no OAuth credentials the row names the two doors and offers nothing
    Given I open the app
    When I open the plugins panel
    Then the mail row's sentence names "OLAI_MAIL_OAUTH_CLIENT"
    And the mail row's sentence names "OLAI_MAIL_OAUTH_SECRET"
    And the mail row offers no Connect action
    And the plugins panel groups "mail" under "Connections"
    And the mail pill reads absent
    And the health dot is "healthy"
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: A connect opens Google in a new tab and the pill names the mailbox
    Given I open the app
    When I open the plugins panel
    Then the plugins panel groups "mail" under "Needs attention"
    And the mail row offers the connect action
    And the mail row draws the redirect URI
    When I press Connect in the mail row
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
    When the server stops
    And the server starts again on the same port
    And I reload the page
    Then the mail pill reads connected
    And the mail pill names the address "you@gmail.com"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:refused @mail-doors
  Scenario: A revoked grant is a fault, and a Reconnect is the whole repair
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When the server stops
    And the server starts again on the same port
    And I reload the page
    Then the mail pill reads fault
    And the health dot is "alarm"
    And the health dot names "Mail error"
    When I open the plugins panel
    Then the mail row's sentence names "invalid_grant"
    And the mail row offers the connect action
    When the mail Google fixture is granted
    And I press Connect in the mail row
    Then the consent tab says it connected as "you@gmail.com"
    And the mail pill reads connected
    And the health dot is "healthy"

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-google:granted @mail-doors
  Scenario: Disconnect revokes at Google and offers a Connect again
    Given I open the app
    When I open the plugins panel
    And I press Connect in the mail row
    Then the mail pill reads connected
    When I open the plugins panel
    And I press Disconnect in the mail row
    Then the mail pill reads absent
    And the mail row offers the connect action
    And Google was asked to revoke the grant
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-himalaya:mailbox @mail-doors
  Scenario: The callback route belongs to the row and leaves with it
    Given I open the app
    When I open the plugins panel
    Then the mail callback route answers 400
    When I switch the plugin "mail" off
    Then the mail callback URL is the app's answer, not mail's
    And the mail pill is not drawn
    And there should be no page errors

  @scratch:mail @rows-on:mail @mail-doors
  Scenario: Without the pinned binary the row names the Nix build
    Given I open the app
    Then the mail pill reads fault
    And the health dot is "alarm"
    And the health dot names "Mail error"
    When I open the plugins panel
    Then the mail row's sentence names "Nix build"
    And the mail row offers no Connect action
    And there should be no page errors
