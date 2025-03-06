// File Uploader functionality
document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-upload');
  const uploadContainer = document.getElementById('upload-container');
  const contentContainer = document.getElementById('content-container');
  const selectedFilesList = document.getElementById('selected-files-list');
  
  // Global variables to store conversation data
  window.currentConversationId = null;
  window.uploadedFiles = [];

  // Handle click on upload area
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener('change', () => {
    updateSelectedFilesList();
  });

  // Handle drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateSelectedFilesList();
    }
  });

  // Function to update the selected files list
  function updateSelectedFilesList() {
    if (!fileInput.files.length) return;
    
    // Clear previous list
    selectedFilesList.innerHTML = '';
    
    // Create list of selected files with metadata
    Array.from(fileInput.files).forEach((file, index) => {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const isValidType = allowedTypes.includes(file.type);
      
      // Validate file size
      const isValidSize = file.size <= 32 * 1024 * 1024; // 32MB limit
      
      // Create file item element
      const fileItem = document.createElement('div');
      fileItem.className = 'selected-file-item';
      
      // File info
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';
      
      // File icon based on type
      let fileIcon = '';
      if (file.type === 'application/pdf') {
        fileIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>`;
      } else if (file.type.startsWith('image/')) {
        fileIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>`;
      }
      
      // Format file size
      const fileSize = formatFileSize(file.size);
      
      fileInfo.innerHTML = `
        <div class="file-icon">${fileIcon}</div>
        <div class="file-details">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${fileSize}</div>
        </div>
      `;
      
      // Remove button
      const removeButton = document.createElement('button');
      removeButton.className = 'file-remove-btn';
      removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>`;
      removeButton.title = 'Remove file';
      removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFileAtIndex(index);
      });
      
      // Warning if invalid
      if (!isValidType || !isValidSize) {
        fileItem.classList.add('invalid-file');
        
        const warningMessage = document.createElement('div');
        warningMessage.className = 'file-warning';
        warningMessage.textContent = !isValidType 
          ? 'Invalid file type' 
          : 'File exceeds 32MB limit';
        
        fileInfo.appendChild(warningMessage);
      }
      
      fileItem.appendChild(fileInfo);
      fileItem.appendChild(removeButton);
      selectedFilesList.appendChild(fileItem);
    });
    
    // Update UI based on selection
    selectedFilesList.classList.remove('hidden');
    document.getElementById('upload-button').classList.remove('hidden');
    
    // Check if there are any valid files
    const validFiles = Array.from(fileInput.files).filter(file => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      return allowedTypes.includes(file.type) && file.size <= 32 * 1024 * 1024;
    });
    
    // Enable/disable upload button
    const uploadButton = document.getElementById('upload-button');
    if (validFiles.length === 0) {
      uploadButton.disabled = true;
      uploadButton.classList.add('disabled');
    } else {
      uploadButton.disabled = false;
      uploadButton.classList.remove('disabled');
    }
  }
  
  // Function to remove a file from the selection
  function removeFileAtIndex(index) {
    const dt = new DataTransfer();
    const files = fileInput.files;
    
    for (let i = 0; i < files.length; i++) {
      if (i !== index) {
        dt.items.add(files[i]);
      }
    }
    
    fileInput.files = dt.files;
    updateSelectedFilesList();
    
    // Hide list and button if no files
    if (fileInput.files.length === 0) {
      selectedFilesList.classList.add('hidden');
      document.getElementById('upload-button').classList.add('hidden');
    }
  }
  
  // Function to format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }
  
  // Upload button handler
  document.getElementById('upload-button').addEventListener('click', handleFileUpload);
  
  // Helper function to detect Persian text
  function isPersianText(text) {
    // Check if text contains Persian/Arabic characters (Unicode range)
    return /[\u0600-\u06FF]/.test(text);
  }

  // Function to update the files panel in the UI with conversation files
  function updateFilesPanel(newFiles) {
    if (!newFiles || newFiles.length === 0) {
      console.warn('No files to display in files panel');
      return;
    }
    
    console.log('Updating files panel with new files:', newFiles);
    
    const filesPanel = document.getElementById('conversation-files');
    if (!filesPanel) {
      console.error('Files panel element not found');
      return;
    }
    
    // Add accordion styles if not already added
    if (!document.getElementById('files-accordion-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'files-accordion-styles';
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
          overflow-y: auto;
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
          background-color: #222;
          border-radius: 6px;
          color: #fff;
        }
        
        .file-name {
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .file-date {
          font-size: 12px;
          color: #aaa;
          white-space: nowrap;
          margin-left: 8px;
        }
        
        /* Responsive styles for mobile */
        @media (max-width: 768px) {
          .files-header {
            padding: 10px 12px;
          }
          
          .files-content.open {
            padding: 10px;
          }
          
          .file-item {
            padding: 8px;
            flex-direction: column;
            align-items: flex-start;
          }
          
          .file-date {
            margin-left: 0;
            margin-top: 4px;
          }
        }
      `;
      document.head.appendChild(styleElement);
    }
    
    // Get a list of all existing file IDs in the panel
    const existingFileIds = Array.from(filesPanel.querySelectorAll('.file-item'))
      .map(item => item.dataset.id);
    
    console.log('Existing file IDs in panel:', existingFileIds);
    
    // Clear existing content
    filesPanel.innerHTML = '';
    
    // Create accordion structure
    const filesAccordion = document.createElement('div');
    filesAccordion.className = 'files-accordion';
    
    // Create header
    const filesHeader = document.createElement('div');
    filesHeader.className = 'files-header';
    filesHeader.innerHTML = `
      <span class="files-title">Attached files (${newFiles.length})</span>
      <span class="toggle-icon">▼</span>
    `;
    
    // Create content
    const filesContent = document.createElement('div');
    filesContent.className = 'files-content';
    
    // Create file list
    const filesList = document.createElement('div');
    filesList.className = 'files-list';
    
    // Format file date helper function
    const formatDate = (timestamp) => {
      if (!timestamp) return '';
      try {
        const date = new Date(timestamp);
        // Return a more compact timestamp format (just show time)
        return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
      } catch (e) {
        return '';
      }
    };
    
    // Add files to the list
    newFiles.forEach(file => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.dataset.id = file.id;
      
      // Icon based on file type
      let fileIcon = '';
      if (file.type === 'application/pdf') {
        fileIcon = `<svg class="file-type-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>`;
      } else if (file.type && file.type.startsWith('image/')) {
        fileIcon = `<svg class="file-type-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>`;
      }
      
      // Get upload time if available
      const uploadTime = formatDate(file.uploadTime || file.timestamp);
      
      // Check if filename contains Persian text
      const hasPersianText = isPersianText(file.name);
      
      // Apply RTL class to the entire file item if it contains Persian text
      if (hasPersianText) {
        fileItem.classList.add('rtl-text');
      }
      
      fileItem.innerHTML = `
        <span class="file-name ${hasPersianText ? 'rtl-text' : ''}">${hasPersianText ? file.name + fileIcon : fileIcon + file.name}</span>
      `;
      
      filesList.appendChild(fileItem);
      console.log('Added file to panel:', file.name);
    });
    
    // Assemble the structure
    filesContent.appendChild(filesList);
    filesAccordion.appendChild(filesHeader);
    filesAccordion.appendChild(filesContent);
    filesPanel.appendChild(filesAccordion);
    
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
  }
  
  // Function to handle file upload
  function handleFileUpload() {
    if (!fileInput.files.length) return;
    
    // Filter out invalid files
    const validFiles = Array.from(fileInput.files).filter(file => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      return allowedTypes.includes(file.type) && file.size <= 32 * 1024 * 1024;
    });
    
    if (validFiles.length === 0) {
      alert('No valid files to upload. Please select valid files.');
      return;
    }
    
    // Create FormData and append files
    const formData = new FormData();
    validFiles.forEach(file => {
      formData.append('files', file);
    });
    
    // Show loading state
    uploadArea.innerHTML = '<div class="loading-indicator"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div><p>Uploading...</p></div>';
    selectedFilesList.classList.add('hidden');
    document.getElementById('upload-button').classList.add('hidden');
    
    // Upload files to server
    fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      return response.json();
    })
    .then(data => {
      // Store conversation ID and files
      window.currentConversationId = data.conversationId;
      window.uploadedFiles = data.files || [];
      
      // Show chat interface
      uploadContainer.classList.add('hidden');
      contentContainer.classList.remove('hidden');
      
      // Populate files panel with uploaded files
      updateFilesPanel(data.files);
      
      // Initialize chat
      initializeChat();
      
      // Log success
      console.log('Files uploaded successfully:', data.files);
    })
    .catch(error => {
      console.error('Error uploading files:', error);
      uploadArea.innerHTML = `
        <div class="upload-prompt">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p>Upload failed. Please try again.</p>
          <p class="file-limit">Maximum file size: 32MB per file</p>
        </div>
      `;
      selectedFilesList.classList.add('hidden');
      document.getElementById('upload-button').classList.add('hidden');
    });
  }
  
  // Function to handle adding files during chat
  window.addFilesToConversation = function(conversationId) {
    if (!fileInput.files.length) return Promise.reject('No files selected');
    
    // Filter out invalid files
    const validFiles = Array.from(fileInput.files).filter(file => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      return allowedTypes.includes(file.type) && file.size <= 32 * 1024 * 1024;
    });
    
    if (validFiles.length === 0) {
      return Promise.reject('No valid files to upload');
    }
    
    // Create FormData and append files
    const formData = new FormData();
    validFiles.forEach(file => {
      formData.append('files', file);
    });
    
    // Upload files to existing conversation
    return fetch(`/api/conversation/${conversationId}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      return response.json();
    })
    .then(data => {
      // Add to uploadedFiles
      if (data.files && data.files.length) {
        window.uploadedFiles = window.uploadedFiles.concat(data.files);
      }
      return data;
    });
  };
  
  // Make updateFilesPanel available globally so it can be used by chatInterface.js
  window.updateFilesPanel = updateFilesPanel;
});
