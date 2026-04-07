![BMM Banner](/src/assets/BMM.jpg)

# BMM V3.8.7 - Advanced WhatsApp Bot Framework

**BMM (Bot Management Module) Version 3.8.7** is a comprehensive, enterprise-grade WhatsApp bot framework built with Node.js, Baileys, and Supabase. It features advanced automation capabilities, modular architecture, and production-ready deployment options for communities and businesses.

## 🚀 Key Features

### 🤖 Core Bot Engine
- **Multi-Instance Support**: Run multiple WhatsApp sessions with isolated management
- **Advanced Command System**: 70+ commands across 12 categories with modular handlers
- **Real-time Updates**: Git-based update checking with automatic deployment
- **Memory Optimization**: Automatic garbage collection and RAM monitoring with auto-restart
- **Session Management**: SQLite + Supabase hybrid storage with multi-device support
- **Graceful Shutdown**: Clean process termination with session preservation

### 🛡️ Advanced Moderation & Security
- **Anti-Link Protection**: Configurable link blocking with intelligent detection
- **Anti-Delete System**: Message recovery and forwarding capabilities
- **Admin Management**: Promote/demote/kick with granular permission checks
- **Group Controls**: Advanced group management with metadata controls
- **Warn System**: Multi-level warning with auto-kick functionality
- **Permission System**: Three-tier access control (Owner/Admin/User)

### 🎮 Entertainment & Media Suite
- **Interactive Games**: Word chain, trivia, adventure games with persistence
- **Media Tools**: Sticker creation, image processing, video downloads
- **Sports Integration**: Real-time football updates and team tracking
- **Fun Commands**: Emoji reactions, quotes, facts, and entertainment
- **Newsletter Support**: Auto-reaction to newsletter posts

### 📊 Analytics & Management
- **Group Statistics**: 30-day activity tracking with member rankings
- **Status Automation**: Advanced status viewing with intelligent reacting
- **Hall of Fame System**: Community recognition with trophy tracking
- **Web Dashboard**: Real-time bot monitoring (optional)
- **Performance Monitoring**: CPU, memory, and connection tracking

### 🤖 AI Integration
- **Smart Chatbot**: Contextual AI responses with personality
- **Status Intelligence**: Automated status viewing and reaction
- **Command Intelligence**: Natural language processing for commands

## 📋 Prerequisites

### System Requirements
- **Node.js**: Version 21 or higher
- **Git**: For version control and updates
- **WhatsApp**: Account for bot registration
- **Supabase**: Account for cloud database (recommended)

### Optional Dependencies
- **PM2**: Process management for production
- **Docker**: Containerized deployment
- **Fly.io**: Cloud platform deployment

## 🛠️ Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/ojuolokun86/BMM-PE.git
cd BMM-PE
```

### 2. Install Dependencies
```bash
# Install all dependencies
npm install

# Install production dependencies only
npm install --production
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# Supabase Configuration (Required for Hall of Fame & Cloud Sync)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Bot Configuration
BOT_NAME=BMM
BOT_VERSION=3.8.7
DEFAULT_PREFIX=.
BOT_OWNER_NUMBER=2348026977793

# Feature Toggles
CHATBOT_ENABLED=false
STATUS_VIEW_MODE=0
REACT_TO_COMMAND=true

# Advanced Configuration
MAX_RAM_USAGE=300
AUTO_RESTART=true
LOG_LEVEL=info
```

### 4. Initialize Database
The bot automatically creates and initializes the SQLite database on first run:
- Users table with settings
- Group configurations
- Session management
- Activity tracking

### 5. Start Bot
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start

# Direct execution
npm run bmm
```

### 6. WhatsApp Pairing
1. **QR Code Method**: Scan QR code displayed in terminal
2. **Phone Pairing**: Enter phone number for pairing code
3. **Session Management**: Automatic save and restore with fallback options

## 📱 Command Reference

