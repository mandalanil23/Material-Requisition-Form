// ═══════════════════════════════════════════════════════════════════════════
//  CONSTRUCTPRO — Material Requisition Form | Google Apps Script Backend
//  Version: 2.0 | Author: ConstructPro Team
//  SETUP: See CONFIGURATION section below, then deploy as Web App
// ═══════════════════════════════════════════════════════════════════════════

// ─── CONFIGURATION ────────────────────────────────────────────────────────
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_GOOGLE_SHEET_ID_HERE',   // ← Replace after creating sheet
  DRIVE_FOLDER_ID: 'YOUR_DRIVE_FOLDER_ID_HERE',  // ← Replace with your Drive folder
  EMAIL: {
    ADMIN_CC:    'admin@yourcompany.com',
    MANAGER_CC:  'manager@yourcompany.com',
    LOCATION:    'location@yourcompany.com',
    VENDOR:      'vendor@yourcompany.com'
  },
  COMPANY_NAME: 'ConstructPro',
  COMPANY_LOGO: '',  // Optional: public URL to logo image
};

// ─── SHEET NAMES ──────────────────────────────────────────────────────────
const SHEETS = {
  CONTRACTORS: 'Contractors',
  ITEMS:       'Items',
  STOCK:       'Stock',
  REQUESTS:    'Requests',
  SITES:       'Sites',
  EMAILS:      'Email Config'
};

// ═══════════════════════════════════════════════════════════════════════════
//  HTTP HANDLER — Routes GET and POST requests
// ═══════════════════════════════════════════════════════════════════════════
function doGet(e) {
  const action = e.parameter.action || '';
  let result;
  try {
    switch(action) {
      case 'getAll':      result = getAllData();          break;
      case 'getStock':    result = getStockForItem(e);   break;
      case 'getItems':    result = getItems();            break;
      case 'getSites':    result = getSites(e);           break;
      default:            result = { success: false, message: 'Unknown action' };
    }
  } catch(err) {
    result = { success: false, message: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result;
  try {
    // Handle JSON body
    let payload;
    if(e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); }
      catch { payload = null; }
    }
    // Handle FormData (multipart — for file uploads via fetch FormData)
    const dataStr = e.parameter.data || (payload ? JSON.stringify(payload) : null);
    if(!dataStr) throw new Error('No data received');
    const data = JSON.parse(dataStr);
    result = submitMRF(data, e);
  } catch(err) {
    result = { success: false, message: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader ? ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON) : ContentService.createTextOutput(JSON.stringify(result));
}

// ═══════════════════════════════════════════════════════════════════════════
//  DATA GETTERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns all master data (contractors, sites, items) in one call
 * to minimise frontend round trips.
 */
function getAllData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return {
    success: true,
    data: {
      contractors: getContractorsData(ss),
      items:       getItemsData(ss),
      stock:       getStockData(ss)
    }
  };
}

function getContractorsData(ss) {
  const sheet = ss.getSheetByName(SHEETS.CONTRACTORS);
  const sitesSheet = ss.getSheetByName(SHEETS.SITES);
  if(!sheet) return [];

  const contractorRows = sheet.getDataRange().getValues();
  const contractors = [];

  // Skip header row (row index 0)
  for(let i = 1; i < contractorRows.length; i++) {
    const row = contractorRows[i];
    if(!row[0]) continue;
    contractors.push({
      id:   String(row[0]).trim(),   // Column A: Contractor ID
      name: String(row[1]).trim(),   // Column B: Contractor Name
      email: String(row[2]||'').trim(), // Column C: Email
      sites: getSitesForContractor(sitesSheet, String(row[0]).trim())
    });
  }
  return contractors;
}

function getSitesForContractor(sitesSheet, contractorId) {
  if(!sitesSheet) return [];
  const rows = sitesSheet.getDataRange().getValues();
  const sites = [];
  for(let i = 1; i < rows.length; i++) {
    if(String(rows[i][0]).trim() === contractorId) {
      sites.push(String(rows[i][1]).trim()); // Column B: Site Name
    }
  }
  return sites;
}

