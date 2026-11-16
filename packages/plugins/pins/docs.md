# Pins

Pins keeps a shelf of saved pages in the sidebar, under **Pinned**. One click opens a pinned page, or a whole split layout.[^shared]

## Pin the page you are on

| Where | What it offers |
| --- | --- |
| the palette | **Pin this page**, or **Unpin this page** when it is already on the shelf |
| the palette, in a split | **Pin this layout…**, or **Unpin this layout** |
| a row's menu | **Pin to sidebar**, or **Unpin from sidebar** |

A label ending in `…` is one that asks for a name first.[^name] A row whose page is on the shelf carries a pin glyph in the outline.

## What a layout pin keeps

A layout pin keeps the pages of the split, in order, and always asks `Name this layout`. An empty name is refused with `A layout needs a name`.

Pane widths and which pane has the caret are not part of it, so two splits of the same pages in the same order are one layout.[^label]

## Rename, reorder, unpin

| Verb | What it does |
| --- | --- |
| **Rename** | asks `Rename this pin, or leave it blank`, and changes the shelf row alone, never the page it opens |
| **Unpin** | takes the pin off the shelf |

Drag a pin up or down to reorder the shelf.[^reach] Undo reverses a reorder or an unpin, as it does any other write. A shelf gesture that is refused says so under the header.

## When something is off

| What is off | What you get |
| --- | --- |
| the `outline-olai` plugin | `Pins need outline-olai, which is turned off.` where the shelf was |
| pins | no shelf, no pin commands and no glyph; the rows of `_olai/Pins.olai` stay where they are |

[^shared]: Where the shelf is saved: `_olai/Pins.olai`, in the directory, so every browser that opens this directory reads the same pins. It is an ordinary outline at an ordinary address, so you can open it and edit a pin's title by hand.

[^name]: Naming a pin: pinning a page asks `Name this pin, or leave it blank`. Left blank, the pin reads as its target is called and follows it when the target is renamed.

[^label]: What the shelf shows for a layout: the name you gave it. The addresses it opens follow in the app's tip and in the row's accessible name — `Planning`, then `house.olai · garden.olai`.

[^reach]: Where the verbs are: both appear with the pointer on a pin or the keyboard in it, and are drawn outright on a screen with no hover. The shelf is in the sidebar at every width, the phone's drawer included.
