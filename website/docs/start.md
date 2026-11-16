# Start

Serve a directory of your own notes, write a line into it, and watch git record
it. You need [nix](https://nixos.org/download/) and a terminal.[^nix]

## 1. Make the directory

```sh
mkdir -p ~/notes
git -C ~/notes init
```

`olai web` refuses a path that does not exist, so create it first.[^repo]

## 2. Serve it

```sh
nix run github:juspay/olai -- web ~/notes
```

Open the address on the `serving` line in a browser.[^serving]

## 3. Write a line

Press `Cmd` + `K` (`Ctrl` + `K` away from a Mac) to open the palette, then pick
**Capture to the Inbox**. Type a line after the `+` and press `Enter`.[^inbox]

Open that file from the sidebar and keep typing.[^keys] The page follows the
files on disk, so an edit you make in another program shows up here with
nothing to press.

## 4. Let git record it

Click the Commit readout in the header and press **Commit** in the panel it
opens.[^policy]

```sh
git -C ~/notes log --oneline
```

Your line is a commit over plain text files you own, one record per line.

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

[^nix]: Everything olai needs beyond nix and a terminal is downloaded for you.

[^repo]: Making the directory a git repository gives git something to record
    into.

[^serving]: The server reads the directory recursively and prints one line per
    event on stdout. The line that says `serving` carries the address, because
    `--port 0` is the default and the operating system picks the number.

[^inbox]: A captured line lands in `_olai/Inbox.olai`, dated, marked as work
    you owe.

[^keys]: While typing in an outline, `Enter` starts the next row, and `Tab` and
    `Shift` + `Tab` move a row in and out. [editing.md](editing.md) is the rest
    of the keys.

[^policy]: The Commit readout in the header says what is waiting. The
    directory's default policy is `manual`, so nothing is recorded until you
    ask. [settings.md](settings.md) is where you turn automatic commits on, and
    [git.md](git.md) is what the panel does.
