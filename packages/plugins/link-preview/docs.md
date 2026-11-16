# Link previews

Rest the pointer on a link inside olai, or move the keyboard focus to it, and a card opens showing what a click would open.[^timing]

## Which links open a card

A card opens for a link a click would follow to somewhere inside olai, and olai works out where the link points the same way a click does.[^nothing] Some links, and some pointers, never open a card.[^pointer]

## What a card shows

| The link points at | The card shows |
| --- | --- |
| a row, which is one line of an outline | the outline and the rows it sits under, its title, its mark such as **Doing**, its date, `2/5 done` where the rows under it carry marks, its note, and up to three of those rows with `+N more` |
| a whole outline | its first three top-level rows |
| a document, which is a `.md` file | its opening blocks |
| a heading in a document | that section |
| a conversation with an agent | its last two turns |
| a row that has a conversation on it | the conversation, not the row |
| nothing | `Nothing at <address>`, and a line saying the target is missing or cannot be found |

A card says `Reading…` while it is still fetching, and says in its own words when it cannot show the target.

## What you can do in a card

A card is for reading; nothing in it can be edited.[^size] A link inside a card opens the normal way, and opens no card of its own:[^heading]

| What you do | Where it opens |
| --- | --- |
| click | in the pane the link was drawn in, even if another pane has the caret |
| `Alt` + click | on the right |
| `Alt` + `Shift` + click | in a new pane |

## When something is off

Switching link previews off takes the cards away, and the links themselves keep working.[^kinds]

[^timing]: The card's timing: the pointer rests on the link for about 400 ms before a card opens. Move the pointer onto the card to keep it open; move away for about 200 ms, or press `Escape`, to close it. Only one card is open at a time, and `Escape` closes it without disturbing the page or the caret under it.

[^nothing]: No card opens for a link to a place on the page you are already on, for a download, or for a link that opens another window. None opens for a link inside an editor you are typing in.

[^pointer]: No card opens for a tap, and none opens for keyboard focus on a device whose pointer is a finger, though a mouse on a device that has both still opens cards. None opens for a link that moves under a pointer that has not itself moved, because the page around it changed: move the pointer onto the link and the card opens.

[^size]: A card's size: titles and notes are drawn in full rather than cut short, and the card grows to fit them. Where a card would outgrow the window its body scrolls, so every paragraph stays reachable and the foot of the card stays visible.

[^heading]: In a card for a document, a link to one of that document's own headings opens the document at that heading, on the right.

[^kinds]: Each kind of card comes from the plugin that owns that kind of content, so switching one of those plugins off removes its kind of card and leaves the rest. The listeners and timers behind the cards go when link previews go.
