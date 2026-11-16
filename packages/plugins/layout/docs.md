# Layout

The `layout` plugin draws the frame around every page: the header, the left column, the pages in the middle, the panel on the right, and a phone's bar of buttons.[^seats]

## The header

| On a desktop, left to right | Drawn by |
| --- | --- |
| `olai` and this server's name | layout |
| the search box | [search.md](search.md) |
| the health dot | layout |
| the Preferences gear | [preferences.md](preferences.md) |
| who is signed in | [identity.md](identity.md) |

A phone keeps the search box and who is signed in, and adds a menu button.[^phone]

## The health dot

One dot is always drawn, green, amber or red: the worst colour among the connection and every report a plugin makes.[^name] Clicking the dot opens a list of those reports, worst first.[^rows][^votes] The connection has a line of its own.[^connection] At its foot is **Plugins**, which opens the plugins panel ([plugin-inspector.md](plugin-inspector.md)).[^foot]

## The columns

Below the header are up to three columns: the sidebar (the left column of files), the main column of pages, and the agent panel on the right, labelled **Panel**.[^widths] Drag a handle to resize one:

| Handle | What it resizes |
| --- | --- |
| **Resize sidebar** | the sidebar's width |
| **Resize agent panel** | the panel's width |
| **Resize panes** | the boundary between two panes |

The panel column is drawn when a plugin has filled it, you have it open and the screen is desktop-sized.[^panel] The tab strip sits above the pages, on a desktop only ([tabs.md](tabs.md)).[^strip] A pane's header shows its page's name.[^pane]

## The bar of buttons on a phone

On a phone, while any plugin has added a button, a bar named **Quick access** is fixed to the bottom of the screen.[^thumb]

| Button | Added by |
| --- | --- |
| Today, Agenda | [journal.md](journal.md) |
| Chats | [chat.md](chat.md) |
| Capture | [capture.md](capture.md) |

## When a page breaks

A page that fails while being drawn shows **Something went wrong on this page**, with `Your files are safe. Reload to try again.`[^fault]

[^seats]: The header runs across the top of the window, the sidebar's column down the left, and the bar of buttons along the bottom of a phone's screen. The layout plugin decides how much room each of those gets, and leaves a place in each one for another plugin to fill. Which places there are, and what layout tells the plugins filling them, are in the closed block at the foot of this page.

[^phone]: The menu button sits before the word `olai`, and is named **Show sidebar** or **Hide sidebar**. A phone draws no health dot. News about the connection, and news from git, appear as banners under the top bar, and only when there is news.

    A plugin may ask for a place in the phone's top bar for pages that have no sidebar. On a phone with a sidebar drawer, Preferences and Plugins are entries at the foot of the drawer instead. On a phone page with no drawer, such as the error page, the gear stays in the top bar.

[^name]: A screen reader reads the dot as `Status: all good`, or as `Status: ` followed by each piece of news in the words of the plugin that reported it, joined by ` · `, alarms first.

[^rows]: A plugin's report is a line in the same list: git's Commit line, [kolu.md](kolu.md), [odu.md](odu.md), [mail.md](mail.md), [xyne-spaces.md](xyne-spaces.md). Lines stand worst first: alarms, then notices, then healthy, then quiet. Within one colour the connection comes first and the rest follow the order their plugins started in. The order updates as you watch, so a line whose colour changes moves, and `Tab` walks the lines in the order you see.

[^votes]: Switching a plugin off takes its line away, and takes its colour out of the count for the dot, in the same step; an open list redraws without it. So a dot that is not green always has a line of exactly its colour under it.

[^connection]: The connection line says `Connected` while the page is reading from the server, `Connecting…` while the first connection is still being made, and `Reconnecting…` when the connection dropped and is being retried. `Partly connected` means the connection is up but some plugins have stopped receiving updates, and the line names them. `The server restarted` is followed by `Reload the page to keep working.`

[^foot]: The last line above the foot is quiet and does not affect the dot's colour: `Running for 2h`, with `Running since <instant>` in its tip and in what a screen reader reads. Choosing **Plugins** closes the list and opens the plugins panel under the dot. `Escape` closes the panel and puts the keyboard focus back on the dot.

