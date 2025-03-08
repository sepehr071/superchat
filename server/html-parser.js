/**
 * HTML Parser for PDF Generation
 * Converts HTML tables to structured data for PDFKit
 */

const { JSDOM } = require('jsdom');

/**
 * Parse HTML table to structured data
 * @param {string} tableHtml - The HTML table content
 * @returns {Object} - Structured table data with headers and rows
 */
function parseHtmlTable(tableHtml) {
  try {
    // Create virtual DOM with complete document structure
    const dom = new JSDOM(`<!DOCTYPE html><html dir="rtl" lang="fa"><body>${tableHtml}</body></html>`);
    const document = dom.window.document;
    
    // Get table element
    const table = document.querySelector('table');
    if (!table) {
      throw new Error('No table found in provided HTML');
    }
    
    // Extract headers
    const headerRow = table.querySelector('tr');
    if (!headerRow) {
      throw new Error('No header row found in table');
    }
    
    const headers = Array.from(headerRow.querySelectorAll('th'))
      .map(th => th.textContent.trim());
    
    // Extract data rows
    const rows = [];
    const dataRows = Array.from(table.querySelectorAll('tr')).slice(1);
    
    dataRows.forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'))
        .map(td => td.textContent.trim());
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    });
    
    return { headers, rows };
  } catch (error) {
    console.error('Error parsing HTML table:', error);
    throw new Error(`Failed to parse HTML table: ${error.message}`);
  }
}

/**
 * Process Persian text for better RTL rendering
 * @param {string} text - The text to process
 * @returns {string} - Processed text with fixed RTL issues
 */
function processPersianText(text) {
  if (!text) return '';
  
  // Fix parentheses position - e.g., "(CR7) کریستیانو رونالدو" to "کریستیانو رونالدو (CR7)"
  text = text.replace(/\(([^)]+)\)\s*([^<]+)/g, '$2 ($1)');
  
  // Fix "بیش از" patterns with numbers - e.g., "730 از بیش" to "بیش از 730"
  text = text.replace(/(\d+)\s+از\s+بیش/g, 'بیش از $1');
  
  // Fix numbers followed by Persian text - e.g., "730 گل" to "گل 730"
  text = text.replace(/(\d+)\s+(قهرمانی|گل|پاس)/g, '$2 $1');
  
  // Fix parenthetical phrases - ensure correct bidirectional rendering
  text = text.replace(/\(([^)]*?بیشترین در تاریخ[^)]*?)\)/g, '(بیشترین در تاریخ)');
  text = text.replace(/\(([^)]*?اسپانیا[^)]*?)\)/g, '($1)');
  text = text.replace(/\(([^)]*?فرانسه[^)]*?)\)/g, '($1)');
  text = text.replace(/\(([^)]*?انگلیس[^)]*?)\)/g, '($1)');
  text = text.replace(/\(([^)]*?ایتالیا[^)]*?)\)/g, '($1)');
  
  // Fix specific patterns that are problematic
  text = text.replace(/بدون قهرمانی \(بهترین: مقام چهارم\)/g, 'بدون قهرمانی (بهترین: مقام چهارم)');
  text = text.replace(/۷ \(در انگلیس، اسپانیا، ایتالیا\)/g, '۷ (در انگلیس، اسپانیا، ایتالیا)');
  text = text.replace(/۱۱ \(اسپانیا، فرانسه\)/g, '۱۱ (اسپانیا، فرانسه)');
  
  return text;
}

/**
 * Process table data for RTL languages
 * @param {Object} tableData - The parsed table data
 * @returns {Object} - Processed table data with RTL text fixes
 */
function processTableData(tableData) {
  return {
    headers: tableData.headers.map(header => processPersianText(header)),
    rows: tableData.rows.map(row => row.map(cell => processPersianText(cell)))
  };
}

/**
 * Extract styles from HTML table
 * @param {string} tableHtml - The HTML table content 
 * @returns {Object} - Extracted style information
 */
function extractTableStyles(tableHtml) {
  try {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${tableHtml}</body></html>`);
    const document = dom.window.document;
    const table = document.querySelector('table');
    
    if (!table) return {};
    
    // Extract background colors and other styles
    const styles = {
      headerBackgroundColor: '#333340',
      headerTextColor: '#ffffff',
      oddRowBackgroundColor: '#28282f',
      evenRowBackgroundColor: '#222228',
      textColor: '#ffffff',
      borderColor: '#4a4a57'
    };
    
    // Try to extract actual styles from the table if available
    const computedStyle = table.getAttribute('style');
    if (computedStyle) {
      // Extract border color if present
      const borderColorMatch = computedStyle.match(/border(-color)?:\s*([^;]+)/);
      if (borderColorMatch && borderColorMatch[2]) {
        styles.borderColor = borderColorMatch[2].trim();
      }
    }
    
    return styles;
  } catch (error) {
    console.error('Error extracting table styles:', error);
    return {};
  }
}

module.exports = {
  parseHtmlTable,
  processPersianText,
  processTableData,
  extractTableStyles
};