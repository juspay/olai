#lang racket/base

;; The watcher: one thread that turns "a file moved" into one callback.
;;
;; It watches DIRECTORIES, not files. Every editor worth the name saves by
;; writing a temp file and renaming it over the target, and a rename fires on
;; the directory — a filesystem-change-evt held on the old inode would never
;; see it. Watching the parent also covers a watched file that does not exist
;; yet (a Daily fragment before the first capture of the month).
;;
;; The watch set is re-read every cycle, from the store's own snapshot, so an
;; edit that adds an @include starts watching the new fragment on the next
;; turn of the loop and nothing has to be restarted.
;;
;; This thread is allowed a clock — it is the shell layer, and the midnight
;; boundary is a real event: `today` grouping and the /today page go stale at
;; local midnight with no file having changed. The boundary ARITHMETIC is a
;; pure function of a moment (seconds-until-midnight), so it is testable
;; without waiting for one.

(require racket/contract
         racket/list
         racket/path
         (only-in gregor now/moment moment? at-midnight +days ->posix)
         ;; where a question reads — a starred @include's one directory, the
         ;; whole tree under a served one — which is a place nothing in the
         ;; watch set need sit in yet
         (only-in olai/paths dirs-read)
         olai/store)

(provide (contract-out
          [start-watcher (->* (store? #:on-change (-> any))
                              (#:debounce-seconds (>=/c 0)
                               #:poll-seconds (>/c 0))
                              (-> void?))]
          [seconds-until-midnight (-> moment? (>=/c 0))]))

;; An atomic save is several directory events in a row (temp file created,
;; renamed, old one unlinked). Coalesce them or every save is three renders.
(define default-debounce-seconds 0.15)

;; Fallback tick, and the retry when there is nothing watchable yet.
(define default-poll-seconds 2.0)

;; ---- midnight -------------------------------------------------------------

;; Seconds from `mom` to the next local midnight. Days are not all 86400
;; seconds long, so this goes through the calendar (+days then at-midnight)
;; and subtracts instants, rather than doing modular arithmetic on a clock.
(define (seconds-until-midnight mom)
  (max 0 (- (->posix (at-midnight (+days mom 1))) (->posix mom))))

(define (midnight-evt)
  (alarm-evt (+ (current-inexact-milliseconds)
                (* 1000.0 (seconds-until-midnight (now/moment))))))

(define (tick-evt seconds)
  (alarm-evt (+ (current-inexact-milliseconds) (* 1000.0 seconds))))

;; ---- what to watch --------------------------------------------------------

;; The parent directories of everything the outlines are built from, deduped.
;;
;; Two lists, because the store depends on two kinds of thing. The files it
;; read are watched through their own directories (a save is a rename, which
;; fires there). And every QUESTION it will ask again — the root it was
;; pointed at, and each `@include` pattern — is watched wherever it READS,
;; which is not the same list: a directory that has answered with nothing has
;; no file here to take a parent of, and the first fragment of a new year
;; appearing in one is precisely the event this whole arrangement exists to
;; catch. That is also the state a watcher has to get out of before the first
;; successful load, when the snapshot is empty and the root is all there is.
(define (watch-dirs st)
  (define snap (store-snapshot st))
  (remove-duplicates
   (filter values
           (append
            (for/list ([p (in-list (snapshot-watch snap))])
              (path-only (simple-form-path p)))
            (append-map dirs-read (cons (store-root st) (snapshot-globs snap)))))
   #:key path->string))

;; -> evt | 'unsupported | #f (no such directory, nothing to watch yet)
(define (dir-change-evt dir)
  (with-handlers ([exn:fail:unsupported? (λ (_e) 'unsupported)]
                  [exn:fail? (λ (_e) #f)])
    (filesystem-change-evt dir (λ () 'unsupported))))

(define (cancel-all evts)
  (for ([e (in-list evts)] #:when (evt? e))
    (filesystem-change-evt-cancel e)))

;; ---- the loop -------------------------------------------------------------

;; Returns a stop procedure. The thread selects on a stop semaphore alongside
;; everything else, so stopping is the loop finishing its turn, not a kill.
(define (start-watcher st
                       #:on-change on-change
                       #:debounce-seconds [debounce default-debounce-seconds]
                       #:poll-seconds [poll default-poll-seconds])
  (define stop-sema (make-semaphore 0))
  (define stopped (semaphore-peek-evt stop-sema))
  (define armed (make-semaphore 0))
  (define thd (thread (λ () (watch-loop st on-change stopped debounce poll armed))))
  ;; Do not hand back control before the first arm: a caller that starts a
  ;; server and edits a file in the same breath would otherwise lose the
  ;; event it was starting the watcher for.
  (sync/timeout 5 armed)
  (λ ()
    (semaphore-post stop-sema)
    ;; a debounce sleep is the longest it can be busy; do not wait forever
    (unless (sync/timeout (+ 2.0 debounce) thd)
      (kill-thread thd))
    (void)))

(define (watch-loop st on-change stopped debounce poll armed)
  (let loop ([armed armed] [warned-unsupported? #f])
    (define evts (map dir-change-evt (watch-dirs st)))
    (define live (filter evt? evts))
    (define unsupported? (memq 'unsupported evts))
    (when (and unsupported? (not warned-unsupported?))
      (eprintf "olai: filesystem-change-evt unsupported here; polling every ~as\n"
               poll))
    (when armed (semaphore-post armed))
    ;; Always arm a poll tick alongside any live change-evts. On some Darwin
    ;; setups (and network mounts) filesystem-change-evt returns an evt that
    ;; never fires instead of raising unsupported — without a tick the loop
    ;; would sleep until midnight and miss every save. The store probe is
    ;; cheap; reloaded? is the arbiter either way.
    (define midnight (midnight-evt))
    (define tick (tick-evt poll))
    (define woke
      (if unsupported?
          (sync stopped midnight tick)
          (apply sync stopped midnight tick live)))
    (cancel-all live)
    (cond
      [(eq? woke stopped) (void)]
      ;; The day rolled over. Nothing on disk moved, so the store has
      ;; nothing to say — but `today` is a render-time argument, and the
      ;; page holding yesterday's is the whole reason for this alarm.
      [(eq? woke midnight)
       (on-change)
       (loop #f (or warned-unsupported? unsupported?))]
      [else
       ;; One atomic save is a flurry of directory events; let it end.
       ;; Poll ticks skip the debounce — they are already spaced by `poll`.
       (unless (eq? woke tick) (sleep debounce))
       (when (reloaded? st) (on-change))
       (loop #f (or warned-unsupported? unsupported?))])))

;; Directory events are not outline events: a lock file, an editor's swap
;; file, a Dropbox conflict copy all land in the same directory, and firing
;; on each of those would have every open tab re-fetch for nothing. The store
;; is the arbiter — it reloaded or it did not.
;;
;; A file that BROKE counts as reloaded (see store-revision), which is what
;; makes the error banner appear without a refresh.
(define (reloaded? st)
  (define before (store-revision st))
  (store-invalidate! st)
  (not (= before (store-revision st))))
