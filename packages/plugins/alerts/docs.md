# Alerts

The tab-only `alerts` row owns the notification channel previously owned by
chat. It offers `alerts.channel`: notification consent and permission requests,
notification delivery and press subscriptions, a best-effort chime, and the app
badge or tab mark. It has no server half or wire members.

The `channel` component acquires the notification seam, preference followers,
first-gesture listeners and audio context before offering the service. On
withdrawal consumers stop first, then the badge clears, audio closes, listeners
leave and retained preference setters are invalidated. A second seam activation
is refused. Reactivation reads current storage and permission.

The `controls` component contributes **Alerts** and **Alert sound**, both default
on, to `preferences.sections`. Alert sound is frozen while Alerts is off.
Alerts off gates every device and immediately clears the badge. The Allow
notifications button offers a real gesture for permission requests.

The `tab-attention` component alone writes `theme.appearance`'s `chrome.waiting`;
its withdrawal clears that mark. Chat is the badge's only claimant: it counts
questions. Its `attention` component names `alerts.channel`, so removing this row
leaves the panel, forms and header toggle standing, while attention waits and
nothing rings. Removing preferences or theme does not stop notification delivery.

The channel subscribes to the framework once and dispatches through
`onPress(kind, handler)`, with one claimant per kind. A duplicate claim names
both handlers and installs nothing. An unclaimed press is held, newest per kind,
until a claimant arrives; delivered presses are forgotten, and withdrawal drops
all held presses. Chat cannot consume another kind’s click.

The click contract carries `{ kind: "ask" }`, meaning open the current question,
and `{ kind: "due" }`, meaning open today’s agenda. Each goes only to its kind’s claimant.
The framework owns worker delivery and the durable click handshake; this row
owns the page's listener. The app must be running to alert. A closed app hears
nothing. Sound requires an earlier pointer or keyboard gesture in this page;
a call before that is skipped, never replayed. Notifications still require the
browser's consent.
