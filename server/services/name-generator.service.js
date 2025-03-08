const claudeService = require('./claude.service');

/**
 * Generate a short, descriptive title for a conversation based on the first message
 * @param {string} message - The first message in the conversation
 * @returns {Promise<string>} - The generated title
 */
async function generateChatName(message) {
  const systemPrompt = `
    You are a title generator for chat conversations.
    Generate a very short, concise title (3-5 words) that captures the essence of the user's message.
    The title should be descriptive but brief, and should not use quotes or special formatting.
    Just respond with the title text alone, nothing else.
  `;
  
  try {
    const response = await claudeService.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 20,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Generate a short title for this conversation: "${message}"` }
      ]
    });
    
    // Extract title from response
    let title = response.content[0].text.trim();
    
    // Clean up: remove quotes, limit length
    title = title.replace(/["']/g, '');
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return title;
  } catch (error) {
    console.error('Error generating chat name:', error);
    return 'New Chat'; // Fallback title
  }
}

module.exports = {
  generateChatName
};