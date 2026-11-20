Feature: Asking for a plugin
  Nobody is asked about halves, slots, service keys or a word grammar. A person
  says in one sentence what they want, olai suggests a name and says where the
  folder will be kept, and the press lands on the plugin's own page with the
  conversation that is building it in the pane beside.

  IT IS THE SHAPE **NEW CHAT** ALREADY HAS — ⌘K, a row, two levels, a submit —
  because the gesture is the same gesture with a different noun, and a second
  way of asking for something would be a second thing to learn for no reason
  at all.

  WHAT IS ASSERTED HERE IS THE DISK AND THE PANE. A mint that drew the right
  words and wrote nothing would pass any assertion made about the screen, so
  these scenarios ask the vault what is in it: the folder with the README the
  person's own sentence went into, `chat-agent-session` IN THAT README'S OWN
  FRONT MATTER — which is the whole of what makes that conversation this
  plugin's — and the conversation itself in the pane beside the page.

  THE REFUSALS ARE IN PLACE, and that is the one interaction claim worth
  spelling out. A word already taken and a word that is not a word are both
  things a person fixes by typing two characters — which they can only do if
  the box they typed into is still there. A level that closed and navigated
  would leave somebody working out that nothing had happened.

  @scratch:plugins
  Scenario: One sentence, a name, and a page with its conversation beside it
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I type "draws a tiny bar beside any number" into the palette box
    Then the palette sections are "Who builds it"
    When I press "Enter" in the palette
    Then a name is suggested for the new plugin
    When I name the plugin "Bar beside"
    Then the new plugin will be kept in "plugins/bar-beside/"
    When I accept the name
    Then the address is "/plugins/bar-beside"
    And the plugin page is about "bar-beside"
    And the folder "plugins/bar-beside" holds "README.md"
    And the plugin page's README says "draws a tiny bar beside any number"

    And the plugin page is "building"
    And the plugin page's status says "the files are still landing"
    And the Plugins row "bar-beside" is marked "working"

    And the plugin "bar-beside" is being built by a conversation called "Bar beside"
    And the conversation building "bar-beside" is beside the page
    And the builder was told how to write a plugin exactly once
    And the agent has answered "draws a tiny bar beside any number" exactly once
    And there should be no page errors

  @scratch:plugins
  Scenario: A folder this vault already has is refused where it was typed
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "does something else entirely"
    And I name the plugin "Swatch"
    And I accept the name
    Then the new plugin level refuses with "plugins/swatch/ is taken"
    And the new plugin level is still open
    And the address is "/colours.olai"

    When I name the plugin "Swatch two"
    Then the new plugin will be kept in "plugins/swatch-two/"
    When I accept the name
    Then the address is "/plugins/swatch-two"
    And the folder "plugins/swatch-two" holds "README.md"
    And there should be no page errors

  @scratch:plugins
  Scenario: A name that cannot become a folder, and a name that is not there at all
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "makes a noise"
    And I name the plugin "!!!"
    And I accept the name
    Then the new plugin level refuses with "can't become a folder"
    And the new plugin level is still open
    And the folder "plugins/!!!" is gone

    When I name the plugin ""
    And I accept the name
    Then the new plugin level refuses with "Give it a name."
    And the new plugin level is still open
    And there should be no page errors

  @scratch:plugins
  Scenario: With nothing said about it, the first level asks again rather than drilling
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I press the palette row "new-plugin-say"
    Then the new plugin level is still open
    And the palette path is "new-plugin"
    And there should be no page errors

  @scratch:good @rows-off:chat
  Scenario: With no agent on this serve, the folder is still minted and the page says so
    Given I open the app
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "rings a bell at seven"
    And I name the plugin "Doorbell"
    And I accept the name
    Then the address is "/plugins/doorbell"
    And the folder "plugins/doorbell" holds "README.md"
    And nothing is building the plugin "doorbell"

    And the plugin page offers nobody to ask
    And the plugin page does not say "Ask for a change"
    And the plugin page says "server.ts"
    And there should be no page errors
