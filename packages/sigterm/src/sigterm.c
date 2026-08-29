/* The SIGTERM catcher's handler — why this file exists is argued in
 * ./sigterm.ts; what can be enforced HERE is the handler's one law:
 * ASYNC-SIGNAL-SAFETY. It runs on whatever thread the kernel picked to
 * deliver the signal, in the middle of whatever that thread was doing —
 * a malloc lock may be held, the JS VM is unapproachable, and nothing
 * that allocates, takes a lock, or calls into libc userspace state may
 * run here. The POSIX list of allowed calls is short; write(2) is on it,
 * and that is all this handler does: copy the three numbers the
 * kernel already recorded (the record IS the attribution) into a
 * self-pipe TypeScript drains in ordinary context. No printf, no /proc reads, no
 * logging — those happen across the pipe, where it is safe.
 *
 * FREESTANDING so that bun's embedded tinycc (`bun:ffi`'s `cc`, which
 * links -lc even when we reference nothing) never has to resolve a
 * symbol for us: write(2) arrives as a function POINTER handed over at
 * arm time, obtained by TypeScript from the dlopen'd libc the process
 * already has mapped. The -lc link tcc insists on is satisfied at
 * compile time only (see ./sigterm.ts's staged libc.so).
 *
 * siginfo_t layout (Linux x86_64 and aarch64 alike): si_signo@0,
 * si_errno@4, si_code@8, then _sifields at 16 — the union holds
 * 8-byte-aligned members, so 12 pads up to 16 — giving si_pid@16 and
 * si_uid@20 for kill(2) senders. This is kernel ABI and cannot move;
 * even so, ./sigterm.ts proves it on every boot with a self-sent
 * signal before declaring the guard armed, and falls back loudly if
 * the round trip does not come back.
 *
 * The record is 12 bytes — { si_pid, si_uid, si_code }, three
 * little-endian i32s under PIPE_BUF, so a batch read can slice it
 * without a length word and one write(2) can never interleave with
 * another. si_code is HERE and read by the policy: cross-process
 * siginfo supplies (rt_sigqueueinfo) may only arrive tagged SI_QUEUE
 * and friends — the kill family's own codes (SI_USER, SI_TKILL,
 * SI_KERNEL) are the kernel's to write, which is the line between a
 * genuine sender's pid and a supplied one. And MEASURED on this
 * machine (kernel 7.1.5, bun 1.4.0, the review's probe re-run): the
 * PR_SET_PDEATHSIG death signal arrives with si_code == SI_USER and
 * si_pid == the DYING PARENT's pid — never the si_pid 0 of the man
 * pages' examples. Pipe floods drop records (counted, reported from
 * the drain side) rather than blocking a signal sender on us — and a
 * dropped record can be the supervisor's STOP, not only an unnamed
 * stranger: that is the one way this guard's failure is worse than no
 * guard, and the drain side's message says so.
 *
 * ATOMICITY, pedantically: two threads may run this handler
 * back-to-back (a process-directed TERM goes to one arbitrary
 * unblocked thread at a time). The write(2) is safe: 12 bytes is far
 * under PIPE_BUF, so one record can never interleave with another.
 * `dropped` is sig_atomic_t — POSIX's word for "safe to touch in a
 * handler" — and the arm-time globals the handler reads are volatile
 * with it. tcc (measured) grows no __sync builtins, so a cross-CPU
 * read-modify-write CAN still lose an increment: a flood counter is
 * allowed to lie by how much it flooded. */
typedef int sig_atomic_t; /* freestanding: what <signal.h> calls it, on
                             glibc and musl alike */

static volatile int outFd = -1;
static long (*volatile x_write)(int, const void *, unsigned long);
static volatile sig_atomic_t dropped = 0;

static void olaiSigterm(int sig, void *info, void *uctx) {
  int rec[3];
  char *p = (char *)info;
  rec[0] = *(int *)(p + 16);                /* si_pid  */
  rec[1] = (int)*(unsigned int *)(p + 20);  /* si_uid  */
  rec[2] = *(int *)(p + 8);                 /* si_code */
  if (outFd < 0 || x_write(outFd, rec, 12) != 12) {
    dropped = dropped + 1;
  }
}

/* The handler is static on purpose — nothing outside this file may
 * depend on its name — but its ADDRESS escapes through `olaiAddr`, so
 * TypeScript can hand it to sigaction(2) as sa_sigaction. */
long olaiAddr(void) { return (long)&olaiSigterm; }
void olaiArm(long writeAddr, int fd) {
  x_write = (long (*)(int, const void *, unsigned long))writeAddr;
  outFd = fd;
}
long olaiDropped(void) { return dropped; }
