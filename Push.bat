@echo off
:: 1. Configuramos la ruta al Git Portable (Carpeta bin)
:: Ajustamos la ruta para apuntar a la carpeta donde estan los ejecutables
set PATH=%PATH%;C:\0DE\PortableGit\bin;C:\0DE\PortableGit\usr\bin

:: 2. Vamos a la carpeta de tu proyecto (Si el .bat no esta dentro)
:: cd "C:\0DE\Ticketera"

echo --- Preparando Commit ---
set /p msg="20260123"

echo.
echo --- Iniciando proceso de Git ---

:: Ahora 'git' ya sera reconocido como comando
git add .
git commit -m "%msg%"
git push

echo.
echo --- Proceso finalizado con exito ---
pause