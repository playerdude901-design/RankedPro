using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

// Only samples foreground ownership and idle duration. No key logging or window text.
class FocusMonitor {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
  static volatile bool alive = true;
  static void Main() {
    var reader = new Thread(() => { Console.ReadLine(); alive = false; }); reader.IsBackground = true; reader.Start();
    uint lastPid = 0; bool premiere = false; bool capcut = false;
    while (alive) {
      try {
        uint pid; var window = GetForegroundWindow(); GetWindowThreadProcessId(window, out pid);
        if (pid != lastPid) {
          premiere = false; capcut = false;
          try { using (var p = Process.GetProcessById((int)pid)) { premiere = String.Equals(p.ProcessName, "Adobe Premiere Pro", StringComparison.OrdinalIgnoreCase); capcut = String.Equals(p.ProcessName, "CapCut", StringComparison.OrdinalIgnoreCase); } } catch {}
          lastPid = pid;
        }
        var info = new LASTINPUTINFO(); info.cbSize = (uint)Marshal.SizeOf(info);
        bool valid = GetLastInputInfo(ref info);
        uint idle = valid ? unchecked((uint)Environment.TickCount - info.dwTime) : UInt32.MaxValue;
        Console.WriteLine("{\"premiere\":" + (premiere && window != IntPtr.Zero ? "true" : "false") + ",\"capcut\":" + (capcut && window != IntPtr.Zero ? "true" : "false") + ",\"pid\":" + pid + ",\"idleMs\":" + idle + "}");
      } catch { break; }
      Thread.Sleep(500);
    }
  }
}
