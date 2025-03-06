// Chat Interface functionality
let isProcessing = false;

// Global variables for conversation
if (!window.conversationHistory) {
  window.conversationHistory = [];
}
if (!window.currentConversationId) {
  window.currentConversationId = null;
}
if (!window.uploadedFiles) {
  window.uploadedFiles = [];
}
if (!window.selectedChatFiles) {
  window.selectedChatFiles = [];
}

// Function to safely render markdown with enhanced LaTeX support
function renderMarkdown(text) {
  // Pre-process LaTeX environments to improve compatibility
  let processedText = text
    // Convert equation environments to display math
    .replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, '$$$$1$$')
    // Other environment conversions
    .replace(/\\begin\{align\}([\s\S]*?)\\end\{align\}/g, '$$\\begin{aligned}$1\\end{aligned}$$')
    .replace(/\\begin\{eqnarray\}([\s\S]*?)\\end\{eqnarray\}/g, '$$\\begin{aligned}$1\\end{aligned}$$');
  
  // Parse markdown to HTML
  const rawHtml = marked.parse(processedText);
  
  // Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(rawHtml);
  
  // Create a temporary container to render LaTeX
  const temp = document.createElement('div');
  temp.innerHTML = sanitizedHtml;
  
  // Wrap tables in a div for better scrolling
  const tables = temp.querySelectorAll('table');
  tables.forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
  
  // Render LaTeX expressions with expanded options
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(temp, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true},
        // Add support for equation* environment
        {left: '\\begin{equation*}', right: '\\end{equation*}', display: true},
        {left: '\\begin{align*}', right: '\\end{align*}', display: true},
        {left: '\\begin{aligned}', right: '\\end{aligned}', display: true}
      ],
      throwOnError: false,
      output: 'html',
      strict: false,
      trust: true, // Allow more functions but be careful with user-generated content
      macros: {
        // Common macros can be defined here
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}"
      }
    });
  }
  
  return temp.innerHTML;
}

// Function to initialize chat
// Setup message observer to automatically add UI elements to new messages
let messageObserver = null;

