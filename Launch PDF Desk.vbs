Option Explicit
Dim shell, filesystem, folder, nodePath, command
Set shell = CreateObject("WScript.Shell")
Set filesystem = CreateObject("Scripting.FileSystemObject")
folder = filesystem.GetParentFolderName(WScript.ScriptFullName)
nodePath = "node.exe"
If filesystem.FileExists(folder & "\runtime\node.exe") Then nodePath = folder & "\runtime\node.exe"
shell.CurrentDirectory = folder
command = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & folder & "\server.mjs" & Chr(34) & " --open"
On Error Resume Next
shell.Run command, 0, False
If Err.Number <> 0 Then MsgBox "PDF Desk needs Node.js 22.13 or newer on PATH. Install Node.js, then try again. For diagnostics, run 'node server.mjs --open' in this folder.", 48, "PDF Desk"
