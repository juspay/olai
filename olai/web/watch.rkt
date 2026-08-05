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
;; store-files is in there as well as the snapshot's watch set: before the
;; first successful load the snapshot is empty, and that is exactly the state
;; a watcher has to get out of.
(define (watch-dirs st)
  (remove-duplicates
   (filter values
           (for/list ([p (in-list (append (store-files st)
                                          (snapshot-watch (store-snapshot st))))])
             (path-only (simple-form-path p))))
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
  (let loop ([armed armed])
    (define evts (map dir-change-evt (watch-dirs st)))
    (define live (filter evt? evts))
    (when armed (semaphore-post armed))
    (cond
      ;; Exotic filesystems (some network mounts, some sandboxes) have no
      ;; change notification at all. Say so once, then poll.
      [(memq 'unsupported evts)
       (cancel-all evts)
       (eprintf "olai: filesystem-change-evt unsupported here; polling every ~as\n"
                poll)
       (poll-loop st on-change stopped poll)]
      [else
       (define midnight (midnight-evt))
       ;; Nothing watchable yet (the outline's directory does not exist):
       ;; tick instead of blocking forever on the two alarms.
       (define tick (and (null? live) (tick-evt poll)))
       (define woke (apply sync stopped midnight (if tick (list tick) live)))
       (cancel-all live)
       (cond
         [(eq? woke stopped) (void)]
         ;; The day rolled over. Nothing on disk moved, so the store has
         ;; nothing to say — but `today` is a render-time argument, and the
         ;; page holding yesterday's is the whole reason for this alarm.
         [(eq? woke midnight) (on-change) (loop #f)]
         [else
          ;; One atomic save is a flurry of directory events; let it end.
          (sleep debounce)
          (when (reloaded? st) (on-change))
          (loop #f)])])))

;; store-invalidate! already probes mtime + size cheaply, so polling is just
;; that probe on a timer; the revision says whether it actually reloaded.
(define (poll-loop st on-change stopped poll)
  (let loop ()
    (cond
      [(sync/timeout poll stopped) (void)]
      [else
       (when (reloaded? st) (on-change))
       (loop)])))

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
