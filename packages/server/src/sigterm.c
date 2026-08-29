/* The SIGTERM catcher's handler — why this file exists is argued in
 * ./sigterm.ts; what can be enforced HERE is the handler's one law:
 * ASYNC-SIGNAL-SAFETY. It runs on whatever thread the kernel picked to
 * deliver the signal, in the middle of whatever that thread was doing —
 * a malloc lock may be held, the JS VM is unapproachable, and nothing
 * that allocates, takes a lock, or calls into libc userspace state may
 * run here. The POSIX list of allowed calls is short; write(2) is on it,
 * and that is all this handler does: copy the four numbers the kernel
 * already recorded (the record IS the attribution) into a self-pipe
 * TypeScript drains in ordinary context. No printf, no /proc reads, no
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
 * the round trip does not come back. Kernel-sent signals (the
 * PR_SET_PDEATHSIG contract is the only one we expect) arrive with
 * si_pid == 0 and si_uid == 0 — not a possible sender pid, so they can
 * never be confused for a user-space process's send.
 *
 * The record is 16 bytes so a batch read can slice it without a length
 * word: { signo, si_code, si_pid, si_uid }, all little-endian i32s.
 * Pipe floods drop records (counted, reported from the drain side)
 * rather than blocking a signal sender on us. */
static int outFd = -1;
static long (*x_write)(int, const void *, unsigned long);
static volatile long dropped = 0;

static void olaiSigterm(int sig, void *info, void *uctx) {
  int rec[4];
  char *p = (char *)info;
  rec[0] = sig;
  rec[1] = *(int *)(p + 8);                 /* si_code */
  rec[2] = *(int *)(p + 16);                /* si_pid  */
  rec[3] = (int)*(unsigned int *)(p + 20);  /* si_uid  */
  if (outFd < 0 || x_write(outFd, rec, 16) != 16) {
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
