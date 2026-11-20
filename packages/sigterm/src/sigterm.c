/* A signal handler may only call what POSIX marks async-signal-safe: it runs
 * on whatever thread the kernel picked, in the middle of whatever that thread
 * was doing, so nothing that allocates, takes a lock or touches libc userspace
 * state may run here. write(2) is on that list and is all this does.
 *
 * FREESTANDING because bun's embedded tinycc (`bun:ffi`'s `cc`) links -lc even
 * when nothing is referenced: write(2) arrives as a function POINTER handed in
 * at arm time rather than as a symbol tcc would have to resolve.
 *
 * siginfo_t layout (Linux x86_64 and aarch64 alike): si_signo@0, si_errno@4,
 * si_code@8, then _sifields at 16 — the union's members are 8-byte aligned, so
 * 12 pads up to 16 — giving si_pid@16 and si_uid@20 for kill(2) senders.
 *
 * The record is three i32s: 12 bytes is under PIPE_BUF, so one write(2) can
 * never interleave with another even when two threads run this back to back.
 * `dropped` is sig_atomic_t, POSIX's word for what a handler may touch; tcc
 * grows no __sync builtins, so a cross-CPU read-modify-write can still lose an
 * increment and a flood counter may understate the flood. */
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

long olaiAddr(void) { return (long)&olaiSigterm; }
void olaiArm(long writeAddr, int fd) {
  x_write = (long (*)(int, const void *, unsigned long))writeAddr;
  outFd = fd;
}
long olaiDropped(void) { return dropped; }
