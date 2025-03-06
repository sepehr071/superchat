// Main application initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log('Super Chat application initialized');
  
  // Check if browser supports the required features
  if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
    alert('Your browser does not support the File APIs needed for this application.');
    return;
  }
  
  // Add error handling for uncaught errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });
  
  // Add error handling for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
  
  // Initialize New Chat button functionality
  initializeNewChatButton();
});

// Function to initialize the New Chat button and admin access
function initializeNewChatButton() {
  const newChatButton = document.getElementById('new-chat-button');
  const adminLink = document.getElementById('admin-link');
  
  // Show the button once user is authenticated
  fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'include'
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('Not authenticated');
  })
  .then(data => {
    // User is logged in
    
    // Show new chat button if it exists
    if (newChatButton) {
      newChatButton.style.display = 'flex';
      newChatButton.addEventListener('click', createNewChat);
    }
    
    // Show admin link for admin users if it exists
    if (adminLink && data.user && data.user.isAdmin) {
      adminLink.style.display = 'block';
    }
  })
  .catch(error => {
    console.error('Error checking authentication:', error);
  });
}

// Helper function to check if conversation has valid messages
function hasValidMessages(conversationHistory) {
  if (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length < 2) {
    return false;
  }
  
  // Check for at least one user message and one assistant message
  let hasUserMessage = false;
  let hasAssistantMessage = false;
  
  for (const message of conversationHistory) {
    if (message.role === 'user') {
      hasUserMessage = true;
    } else if (message.role === 'assistant') {
      hasAssistantMessage = true;
    }
    
    if (hasUserMessage && hasAssistantMessage) {
      return true;
    }
  }
  
  return false;
}

// Function to create a new empty chat
function createNewChat() {
  // Check if there's a current conversation
  if (window.currentConversationId) {
    // Check if current conversation has valid messages
    if (!hasValidMessages(window.conversationHistory)) {
      // Show notification to the user
      showNotification('Please add at least one message to your current chat before creating a new one', 'warning');
      return;
    }
  }
  
  // Show loading state on the button
  const newChatButton = document.getElementById('new-chat-button');
  const originalContent = newChatButton.innerHTML;
  newChatButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinner">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 6v6l4 2"></path>
    </svg>
    Creating...
  `;
  newChatButton.disabled = true;
  
  // Call API to create empty conversation
  fetch('/api/conversations/create-empty', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'New Chat' // Default title
    }),
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to create new chat');
    }
    return response.json();
  })
  .then(data => {
    // Redirect to the new conversation
    window.location.href = `/?conversation=${data.conversationId}`;
  })
  .catch(error => {
    console.error('Error creating new chat:', error);
    // Reset button
    newChatButton.innerHTML = originalContent;
    newChatButton.disabled = false;
    
    // Show error message
    alert('Failed to create new chat. Please try again.');
  });
}

// Function to show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add notification to the DOM
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Remove notification after delay
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300); // Wait for animation to finish
  }, 3000);
}

// Add some basic CSS for the spinner and notifications
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .spinner {
      animation: spin 1.5s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      background-color: #333;
      color: white;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      opacity: 0;
      transform: translateY(-20px);
      transition: opacity 0.3s, transform 0.3s;
    }
    
    .notification.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .notification.info {
      background-color: #2196F3;
    }
    
    .notification.warning {
      background-color: #FF9800;
    }
    
    .notification.error {
      background-color: #F44336;
    }
    
    .notification.success {
      background-color: #4CAF50;
    }
  </style>
`);
