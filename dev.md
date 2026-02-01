# BMM V3 - Development Documentation

## 🏗️ Architecture Overview

BMM V3 is a modular WhatsApp bot framework built with Node.js, utilizing the Baileys library for WhatsApp Web API integration and Supabase for cloud database operations.

### Core Components

#### 1. **Entry Point** (`src/index.js`)
- Main application bootstrap
- WhatsApp connection management
- Session initialization and restoration
- Memory management and monitoring
- Graceful shutdown handling

#### 2. **Message Handler** (`src/handler/messageHandler.js`)
- Central message processing hub
- Command routing and execution
- Feature integration and coordination
- Event-driven architecture

#### 3. **Command System** (`src/handler/command/`)
- Modular command handlers
- Dynamic menu system
- Permission-based access control
- Command registry and aliases

#### 4. **Database Layer** (`src/database/`)
- SQLite for local storage
- Supabase integration for cloud sync
- Session management
- Configuration persistence

#### 5. **Feature Modules** (`src/handler/features/`)
- Specialized functionality
- Reusable components
- Event handlers
- Automation systems

## 📊 Database Schema

### SQLite Tables

#### `users`
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  user_lid TEXT,
  user_name TEXT,
  auth_id TEXT,
  mode TEXT DEFAULT 'private',
  prefix TEXT DEFAULT '.',
  status_view_mode INTEGER DEFAULT 0,
  react_to_command INTEGER DEFAULT 0,
  followed_teams TEXT DEFAULT '[]',
  chatbot_enabled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `welcome_settings`
```sql
CREATE TABLE welcome_settings (
  group_id TEXT,
  bot_id TEXT,
  welcome_enabled INTEGER DEFAULT 0,
  goodbye_enabled INTEGER DEFAULT 0,
  show_fame INTEGER DEFAULT 1,
  PRIMARY KEY (group_id, bot_id)
);
```

#### `antilink_settings`
```sql
CREATE TABLE antilink_settings (
  group_id TEXT,
  bot_id TEXT,
  mode TEXT DEFAULT 'off',
  warn_limit INTEGER DEFAULT 2,
  bypass_admins INTEGER DEFAULT 1,
  PRIMARY KEY (group_id, bot_id)
);
```

#### `antidelete_settings`
```sql
CREATE TABLE antidelete_settings (
  user_id TEXT PRIMARY KEY,
  mode TEXT DEFAULT 'off',
  forward_to_dm INTEGER DEFAULT 0
);
```

#### `bot_activity`
```sql
CREATE TABLE bot_activity (
  user TEXT,
  bot TEXT,
  action TEXT,
  time INTEGER
);
```

