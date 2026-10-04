# Link previews

Hover an internal link for about 400 ms, or focus it with the keyboard, to
read a live preview. Move onto the card to keep it open; leave it for about
200 ms or press Escape to close it. Only one card opens at a time. A layout
change moving a new link under a stationary pointer does not open a card;
moving the pointer over that link does. Movement within the same element does
not repeatedly classify its link. Escape is consumed by an open card, leaving
the underlying page and focus alone. Each card describes its link through
`aria-describedby`, preserving any existing description when it closes.

Outlines show the target's context, title, status, date, task progress, the complete
title and note, and up to three children. Qualified row links read just the node and verify
its file; they do not lease the whole outline. Whole outline links show three top-level rows.
Markdown links show opening blocks; heading links show that section, using
the same dead-link decoration and loading/failure states as document pages. Chat
conversation links show the last two turns. Missing targets say “Nothing at”.

Cards are read-only and grow to fit their content. Outline titles and descriptions
are never truncated. When a card reaches the available viewport height reported
by Popper, its body scrolls so every paragraph remains reachable; the footer stays
visible. The children list still shows at most three rows and “+N more”.
Links inside cards still open,
but do not create nested previews. Touch input, keyboard focus on a coarse-pointer
device, and links in active editors do not open cards. A mouse on a hybrid
device can still open previews. Clicking retains the app's navigation gestures:
click opens, Alt-click opens on the right, and Alt-Shift-click forces a new pane.

The card leases live data only while open. Switching this plugin off removes
its listeners, timers, overlay and reading. Content plugins independently offer
renderers through `navigation.link-previews`; removing one withdraws its card.
Chat wins over the generic outline renderer for nodes with a conversation.
