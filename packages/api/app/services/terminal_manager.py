import asyncio
import logging
import os
import struct

logger = logging.getLogger(__name__)


class TerminalSession:
    def __init__(self, cols: int = 80, rows: int = 24):
        self.cols = cols
        self.rows = rows
        self.master_fd: int | None = None
        self.pid: int | None = None

    async def start(self) -> None:
        import pty
        pid, fd = pty.openpty()
        self.master_fd = fd
        self.pid = pid
        env = dict(os.environ)
        env["TERM"] = "xterm-256color"
        env["COLUMNS"] = str(self.cols)
        env["LINES"] = str(self.rows)
        child_pid = os.fork()
        if child_pid == 0:
            os.setsid()
            import fcntl
            import termios
            slave_fd = os.open(os.ttyname(pid), os.O_RDWR)
            fcntl.ioctl(slave_fd, termios.TIOCNOTTY)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            os.close(pid)
            os.close(fd)
            os.execvpe("/bin/bash", ["/bin/bash"], env)
        else:
            os.close(pid)
            self.pid = child_pid

    async def read(self) -> bytes:
        if self.master_fd is None:
            return b""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, os.read, self.master_fd, 4096)

    async def write(self, data: bytes) -> None:
        if self.master_fd is None:
            return
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, os.write, self.master_fd, data)

    async def resize(self, cols: int, rows: int) -> None:
        if self.master_fd is None:
            return
        import fcntl
        import termios
        self.cols = cols
        self.rows = rows
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)

    def close(self) -> None:
        if self.master_fd is not None:
            os.close(self.master_fd)
            self.master_fd = None
        if self.pid is not None:
            try:
                os.kill(self.pid, 9)
                os.waitpid(self.pid, os.WNOHANG)
            except (ProcessLookupError, ChildProcessError):
                pass
            self.pid = None


_sessions: dict[str, TerminalSession] = {}


def get_session(session_id: str) -> TerminalSession | None:
    return _sessions.get(session_id)


async def create_session(session_id: str, cols: int = 80, rows: int = 24) -> TerminalSession:
    if session_id in _sessions:
        _sessions[session_id].close()
    session = TerminalSession(cols=cols, rows=rows)
    await session.start()
    _sessions[session_id] = session
    return session


def destroy_session(session_id: str) -> None:
    session = _sessions.pop(session_id, None)
    if session:
        session.close()
