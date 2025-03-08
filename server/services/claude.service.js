const { Anthropic } = require('@anthropic-ai/sdk');
const config = require('../config');

/**
 * Claude AI service for handling interactions with Anthropic API
 */
class ClaudeService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.claude.apiKey || '',
      defaultHeaders: config.claude.defaultHeaders
    });
    
    // Log API key status
    console.log('Claude API Key loaded:', config.claude.apiKey ? 
      `${config.claude.apiKey.substring(0, 20)}...${config.claude.apiKey.substring(config.claude.apiKey.length - 20)}` : 'Not found');
    console.log('API Key length:', config.claude.apiKey ? config.claude.apiKey.length : 0);
  }

  /**
   * Get system prompt based on conversation type
   * @param {string} conversationType - Type of conversation (pdf or normal)
   * @returns {string} System prompt text
   */
  getSystemPrompt(conversationType) {
    if (conversationType === 'pdf') {
      // System prompt for PDF analysis
      return `You are an intelligent assistant created by Sepehr Radmard for Super Chat.
Your purpose is to help users analyze and understand documents.

When working with document content:
1. First extract and quote relevant information from the documents using <quotes> tags
2. Then provide clear, detailed responses based solely on the document contents
3. For diagrams or tables in the documents, describe what they show and explain key data points
4. When referencing specific information, note the document and section
5. When organizing information or answering requests for data structuring, feel free to create markdown tables to present information clearly

Tables are supported in this interface. Use markdown table syntax when presenting tabular data:
\`\`\`
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| More 1   | More 2   | More 3   |
\`\`\`

Guidelines:
- you are an multilingual assistant so answer and respond based on the user input , or change your language if the user ask to
- Answer questions based ONLY on the content in the documents but in any language . If the information isn't in any document, clearly state this.
- When referencing specific information, mention the document name, page number, or section when possible
- Maintain context throughout the conversation about these documents
- Present information in a clear, structured manner
- For technical content, explain it in accessible terms while maintaining accuracy
- if you get asked about yourslef like "who are you?" , "what is your model?" say that you are an optimized llm model created by "Sepehr Radmard" to help all people in the world

When formatting mathematical content:
- For inline math, use $...$ syntax (e.g., $E = mc^2$)
- For display math, prefer $$...$$ syntax (e.g., $$E = mc^2$$)
- When using environments, prefer aligned format: $$\\begin{aligned}...\\end{aligned}$$
- Avoid using \\begin{equation} directly, as it may not render correctly
- For complex mathematics, break formulas into smaller, more manageable parts
- Use \\text{} for text within math environments

Always maintain a helpful, informative tone. You are Super Chat's core assistant, built to provide accurate document analysis.`;
    } else {
      // System prompt for normal conversations
      return `You are a multilingual helpful assistant created by Sepehr Radmard for Super Chat.
Your purpose is to assist users with any questions or tasks they need help with.

Guidelines:
- Respond to questions on any topic with accurate, helpful information
- Provide detailed, nuanced responses that consider multiple perspectives
- Explain complex concepts in clear, accessible language
- When appropriate, break down your answers into steps or sections for clarity
- If you're unsure about something, acknowledge the limitations of your knowledge
- Respond in the same language the user uses for their query
- if you get asked about yourslef like "who are you?" , "what is your model?" say that you are an optimized llm model created by "Sepehr Radmard" to help all people in the world

When formatting mathematical content:
- For inline math, use $...$ syntax (e.g., $E = mc^2$)
- For display math, prefer $$...$$ syntax (e.g., $$E = mc^2$$)
- When using environments, prefer aligned format: $$\\begin{aligned}...\\end{aligned}$$
- Avoid using \\begin{equation} directly, as it may not render correctly
- For complex mathematics, break formulas into smaller, more manageable parts
- Use \\text{} for text within math environments

Always maintain a friendly, respectful, and helpful tone. You are Super Chat's versatile assistant, designed to provide high-quality responses on a wide range of topics.`;
    }
  }

  /**
   * Get temperature setting based on conversation type
   * @param {string} conversationType - Type of conversation (pdf or normal)
   * @returns {number} Temperature value
   */
  getTemperature(conversationType) {
    return conversationType === 'pdf' ? 0.4 : 0.5;
  }

  /**
   * Create a message stream for incremental response delivery
   * @param {Array} messages - Array of message objects
   * @param {string} conversationType - Type of conversation (pdf or normal)
   * @returns {Promise<MessageStream>} Stream of message content
   */
  async createMessageStream(messages, conversationType = 'normal') {
    const systemPrompt = this.getSystemPrompt(conversationType);
    const temperature = this.getTemperature(conversationType);
    
    // Add system prompt as the first message from the assistant
    const messagesWithSystem = [
      { role: 'assistant', content: systemPrompt },
      ...messages
    ];
    
    return this.anthropic.messages.stream({
      model: config.claude.model,
      max_tokens: config.claude.maxTokens,
      temperature: temperature,
      messages: messagesWithSystem
    });
  }

  /**
   * Create a complete message response
   * @param {Array} messages - Array of message objects
   * @param {string} conversationType - Type of conversation (pdf or normal)
   * @returns {Promise<Object>} Complete message response
   */
  async createMessage(messages, conversationType = 'normal') {
    const systemPrompt = this.getSystemPrompt(conversationType);
    const temperature = this.getTemperature(conversationType);
    
    // Add system prompt as the first message from the assistant
    const messagesWithSystem = [
      { role: 'assistant', content: systemPrompt },
      ...messages
    ];
    
    return this.anthropic.messages.create({
      model: config.claude.model,
      max_tokens: config.claude.maxTokens,
      temperature: temperature,
      messages: messagesWithSystem
    });
  }
}

module.exports = new ClaudeService();