### 🔧 Core Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.menu` | Display all available commands | `.menu` | User |
| `.help [command]` | Get help for specific commands | `.help ping` | User |
| `.ping` | Check bot responsiveness | `.ping` | User |
| `.settings` | View current configuration | `.settings` | User |
| `.info` | Bot information | `.info` | User |

### 👥 Group Management
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.group stats` | Show activity statistics | `.group stats` | Admin |
| `.group desc <text>` | Set group description | `.group desc Welcome!` | Admin |
| `.group pic` | Set group profile picture | `.group pic` | Admin |
| `.group link` | Get group invite link | `.group link` | Admin |
| `.welcome` | Configure welcome messages | `.welcome` | Admin |
| `.mute` | Mute group notifications | `.mute 1h` | Admin |
| `.unmute` | Unmute group | `.unmute` | Admin |

### 🏆 Hall of Fame System
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.hall @user League Team` | Add to Hall of Fame | `.hall @user Premier League "Man City"` | Admin |
| `.fame` | Display Hall of Fame | `.fame` | User |
| `.fame stats` | Show Hall of Fame statistics | `.fame stats` | User |
| `.fame remove @user` | Remove from Hall of Fame | `.fame remove @user` | Admin |

### 🛡️ Moderation Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.kick @user [reason]` | Remove user from group | `.kick @user Spam` | Admin |
| `.warn @user [reason]` | Warn user | `.warn @user Spamming` | Admin |
| `.delwarn @user` | Remove user warning | `.delwarn @user` | Admin |
| `.antilink` | Configure anti-link | `.antilink on` | Admin |
| `.antidelete` | Configure anti-delete | `.antidelete on` | Admin |
| `.delete` | Delete bot message | `.delete` | Admin |

### 🎮 Entertainment Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.game` | Start interactive games | `.game trivia` | User |
| `.wordchain` | Word chain game | `.wordchain` | User |
| `.trivia` | Trivia questions | `.trivia` | User |
| `.fact` | Random facts | `.fact` | User |
| `.quote` | Random quotes | `.quote` | User |
| `.react` | React to messages | `.react 😂` | User |

### 📺 Media & Content Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.sticker` | Create sticker from image | `.sticker` | User |
| `.img` | Convert sticker to image | `.img` | User |
| `.play [song]` | Play audio in group | `.play Despacito` | User |
| `.ytdl [url]` | Download YouTube video | `.ytdl https://...` | User |
| `.bg [image]` | Set background | `.bg` | User |

### ⚽ Sports Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.football` | Football updates | `.football` | User |
| `.team [name]` | Team information | `.team Man City` | User |
| `.matches` | Upcoming matches | `.matches` | User |
| `.scores` | Recent scores | `.scores` | User |

### 🤖 AI Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.ai [message]` | Chat with AI | `.ai Hello` | User |
| `.chatbot` | Toggle AI chatbot | `.chatbot on` | Admin |
| `.imagine [prompt]` | Generate AI images | `.imagine cat` | User |

### ⚙️ Utility Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.time [location]` | Get time | `.time London` | User |
| `.disk` | Disk usage information | `.disk` | User |
| `.weather [city]` | Weather information | `.weather London` | User |
| `.news` | Latest news | `.news` | User |

### 🔧 System Commands
| Command | Description | Usage | Permissions |
|---------|-------------|---------|--------------|
| `.update` | Check for updates | `.update` | Owner |
| `.update bot` | Update normally | `.update bot` | Owner |
| `.update force` | Force update | `.update force` | Owner |
| `.restart` | Restart bot | `.restart` | Owner |
| `.shutdown` | Shutdown bot | `.shutdown` | Owner |
| `.logout` | Logout WhatsApp | `.logout` | Owner |

## 🏗️ Project Architecture

