# Kavach SecureComm

A proof-of-concept for a closed-group encrypted messaging platform designed specifically for defence personnel and their families, following a Zero-Trust security architecture.

## Prerequisites

Before running the project, ensure you have the following installed on your system:
- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose
- [Android Studio](https://developer.android.com/studio) (for the mobile app)
- [Node.js](https://nodejs.org/) (optional, if you want to run the backend outside of Docker)

## Project Structure

- `backend-api/`: Node.js/Express server handling authentication and WebSocket blind relay.
- `ai-security/`: Python FastAPI service for AI-based anomaly detection.
- `db-schema/`: PostgreSQL initialization scripts with Row-Level Security (RLS).
- `docker/`: Docker Compose configuration to orchestrate the backend services.
- `android-app/`: Android Kotlin app using Jetpack Compose, Android Keystore, and simulated Signal Protocol E2E encryption.

## Step 1: Running the Backend Services (Docker)

The easiest way to run the entire backend infrastructure (Database, Node API, AI Service, and Keycloak) is using Docker Compose.

1. Open a terminal (PowerShell or Command Prompt).
2. Navigate to the `docker` directory inside the project:
   ```bash
   cd c:\Users\DELL\Desktop\kavachsecurecom\docker
   ```
3. Start the services using Docker Compose:
   ```bash
   docker-compose up --build -d
   ```

This will spin up:
- **PostgreSQL Database**: `localhost:5432`
- **Backend Node API**: `localhost:3000`
- **AI Security Module**: `localhost:8000`
- **Keycloak IAM**: `localhost:8080`

You can verify the backend is running by navigating to `http://localhost:3000/health` in your browser.

*To stop the services later, run `docker-compose down` from the `docker` directory.*

## Step 2: Running the Android Application

1. Open **Android Studio**.
2. Select **Open** and navigate to `c:\Users\DELL\Desktop\kavachsecurecom\android-app`. Click OK to open the project.
3. Allow Android Studio to sync the Gradle files. (Note: The Android app is currently scaffolding/structural MVP code. You may need to add a standard `build.gradle` and manifest to make it fully compilable if you wish to run it on an emulator immediately).
4. Once synced, you can connect an Android device or start an Android Emulator.
5. Click the **Run** button (green play icon) in Android Studio to install and launch the app on your device/emulator.

### Important Note for Android Emulator Networking
If you are running the Android app on an emulator, `localhost` refers to the Android device itself. To connect to the backend API running on your host machine via Docker, you should configure the Android app's WebSocket and API URLs to use `10.0.2.2:3000` instead of `localhost:3000`.
