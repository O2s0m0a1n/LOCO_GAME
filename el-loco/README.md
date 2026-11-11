LOCO — Online Tic-Tac-Toe

A real-time multiplayer Tic-Tac-Toe game built with Flask, Flask-SocketIO, Bootstrap 5, and Vanilla JavaScript (no React or Vue).

DESIGNED BY EL-GRINGO

Features
Real-time multiplayer gameplay with two players per room.
Server-side validation for all game moves.
Custom LOCO interface with Dark and Light themes.
Arabic and English language support with RTL/LTR layouts.
Responsive design for desktop, tablet, and mobile devices.
Optional background music and sound effects with audio controls.
Real-time text chat with a desktop side panel and mobile bottom Offcanvas window.
Optional WebRTC voice chat for direct communication between players.
Voice call controls: start, accept, reject, end, microphone mute, and speaker mute.
Project Structure
text
mywebsite/
├── app.py
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js
    │   ├── game.js
    │   ├── chat.js
    │   └── voice.js
    └── audio/
        ├── background.mp3
        ├── click.mp3
        └── win.mp3

Installation & Setup

Clone the repository:

bash
git clone https://github.com/O2s0m0a1n/LOCO_GAME.git
cd LOCO_GAME


Create and activate a virtual environment:

bash
python -m venv venv


Windows:

powershell
venv\Scripts\activate


Linux / macOS:

bash
source venv/bin/activate


Install dependencies:

bash
pip install -r requirements.txt


Start the application:

bash
python app.py


Open your browser:

text
http://localhost:5000

Multiplayer Testing
Open the application in one browser.
Create a new game room.
Open another browser or an incognito window.
Join using the same room code.
Start playing!
Voice Chat Requirements
HTTPS is required for microphone access outside localhost.
STUN servers help establish direct WebRTC connections.
A TURN server may be required for restricted networks.
Voice chat is optional; gameplay and text chat work independently.

Configure TURN using environment variables:

text
LOCO_TURN_URLS
LOCO_TURN_USERNAME
LOCO_TURN_CREDENTIAL

Production Deployment
Disable debug mode using LOCO_DEBUG=0.
Configure a secure LOCO_SECRET_KEY.
Deploy behind Nginx or Caddy with HTTPS.
Configure WebSocket proxy support.
Use a single worker process because game rooms are stored in application memory.
Use dedicated TURN credentials.
Security & Chat Limits
Maximum chat message length: 200 characters.
Rate limit: 5 messages per 5 seconds.
Chat messages are rendered using JavaScript textContent to prevent HTML injection.
All game moves are validated server-side.
Known Limitations
Microphone access requires HTTPS outside localhost.
WebRTC connections may require TURN on restricted networks.
Real-device and cross-browser testing is recommended before production deployment.
Credits

Designed and developed by EL-GRINGO.

LOCO — Play Together. Stay Connected. ❤️
