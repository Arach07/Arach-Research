@echo off
rem Uruchamia n8n na tym komputerze (edytor: http://localhost:5678).
rem Okno musi zostać otwarte — zamknięcie go wyłącza n8n i harmonogram raportów.
title n8n - raporty Research (nie zamykaj)
set GENERIC_TIMEZONE=Europe/Warsaw
set N8N_RUNNERS_TASK_TIMEOUT=300
npx --yes n8n
pause
