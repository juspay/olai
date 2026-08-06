#lang racket/base

;; The closed words, and what each one MEANS to a check.
;;
;; Three clocks and seven authorities, and both lists are human-ratified: a new
;; authority is a proposal on the roadmap, not an edit here. That is the point
;; of keeping them in one small module — a vocabulary that anyone can extend in
;; passing is a vocabulary that stops meaning anything, and the measured record
;; on abstraction libraries is that they rot as they grow.
;;
;; A word is not just a name here; it carries the two things a check needs:
;;
;;   * a clock carries its RANK (which way a dependency may point) and its
;;     CHURN CEILING (what history is allowed to say about a module wearing it)
;;   * an authority carries its SPELLINGS — the identifiers that, if a module
;;     imports and mentions one, mean the module reaches for that authority
;;
;; Keeping the word and its meaning in the same table is what makes "settling"
;; a definition rather than a mood. Any check that needed to know what a word
;; means and asked somewhere else would be a second definition.

(require racket/contract
         racket/list)

(provide (contract-out
          [clocks (listof symbol?)]
          [clock? (-> any/c boolean?)]
          [clock-rank (-> clock? exact-nonnegative-integer?)]
          [clock-churn-ceiling (-> clock? (or/c #f (and/c real? (between/c 0 1))))]
          [authorities (listof symbol?)]
          [authority? (-> any/c boolean?)]
          [authority-spellings (-> authority? (listof symbol?))]
          [word-list (-> (listof symbol?) string?)]
          [did-you-mean (-> symbol? (listof symbol?) (or/c symbol? #f))]))

;; ---- clocks -----------------------------------------------------------------

;; Least volatile first. The order IS the rank, and the rank is the whole of
;; check 1: an edge may point at the same rank or lower, never higher.
(define clocks '(stable settling volatile))

(define (clock? v) (and (memq v clocks) #t))

(define (clock-rank c)
  (- (length clocks) (length (memq c clocks))))

;; What history may say about a module wearing this word, as a fraction of the
;; audited window. Only the tight end is checked: a module that declares itself
;; volatile and never changes is not lying about anything a reader could be
;; misled by, and `volatile` is therefore uncapped.
;;
;; The numbers are deliberately loose. A window is a few dozen commits, a
;; single feature can touch one file three times in an afternoon, and a check
;; that fires on ordinary work is a check people learn to route around. They
;; are tight enough to catch the case the audit is for — a module everybody
;; edits every week, still declared stable.
(define churn-ceilings
  (hash 'stable   1/5      ; 6 of 30
        'settling 1/2      ; 15 of 30
        'volatile #f))

(define (clock-churn-ceiling c) (hash-ref churn-ceilings c))

;; ---- authorities ------------------------------------------------------------

;; Ambient authority: what a module can reach for without being handed it. The
;; set is the spec's, unchanged. `randomness` has no user in this repo yet and
;; is listed anyway — the vocabulary is ratified as a whole, and a word nobody
;; needs today is cheaper than one nobody may add tomorrow.
;;
;; The spellings are a CURATED TABLE, not a search: an identifier is here
;; because somebody decided it opens a door. Over-inclusion costs a declaration
;; somebody has to write; under-inclusion costs a rule that quietly does not
;; apply. When in doubt the table includes the name.
(define authority-table
  (hash
   ;; What time is it, and blocking until it is later. `sleep` is here because
   ;; a module that waits on wall time is as untestable as one that reads it.
   'clock
   '(today today/utc now now/utc now/moment now/moment/utc
     current-date current-seconds current-milliseconds
     current-inexact-milliseconds current-inexact-monotonic-milliseconds
     current-process-milliseconds current-gc-milliseconds
     current-clock
     sleep)

   ;; Bytes on a disk, and the ambient cursor that says where relative paths
   ;; land. `current-directory` counts: a function whose answer depends on the
   ;; directory it was called from is reading the world.
   'filesystem
   '(open-input-file open-output-file open-input-output-file
     call-with-input-file call-with-input-file* call-with-output-file call-with-output-file*
     with-input-from-file with-output-to-file
     file->string file->bytes file->lines file->list file->value
     display-to-file write-to-file
     directory-list in-directory find-files
     file-exists? directory-exists? link-exists?
     make-directory make-directory* make-parent-directory*
     delete-file delete-directory delete-directory/files
     rename-file-or-directory copy-file copy-directory/files
     file-or-directory-modify-seconds file-or-directory-permissions
     file-or-directory-identity file-size
     make-temporary-file make-temporary-directory
     current-directory current-directory-for-user current-load-relative-directory)

   ;; Being told that they changed, which is a different power from reading
   ;; them and belongs to a different module.
   'filesystem-events
   '(filesystem-change-evt filesystem-change-evt? filesystem-change-evt-cancel)

   'network
   '(tcp-listen tcp-connect tcp-connect/enable-break tcp-accept tcp-accept/enable-break
     udp-open-socket
     serve serve/servlet serve/launch/wait
     get-pure-port get-impure-port call/input-url)

   'subprocess
   '(subprocess subprocess-wait subprocess-kill subprocess-status
     process process* process/ports process*/ports
     system system* system/exit-code system*/exit-code)

   'threads
   '(thread thread/suspend-to-kill kill-thread break-thread
     thread-send thread-receive thread-suspend thread-resume thread-wait
     make-thread-group)

   'randomness
   '(random random-seed make-pseudo-random-generator current-pseudo-random-generator
     crypto-random-bytes)))

(define authorities (sort (hash-keys authority-table) symbol<?))

(define (authority? v) (and (memq v authorities) #t))

(define (authority-spellings a) (hash-ref authority-table a))

;; ---- saying a list of words --------------------------------------------------

(define (word-list names)
  (if (null? names)
      "(none)"
      (apply string-append
             (add-between (for/list ([n (in-list names)]) (format "~a" n)) ", "))))

;; ---- did you mean ------------------------------------------------------------

;; Zero dependencies is a rule here and the distribution ships no edit distance,
;; so this is the textbook two-row Levenshtein — over a handful of candidates,
;; in a branch that only runs when the compile is already failing.
(define (edit-distance a b)
  (define m (string-length b))
  (for/fold ([row (build-list (add1 m) values)] #:result (last row))
            ([i (in-range 1 (add1 (string-length a)))])
    (for/fold ([out (list i)] #:result (reverse out))
              ([j (in-range 1 (add1 m))])
      (cons (min (add1 (car out))                       ; delete
                 (add1 (list-ref row j))                ; insert
                 (+ (list-ref row (sub1 j))             ; substitute
                    (if (char=? (string-ref a (sub1 i)) (string-ref b (sub1 j))) 0 1)))
            out))))

;; Two edits: enough for a transposition (`stabel`) or a dropped letter
;; (`filesystem-event`), tight enough that an unrelated word is never offered.
(define (did-you-mean name candidates)
  (define scored (for/list ([c (in-list candidates)])
                   (cons (edit-distance (symbol->string name) (symbol->string c)) c)))
  (define best (and (pair? scored) (argmin car scored)))
  (and best (<= (car best) 2) (cdr best)))
