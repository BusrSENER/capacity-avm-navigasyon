@echo off
title Capacity AVM GitHub Senkronizasyonu
echo ========================================================
echo   Capacity AVM Navigasyon - GitHub Guncelleme
echo ========================================================
echo.
git status
echo.
set /p commit_msg="Commit mesajini girin (Bos birakirsaniz otomatik mesaj atanir): "
if "%commit_msg%"=="" set commit_msg=chore: guncellemeler ve arayuz iyilestirmeleri
echo.
echo Dosyalar hazirlaniyor (git add)...
git add .
echo Degisiklikler kaydediliyor (git commit)...
git commit -m "%commit_msg%"
echo GitHub'a gonderiliyor (git push origin main)...
git push origin main
echo.
echo ========================================================
echo   Basariyla GitHub'a gonderildi!
echo   Canli site yaklasik 1-2 dakika icinde guncellenecektir:
echo   https://busrsener.github.io/capacity-avm-navigasyon/
echo ========================================================
pause
