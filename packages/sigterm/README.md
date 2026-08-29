# @olai/sigterm

The SIGTERM guard `olai web` boots with (Linux): `sigaction(2)` + `SA_SIGINFO`
names every TERM's sender (pid, uid, si_code — kernel-written, not asserted by
the sender), `src/sigterm.ts` decides honor-or-refuse as a pure function, and a
refusal lands in the journal with the sender's cmdline while the server keeps
serving. Three honored shapes: the supervisor (live `getppid()`, which is how
`systemctl --user stop|restart` delivers), the parent recorded at arm time (the
measured shape of the kernel's `PR_SET_PDEATHSIG` answer — the DYING parent's
pid, `SI_USER`, read after the drain's `getppid()` has usually moved to 1), and
the process itself; every honor additionally requires a kill-family `si_code`,
which a `rt_sigqueueinfo`-supplied siginfo cannot carry — the one forge path,
closed. An honored TERM restores the pre-guard disposition and is re-raised, so
today's orderly shutdown runs unchanged. The handler itself is a few lines of
freestanding C (`src/sigterm.c`), compiled at boot by the runtime's embedded
compiler — a JS callback inside signal context is the unbounded-haircut answer,
and nobody cuts a process. If arming or the boot-time round-trip proof fails,
the guard says so once and the old disposition is left in place — loud, never
a silent refusal-path.

On macOS the package does nothing: `installSigtermGuard` returns early and the
`.c` is inert data there — the guard's contract (systemd's stop protocol,
`PR_SET_PDEATHSIG`) is Linux's.
