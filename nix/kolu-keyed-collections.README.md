# Keyed collection ownership patch

`kolu-keyed-collections.patch` ties client collection subscriptions to their
parameter key and Solid owner. Chat uses conversation-keyed state, transcript,
and saying streams; changing or disposing a fold must unsubscribe the previous
key, and multiple readers of one key must share it without retaining another.

When updating the Kolu pin, check whether upstream includes the patch, apply it
only if still needed, and run keyed-reading unit tests and node agent fold,
history, reconnect and plugin rebuild e2e scenarios. Verify disposal releases
all three streams and a second tab keeps its own reading alive.