// Function to add UI elements to all existing messages
function addUIElementsToExistingMessages() {
  const messages = document.querySelectorAll('.message');
  
  messages.forEach(message => {
    // Check for Persian text in both user and assistant messages
    const messageText = message.textContent || '';
    const hasPersianText = /[\u0600-\u06FF]/.test(messageText);
    
    // Add RTL class if Persian text is detected
    if (hasPersianText && !message.classList.contains('rtl-text')) {
      message.classList.add('rtl-text');
    }
    
    // Only process assistant messages for copy buttons
    if (message.classList.contains('assistant-message')) {
      // Check if the message already has action buttons
      if (!message.querySelector('.message-actions')) {
        // Create copy button for assistant messages
        const copyButtonContainer = document.createElement('div');
        copyButtonContainer.className = 'message-actions';
        
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        `;
        
        // Get the message content for copying
        copyButton.addEventListener('click', () => {
          // Get the content to copy (all the HTML inside the message, except action buttons)
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = message.innerHTML;
          
          // Remove the copy button from the cloned content
          const actionsToRemove = tempDiv.querySelectorAll('.message-actions');
          actionsToRemove.forEach(el => el.remove());
          
          // Get content for copying
          const messageContent = message.textContent.trim();
          
          // Use the clipboard API to copy the content
          navigator.clipboard.writeText(messageContent)
            .then(() => {
              // Show success feedback
              copyButton.classList.add('copied');
              copyButton.querySelector('span').textContent = 'Copied!';
              
              // Reset after 2 seconds
              setTimeout(() => {
                copyButton.classList.remove('copied');
                copyButton.querySelector('span').textContent = 'Copy';
              }, 2000);
            })
            .catch(err => {
              console.error('Error copying text: ', err);
              copyButton.querySelector('span').textContent = 'Failed';
              
              setTimeout(() => {
                copyButton.querySelector('span').textContent = 'Copy';
              }, 2000);
            });
        });
        
        copyButtonContainer.appendChild(copyButton);
        message.appendChild(copyButtonContainer);
      }
      
      // Add table download buttons if not already added
      const tables = message.querySelectorAll('table');
      tables.forEach((table, index) => {
        // Check if table already has download buttons
        if (!table.nextElementSibling || !table.nextElementSibling.classList.contains('table-actions')) {
          addTableDownloadButtons(message);
        }
      });
    }
  });
}

// Function to add a go-to-top button for the chat messages container
function addGoToTopButton(chatMessagesContainer) {
  // Only add if we're in a chat interface
  if (!chatMessagesContainer) return;
  
  // Check if there's already a go-to-top button
  let goToTopBtn = document.querySelector('.go-to-top-button');
  
  // If not, create a new one
  if (!goToTopBtn) {
    goToTopBtn = document.createElement('button');
    goToTopBtn.id = 'go-to-top-btn';
    goToTopBtn.className = 'go-to-top-button hidden';
    goToTopBtn.setAttribute('aria-label', 'Scroll to top');
    goToTopBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;
    
    // Make button highly visible for debugging
    goToTopBtn.style.zIndex = '9999';
    
    // Append button to body - this ensures it can be fixed positioned properly
    document.body.appendChild(goToTopBtn);
    
    console.log('Added go-to-top button to page');
  }
  
  // Track last known scroll position for optimization
  let lastScrollTop = 0;
  
  // Show/hide button based on scroll position
  function updateButtonVisibility() {
    // Threshold - show button when scrolled down
    const scrollThreshold = 500;
    
    // Check if we're on a mobile device
    const isMobile = window.innerWidth <= 768;
    
    // Use a lower threshold for mobile devices
    const mobileThreshold = 300;
    const effectiveThreshold = isMobile ? mobileThreshold : scrollThreshold;
    
    if (chatMessagesContainer.scrollTop > effectiveThreshold) {
      goToTopBtn.classList.remove('hidden');
      // Add mobile class for mobile-specific styling
      if (isMobile) {
        goToTopBtn.classList.add('mobile');
      } else {
        goToTopBtn.classList.remove('mobile');
      }
      
      // Button visibility updated
    } else {
      goToTopBtn.classList.add('hidden');
    }
    
    lastScrollTop = chatMessagesContainer.scrollTop;
  }
  
  // Initial check
  updateButtonVisibility();
  
  // Add scroll event with throttling for better performance
  chatMessagesContainer.addEventListener('scroll', function() {
    // Only update if we've scrolled significantly (without logging)
    if (Math.abs(chatMessagesContainer.scrollTop - lastScrollTop) > 50) {
      updateButtonVisibility();
    }
  });
  
  // Scroll to top with smooth animation when button is clicked
  goToTopBtn.addEventListener('click', function() {
    chatMessagesContainer.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
  
  // Update on window resize
  window.addEventListener('resize', updateButtonVisibility);
  
  // Clean up on page navigation/unload
  window.addEventListener('beforeunload', function() {
    if (goToTopBtn && goToTopBtn.parentNode) {
      goToTopBtn.parentNode.removeChild(goToTopBtn);
    }
  });
  
  // Force update after a delay to ensure proper initialization
  setTimeout(updateButtonVisibility, 500);
}

// Function to setup MutationObserver to watch for new messages
function setupMessageObserver() {
  // If observer already exists, disconnect it first
  if (messageObserver) {
    messageObserver.disconnect();
  }
  
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  // Create a new observer instance
  messageObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Check if nodes were added
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        // Process each added node
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is an element node and has the message class
          if (node.nodeType === 1 && node.classList && node.classList.contains('assistant-message')) {
            // Add UI elements to this new message
            // Wait a brief moment to ensure all content is rendered
            setTimeout(() => {
              // Check again if this message already has UI elements
              if (!node.querySelector('.message-actions')) {
                const copyButtonContainer = document.createElement('div');
                copyButtonContainer.className = 'message-actions';
                
                const copyButton = document.createElement('button');
                copyButton.className = 'copy-button';
                copyButton.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Copy</span>
                `;
                
                // Add click handler for copying
                copyButton.addEventListener('click', () => {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = node.innerHTML;
                  
                  const actionsToRemove = tempDiv.querySelectorAll('.message-actions');
                  actionsToRemove.forEach(el => el.remove());
                  
                  const messageContent = node.textContent.trim();
                  
                  navigator.clipboard.writeText(messageContent)
                    .then(() => {
                      copyButton.classList.add('copied');
                      copyButton.querySelector('span').textContent = 'Copied!';
                      
                      setTimeout(() => {
                        copyButton.classList.remove('copied');
                        copyButton.querySelector('span').textContent = 'Copy';
                      }, 2000);
                    })
                    .catch(err => {
                      console.error('Error copying text: ', err);
                      copyButton.querySelector('span').textContent = 'Failed';
                      
                      setTimeout(() => {
                        copyButton.querySelector('span').textContent = 'Copy';
                      }, 2000);
                    });
                });
                
                copyButtonContainer.appendChild(copyButton);
                node.appendChild(copyButtonContainer);
              }
              
              // Add table download buttons
              const tables = node.querySelectorAll('table');
              if (tables.length > 0) {
                addTableDownloadButtons(node);
              }
            }, 100);
          }
        });
      }
    });
  });
  
  // Start observing the target node with the configured options
  messageObserver.observe(chatMessages, {
    childList: true,  // observe direct children
    subtree: false    // don't observe all descendants
  });
  
  console.log('Message observer setup complete');
}

