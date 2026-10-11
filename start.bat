@echo off
chcp 65001 > nul
title RCMS - ระบบบริหารงานจัดเก็บรายได้ ชย.ทอ.
echo ===================================================
echo   RCMS · ระบบบริหารงานจัดเก็บรายได้ ชย.ทอ.
echo   กำลังเริ่มต้นเซิร์ฟเวอร์...
echo ===================================================
echo.

if not exist node_modules (
  echo [1/2] กำลังติดตั้ง Dependencies (npm install)...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] ติดตั้ง dependencies ไม่สำเร็จ
    pause
    exit /b 1
  )
)

echo [2/2] เริ่มต้นระบบ RCMS บน http://localhost:8080/
start /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:8080/"
call npm.cmd run dev
pause