### Directory Structure
```
BMM-PE/
├── src/
│   ├── handler/
│   │   ├── command/          # Command handlers (70+ commands)
│   │   ├── features/         # Feature modules (14 modules)
│   │   ├── middleware/       # Authentication middleware
│   │   ├── commandHandler.js # Main command processor
│   │   └── messageHandler.js # Main message processor
│   ├── database/            # Database operations
│   │   ├── database.js       # Main database interface
│   │   ├── sqliteAuthState.js # Session management
│   │   └── [feature]Db.js  # Feature-specific databases
│   ├── utils/               # Utility functions
│   │   ├── globalStore.js    # Global state management
│   │   ├── sendToChat.js     # Message sending utilities
│   │   └── [feature].js     # Feature-specific utilities
│   ├── main/                # Core bot logic
│   │   ├── restart.js        # Restart management
│   │   └── [feature].js     # Core features
│   ├── server/              # Web server components
│   └── index.js            # Entry point
├── data/                   # Static data files
├── scripts/               # Helper scripts
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables
├── .env.example          # Environment template
├── Dockerfile            # Docker configuration
├── fly.toml             # Fly.io configuration
├── dev.md               # Development documentation
└── README.md             # This file
```

### Core Components

#### 1. **Entry Point** (`src/index.js`)
- WhatsApp connection management with Baileys v7
- Session initialization and restoration
- Memory monitoring with auto-restart
- Graceful shutdown handling
- Event-driven architecture

#### 2. **Message Handler** (`src/handler/messageHandler.js`)
- Central message processing hub
- Command routing and execution
- Feature integration and coordination
- Anti-delete and anti-link integration

#### 3. **Command System** (`src/handler/command/`)
- 70+ modular command handlers
- Dynamic menu system with categories
- Permission-based access control
- Command registry and aliases

#### 4. **Database Layer** (`src/database/`)
- SQLite for local storage and caching
- Supabase integration for cloud sync
- Session management with encryption
- Configuration persistence

#### 5. **Feature Modules** (`src/handler/features/`)
- Specialized functionality modules
- Reusable components and utilities
- Event handlers for automation
- Status viewing with intelligent reactions

## 🔧 Configuration

### Environment Variables
| Variable | Description | Default | Required |
|----------|-------------|---------|-----------|
| `SUPABASE_URL` | Supabase project URL | - | Required |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | - | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | - | Required |
| `DEFAULT_PREFIX` | Command prefix | `.` | Optional |
| `BOT_NAME` | Bot display name | `BMM` | Optional |
| `BOT_OWNER_NUMBER` | Owner WhatsApp number | - | Required |
| `CHATBOT_ENABLED` | Enable AI chatbot | `false` | Optional |
| `STATUS_VIEW_MODE` | Status viewing behavior | `0` | Optional |
| `REACT_TO_COMMAND` | Auto-react to commands | `true` | Optional |
| `MAX_RAM_USAGE` | RAM limit in MB | `300` | Optional |
| `AUTO_RESTART` | Enable auto-restart | `true` | Optional |

### Status View Modes
| Mode | Description |
|------|-------------|
| `0` | Status viewing disabled |
| `1` | View status only |
| `2` | View status and react with emoji |

### Database Schema

#### SQLite Tables
```sql
-- Users table
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

-- Welcome settings
CREATE TABLE welcome_settings (
  group_id TEXT,
  bot_id TEXT,
  welcome_enabled INTEGER DEFAULT 0,
  goodbye_enabled INTEGER DEFAULT 0,
  show_fame INTEGER DEFAULT 1,
  PRIMARY KEY (group_id, bot_id)
);

-- Anti-link settings
CREATE TABLE antilink_settings (
  group_id TEXT,
  bot_id TEXT,
  mode TEXT DEFAULT 'off',
  warn_limit INTEGER DEFAULT 2,
  bypass_admins INTEGER DEFAULT 1,
  PRIMARY KEY (group_id, bot_id)
);

-- Anti-delete settings
CREATE TABLE antidelete_settings (
  user_id TEXT PRIMARY KEY,
  mode TEXT DEFAULT 'off',
  forward_to_dm INTEGER DEFAULT 0
);

-- Group statistics
CREATE TABLE group_stats (
  group_id TEXT,
  user_id TEXT,
  message_count INTEGER DEFAULT 0,
  last_active DATETIME,
  PRIMARY KEY (group_id, user_id)
);

-- Adventure games
CREATE TABLE adventure_games (
  player_id TEXT PRIMARY KEY,
  game_state TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Supabase Tables
```sql
-- Hall of Fame
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

