@echo off
chcp 65001 >nul
where py >nul 2>nul && (py receptor-telemetria.py & goto fin)
where python >nul 2>nul && (python receptor-telemetria.py & goto fin)
echo No se encontro Python. Instalalo desde https://www.python.org/downloads/ (marca "Add python.exe to PATH").
:fin
pause
