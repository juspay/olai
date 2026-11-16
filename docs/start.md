# Start

Serve a directory of your own notes, write a line into it, and watch git record
it. You need [nix](https://nixos.org/download/) and a terminal. Everything else
is downloaded for you.

## 1. Make the directory

`olai web` refuses a path that does not exist, so create it first. Make it a git
repository too, so there is something to record into:

```sh
mkdir -p ~/notes
git -C ~/notes init
```

## 2. Serve it

```sh
nix run github:juspay/olai -- web ~/notes
```

The server reads the directory recursively and prints one line per event on
stdout. The line that says `serving` carries the address, because `--port 0` is
the default and the OS picks the number. Open that address in a browser.

## 3. Write a line

Press `Cmd` + `K` (`Ctrl` + `K` away from a Mac) to open the palette, then pick
**Capture to the Inbox**. Type a line after the `+` and press `Enter`. It lands
in `_olai/Inbox.olai`, dated, marked as work you owe.

Open that file from the sidebar and keep typing: `Enter` starts the next row,
`Tab` and `Shift` + `Tab` move a row in and out. The page follows the files on
disk, so an edit you make in another program shows up here with nothing to
press. [editing.md](editing.md) is the rest of the keys.

## 4. Let git record it

The header carries the Commit readout, which says what is waiting. Click it to
open the commit panel and press **Commit**. The directory's default policy is
`manual`, so nothing is recorded until you ask.

```sh
git -C ~/notes log --oneline
```

Your line is a commit over plain text files you own, one record per line.
[settings.md](settings.md) is where you turn automatic commits on, and
[git.md](git.md) is what the panel does.

## Where to go next

| You want to | Page |
| --- | --- |
| a fixed port, a different interface, or the logs | [running.md](running.md) |
| olai up after a reboot, or behind a proxy | [deploying.md](deploying.md) |
| choose which plugins run | [settings.md](settings.md) |
| ask an agent for a plugin of your own | [dynamic-plugins.md](dynamic-plugins.md) |
| talk to an agent about these notes | [chat.md](chat.md) |
| point an agent in a terminal at this server | [connecting-agents.md](connecting-agents.md) |
| the file format underneath | [format.md](format.md) |
