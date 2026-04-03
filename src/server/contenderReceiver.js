const express = require('express');
const cors = require('cors');

class ContenderReceiverServer {
  constructor(sock) {
    this.app = express();
    this.port = 3000; // Changed to avoid port conflict
    this.sock = sock;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`🔗 [SERVER] ${req.method} ${req.path} - ${new Date().toISOString()}`);
      console.log(`📥 [SERVER] Request body:`, req.body);
      next();
    });
  }

  setupRoutes() {
    // Test endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Contender Receiver Server is running!',
        endpoints: [
          'POST /contender/new - Receive new contender'
        ]
      });
    });

    /**
     * POST /contender/new
     * Backend calls this when a new contender is available
     */
    this.app.post('/contender/new', async (req, res) => {
      try {
        const { contender } = req.body;
        
        if (!contender) {
          return res.status(400).json({
            success: false,
            error: 'Contender data is required'
          });
        }

        // Validate required fields
        if (!contender.id || !contender.name || !contender.email) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: id, name, email'
          });
        }

        console.log(`🏆 [SERVER] Received new contender: ${contender.name}`);

        // Call web.js function to handle the contender
        const { processNewContender } = require('../utils/web');
        const result = await processNewContender(this.sock, contender);

        // Respond to backend
        res.json({
          success: true,
          message: 'Contender received and processing started',
          data: {
            contenderId: contender.id,
            result: result
          }
        });

        console.log(`📊 [SERVER] Contender ${contender.name} passed to web.js for processing`);

      } catch (error) {
        console.error('❌ [SERVER] Error processing contender:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('❌ [SERVER] Server error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`🚀 [SERVER] Contender Receiver Server started on port ${this.port}`);
      console.log(`📡 [SERVER] Backend calls: POST http://localhost:${this.port}/contender/new`);
    });

    // Graceful shutdown
    this.server.on('close', () => {
      console.log('🛑 [SERVER] Server shut down');
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = ContenderReceiverServer;
