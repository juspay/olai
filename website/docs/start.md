# Set up olai and write your first line

olai shows a directory of your notes in a browser. Here you make that
directory, serve it, write one line into it, and let git record the change.

You need [nix](https://nixos.org/download/) and a terminal.[^nix]

## 1. Make the directory

```sh
mkdir -p ~/notes
git -C ~/notes init
```

`olai web` refuses a path that does not exist, so make the directory first,
and make it a git repository.[^repo]

## 2. Serve it

```sh
nix run github:juspay/olai -- web ~/notes
```

The command prints one line for each thing the server does. The line that says
`serving` carries the web address to open in a browser.[^serving]

## 3. Write a line

Press `Cmd` + `K` (`Ctrl` + `K` if you are not on a Mac) to open the palette,
the box for searching commands. Pick **Capture to the Inbox**, type a line
after the `+` and press `Enter`. olai saves your line as a row, one line of an
outline, in the file `_olai/Inbox.olai`.[^inbox]

Open that file from the sidebar, the list of files down the left, and keep
typing.[^keys] The page follows the files on disk: edit one in another program
and the page shows your change at once, with no reload.

## 4. Let git record it

The header shows the Commit readout, which says what is waiting to be
recorded. Click it, then click **Commit**.[^policy]

```sh
git -C ~/notes log --oneline
```

Your line is now a git commit over plain text files that you own.[^plain]

## Where to go next

| You want to | Page |
| --- | --- |
| a fixed port, a different network interface, or the log | [running.md](running.md) |
| olai up after a reboot, or behind a proxy | [deploying.md](deploying.md) |
| choose which plugins run | [settings.md](settings.md) |
| ask an agent for a plugin of your own | [dynamic-plugins.md](dynamic-plugins.md) |
| talk to an agent about these notes | [chat.md](chat.md) |
| point an agent in a terminal at this server | [connecting-agents.md](connecting-agents.md) |
| the file format underneath | [format.md](format.md) |

[^nix]: nix is the package manager that fetches and runs olai for you in step
    2. Everything olai needs beyond nix and a terminal is downloaded for you.

[^repo]: git records versions of the files in a directory. Running `git init`
    in `~/notes` makes that directory a git repository, which gives git
    somewhere to record the changes you make.

[^serving]: The server reads the directory and every folder under it, and
    prints one line per event on stdout. The address is on the `serving` line
    because olai asks the operating system for a free port number by default
    (`--port 0`), so the number can differ each time you start it.

[^inbox]: The inbox is the file `_olai/Inbox.olai`, where every captured line
    lands. A captured line arrives with today's date on it and the mark **To
    do**, which says it is work you owe.

[^keys]: An outline is a file of rows, and a row can hold rows under it. While
    you type in an outline, `Enter` starts the next row, `Tab` indents a row so
    it sits under the row above it, and `Shift` + `Tab` moves it back out.
    [editing.md](editing.md) is the rest of the keys.

[^policy]: Clicking the Commit readout opens the commit panel, which is where
    the **Commit** button sits. A directory starts with its commit policy set
    to `manual`, so olai records nothing until you ask it to.
    [settings.md](settings.md) is where you turn automatic commits on, and
    [git.md](git.md) is what the commit panel does.

[^plain]: An olai outline is a plain text file holding one record per line.
    [format.md](format.md) is the format itself.