function getItemsData(ss) {
  const sheet = ss.getSheetByName(SHEETS.ITEMS);
  if(!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const items = [];
  for(let i = 1; i < rows.length; i++) {
    if(!rows[i][0]) continue;
    items.push({
      id:   String(rows[i][0]).trim(),   // Column A: Item ID
      name: String(rows[i][1]).trim(),   // Column B: Item Name
      unit: String(rows[i][2]||'').trim() // Column C: Unit
    });
  }
  return items;
}

function getStockData(ss) {
  const sheet = ss.getSheetByName(SHEETS.STOCK);
  if(!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const stock = {};
  for(let i = 1; i < rows.length; i++) {
    const itemId = String(rows[i][0]).trim();
    if(!itemId) continue;
    stock[itemId] = {
      location: parseFloat(rows[i][2])||0,   // Column C: Location Stock
      central:  parseFloat(rows[i][3])||0    // Column D: Central Stock
    };
  }
  return stock;
}

function getItems() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return { success: true, data: getItemsData(ss) };
}

function getStockForItem(e) {
  const itemId = e.parameter.itemId;
  if(!itemId) return { success: false, message: 'itemId required' };
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const stock = getStockData(ss);
  return { success: true, data: stock[itemId] || { location: 0, central: 0 } };
}

function getSites(e) {
  const contractorId = e.parameter.contractorId;
  if(!contractorId) return { success: false, message: 'contractorId required' };
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sitesSheet = ss.getSheetByName(SHEETS.SITES);
  return { success: true, data: getSitesForContractor(sitesSheet, contractorId) };
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMIT MRF
// ═══════════════════════════════════════════════════════════════════════════

function submitMRF(data, e) {
  // 1. Validate required fields
  if(!data.reqId)       throw new Error('Request ID missing');
  if(!data.contractor)  throw new Error('Contractor missing');
  if(!data.site)        throw new Error('Site missing');
  if(!data.items || data.items.length === 0) throw new Error('No items provided');

  // 2. Save to Requests sheet
  saveToSheet(data);

  // 3. Handle file uploads (if files present in FormData)
  const fileLinks = uploadFiles(data, e);

  // 4. Send email notifications
  sendNotificationEmails(data, fileLinks);

  return { success: true, reqId: data.reqId, message: 'MRF submitted successfully' };
}

function saveToSheet(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.REQUESTS);
  if(!sheet) {
    sheet = ss.insertSheet(SHEETS.REQUESTS);
    // Add headers
    sheet.appendRow([
      'Request ID','Contractor ID','Contractor Name','Site','Requested By',
      'Phone','Date','Priority','Required By Date','Remarks',
      'Item ID','Item Name','Qty','Unit','Loc Stock','Central Stock',
      'Challan','Other Docs','Timestamp','Status'
    ]);
    sheet.getRange(1,1,1,20).setFontWeight('bold').setBackground('#f59e0b').setFontColor('#000000');
    sheet.setFrozenRows(1);
  }

  const timestamp = new Date().toISOString();
  const contractorName = data.contractor;

  // One row per item
  data.items.forEach(item => {
    sheet.appendRow([
      data.reqId,
      data.contractor,
      contractorName,
      data.site,
      data.reqBy || '',
      data.phone || '',
      data.date || '',
      data.priority || 'normal',
      data.reqByDate || '',
      data.remarks || '',
      item.itemId,
      item.itemName,
      item.qty,
      item.unit || '',
      item.locStock || 0,
      item.cenStock || 0,
      data.hasChallan ? 'Yes' : 'No',
      data.hasDocs ? 'Yes' : 'No',
      timestamp,
      'Pending'
    ]);
  });

  // Also create a sub-sheet per MRF for easy reference
  createMRFSubSheet(ss, data);
}

function createMRFSubSheet(ss, data) {
  try {
    const sheetName = data.reqId; // e.g. MRF-260319-1234
    let sheet = ss.getSheetByName(sheetName);
    if(sheet) ss.deleteSheet(sheet);
    sheet = ss.insertSheet(sheetName);

    // Title row
    sheet.getRange('A1:G1').merge().setValue(`${CONFIG.COMPANY_NAME} — Material Requisition: ${data.reqId}`);
    sheet.getRange('A1').setFontSize(14).setFontWeight('bold').setBackground('#f59e0b').setFontColor('#000');

    // Info block
    const info = [
      ['Contractor:', data.contractor, '', 'Site:', data.site, '', ''],
      ['Requested By:', data.reqBy||'-', '', 'Date:', data.date||'-', '', ''],
      ['Priority:', data.priority||'normal', '', 'Required By:', data.reqByDate||'-', '', ''],
      ['', '', '', '', '', '', ''],
      ['Item ID', 'Item Name', 'Qty', 'Unit', 'Loc Stock', 'Central Stock', 'Status']
    ];
    sheet.getRange(2,1,info.length,7).setValues(info);
    sheet.getRange(2,1,4,1).setFontWeight('bold');
    sheet.getRange(6,1,1,7).setFontWeight('bold').setBackground('#1e2436').setFontColor('#ffffff');

    // Item rows
    data.items.forEach((item, i) => {
      sheet.getRange(7+i, 1, 1, 7).setValues([[
        item.itemId, item.itemName, item.qty, item.unit||'',
        item.locStock||0, item.cenStock||0,
        item.qty > (item.locStock||0) ? 'INSUFFICIENT STOCK' : 'OK'
      ]]);
    });

    if(data.remarks) {
      const lastRow = 8 + data.items.length;
      sheet.getRange(lastRow, 1).setValue('Remarks:').setFontWeight('bold');
      sheet.getRange(lastRow, 2, 1, 6).merge().setValue(data.remarks);
    }

    sheet.autoResizeColumns(1, 7);
  } catch(err) {
    Logger.log('Sub-sheet creation failed: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  FILE UPLOADS TO GOOGLE DRIVE
// ═══════════════════════════════════════════════════════════════════════════

function uploadFiles(data, e) {
  const links = { challan: '', docs: [] };
  if(!e || !e.parameters) return links;

  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    // Create sub-folder per MRF
    let mrfFolder;
    const folders = folder.getFoldersByName(data.reqId);
    mrfFolder = folders.hasNext() ? folders.next() : folder.createFolder(data.reqId);

    // Upload challan
    if(e.parameters.challan) {
      const blob = e.parameters.challan;
      const file = mrfFolder.createFile(blob);
      file.setName(`CHALLAN_${data.reqId}_${blob.getName()}`);
      links.challan = file.getUrl();
    }

    // Upload other docs
    let docIndex = 0;
    while(e.parameters[`doc_${docIndex}`]) {
      const blob = e.parameters[`doc_${docIndex}`];
      const file = mrfFolder.createFile(blob);
      file.setName(`DOC_${docIndex+1}_${data.reqId}_${blob.getName()}`);
      links.docs.push(file.getUrl());
      docIndex++;
    }
  } catch(err) {
    Logger.log('File upload error: ' + err.message);
  }
  return links;
}

// ═══════════════════════════════════════════════════════════════════════════
//  EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

function sendNotificationEmails(data, fileLinks) {
  const subject = `[MRF] ${data.reqId} — ${data.contractor} | ${data.site}`;
  const htmlBody = buildEmailHTML(data, fileLinks);

  // Lookup location + vendor emails from "Email Config" sheet
  const { locationEmail, vendorEmail } = getEmailsFromSheet(data);
  const toEmail    = locationEmail || CONFIG.EMAIL.LOCATION;
  const vendorMail = vendorEmail   || CONFIG.EMAIL.VENDOR;

  try {
    GmailApp.sendEmail(toEmail, subject, '', {
      htmlBody:  htmlBody,
      cc:        `${vendorMail},${CONFIG.EMAIL.ADMIN_CC},${CONFIG.EMAIL.MANAGER_CC}`,
      name:      CONFIG.COMPANY_NAME + ' — MRF System',
      replyTo:   CONFIG.EMAIL.ADMIN_CC
    });
  } catch(err) {
    Logger.log('Email error: ' + err.message);
    // Don't throw — submission still succeeded, email failure is non-critical
  }
}

function getEmailsFromSheet(data) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.EMAILS);
    if(!sheet) return {};
    const rows = sheet.getDataRange().getValues();
    for(let i = 1; i < rows.length; i++) {
      if(String(rows[i][0]).trim() === data.site) {
        return { locationEmail: rows[i][1], vendorEmail: rows[i][2] };
      }
    }
  } catch(e) {}
  return {};
}

