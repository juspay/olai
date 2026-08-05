# `./examples/Example.rkt` and `./olai/tests/fake-acp-agent.rkt` used to
# be relative paths in flake.nix, resolving from the repo root. Moved here
# verbatim they'd resolve from nix/ instead (nix/examples, nix/olai/...),
# which don't exist — so the flake passes the two repo paths in as arguments
# (`exampleOutline`, `fakeAcpAgentSrc`) instead of this file spelling them out.
{ runCommand, olai, racket, curl, tzdata, exampleOutline, fakeAcpAgentSrc }:

runCommand "olai-smoke"
  {
    nativeBuildInputs = [
      olai
      racket
      curl
    ];
  }
  ''
    export TZDIR="${tzdata}/share/zoneinfo"
    olai check ${exampleOutline}

    # Parse the JSON; never grep it (key order is not a contract).
    olai tree ${exampleOutline} > tree.json
    racket -e '(require json)
               (define j (call-with-input-file "tree.json" read-json))
               (unless (and (= 1 (hash-ref j (quote version)))
                            (string? (hash-ref j (quote file)))
                            (pair? (hash-ref j (quote tasks))))
                 (error (quote smoke) "unexpected tree JSON"))'

    # The write path validates in a fresh namespace, so it has to work
    # from the packaged binary too.
    cp ${exampleOutline} edit.rkt
    chmod u+w edit.rkt
    olai add --json --no-commit --file edit.rkt "Smoke capture" > add.json
    racket -e '(require json)
               (unless (hash-ref (call-with-input-file "add.json" read-json)
                                 (quote ok))
                 (error (quote smoke) "add failed"))'
    olai check edit.rkt

    # The server has to work from the packaged binary too: static files
    # and the language readers resolve differently there.
    cp ${exampleOutline} live.rkt
    chmod u+w live.rkt

    # `serve` refuses to start without an ACP agent. The scripted one
    # from the test suite is agent enough here: real subprocess, real
    # ndjson, no LLM.
    printf '#!/bin/sh\nexec racket %s "$@"\n' \
      ${fakeAcpAgentSrc} > fake-acp-agent
    chmod +x fake-acp-agent
    export OLAI_ACP_AGENT="$PWD/fake-acp-agent"

    # No agent, no server: a usage error naming the variable, and
    # nothing left listening on 8098.
    if env -u OLAI_ACP_AGENT olai serve --port 8098 live.rkt \
         > refused.out 2> refused.err; then
      echo "smoke: serve started with no OLAI_ACP_AGENT" >&2
      exit 1
    fi
    grep -q OLAI_ACP_AGENT refused.err

    # Nothing to serve, no server: the DIRECTORY form globs the top
    # level, and an empty one is refused before anything binds.
    mkdir -p empty-outlines
    if olai serve --port 8097 empty-outlines \
         > refused-dir.out 2> refused-dir.err; then
      echo "smoke: serve started on a directory with no outlines" >&2
      exit 1
    fi
    grep -q empty-outlines refused-dir.err

    # Wait for a FRAMING line in a file curl is still writing. Framing
    # only — a JSON payload goes to racket below, never to grep.
    wait_for() {
      for _ in $(seq 1 150); do
        grep -q "$1" "$2" && return 0
        sleep 0.2
      done
      echo "smoke: never saw '$1' in $2" >&2
      cat "$2" >&2
      return 1
    }

    olai serve --port 8099 live.rkt &
    serve_pid=$!
    for i in $(seq 1 60); do
      curl -sf -o page.html http://127.0.0.1:8099/ && break
      sleep 1
    done
    grep -qi "<html" page.html
    curl -sf -o api.json http://127.0.0.1:8099/api/tree
    racket -e '(require json)
               (unless (= 1 (hash-ref (call-with-input-file "api.json" read-json)
                                      (quote version)))
                 (error (quote smoke) "unexpected /api/tree JSON"))'
    curl -sf -o app.css http://127.0.0.1:8099/static/app.css
    curl -sf -o collapse.js http://127.0.0.1:8099/static/collapse.js
    grep -q "olai.collapsed" collapse.js
    test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/nope)" = 404

    # the sidebar Today link has to be a real route
    curl -sf -o today.html http://127.0.0.1:8099/today
    grep -qi "<html" today.html

    # One stream for the rest of the run: saves and the agent both
    # ride it. It opens with a heartbeat comment, which is also how we
    # know the subscription exists before anything is pushed.
    curl -sN --max-time 120 http://127.0.0.1:8099/events > events.txt &
    events_pid=$!
    wait_for '^:hb' events.txt

    # Reload after a save. This is the check that matters in the
    # PACKAGED binary: the store loads outlines in a fresh namespace,
    # which has no collection paths to resolve olai from — it has
    # to work off attached modules.
    #
    # The push comes first on purpose: a request would reload the store
    # itself, and then the watcher would have nothing to announce.
    ! grep -q "Smoke reload marker" page.html
    printf 'Smoke reload marker\n' >> live.rkt
    wait_for '^event: outline' events.txt
    curl -sf -o page2.html http://127.0.0.1:8099/
    grep -q "Smoke reload marker" page2.html

    # The agent loop, over HTTP: the page carries the panel, a POST is
    # accepted with no body of its own, and what the panel draws comes
    # back as `chat` frames on the stream above.
    grep -q 'id="sf-chat"' page.html
    test "$(curl -s -o /dev/null -w '%{http_code}' \
              --data-urlencode 'text=smoke hello' \
              http://127.0.0.1:8099/chat)" = 204
    wait_for '^event: chat' events.txt

    # Frames are JSON: parse them. `data:` lines carry both event
    # names' payloads, so anything that is not an object is somebody
    # else's (the outline event's revision counter).
    racket -e '(require json racket/port racket/string)
               (define frames
                 (for*/list ([l (in-list (with-input-from-file "events.txt" port->lines))]
                             #:when (string-prefix? l "data: ")
                             [j (in-value
                                 (with-handlers ([exn:fail? (lambda (_e) #f)])
                                   (read-json (open-input-string (substring l 6)))))]
                             #:when (hash? j))
                   j))
               (unless (for/or ([f (in-list frames)])
                         (and (equal? (hash-ref f (quote type) #f) "user")
                              (equal? (hash-ref f (quote text) #f) "smoke hello")))
                 (error (quote smoke) "no chat frame for the prompt on /events"))'

    # Frames are ephemeral; the page is where the turn comes back. The
    # scripted agent answers "hello world".
    for i in $(seq 1 60); do
      curl -sf -o chat.html http://127.0.0.1:8099/ \
        && grep -q "hello world" chat.html && break
      sleep 0.5
    done
    grep -q "hello world" chat.html
    grep -q "smoke hello" chat.html

    # Nothing to say is not a turn.
    test "$(curl -s -o /dev/null -w '%{http_code}' \
              --data-urlencode 'text=   ' \
              http://127.0.0.1:8099/chat)" = 400

    # A broken file keeps the last good page (with an error banner)
    # and fails the JSON route loudly.
    printf '  @date not-a-date\n' >> live.rkt
    curl -sf -o page3.html http://127.0.0.1:8099/
    grep -q "Smoke reload marker" page3.html
    grep -q "sf-error" page3.html
    test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/api/tree)" = 500

    kill $events_pid || true
    kill $serve_pid

    touch $out
  ''
