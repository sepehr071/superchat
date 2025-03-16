const openRouterService = require('../services/openrouter.service');
const { db, getCurrentISOTimestamp } = require('../config/database');

/**
 * Handle research chat requests
 */
exports.researchChat = async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    
    if (!conversationId || !message) {
      return res.status(400).json({ error: 'Conversation ID and message are required' });
    }

    // Get the conversation and verify it belongs to the user
    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND user_id = ?'
    ).get(conversationId, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get all previous messages in this conversation
    const previousMessages = db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC'
    ).all(conversationId);

    // Add the new user message to the database
    const insertMessage = db.prepare(
      'INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)'
    );
    
    const timestamp = getCurrentISOTimestamp();
    insertMessage.run(conversationId, 'user', message, timestamp);

    // Update conversation updated_at time
    db.prepare(
      'UPDATE conversations SET updated_at = ? WHERE id = ?'
    ).run(timestamp, conversationId);

    // Format messages for the API
    const apiMessages = previousMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Add the new message
    apiMessages.push({ role: 'user', content: message });

    
    // Check if streaming is requested
    const shouldStream = req.query.stream === 'true';
    
    if (shouldStream) {
      // Set up SSE headers for streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      try {
        // Call the OpenRouter API with streaming enabled
        const stream = await openRouterService.researchChat(apiMessages, true);
        
        let assistantResponse = '';
        
        // Process the streaming response
        for await (const chunk of stream) {
          // Extract content from the chunk
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            assistantResponse += content;
            
            // Send the chunk to the client
            res.write(`data: ${JSON.stringify({ 
              content,
              done: false
            })}\n\n`);
          }
        }
        
        // Save assistant's response to the database
        const insertMessage = db.prepare(
          'INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)'
        );
        insertMessage.run(conversationId, 'assistant', assistantResponse, getCurrentISOTimestamp());
        
        // Update conversation title for new conversations if needed
        if (conversation.title === 'New Chat' && previousMessages.length === 0) {
          // Use the first part of the message as the title (up to 50 chars)
          let title = message.substring(0, 50);
          if (message.length > 50) title += '...';
          
          db.prepare(
            'UPDATE conversations SET title = ? WHERE id = ?'
          ).run(title, conversationId);
        }
        
        // Send completion message
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        
      } catch (error) {
        console.error('Streaming research chat error:', error);
        res.write(`data: ${JSON.stringify({ 
          error: 'Failed to process streaming research chat request',
          details: error.message,
          done: true
        })}\n\n`);
        res.end();
      }
      
      return;
    }

    // Non-streaming flow
    try {
      // Call the OpenRouter API for research
      const completion = await openRouterService.researchChat(apiMessages, false);
    
  
      // Check if the response has choices
      if (!completion.choices || completion.choices.length === 0) {
        throw new Error('Invalid response from OpenRouter API');
      }
      
      // Extract assistant's response
      const assistantMessage = completion.choices[0].message.content;

      
      // Save assistant's response to the database
      insertMessage.run(conversationId, 'assistant', assistantMessage, getCurrentISOTimestamp());

      
      // Generate title for new conversations
      if (conversation.title === 'New Chat' && previousMessages.length === 0) {
        // Use the first part of the message as the title (up to 50 chars)
        let title = message.substring(0, 50);
        if (message.length > 50) title += '...';
      
  
        db.prepare(
          'UPDATE conversations SET title = ? WHERE id = ?'
        ).run(title, conversationId);
      }
      
      // Return the assistant's response to the client
      res.status(200).json({
        message: assistantMessage,
        conversationId
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Research chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process research chat request',
      details: error.message
    });
  }
};

/**
 * Create a new research conversation
 */
exports.createResearchConversation = (req, res) => {
  try {
    const userId = req.user.id;
    const { title = 'New Chat' } = req.body;
    
    // Insert new conversation with type 'research'
    const insertConversation = db.prepare(
      'INSERT INTO conversations (user_id, title, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    
    const timestamp = getCurrentISOTimestamp();
    const result = insertConversation.run(userId, title, 'research', timestamp, timestamp);
    
    const conversationId = result.lastInsertRowid;
    
    res.status(201).json({
      message: 'Research conversation created',
      conversationId
    });
  } catch (error) {
    console.error('Create research conversation error:', error);
    res.status(500).json({ error: 'Failed to create research conversation' });
  }
};