## 🚀 Deployment

### Local Development
```bash
# Clone repository
git clone https://github.com/ojuolokun86/BMM-PE.git
cd BMM-PE

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Deployment
```bash
# Install production dependencies
npm install --production

# Configure environment
cp .env.example .env
# Edit .env with production settings

# Start production server
npm start

# Or use PM2 for process management
pm2 start npm --name "bmm-bot" -- start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t bmm-bot .

# Run container
docker run -d \
  --name bmm-bot \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  bmm-bot
```

### Fly.io Deployment
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Authenticate
flyctl auth login

# Deploy
flyctl deploy

# Scale if needed
flyctl scale count 1
```

### PM2 Configuration
```json
{
  "name": "bmm-bot",
  "script": "npm start",
  "instances": 1,
  "autorestart": true,
  "watch": false,
  "max_memory_restart": "300M",
  "env": {
    "NODE_ENV": "production"
  }
}
```

## 📊 Features Deep Dive

### Command Categories
1. **Core** (8 commands): Bot control, settings, information
2. **Moderation** (12 commands): Anti-link, warnings, admin tools
3. **Group** (15 commands): Management, statistics, settings
4. **Media** (10 commands): Stickers, images, video downloads
5. **Sports** (8 commands): Football updates, team tracking
6. **Games** (6 commands): Word chain, trivia, adventure
7. **Utilities** (8 commands): Time, disk, system tools
8. **AI** (4 commands): Chatbot, status automation
9. **Fun** (6 commands): Emoji reactions, quotes, facts
10. **Features** (5 commands): Advanced bot capabilities

### Hall of Fame System
- **Community Recognition**: Track achievements across multiple groups
- **Trophy System**: Points-based ranking with leaderboards
- **League Integration**: Support for sports leagues and teams
- **Admin Control**: Add/remove/manage Hall of Fame entries
- **Automatic Display**: Show Hall of Fame to new group members

### Status Automation
- **Intelligent Viewing**: Automatically view new status updates
- **Smart Reactions**: React to status based on user settings
- **Rate Limiting**: Built-in protection against WhatsApp limits
- **Privacy Respect**: Honor user privacy settings
- **Error Recovery**: Automatic retry on failures

### Update System
- **Git Integration**: Automatic version checking from repository
- **Safe Updates**: Preserve local changes during updates
- **Rollback Support**: Revert problematic updates
- **Changelog Display**: Show what's new in each version
- **Auto-Restart**: Restart bot after successful updates

## 🛡️ Security & Performance

### Permission System
- **Owner Level**: Critical bot operations (restart, update, shutdown)
- **Admin Level**: Group management and moderation tools
- **User Level**: General commands and entertainment features

### Data Protection
- **Encrypted Storage**: All sessions encrypted with AES-256
- **Secure API Keys**: Environment variable protection
- **Local Backup**: SQLite backup of all configurations
- **Cloud Sync**: Optional Supabase synchronization

### Performance Optimization
- **Memory Management**: Automatic garbage collection every minute
- **RAM Monitoring**: Auto-restart if memory exceeds 300MB
- **Session Cleanup**: Automatic cleanup of expired sessions
- **Event Optimization**: Efficient event listener management
- **Message Queuing**: Handle high message loads efficiently

## 🔍 Troubleshooting

### Common Issues & Solutions

#### 1. **Connection Problems**
```bash
# Check if bot is running
.ping

# Restart bot
.restart

# Check logs for errors
# Review terminal output
```

