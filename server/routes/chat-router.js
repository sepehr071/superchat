/**
 * Chat Router Module
 * Handles chat interactions with the LLM
 */

const express = require('express');
const router = express.Router();
const { Anthropic } = require('@anthropic-ai/sdk');
const { authenticateUser } = require('../auth');
const { db, getCurrentISOTimestamp } = require('../database');
const fs = require('fs');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  defaultHeaders: {
    'anthropic-beta': 'output-128k-2025-02-19'
  }
});

/**
 * Handle chat requests
 * @route POST /api/chat
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { message, fileIds, conversationId, conversationHistory, stream = false, conversationType = 'pdf' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // If conversationId is provided, verify it belongs to the user
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const conversation = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, req.user.id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Determine the conversation type - use the one from database or fallback to the request parameter
    const chatType = conversation.type || conversationType;
    
    // Get files for this conversation (if any)
    let files = [];
    if (fileIds && fileIds.length > 0) {
      // Get files for this conversation
      files = db.prepare(`
        SELECT * FROM pdf_files
        WHERE conversation_id = ?
        AND id IN (${fileIds.join(',')})
      `).all(conversationId);
    }
    
    // For PDF chat type, files are required
    if (chatType === 'pdf' && files.length === 0) {
      return res.status(400).json({ error: 'No files found for this PDF conversation' });
    }
    
    // Prepare the user message content array
    let userMessageContent = [];
    let messageText = message;
    
    // Process files for any chat type if files are present
    if (files.length > 0) {
      // Format document content with XML structure for better context handling
      let documentContent = '<documents>\n';
      
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Read the file and convert to base64
        const fileBuffer = fs.readFileSync(file.file_path);
        const base64Data = fileBuffer.toString('base64');
        
        // Add document to XML structure
        documentContent += `  <document index="${i+1}">\n`;
        documentContent += `    <source>${file.file_name}</source>\n`;
        
        // Add file content to message based on file type
        if (file.file_type === 'application/pdf') {
          userMessageContent.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            }
          });
        } else if (file.file_type.startsWith('image/')) {
          userMessageContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.file_type,
              data: base64Data
            }
          });
        }
      }
      
      // Close the XML structure
      documentContent += '</documents>\n\n';
      
      // Add document content to the message
      messageText = documentContent + message;
    }
    
    // Add the user's message text at the end
    userMessageContent.push({
      type: 'text',
      text: messageText
    });
    
    // Prepare the messages for Claude
    const userMessage = {
      role: 'user',
      content: userMessageContent
    };
    
    // Create messages array
    let messageArray = [userMessage];
    
    // Add conversation history if available
    if (conversationHistory && conversationHistory.length > 0) {
      // Add previous messages to the conversation
      messageArray = [...conversationHistory, ...messageArray];
    } else if (conversationId) {
      // If conversationId is provided but no history, fetch from database
      const messages = db.prepare(`
        SELECT role, content
        FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `).all(conversationId);
      
      if (messages.length > 0) {
        messageArray = [...messages, ...messageArray];
      }
    }
    
    // Create a system prompt based on conversation type
    let systemPrompt;
    let temperature = 0.4;
    
    if (chatType === 'pdf') {
      // System prompt for PDF analysis
      systemPrompt = `You are an intelligent assistant created by Sepehr Radmard for Super Chat.
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
      systemPrompt = `You are a multilingual helpful assistant created by Sepehr Radmard for Super Chat.
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
      
      // Use a slightly higher temperature for normal chat
      temperature = 0.5;
    }
    
    // Add system prompt as the first message from the assistant
    const messagesWithSystem = [
      { role: 'assistant', content: systemPrompt },
      ...messageArray
    ];
    
    // Check if streaming is requested
    if (stream) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if using Nginx
      
      try {
        // Create a streaming request to Anthropic API with dynamic temperature
        const stream = await anthropic.messages.stream({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 64000, // Increased from 4096 to utilize the 128k capacity
          temperature: temperature,
          messages: messagesWithSystem
        });

        // If conversationId is provided, save the user message first
        if (conversationId) {
          try {
            // Save user message
            const insertUserMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertUserMessage.run(conversationId, 'user', message);
          } catch (dbError) {
            console.error('Error saving user message to database:', dbError);
          }
        }
        
        // Variable to accumulate the full assistant response
        let fullAssistantResponse = '';
        
        // Forward each event from Anthropic to the client
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && 'delta' in event) {
            // Send text deltas to the client
            if (event.delta.type === 'text_delta') {
              // Accumulate the response for saving to database
              fullAssistantResponse += event.delta.text;
              
              // Send to client
              res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
            }
          } else if (event.type === 'message_stop') {
            // End of message
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            
            // Save the assistant message to database if conversationId is provided
            if (conversationId && fullAssistantResponse.length > 0) {
              try {
                // In case this is the first message in a normal chat conversation, ensure type is set correctly
                if (chatType === 'normal') {
                  // Update conversation type to ensure it's 'normal'
                  const updateConvType = db.prepare(`
                    UPDATE conversations 
                    SET type = 'normal' 
                    WHERE id = ? AND type = 'pdf'
                  `);
                  updateConvType.run(conversationId);
                }
              
                // Save assistant message
                const insertAssistantMessage = db.prepare(`
                  INSERT INTO messages (conversation_id, role, content)
                  VALUES (?, ?, ?)
                `);
                insertAssistantMessage.run(conversationId, 'assistant', fullAssistantResponse);
                
                // Update conversation's updated_at timestamp with current ISO timestamp
                const currentTime = getCurrentISOTimestamp();
                db.prepare(`
                  UPDATE conversations
                  SET updated_at = ?
                  WHERE id = ?
                `).run(currentTime, conversationId);
              } catch (dbError) {
                console.error('Error saving assistant message to database:', dbError);
              }
            }
          }
        }
        
        // End the response
        res.end();
      } catch (apiError) {
        console.error('Anthropic API Streaming Error:', apiError);
        res.write(`data: ${JSON.stringify({ 
          error: 'Error calling Claude API', 
          details: apiError.message || 'Unknown error'
        })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming request
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 64000, // Increased from 4096 to utilize the 128k capacity
          temperature: temperature,
          messages: messagesWithSystem
        });
        
        // Get the assistant's response text
        const assistantResponse = response.content[0].text;
        
        // If conversationId is provided, save the messages
        if (conversationId) {
          try {
            // In case this is the first message in a normal chat conversation, ensure type is set correctly
            if (chatType === 'normal') {
              // Update conversation type to ensure it's 'normal'
              const updateConvType = db.prepare(`
                UPDATE conversations 
                SET type = 'normal' 
                WHERE id = ? AND type = 'pdf'
              `);
              updateConvType.run(conversationId);
            }
          
            // Save user message
            const insertUserMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertUserMessage.run(conversationId, 'user', message);
            
            // Save assistant message
            const insertAssistantMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertAssistantMessage.run(conversationId, 'assistant', assistantResponse);
            
            // Update conversation's updated_at timestamp with current ISO timestamp
            const currentTime = getCurrentISOTimestamp();
            db.prepare(`
              UPDATE conversations
              SET updated_at = ?
              WHERE id = ?
            `).run(currentTime, conversationId);
          } catch (dbError) {
            console.error('Error saving messages to database:', dbError);
          }
        }
        
        // Return the response
        res.status(200).json(response);
      } catch (apiError) {
        console.error('Anthropic API Error:', apiError);
        res.status(500).json({ 
          error: 'Error calling Claude API', 
          details: apiError.message || 'Unknown error'
        });
      }
    }
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

module.exports = router;