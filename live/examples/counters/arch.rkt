#lang arch

;; The framework's worked example, as a program: it consumes `live` and is not
;; part of it, which is why it declares itself here rather than riding on
;; live/arch.rkt. It is an app, so it owns what an app owns — a port, a thread
;; that ticks, the clock it ticks against.
;;
;; Settling and not stable: an example follows the framework, and every change
;; to the forms it demonstrates lands in it.
(clock settling)
(owns clock network threads randomness)