#### `adventure_games`
```sql
CREATE TABLE adventure_games (
  player_id TEXT PRIMARY KEY,
  game_state TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Supabase Tables

#### `hall_of_fame`
```sql
CREATE TABLE hall_of_fame (
  id SERIAL PRIMARY KEY,
  community_jid TEXT,
  community_name TEXT,
  user_jid TEXT,
  league TEXT,
  team TEXT,
  trophies INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Command System Architecture

### Command Registry
Located in `src/handler/command/commandRegistry.js`, this central registry defines:
- Command metadata (description, usage, category)
- Permission levels (owner, admin, user)
- Command aliases
- Category organization

### Command Handler Flow
1. **Message Reception**: `messageHandler.js` receives incoming messages
2. **Command Extraction**: Extracts command and arguments from message
3. **Permission Check**: Validates user permissions
4. **Command Execution**: Routes to appropriate command handler
5. **Response Generation**: Returns formatted response to user

### Command Categories
1. **Core**: Bot control, settings, information
2. **Moderation**: Anti-link, warnings, admin tools
3. **Group**: Management, statistics, settings
4. **Media**: Stickers, images, video downloads
5. **Sports**: Football updates, team tracking
6. **Games**: Word chain, trivia, adventure
7. **Utilities**: Time, disk, system tools
8. **AI**: Chatbot, status automation
9. **Fun**: Emoji reactions, quotes, facts
10. **Features**: Advanced bot capabilities

## 🎯 Feature Modules

### Hall of Fame System
**Location**: `src/handler/command/hallOfFame.js`

**Key Functions**:
- `addFame()`: Add users to Hall of Fame
- `showFame()`: Display Hall of Fame rankings
- `getCommunityInfo()`: Fetch community metadata

**Database Integration**:
- Uses Supabase for cloud storage
- Trophy counting and ranking
- Community-based organization

### Welcome System
**Location**: `src/handler/features/welcome.js`

**Features**:
- Customizable welcome messages
- Group information display
- Rule presentation
- Hall of Fame integration
- Goodbye messages

**Configuration**:
- Per-group enable/disable
- Hall of Fame toggle
- Custom message templates

### Update System
**Location**: `src/handler/command/updateCommand.js`, `src/handler/features/gitUpdate.js`

**Update Commands**:
- `.update`: Check for updates
- `.update bot`: Normal update
- `.update force`: Force update

**Git Integration**:
- Automatic version checking
- Safe update procedures
- Rollback capabilities
- Automatic restart

## 🔐 Security Architecture

### Permission System
Three-tier permission model:

1. **Owner Only**: Critical operations
   - Bot restart/shutdown
   - System configuration
   - Update deployment

2. **Admin Only**: Group management
   - Member management
   - Group settings
   - Moderation tools

3. **User Level**: General features
   - Entertainment commands
   - Information requests
   - Personal settings

### Session Management
**Location**: `src/database/sqliteAuthState.js`

**Features**:
- Encrypted session storage
- Automatic session restoration
- Multi-device support
- Session cleanup on disconnect

### Data Protection
- Local SQLite backup
- Optional cloud sync with Supabase
- Secure API key management
- Memory optimization

## 🚀 Performance Optimization

### Memory Management
```javascript
// Automatic garbage collection
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // Every 1 minute

// Memory monitoring with auto-restart
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 300) {
        console.log('⚠️ RAM too high (>300MB), restarting bot...')
        process.exit(1)
    }
}, 30_000) // Every 30 seconds
```

### Session Optimization
- Efficient session storage
- Automatic cleanup
- Memory leak prevention
- Connection pooling

### Message Processing
- Event-driven architecture
- Async message handling
- Queue management
- Error recovery

## 🔌 API Integration

### Supabase Client
**Location**: `src/supabaseClient.js`

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### External APIs
- **Football Data**: League updates, match results
- **YouTube**: Video downloads, metadata
- **Timezone**: World clock functionality
- **Media Processing**: Image/video manipulation

## 🧩 Development Guidelines

### Adding New Commands

1. **Create Command Handler**
```javascript
// src/handler/command/newCommand.js
async function newCommand(sock, msg, args) {
  // Command logic here
}

module.exports = newCommand;
```

2. **Register Command**
```javascript
// src/handler/command/commandRegistry.js
newCommand: {
  description: 'Command description',
  usage: 'newCommand [args]',
  category: 'Category',
  ownerOnly: false // or adminOnly: true
}
```

3. **Add to Handler**
```javascript
// src/handler/commandHandler.js
case 'newCommand':
  await newCommand(sock, msg, args);
  break;
```

### Adding New Features

1. **Create Feature Module**
```javascript
// src/handler/features/newFeature.js
async function handleNewFeature(sock, msg) {
  // Feature logic here
}

module.exports = handleNewFeature;
```

2. **Integrate with Message Handler**
```javascript
// src/handler/messageHandler.js
const handleNewFeature = require('./features/newFeature');

// Add to message processing pipeline
await handleNewFeature(sock, msg);
```

### Database Operations

#### SQLite Operations
```javascript
const { db } = require('./database');

// Query
const result = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

// Insert
db.prepare('INSERT INTO users (user_id, user_name) VALUES (?, ?)').run(userId, userName);

// Update
db.prepare('UPDATE users SET mode = ? WHERE user_id = ?').run(newMode, userId);
```

#### Supabase Operations
```javascript
const { supabase } = require('../supabaseClient');

// Query
const { data, error } = await supabase
  .from('hall_of_fame')
  .select('*')
  .eq('community_jid', communityJid);

// Insert
const { data, error } = await supabase
  .from('hall_of_fame')
  .insert([newEntry]);

// Update
const { data, error } = await supabase
  .from('hall_of_fame')
  .update({ trophies: newCount })
  .eq('id', entryId);
```

## 🐛 Debugging & Testing

### Logging Strategy
- Structured logging with Pino
- Error tracking and reporting
- Performance monitoring
- Debug mode for development

### Common Issues

1. **Session Problems**
   - Check SQLite database integrity
   - Verify Supabase connection
   - Clear corrupted sessions

2. **Memory Leaks**
   - Monitor RAM usage
   - Check for event listener leaks
   - Review async operations

3. **Command Failures**
   - Verify command registration
   - Check permission settings
   - Review argument parsing

### Testing Commands
```bash
# Test bot responsiveness
.ping

# Check system status
.settings

# Verify database connection
.group stats

# Test update system
.update
```

## 📦 Deployment

### Environment Setup
```bash
# Production dependencies
npm install --production

# Environment variables
cp .env.example .env
# Edit .env with configuration
```

### Docker Deployment
```dockerfile
FROM node:21-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["npm", "start"]
```

### Process Management
- PM2 for production
- Automatic restart on failure
- Log rotation
- Health checks

## 🔮 Future Development

### Planned Features
1. **Web Dashboard**: Real-time bot management
2. **API Endpoints**: RESTful API for integration
3. **Plugin System**: Dynamic feature loading
4. **Multi-Language**: Internationalization support
5. **Analytics**: Advanced usage analytics

### Architecture Improvements
1. **Microservices**: Service separation
2. **Message Queuing**: Redis integration
3. **Caching**: Redis for performance
4. **Load Balancing**: Multi-instance support

## 📚 Resources

### Documentation
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Supabase Documentation](https://supabase.com/docs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### Tools & Libraries
- **Baileys**: WhatsApp Web API
- **Supabase**: Backend-as-a-Service
- **SQLite**: Local database
- **Pino**: Structured logging
- **Socket.IO**: Real-time communication

---

**Version**: 3.6.4  
**Last Updated**: 2026-02-01  
**Maintainer**: Toluwalase Ojabineni

For technical support or questions, please refer to the main README.md or create an issue on GitHub.
