// Creator animation script
document.addEventListener('DOMContentLoaded', () => {
  // Create the terminal structure
  const creatorTerminal = document.createElement('div');
  creatorTerminal.className = 'terminal-container';
  creatorTerminal.innerHTML = `
    <div class="terminal">
      <div class="terminal-header">
        <div class="terminal-buttons">
          <div class="terminal-button terminal-close"></div>
          <div class="terminal-button terminal-minimize"></div>
          <div class="terminal-button terminal-maximize"></div>
        </div>
        <div class="terminal-title">creator-terminal</div>
      </div>
      <div class="terminal-content">
        <div class="terminal-line">
          <span class="terminal-prompt">$</span>
          <span class="terminal-text typing">Created by: Sepehr Radmard</span>
        </div>
        <div class="terminal-line" style="margin-top: 6px;">
          <span class="terminal-prompt">$</span>
          <span class="terminal-text" id="linkedin-text">
            <a href="https://www.linkedin.com/in/sepehr-radmard-8214381b4/" class="terminal-link" target="_blank">LinkedIn Profile</a>
          </span>
        </div>
      </div>
    </div>
  `;
  
  // Find the footer element and insert the terminal
  const footer = document.querySelector('footer');
  if (footer) {
    // Insert before the existing content
    const existingContent = footer.querySelector('p');
    if (existingContent) {
      footer.insertBefore(creatorTerminal, existingContent);
    } else {
      footer.appendChild(creatorTerminal);
    }
    
    // Start the animation sequence
    setTimeout(() => {
      const linkedinText = document.getElementById('linkedin-text');
      if (linkedinText) {
        linkedinText.classList.add('typing');
      }
    }, 3000); // Start after the first animation completes
  }
});
