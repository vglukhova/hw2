// Google Apps Script Code (to be deployed as Web App)
// Copy this code into a new Google Apps Script project

function doPost(e) {
  try {
    // Parse incoming JSON data
    const data = JSON.parse(e.postData.contents);
    
    // Open the spreadsheet by ID or name
    const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // Replace with your Google Sheet ID
    const sheetName = 'Logs'; // Name of the sheet to write to
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      // Add headers
      sheet.getRange(1, 1, 1, 4).setValues([['Timestamp (ts_iso)', 'Review', 'Sentiment (with confidence)', 'Meta']]);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    }
    
    // Prepare data for insertion
    const rowData = [
      data.ts_iso,
      data.review,
      data.sentiment,
      data.meta
    ];
    
    // Append to next available row
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, 4).setValues([rowData]);
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, 4);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Data logged successfully',
        row: lastRow + 1
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to test the script
function testDoPost() {
  const testData = {
    ts_iso: new Date().toISOString(),
    review: 'This is a test review for sentiment analysis.',
    sentiment: 'POSITIVE (95.2%)',
    meta: JSON.stringify({
      userAgent: 'Test Agent',
      model: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
      test: true
    })
  };
  
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(e);
  Logger.log(result.getContent());
}

// Function to set up the spreadsheet (run once)
function setupSheet() {
  const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // Replace with your Google Sheet ID
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  
  // Remove existing Logs sheet if it exists
  const existingSheet = spreadsheet.getSheetByName('Logs');
  if (existingSheet) {
    spreadsheet.deleteSheet(existingSheet);
  }
  
  // Create new Logs sheet
  const sheet = spreadsheet.insertSheet('Logs');
  
  // Set up headers
  const headers = ['Timestamp (ts_iso)', 'Review', 'Sentiment (with confidence)', 'Meta'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  // Format the header row
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#4CAF50').setFontColor('white');
  
  // Set column widths
  sheet.setColumnWidth(1, 180); // Timestamp
  sheet.setColumnWidth(2, 400); // Review
  sheet.setColumnWidth(3, 200); // Sentiment
  sheet.setColumnWidth(4, 300); // Meta
  
  Logger.log('Sheet setup complete');
}

// Deploy instructions:
// 1. Save this script
// 2. Click "Deploy" > "New deployment"
// 3. Select "Web app" as type
// 4. Set "Execute as" to "Me"
// 5. Set "Who has access" to "Anyone"
// 6. Click "Deploy"
// 7. Copy the provided Web App URL and replace in app.js