[^widths]: The columns sit under the header, and the main column holds the tab strip as well as the pages. Both stored widths are fitted to the window as you resize it, so the page in the middle keeps its minimum space. The command `Reset sidebar width` in the command palette puts the sidebar back to its default width, for a keyboard that cannot drag a handle.

[^panel]: The panel column stays under the header as you scroll and is exactly one screen tall, so a conversation scrolls inside it while the page scrolls behind it. On a phone, or when no plugin has filled it, there is no third column whatever width was stored.

[^strip]: The place the tab strip fills is directly below the header, and stays there while a single page scrolls.

[^pane]: A pane's header shows a document's name without its suffix, such as `garden`, or the page's label where it has no file name. The pane's close button is named `Close garden`, and the narrow strip a collapsed pane leaves behind is named `Expand garden`.

[^thumb]: Each button is an icon above a word, a finger's height, lit in the accent colour while you are on its page, with room for one badge at the icon's top corner. Every page leaves room under its last line, and under a composer fixed to the bottom, so nothing is hidden behind the bar. A desktop draws no such bar, whatever plugins added to it: the sidebar and the command palette are how you reach those pages there.

[^fault]: The whole frame is drawn inside a fault boundary, which catches an error instead of letting it blank the window. The page also offers a **Reload** button and a **Go home** link. The technical error text sits word for word inside a closed **Details** block, for you to copy into a bug report.

<details>
<summary>The places other plugins can fill, and what layout tells them</summary>

| Place | Takes |
| --- | --- |
| `layout.sidebar` | one occupant: the column and its strip of icons ([sidebar.md](sidebar.md)) |
| `layout.strip` | one occupant: the strip above the pages, on a desktop |
| `app.panel` | one occupant: what the panel column shows |
| `layout.tools` | a control, with its own desktop and mobile order. Its `desktop` place is `header` (the top bar) or `health` (the foot of the health dot's list) |
| `layout.thumbs` | a button for the phone's bar: `{ order, body }`, drawn left to right by `order` |
| `layout.overlays` | something drawn over the page, such as the command palette |
| `layout.content-status` | a message about the whole page, and whether its content is ready |
| `app.header` | a place in the top bar (`place: "lead"`) or a reading in the health dot's list (`place: "cluster"`), which may declare a `status` of `tone`, `label` and `detail` |
| `app.banner` | a banner under the header |
| `app.viewer` | one occupant: who is signed in |
| `app.mount` | a provider wrapped around the frame |

`layout.shell` carries what the frame knows: the screen size it is drawing for, whether each panel is open and how wide it is, which position the phone's sheet is at, and the panel's drag handle. Name it on a component of your own. With no frame mounted, its readings answer as for a phone-width window, a closed panel and an open sidebar, and its buttons do nothing.

`layout.deployment` carries the name of this olai server and when it started; the header shows that name once the server has given it.

</details>

<details>
<summary>When layout is switched off</summary>

Both `ui-renderer` and `layout` have to be on for a page to be drawn at all ([ui-renderer.md](ui-renderer.md)). Switching `layout` off removes the frame and everything inside it, and the plugins that filled its places wait. Switch it back on by editing `_olai/Settings.olai`, or by restarting olai with the plugins you want, because the **Plugins** panel is itself drawn inside this frame ([settings.md](settings.md)).

When layout starts again it re-reads the stored widths and preferences, including changes another tab made meanwhile, and asks the server again for the name of this olai server rather than reusing the last answer.

</details>

<details>
<summary>What a tab keeps when you switch tabs</summary>

The frame draws one host per open page and one subtree per pane, so switching tabs hides and shows pages rather than loading them again. Splitting a pane, reordering panes, closing a neighbouring pane, collapsing a pane and crossing between phone and desktop width all leave the surviving pages loaded.

A single page scrolls the window, and split columns scroll independently. A column hidden behind another tab comes back to what you were reading rather than to a pixel position. The frame remembers which element was at the top of the column and puts it back, allowing for a pinned heading that changed size meanwhile. Collapsing the desktop sidebar hides its contents and keeps the calendar's month and its subscriptions running.

</details>
