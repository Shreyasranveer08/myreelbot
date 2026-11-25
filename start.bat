@echo off
title SpotFree - Unlimited Free Music App
cd /d "%~dp0"
echo ============================================================
echo       Starting SpotFree Music Engine & Android Server...
echo ============================================================
node server.js
pause
