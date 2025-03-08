@echo off
echo =================================
echo SuperChat Development Environment
echo =================================
echo.

echo [1/2] Running database migrations...
node migrations/add_auto_generated_title.js

echo [2/2] Starting server...
node server.js