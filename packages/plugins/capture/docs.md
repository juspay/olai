# Capture

Capture writes one line into the inbox, the file where a new line waits until you file it, without leaving the page you are on.[^inbox]

## Write a line into the inbox

1. Open the palette, which is what `Cmd` + `K` opens (`Ctrl` + `K` away from a Mac). The command for this reads **Capture to the Inbox**, with `+ a line` beside it.
2. Type `+`, a space, and the line.
3. Press `Enter`.

The palette stays open for the next line, so you can capture several lines in one visit. What you see:

| What you typed | What the palette says |
| --- | --- |
| `+` and nothing else | `Type a line after + to add it to the Inbox` |
| a line that landed | `Captured “line” to <file>`, naming the file it went to |
| a line olai refused | the reason, in the same place |

On a phone the bar at the bottom carries a **Capture** `+` button: one tap opens the palette with `+ ` already typed.

## Where a captured line lands

A capture is added as a new top-level row of `_olai/Inbox.olai`, marked **To do**. If the directory has no inbox file, the capture creates one.[^undo] Deciding where the line really belongs is something you do afterwards, in the app.

## The Inbox entry in the sidebar

The entry opens `_olai/Inbox.olai` and carries a count of what is waiting there.[^chip]

## When something is off

| What is off | What you get |
| --- | --- |
| the `outline-olai` plugin, which reads and writes `.olai` files | `Inbox needs outline-olai, which is turned off.` where the entry was |
| capture | no **Inbox** entry, no `+` prefix in the palette and no capture command; the inbox file stays as it is |

[^inbox]: The inbox is the file `_olai/Inbox.olai`, and capture gives it an **Inbox** entry in the sidebar with a count of what is waiting in it.

[^undo]: Undoing a capture takes the row straight back out. An inbox file the capture created is left standing, so you delete it yourself if you want it gone.

[^chip]: The count beside **Inbox** counts the rows in the inbox marked **To do** or **Doing**, however deeply they are nested, and is not drawn when that count is zero. A ⚠ beside the word means `Couldn't open this file`.
