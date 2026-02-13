# Dilocash RFID Card Top-Up System

**Live Dashboard URL:** http://157.173.101.159:9249

**GitHub Repository:** https://github.com/Mugisha-Ivan-Bright/RFID

A complete RFID card management system with real-time balance tracking, top-up functionality, and comprehensive admin dashboard.

## 🌐 Live Demo

Access the live application at: **http://157.173.101.159:9249**

**Test Credentials:**
- Create an account via the registration page
- Or contact the administrator for demo access

## 📋 Project Overview

This system enables contactless RFID card management with real-time balance updates, transaction tracking, and administrative controls. Built with a microservices architecture using MQTT for device communication and WebSocket for real-time dashboard updates.

## ✨ Features

- 💳 **Real-time RFID Card Detection** - Instant card scanning and recognition
- 💰 **Balance Management** - View and update card balances in real-time
- 👤 **Card Owner Assignment** - Assign and manage card ownership
- 📊 **Analytics Dashboard** - Transaction history and system metrics
- 🔐 **Secure Authentication** - Session-based user authentication
- 🌐 **Real-time Updates** - WebSocket-powered live data synchronization
- 📡 **MQTT Communication** - Reliable device-to-server messaging
- 🎨 **Modern UI** - Responsive dark-themed interface with TailwindCSS

## 🏗️ System Architecture

```
┌─────────────────┐
│  RFID Hardware  │ (ESP8266 + MFRC522)
└────────┬────────┘
         │ Serial/WiFi
         ▼
┌─────────────────┐
│  Python Bridge  │ (Local PC)
└────────┬────────┘
         │ MQTT
         ▼
┌─────────────────┐
│  MQTT Broker    │ (broker.benax.rw)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend API    │ (Node.js + Express)
│  + MongoDB      │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│  Web Dashboard  │ (Browser)
└─────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- TailwindCSS for styling
- WebSocket API for real-time updates
- Responsive design for mobile and desktop

### Backend
- Node.js v20.x with Express.js
- MongoDB for data persistence
- Mongoose ODM
- MQTT.js for device communication
- Express-session for authentication
- WebSocket for real-time client updates

### Hardware/Firmware
- ESP8266 (NodeMCU) with MicroPython
- MFRC522 RFID Reader Module
- Python MQTT Bridge (for USB-connected readers)

### Infrastructure
- Ubuntu 22.04 LTS Server
- PM2 Process Manager
- MQTT Broker: broker.benax.rw

## 📁 Project Structure

```
RFID/
├── frontend/              # Web Dashboard
│   ├── auth.html         # Login/Registration page
│   ├── dashboard.html    # Main dashboard interface
│   ├── index.html        # Landing page
│   ├── styles.css        # Custom styles
│   └── app.js            # Frontend logic
│
├── backend/              # API Server
│   ├── server.js         # Express server & WebSocket
│   ├── models/           # MongoDB schemas
│   │   ├── Card.js       # Card model
│   │   ├── Transaction.js # Transaction model
│   │   └── User.js       # User model
│   ├── package.json      # Dependencies
│   └── .env.example      # Environment variables template
│
├── device_code/          # ESP8266 Firmware
│   ├── main.py           # MicroPython main script
│   └── mfrc522.py        # RFID reader driver
│
├── python/               # Python MQTT Bridge
│   ├── mqtt_bridge.py    # Main bridge script
│   ├── hardware_client.py # Hardware interface
│   └── rfid_client.py    # RFID client utilities
│
├── README.md             # This file
└── .gitignore           # Git ignore rules
```

## 🚀 Installation & Setup

### Prerequisites

- Node.js v20.x or higher
- MongoDB (local or Atlas)
- Python 3.8+ (for hardware bridge)
- ESP8266 with MicroPython (optional, for WiFi-enabled hardware)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Mugisha-Ivan-Bright/RFID.git
cd RFID/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start the server
npm start

# Or use PM2 for production
pm2 start server.js --name rfid-backend
```

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
MONGODB_URI=mongodb://localhost:27017/rfid_db
SESSION_SECRET=your_secret_key_here
MQTT_BROKER=mqtt://broker.benax.rw
PORT=9249
```

### Hardware Setup (ESP8266)

1. Flash MicroPython firmware to ESP8266
2. Upload `device_code/main.py` and `device_code/mfrc522.py`
3. Configure WiFi credentials in `main.py`
4. Connect MFRC522 RFID reader:
   - SDA → GPIO2
   - SCK → GPIO14
   - MOSI → GPIO13
   - MISO → GPIO12
   - RST → GPIO0
   - 3.3V → 3.3V
   - GND → GND

### Python Bridge Setup (Alternative to ESP8266)

```bash
cd python

