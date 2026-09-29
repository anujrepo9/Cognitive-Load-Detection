"""
win32_input.py — System-wide keyboard and mouse capture on Windows.

Uses WH_KEYBOARD_LL / WH_MOUSE_LL so events are seen in every process
(other browser tabs, Word, VS Code, games, etc.). Browser DOM listeners
cannot do this.

Privacy: key *values* are never recorded. Only timing plus a coarse class
(space / backspace / printable / other).
"""

from __future__ import annotations

import ctypes
import threading
from ctypes import wintypes

user32 = ctypes.WinDLL("user32", use_last_error=True)

WH_KEYBOARD_LL = 13
WH_MOUSE_LL = 14
WM_QUIT = 0x0012
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_SYSKEYDOWN = 0x0104
WM_SYSKEYUP = 0x0105
WM_MOUSEMOVE = 0x0200
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
WM_RBUTTONDOWN = 0x0204
WM_RBUTTONUP = 0x0205
WM_MBUTTONDOWN = 0x0207
WM_MBUTTONUP = 0x0208
WM_MOUSEWHEEL = 0x020A
WM_MOUSEHWHEEL = 0x020E

HC_ACTION = 0
VK_BACK = 0x08
VK_TAB = 0x09
VK_RETURN = 0x0D
VK_SPACE = 0x20

ULONG_PTR = ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong
LRESULT = ctypes.c_ssize_t
HOOKPROC = ctypes.WINFUNCTYPE(LRESULT, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)


