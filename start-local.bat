@echo off
title Capacity AVM Yerel Sunucu
echo ========================================================
echo   Capacity AVM Navigasyon - Yerel Test Sunucusu
echo   Tarayicinizda acin: http://localhost:3000
echo   Durdurmak icin: Ctrl + C
echo ========================================================
echo.
python server.py 3000
if %errorlevel% neq 0 (
    echo Python server.py calistirilmadi, python -m http.server deneniyor...
    python -m http.server 3000
)
pause
