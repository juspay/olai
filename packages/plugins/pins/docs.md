# Pins

Pins keeps a shelf of saved pages in the sidebar, under **Pinned**. One click opens a pinned page, or a whole split layout. The shelf is saved in the directory, in `_olai/Pins.olai`, so every browser that opens this directory reads the same pins.

## Pin the page you are on

| Where | What it offers |
| --- | --- |
| the palette | **Pin this page**, or **Unpin this page** when it is already on the shelf |
| the palette, in a split | **Pin this layout…**, or **Unpin this layout** |
| a row's menu | **Pin to sidebar**, or **Unpin from sidebar** |

A label ending in `…` is one that asks for a name first. Pinning a page asks `Name this pin, or leave it blank`: left blank, the pin reads as its target is called and follows it when the target is renamed. A row whose page is on the shelf carries a pin glyph in the outline.

## What a layout pin keeps

A layout pin keeps the pages of the split, in order, and always asks `Name this layout`. An empty name is refused with `A layout needs a name`.

Pane widths and which pane has the caret are not part of it, so two splits of the same pages in the same order are one layout. The shelf draws the name you gave it; the addresses it opens follow in the app's tip and in the row's accessible name — `Planning`, then `house.olai · garden.olai`.

## Rename, reorder, unpin

| Verb | What it does |
| --- | --- |
| **Rename** | asks `Rename this pin, or leave it blank`, and changes the shelf row alone, never the page it opens |
| **Unpin** | takes the pin off the shelf |

Drag a pin up or down to reorder the shelf.

Both verbs appear with the pointer on a pin or the keyboard in it, and are drawn outright on a screen with no hover: the shelf is in the sidebar at every width, the phone's drawer included.

Undo reverses a reorder or an unpin, as it does any other write. A shelf gesture that is refused says so under the header.

## When something is off

| What is off | What you get |
| --- | --- |
| the `outline-olai` plugin | `Pins need outline-olai, which is turned off.` where the shelf was |
| pins | no shelf, no pin commands and no glyph; the rows of `_olai/Pins.olai` stay where they are |

`_olai/Pins.olai` is an ordinary outline at an ordinary address: you can open it and edit a pin's title by hand.
