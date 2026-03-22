# MRF App — Deployment Guide
## Step-by-Step Setup in ~10 Minutes

---

## STEP 1 — Create Google Sheet

1. Go to https://sheets.google.com → Create a **new blank spreadsheet**
2. Name it: `ConstructPro MRF Data`
3. Copy the URL — extract the **Sheet ID** from it:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_YOUR_ID`**`/edit`

---

## STEP 2 — Create Drive Folder

1. Go to https://drive.google.com → New → Folder
2. Name it: `MRF Uploads`
3. Open the folder — copy the **Folder ID** from the URL:
   `https://drive.google.com/drive/folders/`**`THIS_IS_THE_FOLDER_ID`**

---

## STEP 3 — Setup Apps Script

1. In your Google Sheet → **Extensions → Apps Script**
2. Delete any existing code in `Code.gs`
3. Paste the **entire contents of `MRF_Script.gs`**
4. Update the CONFIG section at the top:
   ```javascript
   const CONFIG = {
     SPREADSHEET_ID: 'paste-your-sheet-id-here',
     DRIVE_FOLDER_ID: 'paste-your-folder-id-here',
     EMAIL: {
       ADMIN_CC:   'your-admin@email.com',
       MANAGER_CC: 'your-manager@email.com',
       LOCATION:   'default-location@email.com',
       VENDOR:     'default-vendor@email.com'
     },
     COMPANY_NAME: 'Your Company Name',
   };
   ```

---

## STEP 4 — Populate Dummy Data

1. In Apps Script editor, at the top select function: `populateDummyData`
2. Click **▶ Run**
3. Approve permissions when prompted (allow access to Sheets, Drive, Gmail)
4. You'll see a success alert — check your Sheet, all tabs should now have data

---

## STEP 5 — Deploy as Web App

1. In Apps Script → Click **Deploy → New Deployment**
2. Click ⚙ gear icon → Select type: **Web App**
3. Fill in:
   - Description: `MRF App v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (or "Anyone within [your org]" for security)
4. Click **Deploy**
5. **Copy the Web App URL** — it looks like:
   `https://script.google.com/macros/s/AKfy...xyz/exec`

---

## STEP 6 — Update Frontend

1. Open `MRF_App.html` in any text editor
2. Find this line near the top of the `<script>` section:
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
3. Replace `YOUR_DEPLOYMENT_ID` with your actual deployment ID
4. Save the file

---

## STEP 7 — Host the Frontend

### Option A: GitHub Pages (Recommended — Free)
1. Create a GitHub account if needed
2. New repository → Upload `MRF_App.html` → rename to `index.html`
3. Settings → Pages → Source: main branch
4. Your app is live at: `https://yourusername.github.io/repo-name`

### Option B: Netlify (Drag & Drop — Free)
1. Go to https://netlify.com → Sign up
2. Drag & drop your `MRF_App.html` file onto the deploy zone
3. Rename to `index.html` if prompted
4. Get your live URL instantly

### Option C: Local / Intranet
- Just open `MRF_App.html` directly in Chrome
- Works perfectly for local use or intranet deployment

---

## STEP 8 — CORS Fix (If needed)

If you get CORS errors, add this to the top of your `doGet`/`doPost` in Apps Script:

```javascript
function doGet(e) {
  // Add at start of function:
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
  };
  // ... rest of function
}
```

Or use the `no-cors` mode in fetch (already handled in demo mode fallback).

---

## Google Sheet Structure (Auto-created by populateDummyData)

| Sheet Name    | Purpose                              |
|---------------|--------------------------------------|
| Contractors   | Contractor IDs, names, emails        |
| Sites         | Sites linked to each contractor      |
| Items         | Material catalog with units          |
| Stock         | Location & central stock quantities  |
| Email Config  | Site-specific email addresses        |
| Requests      | All submitted MRF records            |
| MRF-XXXXXX    | Auto-created sub-sheet per request   |

---

## Updating Real Data

Replace dummy data directly in the Google Sheet:
- **Contractors** tab: Add/edit contractor rows
- **Sites** tab: Link sites to contractor IDs
- **Items** tab: Add your actual material catalog
- **Stock** tab: Update quantities (can be automated with a separate sync script)
- **Email Config** tab: Add real email addresses per site

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Demo Mode" shows on app | Apps Script URL not updated or not deployed |
| Emails not sending | Run `populateDummyData` first to authorize Gmail |
| Files not uploading | Check Drive Folder ID and folder permissions |
| CORS error | Redeploy Apps Script after any code change |
| Old data showing | Apps Script cached — redeploy with new version |

> ⚠️ After ANY change to Apps Script code, you MUST create a **New Deployment** 
> (not update existing) to see changes take effect.
