Feature: A plugin's halves are kept, and they are not prose
  The two halves of a vault-defined plugin are KEPT text: their bodies travel
  on the revision, so the write gate can refuse to overwrite source nobody has
  read, the Commit panel can list a change line by line, and the plugin's own
  page can draw the code a person is being asked to say yes to without a second
  fetch. That is what `kept` is for and none of it is in question here.

  WHAT KEPT DOES NOT MEAN IS "READ IT". Everything else olai does with a kept
  body is a reading of somebody's writing: the first line is a title, a
  `#topic` is one of this vault's tags, a `[…](…)` is a link the graph draws, a
  leading `---` block is the file's own record. A half is TypeScript. Read as
  prose, `plugins/swatch/server.ts` arrived in this app titled
  `import { definePlugin, Kinds } from "@olai/plugin-api"`, carrying `#rrggbb`
  — the shape of a colour, written in a sentence about what the kind takes —
  as a tag of the vault, and standing as a document in every list a person can
  reach. So the claim says which of the two things it means
  (`@olai/format`'s `Claim.opaque`, argued in `src/claim.ts`), and these
  scenarios are that sentence seen from the outside.

  THE PALETTE IS THE DOOR THEY ASK AT, because it is the one place a person
  meets the document list and the search's tag facet in the same box: typing
  `#rrggbb` asks for a tag, typing `swatch` asks for a word, and both answer
  out of the same reading `markdown_index`, the sidebar's Reference tree and a
  declared `doc` property are answered from. A scenario per fact would be three
  openings of one modal to ask one question.

  The fixture is the same `swatch` folder the rest of this suite uses: a
  README somebody wrote in prose, beside two halves nobody did.

  @scratch:plugins
  Scenario: A `#`-word in a half's code is nobody's tag
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    # `#rrggbb` is in `server.ts`, in the sentence that says what the `hex`
    # kind takes. It is the shape of a colour and not a topic anybody writes
    # about, and before the claim said so it was a tag this vault held.
    And I type "#rrggbb" into the palette
    Then the palette lists no plugin half
    And the palette lists no document "plugins/swatch/server.ts"
    And there should be no page errors

  @scratch:plugins
  Scenario: The halves are in no document list, and the README beside them is
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    # One word, three files, one folder: the two halves hold it in their PATHS
    # and the README holds it in its path and its heading. The README is a row
    # — a `.md` in a plugin's folder is prose like any other — and that is what
    # makes the two absences a claim about the claim rather than a search that
    # has stopped answering.
    And I type "swatch" into the palette
    Then the palette lists the document "plugins/swatch/README.md"
    And the palette lists no plugin half
    And the palette lists no document "plugins/swatch/server.ts"
    And the palette lists no document "plugins/swatch/browser.tsx"
    And there should be no page errors

  @scratch:plugins
  Scenario: A half's code is not words anybody searched
    Given I open the outline "colours.olai"
    When I press the palette shortcut
    # `definePlugin` is written in both halves of both plugins in this vault
    # and nowhere a person wrote a sentence. A body that is folded into the
    # search index is a body whose every identifier is a hit, which is how a
    # vault with plugins in it came to answer a query about its notes with
    # somebody's import list.
    And I type "definePlugin" into the palette
    Then the palette lists no plugin half
    And there should be no page errors
