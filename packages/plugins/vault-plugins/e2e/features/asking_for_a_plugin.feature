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
    # THE FIRST LEVEL IS THE SENTENCE AND WHO BUILDS IT: the rows are the
    # engines this machine can actually start, so choosing one is choosing the
    # agent that will write the three files.
    And I type "draws a tiny bar beside any number" into the palette box
    Then the palette sections are "Who builds it"
    When I press "Enter" in the palette
    # THE SECOND LEVEL NAMES THE FOLDER, which is the only place a person sees
    # the slug they are choosing — and the folder is the plugin, so the slug is
    # the word every other face will draw.
    Then a name is suggested for the new plugin
    When I name the plugin "Bar beside"
    Then the new plugin will be kept in "plugins/bar-beside/"
    When I accept the name
    # ...AND THE PRESS LANDS ON THE PAGE. The answer carries the address rather
    # than navigating, because where a press goes is the tab's business — but
    # from here it is one place, and it is an address somebody can link to.
    Then the address is "/plugins/bar-beside"
    And the plugin page is about "bar-beside"
    And the folder "plugins/bar-beside" holds "README.md"
    # THE README IS WHAT CREATES THE FOLDER and it carries the person's own
    # sentence verbatim: that sentence is the best description of the thing
    # that will ever exist, and nobody should wait for an agent to paraphrase
    # it.
    And the plugin page's README says "draws a tiny bar beside any number"

    # BEING BUILT is its own state, and it is not a fault: an agent halfway
    # through writing a folder is exactly what this is.
    And the plugin page is "building"
    And the plugin page's status says "the files are still landing"
    And the Plugins row "bar-beside" is marked "working"

    # ...AND THE CONVERSATION IS BESIDE IT, which is what makes watching one get
    # built one screen rather than two. Nothing was written on the plugin's own
    # node to bind them: the chat is the chat ABOUT this page, and a title is
    # how a chat says what it is about.
    And the plugin "bar-beside" is being built by a conversation called "Bar beside"
    And the conversation building "bar-beside" is beside the page
    And the builder was told how to write a plugin exactly once
    And the agent has answered "draws a tiny bar beside any number" exactly once
    And there should be no page errors

  @scratch:plugins
  Scenario: A folder this vault already has is refused where it was typed
    # THE WORD IS THE FOLDER'S NAME, and a directory holds one entry per name —
    # so two plugins cannot claim one word, and the refusal says so by naming
    # the FOLDER rather than by saying "that name is unavailable".
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "does something else entirely"
    And I name the plugin "Swatch"
    And I accept the name
    Then the new plugin level refuses with "plugins/swatch/ is taken"
    And the new plugin level is still open
    And the address is "/colours.olai"

    # ...and the fix is two characters, in the box that is still open.
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
    # NOTHING WAS CREATED, which is why the name is judged before anything is
    # written: a refusal has to arrive before there is a folder to clean up.
    And the folder "plugins/!!!" is gone

    When I name the plugin ""
    And I accept the name
    Then the new plugin level refuses with "Give it a name."
    And the new plugin level is still open
    And there should be no page errors

  @scratch:plugins
  Scenario: With nothing said about it, the first level asks again rather than drilling
    # The sentence is what the README's first paragraph and the builder's first
    # message are both made of, so an empty box has nothing to carry forward —
    # and the level says so where it was typed instead of taking somebody to a
    # second question it cannot answer either.
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I press the palette row "new-plugin-say"
    Then the new plugin level is still open
    And the palette path is "new-plugin"
    And there should be no page errors

  @scratch:good @rows-off:chat
  Scenario: With no agent on this serve, the folder is still minted and the page says so
    # A SERVE WITH NO CHAT STILL MINTS. The folder is a folder somebody can
    # write by hand, and that is the honest answer rather than a failure of the
    # call — so the mint goes through, no conversation is started, and the page
    # offers neither verb that would speak into one.
    Given I open the app
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "rings a bell at seven"
    And I name the plugin "Doorbell"
    And I accept the name
    Then the address is "/plugins/doorbell"
    And the folder "plugins/doorbell" holds "README.md"
    And nothing is building the plugin "doorbell"

    # The page says what is missing in words, which is a thing a person can act
    # on — rather than drawing a button that does nothing.
    And the plugin page offers nobody to ask
    And the plugin page does not say "Ask for a change"
    # ...and with only a README on disk this is a folder that is not yet a
    # plugin, which the page says with the name of the file it is short of.
    And the plugin page says "server.ts"
    And there should be no page errors
