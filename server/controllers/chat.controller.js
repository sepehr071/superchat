const fs = require('fs');
const path = require('path');
const { db, getCurrentISOTimestamp } = require('../config/database');
const claudeService = require('../services/claude.service');
const nameGenerator = require('../services/name-generator.service');

/**
 * Process chat message and get response from Claude AI
 */
exports.processChat = async (req, res) => {
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
    
    // Check if streaming is requested
    if (stream) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if using Nginx
      
      try {
        // Create a streaming request to Anthropic API
        const stream = await claudeService.createMessageStream(messageArray, chatType);

        // If conversationId is provided, save the user message first
        if (conversationId) {
          try {
            // Check if this is the first message in the conversation
            const messageCount = db.prepare(`
              SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
            `).get(conversationId).count;
            
            // Save user message
            const insertUserMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertUserMessage.run(conversationId, 'user', message);
            
            // If this is the first message, generate a chat title
            if (messageCount === 0) {
              try {
                // Generate chat name based on first message
                const generatedTitle = await nameGenerator.generateChatName(message);
                
                // Update conversation title
                db.prepare(`
                  UPDATE conversations
                  SET title = ?, auto_generated_title = 1
                  WHERE id = ?
                `).run(generatedTitle, conversationId);
                
                // Send title to client
                res.write(`data: ${JSON.stringify({ 
                  titleUpdate: generatedTitle 
                })}\n\n`);
                
              } catch (titleError) {
                console.error('Error generating chat title:', titleError);
              }
            }
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
        const response = await claudeService.createMessage(messageArray, chatType);
        
        // Get the assistant's response text
        const assistantResponse = response.content[0].text;
        
        // If conversationId is provided, save the messages
        if (conversationId) {
          try {
            // Check if this is the first message in the conversation
            const messageCount = db.prepare(`
              SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
            `).get(conversationId).count;
            
            // Save user message
            const insertUserMessage = db.prepare(`
              INSERT INTO messages (conversation_id, role, content)
              VALUES (?, ?, ?)
            `);
            insertUserMessage.run(conversationId, 'user', message);
            
            // If this is the first message, generate a chat title
            let generatedTitle = null;
            if (messageCount === 0) {
              try {
                // Generate chat name based on first message
                generatedTitle = await nameGenerator.generateChatName(message);
                
                // Update conversation title
                db.prepare(`
                  UPDATE conversations
                  SET title = ?, auto_generated_title = 1
                  WHERE id = ?
                `).run(generatedTitle, conversationId);
              } catch (titleError) {
                console.error('Error generating chat title:', titleError);
              }
            }
            
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
        // along with the generated title if available
        const responseData = { ...response };
        if (generatedTitle) {
          responseData.titleUpdate = generatedTitle;
        }
        res.status(200).json(responseData);
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
};