Feature: A plugin's chat is the chat about its page
  Asking for a plugin starts a conversation, and NOTHING RECORDS WHICH ONE. The
  chat's title is the plugin's own address — `[Bar beside](/plugins/bar-beside)`
  — and that is the whole of the binding: the serve finds the conversation by
  asking chat what is at that address, the page docks it by that address, and a
  plugin's settings node carries the person's consent and nothing else.

  WHAT THIS REPLACED was a `builder` property on that node, pointing at a chat
  row. Two places recorded one fact, and they could disagree the moment
  somebody retitled or trashed the chat. So the property is gone — and a vault
  that still has one from before must behave as though it does not, which is
  the last scenario here.

  THE PHONE IS THE OTHER HALF of what the page offers. With a column beside the
  page, *Ask for a change…* opens the conversation in it; with no column there
  is nothing to open, so the *Ask* spot holds the page's own seat and the
  conversation is read there.

  @scratch:plugins
  Scenario: The conversation is a chat about the plugin's page, and the page finds it
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "draws a tiny bar beside any number"
    And I name the plugin "Bar beside"
    And I accept the name
    Then the address is "/plugins/bar-beside"

    # THE CHAT IS TITLED WITH THE PAGE, under Inbox › Chats like every other
    # chat in this app — and the plugin's own node says nothing about it.
    And the plugin "bar-beside" is being built by a conversation called "Bar beside"
    And the plugin page is "building"

    # ...AND THE PAGE FINDS IT BY THAT ADDRESS. It is docked beside the page
    # because this plugin is being built, and the menu offers the way back to
    # it once the reader has closed the column.
    And the conversation building "bar-beside" is docked
    And the plugin page offers to ask for a change

    When I ask for a change to the plugin "bar-beside"
    Then the conversation building "bar-beside" is docked
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin whose node still carries a builder property behaves exactly as it did
    # `builder` is a word nothing writes and nothing reads now. One left over
    # from a vault written before that is an ordinary custom property: it is
    # not a knob, it is not a fault, and it is not a conversation — so the
    # plugin turns on, runs, and says nobody is building it.
    Given I rewrite "_olai/Settings.olai" as:
      """
      {"id":"swatch-consent","ord":"a0","title":"swatch","custom":{"builder":"a-chat-that-is-gone"}}
      """
    And I open the app
    When I go to the plugin "swatch"
    Then the plugin page is "review"
    When I press the plugin page verb
    Then the plugin page is "on"
    And file "_olai/Settings.olai" has namespace "swatch" setting "on" as "yes"
    # ...and the page offers no conversation, because there is no chat at this
    # plugin's address — the stale word is not one.
    And the plugin page does not say "Ask for a change"
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: On a handset the new plugin's conversation is in the page's seat
    # A phone has no column to put a conversation in, so the page draws its
    # SEAT where the button would be — the same chat, read under the page
    # instead of beside it.
    Given I open the app
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "counts the hours"
    And I name the plugin "Hours"
    And I accept the name
    Then the address is "/plugins/hours"
    And the plugin "hours" is being built by a conversation called "Hours"
    And the plugin page seats the chat about "hours"
    And there should be no page errors

  # A RELOAD IS WHERE "FIND IT BY THE ADDRESS" IS ACTUALLY TESTED. Nothing is
  # written down about which conversation builds this plugin, so a fresh tab
  # has to ask chat what is at `/plugins/bar-beside` — and it asks while
  # chat's roster is still arriving, which is the race the column has to
  # survive: it opens at once and docks the chat the moment the answer is
  # there, rather than giving up and docking nothing.
  @scratch:plugins
  Scenario: A reload on the page of a plugin being built docks its chat again
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "draws a tiny bar beside any number"
    And I name the plugin "Bar beside"
    And I accept the name
    Then the address is "/plugins/bar-beside"
    And the conversation building "bar-beside" is docked
    When I reload the page
    Then the plugin page is "building"
    And the conversation building "bar-beside" is docked
    And there should be no page errors