function initializeChat() {
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const chatInputContainer = document.querySelector('.chat-input-container');
  
  // Create file preview area and add it to the DOM
  const filePreviewArea = document.createElement('div');
  filePreviewArea.id = 'file-preview-area';
  filePreviewArea.className = 'file-preview hidden';
  chatInputContainer.insertBefore(filePreviewArea, chatInput);
  
  // Focus on chat input
  chatInput.focus();
  
  // Process any existing messages to add UI elements
  addUIElementsToExistingMessages();
  
  // Set up MutationObserver to watch for new messages
  setupMessageObserver();
  
  // Clean "Go to Top" implementation for chat interface
  setTimeout(() => {
    // Remove any existing buttons
    const existingButton = document.getElementById('go-to-top-btn');
    if (existingButton) {
      existingButton.remove();
    }
    
    // Create the button
    const goToTopBtn = document.createElement('button');
    goToTopBtn.id = 'go-to-top-btn';
    goToTopBtn.className = 'go-to-top-button hidden';
    goToTopBtn.setAttribute('aria-label', 'Go to top');
    goToTopBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;
    
    // Add to document
    document.body.appendChild(goToTopBtn);
    
    // Get chat messages container
    const chatMessages = document.getElementById('chat-messages');
    
    if (chatMessages) {
      // Button click handler - scroll to top (without console logs)
      goToTopBtn.addEventListener('click', function() {
        chatMessages.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
      
      // Scroll handler - show/hide button
      chatMessages.addEventListener('scroll', function() {
        const threshold = 300;
        
        // Check if we're on a mobile device
        const isMobile = window.innerWidth <= 768;
        
        if (chatMessages.scrollTop > threshold) {
          goToTopBtn.classList.remove('hidden');
          // Add mobile class for mobile-specific styling
          if (isMobile) {
            goToTopBtn.classList.add('mobile');
          } else {
            goToTopBtn.classList.remove('mobile');
          }
        } else {
          goToTopBtn.classList.add('hidden');
        }
      });
      
      // Ensure button visibility checks run periodically
      setInterval(function() {
        // If we have enough content to scroll, check visibility
        if (chatMessages.scrollHeight > chatMessages.clientHeight) {
          if (chatMessages.scrollTop > 300) {
            goToTopBtn.classList.remove('hidden');
          }
        }
      }, 2000);
    }
  }, 1000);
  
  // Add event listener for send button
  sendButton.addEventListener('click', sendMessage);
  
  // Add event listener for Enter key
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
  });
  
  // Make sure file attachment button has event listener
  const chatFileButton = document.getElementById('chat-file-button');
  if (chatFileButton) {
    chatFileButton.addEventListener('click', (e) => {
      // Stop event propagation to prevent double clicks
      e.stopPropagation();
      e.preventDefault();
      
      // Safely try to access file upload element
      const fileUpload = document.querySelector('#file-upload');
      if (fileUpload) {
        fileUpload.click();
      } else {
        console.error('Could not find file upload element when attach button was clicked');
      }
    });
  }
  
  // Add event listener for file input change to show preview
  const fileInput = document.querySelector('#file-upload');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      updateFilePreview(fileInput.files);
    });
  }
  
  // Load existing files into the files panel if available
  if (window.uploadedFiles && window.uploadedFiles.length > 0) {
    console.log('Initializing files panel with existing files:', window.uploadedFiles);
    if (typeof window.updateFilesPanel === 'function') {
      window.updateFilesPanel(window.uploadedFiles);
    }
  }
}

