# Sourced by the other tools/*.sh scripts. Makes godot/adb resolve even in a
# terminal session that predates the PATH changes made during setup (Windows
# only broadcasts new PATH entries to freshly-launched processes, and even
# then not always reliably to already-open shells).
export PATH="$PATH:/c/Program Files/Godot:/c/Users/updow/.local/bin:/c/Users/updow/AppData/Local/Android/Sdk/platform-tools"
