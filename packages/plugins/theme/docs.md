# Theme: colours, typeface and text size

The theme plugin decides what olai looks like: the colour palette, the typeface, and the size of everything on the page.[^rows]

## Pick a colour palette

The **Theme** row offers eleven palettes, drawn as swatches in the colours they set: the seven light ones first, the four dark ones on a line below.[^swatch] On a screen wider than a phone, each dark swatch stands under the light one of the same colour.

| Colour | Light | Dark |
| --- | --- | --- |
| neutral | `chalk` | `basalt` |
| rose | `bloom` | |
| amber | `manuscript` | `ember` |
| green | `leaf` | |
| sea-glass | `reef` | `abyss` |
| blue | `sky` | |
| violet | `iris` | `dusk` |

Before them stands **Follow the system**, where a browser that has picked nothing starts.[^system] `Tab` reaches the swatches, and `Space` or `Enter` picks one.[^open] A palette also colours the mark in the browser tab, the app icon and a phone's status bar.[^paints]

## Pick a typeface

The **Font** row is a drop-down list of the typefaces olai ships, in three groups: **olai**, **Generic** and **Typefaces**. The default, `olai`, sets titles and documents in Literata, the interface in Inter, and code in iA Writer Mono.[^select]

## Pick a text size

The **Size** row is one number, and it sets the size of the whole page, the controls and the text together.[^layout]

| Choice | What it is |
| --- | --- |
| **Medium** | your browser's own text size |
| **Large** | one notch up, and olai's default |
| **Larger** | two notches up |

## What is kept, and what is forgotten

olai puts your palette, typeface and size back before the page is first drawn, so the page does not flash in one palette and settle in another.[^forgotten]

## When your system decides the colours instead

Three system settings reach olai without passing through these rows, and olai follows all three as you change them, with nothing to reload: high contrast,[^contrast] more contrast[^more] and less movement.[^motion]

[^rows]: The three rows, **Theme**, **Font** and **Size**, are the **Appearance** group at the top of the preferences panel. The choices belong to this browser, are carried to its other tabs, and are never sent to the server.

[^swatch]: A swatch carries no words, so the palette's name is the name a screen reader reads out and the tooltip a pointer gets. The palette in use is named once beside the row's label.

[^system]: Your system's own light or dark setting chooses between `chalk` and `basalt`, and the label reads `System · Chalk`. Pick a swatch and your pick wins over the system until you press **Follow the system** again, after which the label reads the bare name, `Chalk`.

[^open]: The panel stays open while you pick, because you judge a palette by the page it colours.

[^paints]: The palette also sets the colour a phone draws its status bar in, the mark in the browser tab, and the icon. When an agent is waiting for you, a `●` goes in front of the tab's name, and the icon is marked to match.

[^select]: The closed drop-down is drawn in the typeface in use. The options are not: a browser asked to draw twenty names in twenty typefaces would have to fetch all twenty to open the list.

[^layout]: The point at which olai switches between the phone layout and the desktop one does not move with the size, so asking for larger type gives you larger type rather than a laptop drawn as a phone.

[^forgotten]: A stored choice naming a palette, typeface or size olai does not offer is forgotten: the typeface and the size go back to their defaults, and the palette goes back to following the system. Where a browser allows no storage at all, a pick still works and lasts until the page is closed.

[^contrast]: When you ask your system for high contrast, the browser throws olai's palette away and repaints from your own colours, deleting every shadow as it goes. The keyboard's focus ring survives, because it is an outline rather than a shadow.

[^more]: When you ask for more contrast, the scrollbar, which is normally faint, draws its thumb, the part you drag, in the full ink colour of whichever palette is in use.

[^motion]: When you ask for less movement, olai stops moving: switches and chevrons appear in their new state rather than travelling to it, and marks that pulse to show something is live hold still. Showing a row puts it on screen rather than gliding to it. Colours still fade, and nothing those marks were telling you is lost along with the movement.

<details>
<summary>What a system colour repaints, and what happens when a plugin is off</summary>

Anything that said its state in a colour alone says it again in the system's colours: a switch's two positions, the chosen segment of a row of buttons, the selected tab of an hledger journal page. So do the round marks that show an agent's state, a turn in progress and a transaction. The **Theme** swatches are the single exception, on purpose: a palette preview with its colours taken away has nothing left to say.

| What is off | What you get |
| --- | --- |
| theme | no **Appearance** rows and no tab mark; the rest of the preferences panel stands |
| preferences, the sidebar or the layout | the palette, typeface and size keep working and keep following what is stored |

</details>
