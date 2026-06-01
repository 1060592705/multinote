@echo off
echo ================================
echo   MultiNote 本地信令服务器
echo   同 WiFi 下只需一台电脑运行
echo ================================
echo.
echo 启动后请在同一 WiFi 下的其他设备
echo 浏览器中打开 MultiNote 并确保使用
echo "自动连接" 模式即可自动发现对方
echo.
npx y-webrtc-signaling
pause
