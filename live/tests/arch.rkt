#lang arch

;; The framework's tests: same terms as olai's. They boot hubs, open sockets
;; and read the vendored runtime off the disk, and they follow the framework
;; rather than leading it.
(clock volatile)
(owns clock filesystem filesystem-events network subprocess threads randomness)