#### 2. **Session Issues**
```bash
# Clear corrupted session
rm -rf data/sessions/*

# Re-pair with WhatsApp
# Restart bot and scan QR code

# Check database integrity
sqlite3 data/bmm.db ".schema"
```

#### 3. **Memory Issues**
```bash
# Monitor memory usage
.disk

# Check current settings
.settings

# Force garbage collection
# Automatic every minute
```

#### 4. **Update Failures**
```bash
# Force update
.update force

# Check Git status
git status

# Reset to last stable version
git reset --hard HEAD~1
```

#### 5. **Command Not Working**
```bash
# Check command registration
.help [command]

# Verify permissions
# Check if you have required admin level

# Check bot prefix
.settings
```

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

### Performance Monitoring
- **Memory Usage**: Automatic monitoring with alerts
- **Message Processing**: Track message handling performance
- **Connection Status**: Monitor WhatsApp connection health
- **Error Tracking**: Comprehensive error logging and reporting

## 🤝 Contributing

### Development Setup
```bash
# Fork repository
git clone https://github.com/yourusername/BMM-PE.git
cd BMM-PE

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/new-feature
```

### Adding New Commands
1. **Create Command Handler** (`src/handler/command/newCommand.js`)
```javascript
async function newCommand(sock, msg, args) {
  const { from, prefix } = msg;
  // Command logic here
  await sock.sendMessage(from, { text: 'Response' });
}

module.exports = newCommand;
```

2. **Register Command** (`src/handler/command/commandRegistry.js`)
```javascript
newCommand: {
  description: 'Command description',
  usage: 'newCommand [args]',
  category: 'Category',
  ownerOnly: false,
  adminOnly: false
}
```

3. **Add to Handler** (`src/handler/commandHandler.js`)
```javascript
case 'newCommand':
  await newCommand(sock, msg, args);
  break;
```

### Adding New Features
1. **Create Feature Module** (`src/handler/features/newFeature.js`)
2. **Integrate with Message Handler** (`src/handler/messageHandler.js`)
3. **Add Database Support** (if needed)
4. **Test Thoroughly**
5. **Submit Pull Request**

### Code Standards
- Use ES6+ syntax
- Follow existing code style
- Add error handling
- Include logging
- Update documentation

## 📄 License & Support

### License
This project is licensed under the **ISC License**.

### Support Channels
- **Documentation**: Check [dev.md](dev.md) for technical documentation
- **Issues**: [GitHub Issues](https://github.com/ojuolokun86/BMM-PE/issues)
- **Updates**: Check repository for latest releases
- **Community**: Join our Discord server (link in repository)

### Version Information
- **Current Version**: 3.8.7
- **Last Updated**: 2026-04-07
- **Author**: Toluwalase Ojabineni
- **Node.js Requirement**: >=21
- **Baileys Version**: ^7.0.0-rc.9

---

## 🚀 Quick Start Guide

```bash
# 1. Clone and setup
git clone https://github.com/ojuolokun86/BMM-PE.git
cd BMM-PE
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials and bot settings

# 3. Start the bot
npm start

# 4. Pair with WhatsApp
# Scan QR code or use phone pairing when prompted

# 5. Test basic functionality
.ping
.menu
.help ping

# 6. Configure your group
.welcome on
.antilink on
.hall @user Premier League "Your Team"
```

## 🎉 Enjoy Your Advanced WhatsApp Bot!

Thank you for choosing **BMM V3.8.7**! This framework provides everything you need to create a powerful, feature-rich WhatsApp bot for your community or business.

### Next Steps
1. **Explore Commands**: Try different command categories
2. **Configure Settings**: Customize bot behavior for your needs
3. **Engage Community**: Set up Hall of Fame and welcome messages
4. **Monitor Performance**: Use built-in analytics and monitoring tools
5. **Stay Updated**: Regular updates with new features and improvements

For detailed technical documentation, see [dev.md](dev.md). For support, create an issue on GitHub.

---

**Built with ❤️ using Node.js, Baileys, and Supabase**