# Install dependencies
pip install paho-mqtt pyserial requests

# Run the bridge
python mqtt_bridge.py
```

## 📡 MQTT Topics

The system uses the following MQTT topics (Team ID: `ivan_bright`):

- `rfid/ivan_bright/card/status` - Card detection events
- `rfid/ivan_bright/card/balance` - Balance update responses
- `rfid/ivan_bright/card/topup` - Top-up requests
- `rfid/ivan_bright/device/health` - Device health reports
- `rfid/ivan_bright/device/status` - Device online/offline status

## 🔌 API Endpoints

### Authentication
- `POST /register` - Create new user account
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /me` - Get current user info

### Cards
- `GET /cards` - Get all registered cards
- `GET /card/:uid` - Get specific card by UID
- `POST /scan` - Register card scan event
- `POST /topup` - Top-up card balance

### Analytics
- `GET /transactions` - Get transaction history
- `GET /stats` - Get system statistics

## 🎯 Usage

1. **Access the Dashboard**: Navigate to http://157.173.101.159:9249
2. **Register/Login**: Create an account or login
3. **Scan Card**: Place RFID card on reader
4. **View Details**: Card information appears on dashboard
5. **Assign Owner**: Enter card owner name
6. **Top-up Balance**: Enter amount and confirm
7. **View Analytics**: Check transaction history and statistics

## 🔒 Security Features

- Session-based authentication with secure cookies
- Password hashing with bcrypt
- Protected API routes with authentication middleware
- Input validation and sanitization
- CSRF protection
- MongoDB injection prevention

## 📊 Dashboard Views

1. **Dashboard** - Real-time card scanning and top-up interface
2. **Card Registry** - View all registered cards with search
3. **Analytics** - Transaction insights and system metrics
4. **Profile** - User account management
5. **Settings** - System configuration and status

## 🧪 Testing

### Manual Testing
1. Scan a test card
2. Verify card appears on dashboard
3. Assign owner and top-up balance
4. Check transaction history
5. Verify balance persistence

### Test Card UIDs
You can manually test by typing UIDs in the Python bridge:
- `A1B2C3D4`
- `84AE8B04A5`
- Any 8-16 character hex string

## 🐛 Troubleshooting

### Card Not Detected
- Check RFID reader connections
- Verify Python bridge or ESP8266 is running
- Check MQTT broker connection
- Verify card is compatible (Mifare Classic/Ultralight)

### Dashboard Not Updating
- Check WebSocket connection in browser console
- Verify backend server is running
- Check MQTT broker connectivity
- Clear browser cache and reload

### Database Connection Issues
- Verify MongoDB is running
- Check connection string in .env
- Ensure IP is whitelisted (for MongoDB Atlas)

## 📝 Team Information

- **Team ID**: ivan_bright
- **MQTT Broker**: broker.benax.rw
- **Server**: 157.173.101.159:9249
- **GitHub**: https://github.com/Mugisha-Ivan-Bright/RFID

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributors

- **Mugisha Ivan Bright** - Full Stack Development, RFID Hardware Integration, System Architecture & Deployment

## 🙏 Acknowledgments

- BLUHUB Ltd for server hosting
- MongoDB Atlas for database services
- MQTT broker infrastructure

## 📞 Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/Mugisha-Ivan-Bright/RFID/issues)
- Contact: info@bluhub.rw

---

**Live Application**: http://157.173.101.159:9249

**GitHub Repository**: https://github.com/Mugisha-Ivan-Bright/RFID

**Last Updated**: February 2026