function buildEmailHTML(data, fileLinks) {
  const priorityColor = data.priority === 'critical' ? '#ef4444' :
                        data.priority === 'urgent'   ? '#f59e0b' : '#10b981';
  const priorityLabel = data.priority === 'critical' ? '🔴 CRITICAL' :
                        data.priority === 'urgent'   ? '🟡 URGENT' : '🟢 Normal';

  const itemsHTML = data.items.map(item => {
    const insufficient = item.qty > (item.locStock||0);
    return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 16px;font-size:14px">${item.itemName}</td>
        <td style="padding:10px 16px;font-size:14px;font-weight:600">${item.qty} ${item.unit||''}</td>
        <td style="padding:10px 16px;font-size:14px;color:${item.locStock>0?'#10b981':'#ef4444'}">${item.locStock} ${item.unit||''}</td>
        <td style="padding:10px 16px;font-size:14px;color:#3b82f6">${item.cenStock} ${item.unit||''}</td>
        <td style="padding:10px 16px">
          <span style="background:${insufficient?'#fee2e2':'#d1fae5'};color:${insufficient?'#991b1b':'#065f46'};
            padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600">
            ${insufficient ? '⚠ Insufficient' : '✓ Available'}
          </span>
        </td>
      </tr>`;
  }).join('');

  const challanLink = fileLinks?.challan ? `<a href="${fileLinks.challan}" style="color:#f59e0b">View Challan</a>` : 'Not uploaded';
  const docsLinks = fileLinks?.docs?.length
    ? fileLinks.docs.map((l,i)=>`<a href="${l}" style="color:#f59e0b">Document ${i+1}</a>`).join(' &nbsp;|&nbsp; ')
    : 'Not uploaded';

  return `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" style="max-width:640px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)">
  <!-- HEADER -->
  <tr>
    <td style="background:#0f1117;padding:28px 32px">
      <table width="100%"><tr>
        <td><span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:1px">Construct<span style="color:#f59e0b">Pro</span></span>
        <br/><span style="color:#64748b;font-size:12px">Material Requisition System</span></td>
        <td style="text-align:right">
          <span style="background:#f59e0b;color:#000;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700">${data.reqId}</span>
        </td>
      </tr></table>
    </td>
  </tr>
  <!-- PRIORITY BANNER -->
  <tr>
    <td style="background:${priorityColor};padding:10px 32px;color:#fff;font-size:13px;font-weight:600">
      Priority: ${priorityLabel} &nbsp;|&nbsp; Submitted: ${new Date().toLocaleString('en-IN')}
    </td>
  </tr>
  <!-- DETAILS -->
  <tr>
    <td style="padding:28px 32px">
      <h2 style="font-size:20px;color:#0f1117;margin:0 0 20px">New Material Requisition</h2>
      <table width="100%" style="border-collapse:collapse;margin-bottom:24px">
        <tr style="background:#f8fafc">
          <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600;width:35%">Contractor</td>
          <td style="padding:10px 16px;font-size:14px;font-weight:600">${data.contractor}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600">Site</td>
          <td style="padding:10px 16px;font-size:14px">${data.site}</td>
        </tr>
        <tr style="background:#f8fafc">
          <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600">Requested By</td>
          <td style="padding:10px 16px;font-size:14px">${data.reqBy||'—'} ${data.phone ? '| '+data.phone : ''}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600">Required By</td>
          <td style="padding:10px 16px;font-size:14px">${data.reqByDate||'—'}</td>
        </tr>
        ${data.remarks ? `<tr style="background:#f8fafc"><td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600">Remarks</td><td style="padding:10px 16px;font-size:14px">${data.remarks}</td></tr>` : ''}
      </table>

      <h3 style="font-size:16px;font-weight:700;color:#0f1117;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px">Material Items</h3>
      <table width="100%" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tr style="background:#0f1117;color:#fff">
          <th style="padding:10px 16px;font-size:12px;text-align:left;font-weight:600">Item</th>
          <th style="padding:10px 16px;font-size:12px;text-align:left;font-weight:600">Requested</th>
          <th style="padding:10px 16px;font-size:12px;text-align:left;font-weight:600">Loc. Stock</th>
          <th style="padding:10px 16px;font-size:12px;text-align:left;font-weight:600">Central Stock</th>
          <th style="padding:10px 16px;font-size:12px;text-align:left;font-weight:600">Status</th>
        </tr>
        ${itemsHTML}
      </table>

      <table width="100%" style="margin-top:20px">
        <tr>
          <td style="padding:12px 16px;background:#f8fafc;border-radius:8px;font-size:13px">
            <strong>Challan:</strong> ${challanLink}<br/>
            <strong>Other Documents:</strong> ${docsLinks}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- FOOTER -->
  <tr>
    <td style="background:#0f1117;padding:20px 32px;text-align:center">
      <p style="color:#475569;font-size:12px;margin:0">This is an automated notification from ${CONFIG.COMPANY_NAME} MRF System.<br/>
      Please do not reply directly to this email. Contact your admin for queries.</p>
    </td>
  </tr>
</table>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ONE-TIME SETUP — Run this ONCE to create all sheets with dummy data
//  Go to: Apps Script Editor → Run → populateDummyData
// ═══════════════════════════════════════════════════════════════════════════

function populateDummyData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // ── Contractors Sheet ──────────────────────────────────────────────────
  setupSheet(ss, SHEETS.CONTRACTORS, [
    ['Contractor ID', 'Contractor Name', 'Email', 'Phone'],
    ['C001', 'Sharma Constructions Pvt Ltd', 'sharma@constructions.com', '+91 9810000001'],
    ['C002', 'Rajput Infrastructure Ltd', 'rajput@infra.com', '+91 9810000002'],
    ['C003', 'Verma & Sons Builders', 'verma@builders.com', '+91 9810000003'],
    ['C004', 'Kumar Civil Works', 'kumar@civil.com', '+91 9810000004'],
  ]);

  // ── Sites Sheet ────────────────────────────────────────────────────────
  setupSheet(ss, SHEETS.SITES, [
    ['Contractor ID', 'Site Name', 'Location City'],
    ['C001', 'Sector 45 Residential', 'Gurgaon'],
    ['C001', 'Phase 3 Commercial', 'Gurgaon'],
    ['C001', 'NH-48 Bridge Project', 'Delhi-Gurgaon'],
    ['C002', 'Green Valley Township', 'Faridabad'],
    ['C002', 'Metro Station Block B', 'Gurugram'],
    ['C003', 'Sky Tower Gurgaon', 'Gurgaon'],
    ['C003', 'Industrial Warehouse Manesar', 'Manesar'],
    ['C004', 'DLF Phase 5 Villas', 'Gurgaon'],
    ['C004', 'Corporate Park Sector 62', 'Noida'],
  ]);

  // ── Items Sheet ────────────────────────────────────────────────────────
  setupSheet(ss, SHEETS.ITEMS, [
    ['Item ID', 'Item Name', 'Unit', 'Category'],
    ['ITM001', 'Portland Cement (50kg bags)', 'Bags', 'Masonry'],
    ['ITM002', 'TMT Steel Bars 12mm', 'MT', 'Steel'],
    ['ITM003', 'River Sand (Fine)', 'CuM', 'Aggregate'],
    ['ITM004', 'Crushed Aggregate 20mm', 'CuM', 'Aggregate'],
    ['ITM005', 'Fly Ash Bricks', 'Nos', 'Masonry'],
    ['ITM006', 'Binding Wire', 'Kg', 'Hardware'],
    ['ITM007', 'Plywood 18mm (8x4ft)', 'Sheets', 'Timber'],
    ['ITM008', 'Shuttering Plates', 'Nos', 'Formwork'],
    ['ITM009', 'PVC Pipe 4 inch', 'Mtrs', 'Plumbing'],
    ['ITM010', 'MS Channels 100x50', 'Mtrs', 'Steel'],
    ['ITM011', 'White Cement 40kg', 'Bags', 'Masonry'],
    ['ITM012', 'AAC Blocks 600x200x150', 'Nos', 'Masonry'],
  ]);

  // ── Stock Sheet ────────────────────────────────────────────────────────
  setupSheet(ss, SHEETS.STOCK, [
    ['Item ID', 'Item Name', 'Location Stock', 'Central Stock', 'Last Updated'],
    ['ITM001', 'Portland Cement', 320, 1800, new Date().toLocaleDateString()],
    ['ITM002', 'TMT Steel Bars 12mm', 15.5, 84.2, new Date().toLocaleDateString()],
    ['ITM003', 'River Sand (Fine)', 42, 210, new Date().toLocaleDateString()],
    ['ITM004', 'Crushed Aggregate 20mm', 38, 175, new Date().toLocaleDateString()],
    ['ITM005', 'Fly Ash Bricks', 4200, 18000, new Date().toLocaleDateString()],
    ['ITM006', 'Binding Wire', 85, 420, new Date().toLocaleDateString()],
    ['ITM007', 'Plywood 18mm', 60, 240, new Date().toLocaleDateString()],
    ['ITM008', 'Shuttering Plates', 145, 800, new Date().toLocaleDateString()],
    ['ITM009', 'PVC Pipe 4 inch', 230, 900, new Date().toLocaleDateString()],
    ['ITM010', 'MS Channels 100x50', 0, 120, new Date().toLocaleDateString()],
    ['ITM011', 'White Cement 40kg', 180, 950, new Date().toLocaleDateString()],
    ['ITM012', 'AAC Blocks', 1500, 8000, new Date().toLocaleDateString()],
  ]);

  // ── Email Config Sheet ────────────────────────────────────────────────
  setupSheet(ss, SHEETS.EMAILS, [
    ['Site Name', 'Location Email', 'Vendor Email', 'Notes'],
    ['Sector 45 Residential', 'site45@constructions.com', 'vendor1@materials.com', ''],
    ['Phase 3 Commercial', 'phase3@constructions.com', 'vendor2@materials.com', ''],
    ['Green Valley Township', 'greenvalley@infra.com', 'vendor1@materials.com', ''],
    ['Metro Station Block B', 'metro@infra.com', 'vendor3@materials.com', ''],
  ]);

  // ── Requests Sheet ────────────────────────────────────────────────────
  setupSheet(ss, SHEETS.REQUESTS, [
    ['Request ID','Contractor ID','Contractor Name','Site','Requested By',
     'Phone','Date','Priority','Required By Date','Remarks',
     'Item ID','Item Name','Qty','Unit','Loc Stock','Central Stock',
     'Challan','Other Docs','Timestamp','Status']
  ]);

  Logger.log('✅ All sheets created with dummy data. Now deploy as Web App.');
  SpreadsheetApp.getUi().alert('✅ Setup complete! All sheets created with dummy data.\n\nNext step: Deploy this script as a Web App (Deploy → New Deployment → Web App → Anyone).');
}

function setupSheet(ss, name, data) {
  let sheet = ss.getSheetByName(name);
  if(!sheet) sheet = ss.insertSheet(name);
  else sheet.clearContents();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  // Style header
  sheet.getRange(1, 1, 1, data[0].length)
    .setFontWeight('bold')
    .setBackground('#f59e0b')
    .setFontColor('#000000');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, data[0].length);
}