// Function to add download buttons to tables
function addTableDownloadButtons(messageElement) {
  // Find all tables in the message
  const tables = messageElement.querySelectorAll('table');
  
  // If no tables, do nothing
  if (tables.length === 0) return;
  
  // Process each table
  tables.forEach((table, index) => {
    // Create a container for the table actions
    const tableActionsContainer = document.createElement('div');
    tableActionsContainer.className = 'table-actions';
    
    // Create the download button
    const downloadButton = document.createElement('button');
    downloadButton.className = 'table-download-button';
    downloadButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Download as PDF</span>
    `;
    
    // Add event listener to handle download
    downloadButton.addEventListener('click', async () => {
      try {
        // Show loading state
        const originalText = downloadButton.querySelector('span').textContent;
        downloadButton.disabled = true;
        downloadButton.querySelector('span').textContent = 'Generating PDF...';
        
        // Get the table HTML
        const tableHtml = table.outerHTML;
        
        // Create a default filename based on table content or index
        const captionElement = table.querySelector('caption');
        let filename = captionElement ?
          `table-${captionElement.textContent.trim().replace(/\s+/g, '-').toLowerCase()}` :
          `table-${index + 1}`;
        
        // Call the server API to generate and download the PDF
        const response = await fetch('/api/export-table', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tableHtml: tableHtml,
            filename: filename
          }),
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Failed to generate PDF: ${response.status} - ${errorText}`);
        }
        
        // Convert the response to a blob
        const blob = await response.blob();
        
        // Log blob details for debugging
        console.log(`PDF blob received - Size: ${blob.size} bytes, Type: ${blob.type}`);
        
        // Proceed with download even if content type isn't exactly as expected
        // Many browsers handle PDF blobs correctly regardless of the MIME type
        
        // Create a download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${filename}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success state temporarily
        downloadButton.classList.add('success');
        downloadButton.querySelector('span').textContent = 'Downloaded!';
        
        setTimeout(() => {
          downloadButton.classList.remove('success');
          downloadButton.disabled = false;
          downloadButton.querySelector('span').textContent = originalText;
        }, 2000);
        
      } catch (error) {
        console.error('Error downloading table as PDF:', error);
        downloadButton.classList.add('error');
        downloadButton.querySelector('span').textContent = 'Download failed';
        
        // Create an error notification
        const errorMsg = document.createElement('div');
        errorMsg.className = 'system-message';
        errorMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.07)';
        errorMsg.style.color = '#ef4444';
        errorMsg.textContent = `Table export failed: ${error.message}`;
        
        // Find the chat messages container and append the error
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
          chatMessages.appendChild(errorMsg);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        setTimeout(() => {
          downloadButton.classList.remove('error');
          downloadButton.disabled = false;
          downloadButton.querySelector('span').textContent = 'Download as PDF';
        }, 2000);
      }
    });
    
    // Add the button to the container
    tableActionsContainer.appendChild(downloadButton);
    
    // Insert the container after the table
    table.parentNode.insertBefore(tableActionsContainer, table.nextSibling);
  });
}

