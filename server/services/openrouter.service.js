const OpenAI = require('openai');
const config = require('../config');

/**
 * Service for interacting with OpenRouter API
 */
class OpenRouterService {
  constructor() {
    // Initialize OpenAI client with OpenRouter base URL
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': 'https://superchat.app', // Site URL for rankings on openrouter.ai
        'X-Title': 'Super Chat', // Site title for rankings on openrouter.ai
      }
    });
  }

  /**
   * Deep research chat with web browsing capability
 
   * @param {Array} messages - Array of message objects with role and content
   * @param {Boolean} stream - Whether to stream the response
   * @returns {Promise} - Promise that resolves to completion response
   */
  async researchChat(messages, stream = false) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key is not configured');
    }

    try {
      // Ensure the first message has the system prompt for web search if not present
      if (!messages.some(m => m.role === 'system')) {
        messages.unshift({
          role: 'system',
          content: `You are a helpful research assistant with web browsing capabilities. 
Your primary goal is to provide comprehensive, accurate information by searching 
the web and synthesizing the results. When responding:

1. Search the web to find current and relevant information
2. Cite your sources with links when providing information
3. Organize complex information clearly and logically
4. If information is unavailable or uncertain, acknowledge limitations
5. Provide objective analysis considering multiple perspectives
6. IMPORTANT: Always include a comprehensive list of all your sources at the end of your response

Format your citations as numbered references (e.g., [1], [2]) within the text, and then list all sources with full URLs at the end of your response like this:
[1]: https://example.com/source1
[2]: https://example.com/source2

Aim to be thorough yet concise, providing the most valuable information 
while maintaining high accuracy.`
        });
      }

      const completion = await this.openai.chat.completions.create({
        model: 'perplexity/sonar-pro',
        messages: messages
,
        stream: stream,
        temperature: 0.2,
        top_p: 0.9,
        frequency_penalty: 1,
        presence_penalty: 0,
        max_tokens: 3000,
        return_images : true
      });

      return completion;
    } catch (error) {
      console.error('OpenRouter API error:', error.message);
      throw error;
    }
  }
}

module.exports = new OpenRouterService();