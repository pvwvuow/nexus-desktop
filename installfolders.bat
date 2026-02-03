@echo off
echo Creating project structure...

REM --- Root files ---
type nul > package.json
type nul > main.js
type nul > preload.js

REM --- src folder ---
mkdir src
cd src
type nul > login.html
type nul > app.html

REM --- assets inside src ---
mkdir assets
cd assets
type nul > icon.png
type nul > icon.ico
type nul > icon.icns
cd ..
cd ..

REM --- build folder ---
mkdir build
cd build
type nul > icon.png
cd ..

REM --- dist folder ---
mkdir dist

echo Done! Project structure created successfully.
pause