// Function to update file preview when files are selected
function updateFilePreview(files) {
  if (!files || files.length === 0) return;
  
  const filePreviewArea = document.getElementById('file-preview-area');
  if (!filePreviewArea) return;
  
  // Clear existing preview
  filePreviewArea.innerHTML = '';
  filePreviewArea.classList.remove('hidden');
  
  // Add accordion styles if not already added
  if (!document.getElementById('file-accordion-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'file-accordion-styles';
    styleElement.textContent = `
      .files-accordion {
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      
      .files-header {
        background-color: #222;
        color: #fff;
        padding: 12px 15px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background-color 0.2s ease;
        user-select: none;
      }
      
      .files-header:hover {
        background-color: #333;
      }
      
      .files-title {
        font-weight: 600;
      }
      
      .toggle-icon {
        font-size: 12px;
        transition: transform 0.3s ease;
      }
      
      .files-content {
        max-height: 0;
        overflow: hidden;
        background-color: #222;
        transition: max-height 0.3s ease, padding 0.3s ease;
      }
      
      .files-content.open {
        max-height: 300px;
        padding: 12px 15px;
      }
      
      .files-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .file-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #fff;
      }
      
      .file-name {
        font-size: 14px;
        word-break: break-all;
      }
      
      .file-size {
        font-size: 12px;
        color: #aaa;
        white-space: nowrap;
        margin-left: 15px;
      }
      
      .preview-clear-button {
        margin-top: 10px;
        background-color: #333;
        color: #fff;
        border: none;
        padding: 8px 15px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .preview-clear-button:hover {
        background-color: #444;
      }
    `;
    document.head.appendChild(styleElement);
  }
  
  // Format file size helper function
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Create accordion structure
  const filesAccordion = document.createElement('div');
  filesAccordion.className = 'files-accordion';
  
  // Create header
  const filesHeader = document.createElement('div');
  filesHeader.className = 'files-header';
  filesHeader.innerHTML = `
    <span class="files-title">Selected files (${files.length})</span>
    <span class="toggle-icon">▼</span>
  `;
  
  // Create content
  const filesContent = document.createElement('div');
  filesContent.className = 'files-content';
  
  // Create file list
  const fileList = document.createElement('div');
  fileList.className = 'files-list';
  
  Array.from(files).forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    // Icon based on file type
    let fileIcon = '';
    if (file.type === 'application/pdf') {
      fileIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>`;
    } else if (file.type.startsWith('image/')) {
      fileIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>`;
    }
    
    fileItem.innerHTML = `
      <span class="file-name">${fileIcon} ${file.name}</span>
      <span class="file-size">${formatFileSize(file.size)}</span>
    `;
    fileList.appendChild(fileItem);
  });
  
  // Assemble the structure
  filesContent.appendChild(fileList);
  filesAccordion.appendChild(filesHeader);
  filesAccordion.appendChild(filesContent);
  filePreviewArea.appendChild(filesAccordion);
  
  // Add toggle functionality
  filesHeader.addEventListener('click', function() {
    filesContent.classList.toggle('open');
    const toggleIcon = filesHeader.querySelector('.toggle-icon');
    toggleIcon.textContent = filesContent.classList.contains('open') ? '▲' : '▼';
  });
  
  // Auto-open the accordion on initial display
  setTimeout(() => {
    filesContent.classList.add('open');
    const toggleIcon = filesHeader.querySelector('.toggle-icon');
    toggleIcon.textContent = '▲';
  }, 100);
  
  // Add clear button
  const clearButton = document.createElement('button');
  clearButton.className = 'preview-clear-button';
  clearButton.textContent = 'Clear';
  clearButton.addEventListener('click', () => {
    const fileInput = document.querySelector('#file-upload');
    if (fileInput) {
      fileInput.value = '';
      filePreviewArea.innerHTML = '';
      filePreviewArea.classList.add('hidden');
    }
  });
  
  filePreviewArea.appendChild(clearButton);
}

