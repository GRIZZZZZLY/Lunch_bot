# update-urls.ps1 - Improvements Summary

## ✅ Changes Made

### 1. Multiple .env Files Support
**Before:** Updated only 2 files
- `backend/.env`
- `frontend/.env`

**After:** Updates ALL .env files (4 total)
- ✅ `backend/.env`
- ✅ `backend/.env.development` ← **NEW**
- ✅ `frontend/.env`
- ✅ `frontend/.env.development` ← **NEW**

---

### 2. Improved Backend Restart

**Problem:** Backend restarted in NEW terminal window, old window remained open
- ❌ 2 backend processes running
- ❌ 2 terminal windows open

**Solution:** Automatically close old terminal, open new one
- ✅ Kill backend process on port 3001
- ✅ Close parent PowerShell window
- ✅ Open new terminal with fresh backend

---

### 3. Automatic Telegram Webhook Setup ← **NEW!**

**Problem:** After ngrok restart, webhook not updated
- ❌ Telegram sends requests to OLD ngrok URL
- ❌ ERR_NGROK_3200 error in Telegram
- ❌ WebApp doesn't work

**Solution:** Automatically set Telegram webhook to new URL
- ✅ Reads BOT_TOKEN from backend/.env
- ✅ Calls Telegram API to set webhook
- ✅ Verifies webhook was set successfully
- ✅ Shows webhook URL in console

---

### 4. Better User Feedback

**New features:**
- ✅ Step-by-step progress ([1/3], [2/3], [3/3])
- ✅ Verification of backend restart
- ✅ Clear success messages ([OK] markers)
- ✅ Backup of all 4 .env files
- ✅ Automatic webhook setup with confirmation

---

## 🚀 How It Works Now

### Step 1: Backup
```
Creating backups...
  Backed up: backend\.env
  Backed up: backend\.env.development
  Backed up: frontend\.env
  Backed up: frontend\.env.development
```

### Step 2: Update Files
```
Updating backend .env files...
  [OK] Updated backend\.env
  [OK] Updated backend\.env.development

Updating frontend .env files...
  [OK] Updated frontend\.env -> VITE_API_URL=https://xxx.ngrok-free.app/api
  [OK] Updated frontend\.env.development -> VITE_API_URL=https://xxx.ngrok-free.app/api
```

### Step 3: Restart Backend
```
[1/3] Stopping old backend process...
  Stopping process: node (PID: 12345)
  Closing old terminal window (PID: 12340)
  [OK] Old backend stopped

[2/3] Starting new backend terminal...
  [OK] New backend terminal opened

[3/3] Verifying backend restart...
  Waiting for backend to start...
  [OK] Backend is running on port 3001
```

### Step 4: Set Telegram Webhook ← **NEW!**
```
========================================
  Setting Telegram Webhook...
========================================

Setting webhook for Telegram bot...
  [OK] Webhook set successfully!
  URL: https://xxx.ngrok-free.app/api/webhook

========================================
  All Done! Test in Telegram!
========================================

1. Open @rocket_lunch_bot in Telegram
2. Press 'Menu' button (left side)
3. WebApp should open!
```

---

## 🔧 Technical Details

### Backend Restart Logic

1. **Find process on port 3001:**
   ```powershell
   Get-NetTCPConnection -LocalPort 3001
   ```

2. **Kill node process:**
   ```powershell
   Stop-Process -Id $pid -Force
   ```

3. **Close parent PowerShell window:**
   - Finds parent process ID using `Get-CimInstance Win32_Process`
   - Stops parent PowerShell process
   - This closes the old terminal window

4. **Start new terminal:**
   ```powershell
   Start-Process powershell -ArgumentList "-NoExit", "-Command", "..."
   ```

5. **Verify backend started:**
   - Waits up to 10 seconds
   - Checks for listening connection on port 3001

---

## 📁 Files Modified

- ✅ `update-urls.ps1` - Main script with all improvements
- ✅ Functions added:
  - `Update-BackendEnv` - Update backend .env files
  - `Update-FrontendEnv` - Update frontend .env files

---

## 🎯 Usage

### Same as before:
```powershell
.\update-urls.ps1
```

Then paste your ngrok URL when prompted.

### Or with parameter:
```powershell
.\update-urls.ps1 -NgrokUrl "https://abc123.ngrok-free.app"
```

---

## ✅ Testing Checklist

- [x] Syntax validation passed
- [ ] Test with real ngrok URL
- [ ] Verify all 4 .env files updated
- [ ] Verify old backend terminal closes
- [ ] Verify new backend terminal opens
- [ ] Verify backend restarts successfully

---

## 🐛 Known Limitations

1. **Only kills processes on port 3001**
   - If backend runs on different port, manual restart needed

2. **Parent process detection**
   - Works only if backend started from PowerShell
   - If started from IDE, may not close window

3. **10-second verification timeout**
   - Slow backend startup may timeout (not critical, backend still starts)

---

## 📝 Changelog

### Version 2.0 (Current)
- ✅ Multiple .env files support (4 files)
- ✅ Automatic old terminal closure
- ✅ Backend restart verification
- ✅ Better user feedback
- ✅ All 4 files backed up

### Version 1.0 (Previous)
- ❌ Only 2 .env files updated
- ❌ Backend restart opened new window (duplicate)
- ❌ No verification
- ❌ Limited feedback

---

**Last Updated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
