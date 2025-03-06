# Claude PDF Chat (JavaScript Version)

A simple web application that allows users to upload a PDF and chat with Claude about its contents. This version uses plain HTML, CSS, and JavaScript for the frontend and Node.js with Express for the backend.

## Features

- PDF upload functionality
- Chat interface with Claude AI about the uploaded PDF
- Streaming responses for a better user experience
- Mobile-responsive design
- Simplified interface without PDF viewer

## Prerequisites

- Node.js (v18 or higher)
- An Anthropic API key

## Installation

1. Clone the repository or download the source code

2. Install server dependencies:
   ```bash
   cd js-version/server
   npm install
   ```

3. Configure your Anthropic API key:
   - Edit the `.env` file in the server directory
   - Add your API key: `ANTHROPIC_API_KEY=your_api_key_here`

## Running the Application

1. Start the server:
   ```bash
   cd js-version/server
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:5050
   ```

## How to Use

1. Upload a PDF file (up to 32MB)
2. Once uploaded, you'll see the chat interface
3. Ask questions about the PDF content
4. Claude will analyze the PDF and respond to your questions

## Project Structure

```
js-version/
├── client/
│   ├── index.html         # Main HTML page
│   ├── styles.css         # CSS styles
│   ├── app.js             # Main JavaScript file
│   ├── chatInterface.js   # Chat interface functionality
│   └── pdfUploader.js     # PDF upload functionality
├── server/
│   ├── index.js           # Express server
│   ├── package.json       # Server dependencies
│   ├── .env               # Environment variables
│   └── uploads/           # Directory for uploaded PDFs
└── README.md              # Project documentation
```

## Technologies Used

- **Frontend**:
  - HTML5
  - CSS3
  - JavaScript (ES6+)

- **Backend**:
  - Node.js
  - Express
  - Anthropic API (Claude)

## License

This project is open source and available under the MIT License.
