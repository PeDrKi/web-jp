@echo off
setlocal EnableExtensions
rem ============================================================
rem  update.bat - Dua thay doi len GitHub, Render tu deploy lai
rem  Cach dung: nhap dup vao file nay (dat trong thu muc Web_JP)
rem ============================================================
cd /d "%~dp0"
title Cap nhat Web_JP

where git >nul 2>nul || (echo [LOI] Chua cai Git. Tai tai https://git-scm.com/download/win & goto :end)
if not exist ".git" (echo [LOI] Thu muc nay chua duoc ket noi GitHub. Lam theo Buoc 2 trong docs\06-deploy-render-supabase.md truoc. & goto :end)

rem Khong bao gio dua file .env (chua mat khau, khoa bi mat) len GitHub
git ls-files --error-unmatch .env >nul 2>nul && (
  echo [LOI] File .env dang nam trong Git. Chay lenh sau roi chay lai update.bat:
  echo        git rm --cached .env
  goto :end
)

echo.
echo === 1/4. Cac file da thay doi ===
git status --short
git add -A
git diff --cached --quiet && (echo Khong co thay doi nao de cap nhat. & goto :end)

echo.
echo === 2/4. Chay kiem thu (khoang 30 giay, khong dung toi du lieu that) ===
rem Cai/cap nhat thu vien theo package.json (nhanh neu da du)
echo Dang kiem tra thu vien...
call npm install --no-audit --no-fund --loglevel=error >nul 2>&1 || (echo [LOI] npm install that bai. Chay "npm install" de xem chi tiet. & git reset -q & goto :end)
call npm test >"%TEMP%\webjp-test.log" 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Get-Content -Tail 15 -Encoding UTF8 '%TEMP%\webjp-test.log'"
  echo [CANH BAO] Co kiem thu bi loi. Xem chi tiet: %TEMP%\webjp-test.log
  choice /C CK /M "Van tiep tuc dua len (C = co, K = khong)"
  if errorlevel 2 (git reset -q & goto :end)
) else (
  echo Kiem thu dat.
)

echo.
echo === 3/4. Ghi chu cho lan cap nhat ===
set "MSG="
set /p "MSG=Mo ta ngan gon thay doi (Enter de bo qua): "
if "%MSG%"=="" set "MSG=Cap nhat %date% %time:~0,5%"
git commit -q -m "%MSG%" || (echo [LOI] Khong tao duoc commit. & goto :end)

echo.
echo === 4/4. Dua len GitHub ===
git push || (
  echo [LOI] Khong dua len duoc. Kiem tra mang hoac dang nhap GitHub roi chay lai update.bat.
  echo        Thay doi da duoc luu tren may, lan sau chay lai se tu dua len.
  goto :end
)

echo.
echo ============================================================
echo  XONG. Render dang tu build lai, khoang 3-5 phut nua web
echo  https://web-jp-pe86.onrender.com se chay ban moi.
echo  Du lieu tren Supabase giu nguyen.
echo ============================================================

:end
echo.
pause
endlocal
