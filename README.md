#LOCO — Online Tic-Tac-Toe

### A real-time multiplayer Tic-Tac-Toe game built with Flask, Flask-SocketIO, Bootstrap 5, and vanilla JavaScript (no React or Vue).

#DESIGNED BY EL-GRINGO

Features
Real-time multiplayer gameplay with two players per room.
Server-side validation of all game moves.
LOCO custom interface with Dark and Light themes.
Arabic and English language support with RTL/LTR layouts.
Responsive design for desktop, tablet, and mobile devices.
Optional background music and sound effects with audio controls.
Real-time text chat:
Side panel on desktop.
Bottom Offcanvas chat window on mobile.
Optional WebRTC voice chat:
Direct audio communication between the two players.
The server handles signaling only.
Start, accept, reject, and end voice calls.
Microphone and speaker mute controls.
Connection status indicators.
Project Structure
text
mywebsite/
├── app.py                 # Server: rooms, moves, chat, voice signaling
├── requirements.txt
├── templates/
│   └── index.html         # Main application page
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js         # Translations, themes, language, audio
    │   ├── game.js        # Connection, lobby, game board
    │   ├── chat.js        # Text chat
    │   └── voice.js       # WebRTC voice chat
    └── audio/
        ├── background.mp3
        ├── click.mp3
        └── win.mp3

Installation and Setup
1. Download the Project

Download and extract LOCO-complete.zip.

Open the extracted project folder:

bash
cd mywebsite

2. Create a Virtual Environment
bash
python -m venv venv


Activate the virtual environment:

Windows:

powershell
venv\Scripts\activate


Linux / macOS:

bash
source venv/bin/activate

3. Install Dependencies
bash
pip install -r requirements.txt

4. Start the Application
bash
python app.py

5. Open the Game

Visit:

http://localhost:5000

Testing Multiplayer

To test the game with two players:

Open the application in one browser.
Create a new game room.
Open another browser or an incognito window.
Join using the same room code.
Start playing!
Voice Chat: HTTPS and TURN Configuration
1. HTTPS Requirement

Modern browsers require HTTPS for microphone access, except when using localhost.

http://localhost:5000 — Microphone access is allowed.
http://192.168.x.x:5000 — Microphone access is generally blocked.
https://your-domain.com — Microphone access is allowed.

If microphone access is unavailable, the game and text chat will continue working normally.

Recommended solutions:

Deploy the application behind HTTPS.
Use Cloudflare Tunnel or ngrok for testing.
Configure a local SSL certificate.

Example:

bash
LOCO_SSL_CERT=cert.pem LOCO_SSL_KEY=key.pem python app.py

2. STUN and TURN Servers

STUN servers help WebRTC discover public network addresses.

However, STUN alone may not work on every network. A TURN server may be necessary when players are connected through different networks, especially mobile networks or restricted connections.

Configure these environment variables:

Variable	Description	Example
LOCO_STUN_URLS	Comma-separated STUN server URLs	stun:stun.l.google.com:19302
LOCO_TURN_URLS	Comma-separated TURN server URLs	turn:turn.example.com:3478,turns:turn.example.com:5349
LOCO_TURN_USERNAME	TURN username	loco
LOCO_TURN_CREDENTIAL	TURN password	********
Windows PowerShell Example
powershell
$env:LOCO_TURN_URLS="turn:turn.example.com:3478"
$env:LOCO_TURN_USERNAME="loco"
$env:LOCO_TURN_CREDENTIAL="your-strong-password"

python app.py

Example coturn Configuration

On a Linux server, install coturn and configure /etc/turnserver.conf:

ini
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=loco:your-strong-password
realm=turn.example.com
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
min-port=49152
max-port=65535
no-cli


Configure your firewall to allow:

Port 3478 — UDP and TCP.
Port 5349 — TCP.
Ports 49152-65535 — UDP.

Security Note: TURN credentials are provided to players' browsers for WebRTC connections. Use dedicated credentials for this purpose only.

Production Deployment

For production environments:

1. Disable Debug Mode

Set:

bash
LOCO_DEBUG=0
LOCO_SECRET_KEY=your-long-random-secret-key


Never publish your production secret key.

2. Use HTTPS

Deploy the application behind Nginx or Caddy with a valid SSL certificate.

3. Nginx WebSocket Configuration

Example configuration:

nginx
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

4. Run with Gunicorn

The game rooms are stored in application memory, so use a single worker process.

Install Gunicorn:

bash
pip install gunicorn


Run:

bash
gunicorn --threads 100 -w 1 app:app


Make sure the deployment configuration is compatible with Flask-SocketIO and its selected async mode.

5. External Resources

Bootstrap and Socket.IO client libraries are loaded from CDNs.

For offline deployment:

Download the required libraries.
Place them inside the static/ directory.
Update the references in templates/index.html.
Update the Bootstrap LTR/RTL stylesheet paths in app.js.
Chat Limits and Security

The following settings are defined in app.py:

Setting	Default
CHAT_MAX_LENGTH	200 characters
CHAT_RATE_LIMIT	5 messages
CHAT_RATE_WINDOW	5 seconds

Chat messages are rendered using JavaScript textContent instead of HTML rendering to prevent HTML injection through messages.

Quick Testing Checklist

Before deployment, test the following:

Multiplayer Gameplay
Two players in separate browsers.
Complete games.
Win and draw conditions.
Restarting games.
Returning to the lobby.
Text Chat
Send messages from both players.
Test Arabic and English messages.
Test <b>test</b> and verify that it appears as plain text.
Mobile Compatibility
Check the layout on mobile devices.
Ensure there is no horizontal scrolling.
Verify that the chat button opens the bottom Offcanvas window.
Themes and Languages
Switch between Dark and Light modes.
Switch between Arabic and English.
Refresh the page and verify that preferences are saved.
Voice Chat
Start and accept calls.
Reject incoming calls.
Mute and unmute the microphone.
Mute and unmute the speaker.
End calls.
Close one player's browser during a call.
Different Networks
Test a connection between Wi-Fi and mobile data.
Configure a TURN server if direct connections fail.
Known Limitations
Microphone access requires HTTPS outside localhost.
WebRTC connections may fail on restricted networks without a TURN server.
Voice chat is optional; gameplay and text chat should continue working without it.
Real-device and cross-browser testing is recommended before production deployment.
Credits

Designed and developed by EL-GRINGO.

LOCO — Play Together. Stay Connected.
