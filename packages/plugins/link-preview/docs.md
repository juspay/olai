# Link previews

Rest the pointer on a link inside olai, or focus it with the keyboard, and a card opens showing what a click would open.[^timing]

## Which links open a card

A card opens for the links a click would take you to inside olai, read the same way a click reads them. So nothing opens for a link to a place on the page you are on, a download, or a link aimed at another window.[^nothing]

## What a card shows

| The link | The card |
| --- | --- |
| a row | where it lives, its title, its mark and date, `2/5 done` where it has children with marks, its note, and up to three children with `+N more` |
| a whole outline | its first three top-level rows |
| a document | its opening blocks |
| a heading in a document | that section |
| a conversation | its last two turns |
| a node with a conversation on it | the conversation, not the row |
| nothing | `Nothing at <address>`, and a line saying the target is missing or cannot be resolved |

A card says `Reading…` while it is still fetching, and draws a refusal in its own words.

## What you can do in a card

A card is for reading: nothing in it can be edited.[^size] Links inside a card open normally, and do not raise a card of their own:[^heading]

| What you do | Where it opens |
| --- | --- |
| click | in the pane the link was drawn in, even if another pane has the caret |
| `Alt` + click | on the right |
| `Alt` + `Shift` + click | in a new pane |

## When something is off

Switching link previews off takes the cards, their listeners and their timers away; links keep working.[^kinds]

[^timing]: The card's timing: the pointer rests about 400 ms before a card opens. Move onto the card to keep it; leave it for about 200 ms, or press `Escape`, to close it. Only one card is open at a time, and `Escape` closes it without disturbing the page or the caret under it.

[^nothing]: Nothing opens either for touch, nor for keyboard focus on a device whose pointer is a finger, though a mouse on a device that has both still opens cards. Nor for a link inside an editor you are typing in. Nor for a link that arrives under a pointer that has not moved, because the page around it changed: move onto it and the card opens.

[^size]: A card's size: titles and notes are drawn whole rather than cut short, and the card grows to fit. Where it would outgrow the window its body scrolls, so every paragraph stays reachable and the foot of the card stays visible.

[^heading]: A document card's link to one of that document's own headings opens the document at that heading on the right.

[^kinds]: Each kind of card is offered by the plugin that owns that content, so switching one of those off withdraws its card and leaves the rest.
