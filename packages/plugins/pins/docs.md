# Pins

Pins keeps a list of saved pages in the sidebar, under **Pinned**. One click opens a pinned page, or a whole set of panes you saved together.[^shared]

## Pin the page you are on

| Where | What it offers |
| --- | --- |
| the palette | **Pin this page**, or **Unpin this page** when it is already pinned |
| the palette, while the window is split into panes | **Pin this layout…**, or **Unpin this layout** |
| the menu on a row, which is one line of an outline | **Pin to sidebar**, or **Unpin from sidebar** |

A label ending in `…` asks you for a name first.[^name] A row whose page is pinned carries a pin icon in the outline.

## What pinning a layout saves

Pinning a layout saves the pages of the split, in order, and always asks `Name this layout`. A name left empty is refused with `A layout needs a name`.

How wide each pane is, and which pane you were working in, are not saved. Two splits of the same pages in the same order are therefore the same layout.[^label]

## Rename, reorder, unpin

| Button | What it does |
| --- | --- |
| **Rename** | asks `Rename this pin, or leave it blank`, and changes the line in the sidebar alone, never the page it opens |
| **Unpin** | takes the pin out of the list |

Drag a pin up or down to reorder the list.[^reach] Undo reverses a reorder or an unpin, as it does any other write. When olai refuses something you do to the list, it says so in a line under the header.

## When something is off

| What is off | What you get |
| --- | --- |
| the `outline-olai` plugin, which reads and writes `.olai` files | `Pins need outline-olai, which is turned off.` where the list was |
| pins | no list, no pin commands and no pin icon; the rows of `_olai/Pins.olai` stay where they are |

[^shared]: Where your pins are saved: in `_olai/Pins.olai`, inside the directory olai serves, so every browser that opens this directory reads the same pins. It is an ordinary outline at an ordinary address, so you can open it and edit a pin's title by hand.

[^name]: Naming a pin: pinning a page asks `Name this pin, or leave it blank`. Left blank, the pin shows the name of the page it opens, and follows that name when the page is renamed.

[^label]: What the sidebar shows for a layout: the name you gave it. The addresses it opens follow in the tip the app shows and in the name a screen reader reads, as `Planning`, then `house.olai · garden.olai`.

[^reach]: Where the two buttons are: both appear when the pointer is on a pin or the keyboard focus is in it, and both are drawn all the time on a screen with no pointer to hover with. The list is in the sidebar at every window width, including the drawer on a phone.
