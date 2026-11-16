# Capture

Capture puts one line into the directory's inbox without leaving the page you are on. The inbox is `_olai/Inbox.olai`, and capture gives it an **Inbox** row in the sidebar with a count of what is waiting in it.

## Write a line into the inbox

1. Open the palette. The row for this reads **Capture to the Inbox**, hinted `+ a line`.
2. Type `+`, a space, and the line.
3. Press `Enter`.

The palette stays open for the next line, so several captures are one visit. What you see:

| What you typed | What the palette says |
| --- | --- |
| `+` and nothing else | `Type a line after + to add it to the Inbox` |
| a line that landed | `Captured “line” to <file>`, naming the file it went to |
| a line that was refused | the refusal, in its place |

On a phone the thumb bar carries a **Capture** `+`: one tap opens the palette with `+ ` already typed.

## Where a captured line lands

A capture is added at the top level of `_olai/Inbox.olai`, marked **To do**, and where the directory has no inbox the write mints one. Deciding where the line really belongs is what you do afterwards, in the app.

Undo takes the row straight back out. An inbox the capture minted is left standing, so you delete it yourself if you want it gone.

## The Inbox row

The row opens `_olai/Inbox.olai`. Its chip counts the rows in the inbox marked **To do** or **Doing**, at any depth, and is not drawn when that count is zero. A ⚠ beside the word means `Couldn't open this file`.

## What else the inbox holds

Chat files a conversation that belongs to no node under a top-level `Chats` row of the inbox, and offers **Inbox › Chats** as the default place on its **New chat** row. Switching capture off withdraws that place and stops the filing; the other places still work, and conversations already on a node are untouched.

## When something is off

| What is off | What you get |
| --- | --- |
| the `outline-olai` plugin | `Inbox needs outline-olai, which is turned off.` where the row was |
| capture | no **Inbox** row, no `+` prefix and no palette row; the inbox file stays as it is |
