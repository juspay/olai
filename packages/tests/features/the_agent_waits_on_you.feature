Feature: The agent waits on you, and says so
  A turn that stops on a question does not time out and does not carry on. It
  hangs, silently, for as long as it takes somebody to notice — and the whole
  reason `ChatState.asking` exists is that noticing is the hard part. This is
  what the panel does about it: when the agent is blocked on a person and the
  conversation is not in front of them, one short chime, a system notification
  naming the conversation and the first line of what it wants, and a mark on
  the app's icon that stays until they look.

  And when it IS in front of them, nothing at all. The form appearing is the
  alert; a banner about what is already on screen is nagging. Turn-complete is
  deliberately silent too — an agent that finished will still be finished in
  five minutes, and a chime for every turn is a chime people switch off, taking
  the one that matters with it.

  It is PWA-shaped because olai installs as one: the notification goes through
  the service worker (`registration.showNotification`), which is the only
  notification path that works in `standalone` display mode at all. The honest
  limit is that the trigger is the live websocket — alerts fire while the app
  is running, foreground or background, and a fully closed PWA hears nothing.
  Web Push is out of scope.

  All three devices can be driven here, each at the last inch before it leaves
  the browser (`support/alerts.ts` says why neither an OS banner nor a sound
  becomes a DOM node): the banner at `showNotification`, the chime at the
  oscillator it starts, and the icon mark on the tab's own title and favicon.
  The press is the message the worker sends an open window — envelope for
  envelope, id and ackable source and all, so it walks the handshake a real
  click walks rather than the no-id branch one never takes.

  ONE OF THE FOUR WAYS OF NOT WATCHING can be driven here: the panel put away.
  Headless Chromium reports every page focused and visible whatever is done to
  it — a second tab brought to the front, focus emulation turned off, the page
  frozen — so a backgrounded WINDOW is not a state this harness can produce,
  and neither is a SIBLING TAB that is being read while this one is not. The
  conjunction is the same one for all four (`client/chat/attention/watching.ts`);
  the halves only those states reach are held as unit suites — a banner quoting
  the first line of the question by `notice.test.ts` and `asked.browsertest.ts`,
  and a sibling tab answering for this one by `elsewhere.browsertest.ts`, which
  is two documents or it is nothing.

  Every scenario is `@scratch:chat` — the agent writes, so the directory is a
  private copy with a server of its own — and `@alerts`, which grants the
  context notification permission and installs the recorders. The last one is
  `@alerts-denied` instead: the same stage with the permission refused, which
  is the one place the three devices' independence can be seen.

  Background:
    Given I open the app
    And the agent panel is open
    And the notification worker is ready

  @scratch:chat @alerts
  Scenario: A question that arrives behind a shut panel says so three ways
    # The case the whole feature is about: the drawer is put away, the agent
    # stops on a question, and nothing on screen is going to say so — the
    # header toggle's own mark is on a button nobody is looking at.
    #
    # `ask later` holds the question until the scenario releases it, which is
    # what lets the panel be shut BEFORE it lands: asking takes an open panel
    # and a press of Send.
    When I ask the agent "ask later"
    And I minimize the agent panel
    And the agent is released
    # The panel was SHUT when the question landed, so this tab has no
    # transcript subscription and no words to quote — the banner says the
    # plain fact rather than a question remembered from the last time it was
    # open, which would be a banner about something else. The other half —
    # the window backgrounded with the panel OPEN, where the first line of the
    # question IS quoted — cannot be driven here: headless Chromium reports
    # every page focused and visible whatever is done to it, so what holds
    # that half is `client/chat/attention/notice.test.ts`.
    Then a notification says "is waiting on your answer"
    # The conversation, named. This one has no name — the agent titles a
    # session a turn or two in, and this is its first — so the banner falls
    # back to the app's own name rather than an empty line.
    And the notification is titled "olai"
    # ... and the mark that STAYS. Not until the banner is dismissed: until
    # somebody looks.
    And the tab says something is waiting
    # ... and the third device, which needs no permission and no worker.
    And the chime rang

  @scratch:chat @alerts
  Scenario: A question that arrives in front of you is its own alert
    # The other half of the ruling, and the one that keeps this feature from
    # being the thing people switch off. The panel is open and the window is
    # the reader's: the form appears where they are already looking.
    When I ask the agent "ask"
    Then the chat shows a question
    And no notification has been raised
    And no chime rang
    And the tab says nothing is waiting

  @scratch:chat @alerts
  Scenario: Pressing the notification opens the conversation at the question
    # What the press promises. The window is the service worker's to focus and
    # it does that itself; what is left for the page is the panel and the
    # scroll, and the panel was SHUT — so opening it is what mounts the
    # transcript, and the request has to outlive the press until the rows land.
    When I ask the agent "ask later"
    And I minimize the agent panel
    And the agent is released
    Then a notification says "is waiting on your answer"
    And the tab says something is waiting
    When the notification is pressed
    Then the panel is open at the question
    # ... and the mark goes, because the mark was never about the banner.
    And the tab says nothing is waiting

  @scratch:chat @alerts
  Scenario: Answering it puts the mark away wherever you are
    # The badge is a STATE and not an event: it says "something is waiting",
    # so it goes when nothing is — even for a reader who never opened the
    # panel and answered from another tab. Here the same tab answers, which is
    # enough to prove it is recomputed rather than dismissed.
    When I ask the agent "ask later"
    And I minimize the agent panel
    And the agent is released
    Then the tab says something is waiting
    When the notification is pressed
    And I choose "birch"
    And I answer the question
    Then the question has been answered
    And the tab says nothing is waiting

  @scratch:chat @alerts
  Scenario: Alerts off is off, and the icon is put back
    # A preference switched off has to be able to clear what it was doing —
    # not merely stop adding to it. So this asserts the absence AND that the
    # tab is put back to what it was.
    When I set Alerts to "off"
    And I press Escape on the preferences
    And I ask the agent "ask later"
    And I minimize the agent panel
    And the agent is released
    Then the agent button says the agent is waiting on me
    And no notification has been raised
    And no chime rang
    And the tab says nothing is waiting
    And this browser has stored that alerts are "off"

  @scratch:chat @alerts
  Scenario: The sound is its own switch, and says so
    # Two rows and not one strip of three: being told and being told AUDIBLY
    # are independent, and folding them together would make turning the chime
    # off cost the banner too. With alerts off the sound row is drawn INERT
    # rather than hidden — the git rows' rule: a choice a reader cannot see is
    # one they cannot ask anybody about.
    When I set the alert sound to "off"
    Then this browser has stored that the alert sound is "off"
    When I set Alerts to "off"
    Then the alert sound cannot be set
    And the Alerts row explains "silent"

  @scratch:chat @alerts-denied
  Scenario: A browser that has refused notifications still chimes and still marks the tab
    # The ruled independence, and the reason the three devices are three `if`s
    # rather than one gate: only the notification needs the OS's consent, and a
    # reader who refused it once — or whose browser refuses on their behalf —
    # must not lose the other two with it. Every other scenario here GRANTS the
    # permission, so a future gate that wrapped all three would pass all of
    # them; this is the one that would fail.
    #
    # `@alerts-denied` is the same stage with `Notification.permission` set to
    # `denied` and no grant made, which is in place before the app's boot.
    When I ask the agent "ask later"
    And I minimize the agent panel
    And the agent is released
    Then the agent button says the agent is waiting on me
    And no notification has been raised
    And the chime rang
    And the tab says something is waiting