// Function to send message
function sendMessage() {
  if (isProcessing) return;
  
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const sendButton = document.getElementById('send-button');
  
  const message = chatInput.value.trim();
  
  if (!message) return;
  
  // Get the conversation type
  const conversationType = window.conversationType || 'pdf';
  
  // Only for PDF chat type, we require at least one file
  if (conversationType === 'pdf' && (!window.uploadedFiles || window.uploadedFiles.length === 0)) {
    const errorMessageElement = document.createElement('div');
    errorMessageElement.className = 'system-message';
    errorMessageElement.innerHTML = 'No files found for this PDF conversation. Please upload at least one file.';
    chatMessages.appendChild(errorMessageElement);
    return;
  }
  
  // Normal chat doesn't require files, but can have them if user wants
  
  // Initialize file handling with a resolved promise (no new files by default)
  let newFilesPromise = Promise.resolve(null);
  
  // Try to find the file input - but don't error if we can't find it
  // This allows the chat to work even if file upload isn't available
  const fileInput = document.querySelector('#file-upload');
  
  // Only try to process new files if the input exists and has files
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    // Check if currently in a conversation
    if (!window.currentConversationId) {
      const errorMessageElement = document.createElement('div');
      errorMessageElement.className = 'system-message';
      errorMessageElement.innerHTML = 'Error: Cannot attach files without an active conversation.';
      chatMessages.appendChild(errorMessageElement);
      return;
    }
    
    // Show uploading message
    const uploadingMessage = document.createElement('div');
    uploadingMessage.className = 'system-message';
    uploadingMessage.textContent = 'Uploading additional files...';
    chatMessages.appendChild(uploadingMessage);
    
    // Only try to upload if the addFilesToConversation function exists
    if (typeof window.addFilesToConversation === 'function') {
      // Upload the files to the current conversation
      newFilesPromise = window.addFilesToConversation(window.currentConversationId)
        .then(result => {
          // Remove uploading message
          chatMessages.removeChild(uploadingMessage);
          
          // Add success message
          const successMessage = document.createElement('div');
          successMessage.className = 'system-message';
          successMessage.textContent = `Successfully added ${result.files.length} file(s) to the conversation.`;
          chatMessages.appendChild(successMessage);
          
          // Update files panel
          updateFilesPanel(result.files);
          
          // Return the file IDs to include in the chat request
          return result.files.map(file => file.id);
        })
        .catch(error => {
          // Remove uploading message
          chatMessages.removeChild(uploadingMessage);
          
          // Add error message
          const errorMessage = document.createElement('div');
          errorMessage.className = 'system-message';
          errorMessage.textContent = `Error uploading files: ${error}`;
          chatMessages.appendChild(errorMessage);
          
          return null;
        });
    } else {
      // Function doesn't exist, show error and continue without files
      chatMessages.removeChild(uploadingMessage);
      
      const errorMessage = document.createElement('div');
      errorMessage.className = 'system-message';
      errorMessage.textContent = 'Error: File upload functionality not available.';
      chatMessages.appendChild(errorMessage);
    }
  }
  
  // Disable input and button while processing
  isProcessing = true;
  chatInput.disabled = true;
  sendButton.disabled = true;
  
  // Process the message after handling any file uploads
  newFilesPromise.then(newFileIds => {
    // Get all file IDs for this conversation
    const fileIds = window.uploadedFiles.map(file => file.id);
    
    // Add new file IDs if any were uploaded
    if (newFileIds) {
      fileIds.push(...newFileIds);
    }
    
    // Check if the user message contains Persian text
    const hasPersianText = /[\u0600-\u06FF]/.test(message);
    
    // Add user message to chat
    const userMessageElement = document.createElement('div');
    userMessageElement.className = `message user-message ${hasPersianText ? 'rtl-text' : ''}`;
    userMessageElement.textContent = message;
    chatMessages.appendChild(userMessageElement);
    
    // Clear input and reset file input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Only reset fileInput if it exists
    if (fileInput) {
      fileInput.value = '';
    }
    
    // Hide and clear file preview area if it exists
    const filePreviewArea = document.getElementById('file-preview-area');
    if (filePreviewArea) {
      filePreviewArea.innerHTML = '';
      filePreviewArea.classList.add('hidden');
    }
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    chatMessages.appendChild(loadingIndicator);
    
    // Add user message to conversation history
    const userMessage = {
      role: 'user',
      content: message
    };
    window.conversationHistory.push(userMessage);
    
    // Send message to server
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        fileIds: fileIds,
        conversationId: window.currentConversationId,
        conversationHistory: window.conversationHistory.slice(0, -1), // Exclude the last message (already sent as 'message')
        stream: true,
        conversationType: window.conversationType || 'pdf' // Include conversation type
      }),
      credentials: 'include'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Chat request failed');
      }
      
      // Remove loading indicator
      chatMessages.removeChild(loadingIndicator);
      
      // Create assistant message element
      const assistantMessageElement = document.createElement('div');
      assistantMessageElement.className = 'message assistant-message';
      chatMessages.appendChild(assistantMessageElement);
      
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      
      function readStream() {
        return reader.read().then(({ done, value }) => {
          if (done) {
            // Add assistant message to conversation history
            const assistantMessage = {
              role: 'assistant',
              content: accumulatedContent
            };
            window.conversationHistory.push(assistantMessage);
            
            // Add copy button to the message
            const copyButtonContainer = document.createElement('div');
            copyButtonContainer.className = 'message-actions';
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            `;
            
            copyButton.addEventListener('click', () => {
              // Copy the formatted message content
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = assistantMessageElement.innerHTML;
              
              // Remove the copy button from the cloned content
              const actionsToRemove = tempDiv.querySelectorAll('.message-actions');
              actionsToRemove.forEach(el => el.remove());
              
              // Get the HTML content for copying (with formatting preserved)
              const htmlContent = tempDiv.innerHTML;
              
              // Use the clipboard API to copy the content
              navigator.clipboard.writeText(accumulatedContent)
                .then(() => {
                  // Show success feedback
                  copyButton.classList.add('copied');
                  copyButton.querySelector('span').textContent = 'Copied!';
                  
                  // Reset after 2 seconds
                  setTimeout(() => {
                    copyButton.classList.remove('copied');
                    copyButton.querySelector('span').textContent = 'Copy';
                  }, 2000);
                })
                .catch(err => {
                  console.error('Error copying text: ', err);
                  copyButton.querySelector('span').textContent = 'Failed';
                  
                  setTimeout(() => {
                    copyButton.querySelector('span').textContent = 'Copy';
                  }, 2000);
                });
            });
            
            copyButtonContainer.appendChild(copyButton);
            assistantMessageElement.appendChild(copyButtonContainer);
            
            // Add download buttons to tables
            addTableDownloadButtons(assistantMessageElement);
            
            // Re-enable input and button
            isProcessing = false;
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.focus();
            
            return;
          }
          
          // Initialize the chat application and add event listeners for conversation loading
          document.addEventListener('DOMContentLoaded', async () => {
            // Redirect to login if not authenticated
            try {
              const response = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include'
              });
              
              if (!response.ok) {
                window.location.href = 'login.html';
                return;
              }
              
              // Initialize chat interface
              initializeChat();
              
              // Process any existing messages to add UI elements
              addUIElementsToExistingMessages();
            } catch (error) {
              console.error('Error checking authentication:', error);
              window.location.href = 'login.html';
            }
          });
          
          // Event listener for when a conversation is loaded
          document.addEventListener('conversationLoaded', function() {
            console.log('Conversation loaded event received');
            // Add UI elements to all messages in the loaded conversation
            setTimeout(() => {
              // Apply RTL to messages first
              const allMessages = document.querySelectorAll('.message');
              allMessages.forEach(msg => {
                const msgText = msg.textContent || '';
                if (/[\u0600-\u06FF]/.test(msgText) && !msg.classList.contains('rtl-text')) {
                  msg.classList.add('rtl-text');
                }
              });
              
              // Then add UI elements and setup observer
              addUIElementsToExistingMessages();
              setupMessageObserver(); // Also set up the observer again
            }, 200); // Small delay to ensure DOM is updated
          });
          
          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          
          // Process each line
          const lines = chunk.split('\n');
          lines.forEach(line => {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.done) {
                  // Stream complete
                  return;
                }
                
                if (data.text) {
                  // Append text to message
                  accumulatedContent += data.text;
                  // Check if response contains Persian text
                  const hasPersianText = /[\u0600-\u06FF]/.test(accumulatedContent);
                  
                  // Add rtl-text class if Persian text is detected
                  if (hasPersianText && !assistantMessageElement.classList.contains('rtl-text')) {
                    assistantMessageElement.classList.add('rtl-text');
                  }
                  
                  // Render markdown and sanitize HTML
                  assistantMessageElement.innerHTML = renderMarkdown(accumulatedContent);
                  
                  // Scroll to bottom
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                if (data.error) {
                  // Handle error
                  assistantMessageElement.textContent = `Error: ${data.error}`;
                  assistantMessageElement.classList.add('error');
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          });
          
          // Continue reading
          return readStream();
        });
      }
      
      return readStream();
    })
    .catch(error => {
      console.error('Error in chat:', error);
      
      // Remove loading indicator if it exists
      if (loadingIndicator.parentNode) {
        chatMessages.removeChild(loadingIndicator);
      }
      
      // Add error message
      const errorMessageElement = document.createElement('div');
      errorMessageElement.className = 'message assistant-message error';
      errorMessageElement.innerHTML = 'Sorry, there was an error processing your request. Please try again.';
      chatMessages.appendChild(errorMessageElement);
      
      // Re-enable input and button
      isProcessing = false;
      chatInput.disabled = false;
      sendButton.disabled = false;
      chatInput.focus();
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  });
}
