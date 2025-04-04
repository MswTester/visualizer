# Visualizer - Interactive 3D Visualization

This application creates an interactive 3D visualization that can be controlled using:
- PC: Mouse controls for rotation and zooming
- Mobile: Gyroscope controls for rotation

## Features

- Segmented sphere visualization with points and color gradients
- Multiple user connections via Socket.io
- Glowing effects and smooth animation
- Mobile gyroscope support
- PC mouse rotation control

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript files:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

## Local Development

For development with auto-restart:
```bash
npm run dev
```

## Usage

1. Open the main visualization on your PC browser:
```
http://localhost:3000
```

2. Connect with your mobile device to control the sphere:
```
http://your-computer-ip:3000/mobile
```

3. Controls:
   - PC: Click and drag to rotate, mouse wheel to zoom
   - Mobile: Tilt your device to control the rotation

## Notes for Testing

For local testing, you can:
1. Open the main display in a browser window
2. Open the mobile control in another window or on your phone
3. If testing on a phone, ensure both devices are on the same network
