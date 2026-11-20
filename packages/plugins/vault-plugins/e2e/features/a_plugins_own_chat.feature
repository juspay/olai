Feature: A plugin's chat is the chat of its README
  Asking for a plugin starts a conversation, and NOTHING RECORDS WHICH ONE
  except the plugin's own README note: `plugins/<word>/README.md` carries
  `chat-agent-session` in its front matter, and that is the whole of the
  binding — the serve finds the conversation by asking chat for that note's
  chat, the page docks the same one, and a plugin's settings node carries the
  person's consent and nothing else.

  WHAT THIS REPLACED was a `builder` property on that node, pointing at a chat
  row. Two places recorded one fact, and they could disagree the moment
  somebody retitled or trashed the chat. So the property is gone — and a vault
  that still has one from before must behave as though it does not, which is
  the last scenario here.

  THE PHONE IS THE OTHER HALF of what the page offers. *Ask for a change…*
  opens the conversation in the pane beside the page, and a handset — which
  draws those panes as a strip of tabs — opens the same chat page the same
  way.

  @scratch:plugins
  Scenario: The conversation is a chat about the plugin's page, and the page finds it
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "draws a tiny bar beside any number"
    And I name the plugin "Bar beside"
    And I accept the name
    Then the address is "/plugins/bar-beside"

    And the plugin "bar-beside" is being built by a conversation called "Bar beside"
    And the plugin page is "building"

    And the plugin page's README says "Bar beside"
    And the plugin page's README does not say "chat-agent-session"

    And the conversation building "bar-beside" is beside the page
    And the plugin page offers to ask for a change

    When I ask for a change to the plugin "bar-beside"
    Then the conversation building "bar-beside" is beside the page
    And there should be no page errors

  @scratch:plugins
  Scenario: A plugin whose node still carries a builder property behaves exactly as it did
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
    And the plugin page does not say "Ask for a change"
    And there should be no page errors

  @phone @scratch:plugins
  Scenario: On a handset the new plugin's conversation opens as its own page
    Given I open the app
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "counts the hours"
    And I name the plugin "Hours"
    And I accept the name
    Then the address is "/plugins/hours"
    And the plugin "hours" is being built by a conversation called "Hours"
    When I ask for a change to the plugin "hours"
    Then the conversation building "hours" is beside the page
    And there should be no page errors

  @scratch:plugins
  Scenario: A reload on the page of a plugin being built docks its chat again
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    And I open New plugin from the palette
    And I ask for a plugin that "draws a tiny bar beside any number"
    And I name the plugin "Bar beside"
    And I accept the name
    Then the address is "/plugins/bar-beside"
    And the conversation building "bar-beside" is beside the page
    When I reload the page
    Then the plugin page is "building"
    And the conversation building "bar-beside" is beside the page
    And there should be no page errors
