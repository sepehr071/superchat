/**
 * Table Parser Module
 * Parses HTML tables into structured data for PDF generation
 */

const { JSDOM } = require('jsdom');

/**
 * Parse an HTML table into a structured object
 * @param {string} htmlTable - HTML table content
 * @returns {Object} - Object with headers and rows
 */
function parseHtmlTable(htmlTable) {
  try {
    console.log('Parsing HTML table...');
    
    // Create a DOM environment to parse the HTML
    const dom = new JSDOM(`<div>${htmlTable}</div>`);
    const document = dom.window.document;
    
    // Find the table element
    const table = document.querySelector('table');
    if (!table) {
      throw new Error('No table element found in HTML');
    }
    
    // Get all rows
    const rows = table.querySelectorAll('tr');
    if (!rows || rows.length === 0) {
      throw new Error('No rows found in table');
    }
    
    // Parse headers from the first row
    const headerRow = rows[0];
    const headers = Array.from(headerRow.querySelectorAll('th')).map(th => 
      th.textContent.trim()
    );
    
    // Parse data rows
    const dataRows = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells && cells.length > 0) {
        const rowData = Array.from(cells).map(td => 
          td.textContent.trim()
        );
        dataRows.push(rowData);
      }
    }
    
    console.log(`Parsed table with ${headers.length} columns and ${dataRows.length} data rows`);
    
    return {
      headers,
      rows: dataRows
    };
  } catch (error) {
    console.error('Error parsing HTML table:', error);
    throw new Error(`Table parsing failed: ${error.message}`);
  }
}

/**
 * Process table data to ensure consistent structure
 * @param {Object} tableData - The parsed table data
 * @returns {Object} - Processed table data
 */
function processTableData(tableData) {
  if (!tableData || !tableData.headers || !tableData.rows) {
    throw new Error('Invalid table data structure');
  }
  
  // Ensure all rows have the same number of cells as headers
  const processedRows = tableData.rows.map(row => {
    const processedRow = [...row];
    while (processedRow.length < tableData.headers.length) {
      processedRow.push(''); // Add empty cells if needed
    }
    return processedRow.slice(0, tableData.headers.length); // Truncate if too many
  });
  
  return {
    headers: tableData.headers,
    rows: processedRows
  };
}

/**
 * Process table data with enhanced RTL support
 * @param {Object} tableData - Parsed table data
 * @returns {Object} - Processed table data
 */
function processTableDataWithRTL(tableData) {
  // First apply standard processing
  const processed = processTableData(tableData);
  
  // Add any RTL specific processing here
  // We're leaving this as a separate function to allow for future RTL enhancements
  
  return processed;
}

/**
 * Extract styling information from the table HTML
 * @param {string} htmlTable - HTML table content
 * @returns {Object} - Extracted style information
 */
function extractTableStyles(htmlTable) {
  try {
    const dom = new JSDOM(`<div>${htmlTable}</div>`);
    const document = dom.window.document;
    const table = document.querySelector('table');
    
    // Default styles
    const styles = {
      headerBackgroundColor: '#333340',
      headerTextColor: 'white',
      rowBackgroundColor: '#222228',
      textColor: 'white',
      borderColor: '#4a4a57'
    };
    
    // Extract styles from inline style attributes or classes
    if (table) {
      // Look for style elements
      const styleElements = document.querySelectorAll('style');
      if (styleElements.length > 0) {
        // Parse CSS rules from style elements
        // This is a simplified approach - a real implementation would need a CSS parser
        for (const style of styleElements) {
          const css = style.textContent;
          
          // Extract header background color
          const headerBgMatch = css.match(/th\s*{[^}]*background-color\s*:\s*([^;]+)/);
          if (headerBgMatch && headerBgMatch[1]) {
            styles.headerBackgroundColor = headerBgMatch[1].trim();
          }
          
          // Extract row background colors
          const rowBgMatch = css.match(/tr:nth-child\(odd\)\s*{[^}]*background-color\s*:\s*([^;]+)/);
          if (rowBgMatch && rowBgMatch[1]) {
            styles.rowBackgroundColor = rowBgMatch[1].trim();
          }
        }
      }
      
      // Check for inline styles on the table element
      if (table.hasAttribute('style')) {
        const tableStyle = table.getAttribute('style');
        
        // Extract border color
        const borderMatch = tableStyle.match(/border-color\s*:\s*([^;]+)/);
        if (borderMatch && borderMatch[1]) {
          styles.borderColor = borderMatch[1].trim();
        }
      }
    }
    
    return styles;
  } catch (error) {
    console.warn('Error extracting table styles:', error);
    // Return default styles if extraction fails
    return {
      headerBackgroundColor: '#333340',
      headerTextColor: 'white',
      rowBackgroundColor: '#222228',
      textColor: 'white',
      borderColor: '#4a4a57'
    };
  }
}

module.exports = {
  parseHtmlTable,
  processTableData,
  processTableDataWithRTL,
  extractTableStyles
};