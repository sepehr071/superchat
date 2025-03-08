# SuperChat - AI-Powered Document Chat Application

SuperChat is a full-stack application that allows users to chat with documents using Claude AI. It features a modern, intuitive interface with specialized tools for document analysis, regular conversations, and upcoming advanced features.

## Features

- 📄 PDF and document chat - Upload documents and ask questions about their content
- 🖼️ Image analysis - Process and discuss images with the AI
- 💬 Regular chat - Have normal conversations without document context
- 🔍 Deep Research - *(Coming Soon)* Advanced research with web browsing capability 
- 🎙️ Media to Text - *(Coming Soon)* Convert audio and video to text transcripts
- 🎯 Specialized interfaces - Dedicated UIs for different chat modes
- 🛡️ Responsive design - Works seamlessly on desktop and mobile devices
- 👥 User accounts - Register, login, and manage your conversations
- 🔒 Authentication - Secure user accounts with JWT
- 📊 Admin dashboard - View stats, manage users and conversations

## Architecture

### Client

The client is a JavaScript-based web application that provides the user interface for interacting with the AI and managing documents and conversations.

- HTML, CSS, and vanilla JavaScript
- Clean, modern responsive interface
- Real-time streaming AI responses
- Specialized interfaces for different chat types

### User Interfaces

SuperChat provides several specialized interfaces for different use cases:

1. **Dashboard** - The main hub for accessing all tools and viewing recent conversations
2. **Normal Chat** - For general conversations with Claude AI without document context
3. **PDF Chat** - For uploading and discussing document content with the AI
4. **Deep Research** - *(Coming Soon)* For research with web browsing capabilities
5. **Media to Text** - *(Coming Soon)* For converting audio/video to text

Each interface is optimized for its specific use case:
- **Normal Chat** focuses on pure conversation with the AI
- **PDF Chat** includes document upload and management features
- The dashboard provides a unified view of all tools and recent conversations
- Coming soon interfaces provide previews of upcoming features

### Server

The server is built with Node.js and Express, using a modular architecture for maintainability and scalability.

#### Key Components:

- **Authentication System**: User registration, login, token management
- **Document Processing**: PDF parsing and image handling
- **Conversation Management**: Storing and retrieving conversation history
- **Claude AI Integration**: Communication with Anthropic's Claude API
- **Admin Dashboard**: System monitoring and user management tools

#### Directory Structure:

```
server/
├── config/           # Configuration files
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── routes/           # API route definitions
├── services/         # Business logic services
├── utils/            # Utility functions
├── data/             # SQLite database files
├── uploads/          # Uploaded files storage
├── app.js            # Express app setup
└── server.js         # Server entry point
```

## Database

The application uses SQLite for data storage with the following main tables:

- **users**: User accounts
- **conversations**: Conversation metadata
- **messages**: Individual messages in conversations
- **pdf_files**: Uploaded document files
- **message_files**: Relationship between messages and files

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info

### Conversations

- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations/create-empty` - Create new conversation
- `PUT /api/conversations/:id` - Update conversation title
- `DELETE /api/conversations/:id` - Delete conversation

### Files

- `POST /api/files/upload` - Upload files and create conversation
- `POST /api/files/conversations/:id` - Add files to existing conversation
- `POST /api/files/export-table` - Export table to PDF
- `DELETE /api/conversations/:id/files/:fileId` - Delete file

### Chat

- `POST /api/chat` - Process chat message with Claude AI

### Admin

- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:userId` - Get user details
- `GET /api/admin/users/:userId/conversations` - List user conversations
- `GET /api/admin/conversations/:chatId` - Get conversation details
- `DELETE /api/admin/conversations/:chatId` - Delete conversation
- `PUT /api/admin/users/:userId/role` - Update user role
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/stats` - Get system statistics

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/superchat.git
   cd superchat
   ```

2. Install server dependencies:
   ```
   cd server
   npm install
   ```

3. Configure environment variables:
   Create a `.env.new` file in the server directory with the following variables:
   ```
   PORT=5000
   JWT_SECRET=your_jwt_secret_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   NODE_ENV=development
   ```

4. Start the server:
   ```
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

### Navigation Guide

- **Dashboard**: Access all tools and recent conversations at `/new-dashboard.html`
- **Normal Chat**: Start a general AI conversation at `/normal-chat.html`
- **PDF Chat**: Upload and discuss documents at `/pdf-chat.html`
- **Admin Panel**: Manage users and system settings at `/admin-dashboard.html` (admin only)

### Default Admin Account

On first run, the system creates a default admin account:
- Username: god
- Password: god

## License

This project is licensed under the MIT License.