class KBDLLHOOKSTRUCT(ctypes.Structure):
    _fields_ = [
        ("vkCode", wintypes.DWORD),
        ("scanCode", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


class POINT(ctypes.Structure):
    _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]


class MSLLHOOKSTRUCT(ctypes.Structure):
    _fields_ = [
        ("pt", POINT),
        ("mouseData", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


user32.SetWindowsHookExW.argtypes = [ctypes.c_int, HOOKPROC, wintypes.HINSTANCE, wintypes.DWORD]
user32.SetWindowsHookExW.restype = wintypes.HHOOK
user32.CallNextHookEx.argtypes = [wintypes.HHOOK, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
user32.CallNextHookEx.restype = LRESULT
user32.UnhookWindowsHookEx.argtypes = [wintypes.HHOOK]
user32.UnhookWindowsHookEx.restype = wintypes.BOOL
user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
user32.GetMessageW.restype = ctypes.c_int
user32.TranslateMessage.argtypes = [ctypes.POINTER(wintypes.MSG)]
user32.DispatchMessageW.argtypes = [ctypes.POINTER(wintypes.MSG)]
user32.PostThreadMessageW.argtypes = [wintypes.DWORD, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user32.PostThreadMessageW.restype = wintypes.BOOL
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
kernel32.GetCurrentThreadId.restype = wintypes.DWORD


class AnonKey:
    """Key identity without the typed character."""

    def __init__(self, kind: str, vk: int = 0):
        self.kind = kind  # space | backspace | printable | other
        self.vk = vk
        self.char = " " if kind == "space" else None

    def __eq__(self, other):
        try:
            from pynput import keyboard as kb
            if other == kb.Key.backspace:
                return self.kind == "backspace"
            if other == kb.Key.space:
                return self.kind == "space"
        except Exception:
            pass
        return False


def classify_vk(vk: int) -> str:
    if vk == VK_BACK:
        return "backspace"
    if vk == VK_SPACE:
        return "space"
    # Letters, digits, OEM punctuation — treat as printable without storing which.
    if (0x30 <= vk <= 0x39) or (0x41 <= vk <= 0x5A) or (0xBA <= vk <= 0xC0) or (0xDB <= vk <= 0xDF):
        return "printable"
    return "other"


class _HookThread:
    """Runs one low-level hook plus a Win32 message pump."""

    def __init__(self, hook_id: int, proc):
        self._hook_id = hook_id
        self._proc = proc
        self._hook = None
        self._thread = None
        self._thread_id = 0
        self._ready = threading.Event()
        self._failed: str | None = None
        # Keep a strong reference so ctypes does not GC the callback.
        self._cb = HOOKPROC(self._dispatch)

    def _dispatch(self, n_code, wparam, lparam):
        if n_code == HC_ACTION:
            try:
                self._proc(wparam, lparam)
            except Exception:
                pass
        return user32.CallNextHookEx(self._hook, n_code, wparam, lparam)

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name=f"win32-hook-{self._hook_id}", daemon=True)
        self._thread.start()
        if not self._ready.wait(timeout=5):
            raise RuntimeError("Windows input hook did not start (timeout)")
        if self._failed:
            raise RuntimeError(self._failed)

    def stop(self) -> None:
        if self._thread_id:
            user32.PostThreadMessageW(self._thread_id, WM_QUIT, 0, 0)
        if self._thread:
            self._thread.join(timeout=3)

    def _run(self) -> None:
        self._thread_id = kernel32.GetCurrentThreadId()
        hmod = kernel32.GetModuleHandleW(None)
        self._hook = user32.SetWindowsHookExW(self._hook_id, self._cb, hmod, 0)
        if not self._hook:
            err = ctypes.get_last_error()
            self._failed = f"SetWindowsHookEx failed (Win32 error {err})"
            self._ready.set()
            return
        self._ready.set()
        msg = wintypes.MSG()
        while True:
            rc = user32.GetMessageW(ctypes.byref(msg), None, 0, 0)
            if rc == 0:
                break
            if rc == -1:
                break
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
        if self._hook:
            user32.UnhookWindowsHookEx(self._hook)
            self._hook = None


class Win32KeyboardHook:
    def __init__(self, on_press, on_release):
        self._on_press = on_press
        self._on_release = on_release
        self._impl = _HookThread(WH_KEYBOARD_LL, self._handle)

    def _handle(self, wparam, lparam):
        info = ctypes.cast(lparam, ctypes.POINTER(KBDLLHOOKSTRUCT)).contents
        kind = classify_vk(int(info.vkCode))
        key = AnonKey(kind, vk=int(info.vkCode))
        msg = int(wparam)
        if msg in (WM_KEYDOWN, WM_SYSKEYDOWN):
            self._on_press(key)
        elif msg in (WM_KEYUP, WM_SYSKEYUP):
            self._on_release(key)

    def start(self):
        self._impl.start()

    def stop(self):
        self._impl.stop()


class _Button:
    left = "left"
    right = "right"
    middle = "middle"


class Win32MouseHook:
    def __init__(self, on_move, on_click, on_scroll):
        self._on_move = on_move
        self._on_click = on_click
        self._on_scroll = on_scroll
        self._impl = _HookThread(WH_MOUSE_LL, self._handle)

    def _handle(self, wparam, lparam):
        info = ctypes.cast(lparam, ctypes.POINTER(MSLLHOOKSTRUCT)).contents
        x, y = int(info.pt.x), int(info.pt.y)
        msg = int(wparam)
        if msg == WM_MOUSEMOVE:
            self._on_move(x, y)
            return
        if msg == WM_MOUSEWHEEL:
            # high word of mouseData is signed delta (multiples of 120)
            raw = ctypes.c_short(info.mouseData >> 16).value
            self._on_scroll(x, y, 0, 1 if raw > 0 else -1)
            return
        if msg == WM_MOUSEHWHEEL:
            raw = ctypes.c_short(info.mouseData >> 16).value
            self._on_scroll(x, y, 1 if raw > 0 else -1, 0)
            return
        mapping = {
            WM_LBUTTONDOWN: (_Button.left, True),
            WM_LBUTTONUP: (_Button.left, False),
            WM_RBUTTONDOWN: (_Button.right, True),
            WM_RBUTTONUP: (_Button.right, False),
            WM_MBUTTONDOWN: (_Button.middle, True),
            WM_MBUTTONUP: (_Button.middle, False),
        }
        hit = mapping.get(msg)
        if hit:
            button, pressed = hit
            self._on_click(x, y, button, pressed)

    def start(self):
        self._impl.start()

    def stop(self):
        self._impl.stop()
