#!/bin/sh
# Run once on hosts that previously enabled the optional systemd updater.
set -eu
command -v systemctl >/dev/null || { echo 'No systemd found; nothing to disable.'; exit 0; }
if [ "$(id -u)" != 0 ]; then echo 'Run with sudo.' >&2; exit 1; fi
if [ -f /etc/systemd/system/yuri-blog-update.timer ]; then
  systemctl disable --now yuri-blog-update.timer
fi
if systemctl is-active --quiet yuri-blog-update.service; then
  echo 'Timer disabled. An update is still running; let it finish, then rerun this script.' >&2
  exit 1
fi
rm -f /etc/systemd/system/yuri-blog-update.timer /etc/systemd/system/yuri-blog-update.service
systemctl daemon-reload
echo 'Scheduled updater removed. Updates now run only when you invoke scripts/update.sh.'
