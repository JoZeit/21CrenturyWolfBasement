@echo off
echo 🐺 地下室系统 - 本地服务器
echo.
echo 手机连同一个 WiFi 后访问:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr /v "192.168.56"') do echo   http://%%a:8080
echo.
npx http-server . -p 8080 --cors -c-1
