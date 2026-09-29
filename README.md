# 🛰️ AerialLink — Multi-UAV Search & Rescue Tactical Dashboard

[![CI/CD Pipeline](https://github.com/omnox-dev/AerialLink-DSHboard/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/omnox-dev/AerialLink-DSHboard/actions/workflows/ci-cd.yml)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Framework-Flask%203.0-black?logo=flask)](https://flask.palletsprojects.com/)
[![Gunicorn](https://img.shields.io/badge/WSGI-Gunicorn-499848?logo=gunicorn&logoColor=white)](https://gunicorn.org/)
[![CesiumJS](https://img.shields.io/badge/3D%20Engine-CesiumJS-68A063?logo=cesium&logoColor=white)](https://cesium.com/)
[![Leaflet](https://img.shields.io/badge/2D%20Map-Leaflet-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**AerialLink** is a mission-critical, real-time command & control (C2) tactical dashboard engineered for autonomous Multi-UAV Search and Rescue (SAR) operations. Built with a high-fidelity tactical HUD interface, dual-engine 2D/3D geospatial visualization (Leaflet + CesiumJS), real-time Server-Sent Events (SSE) telemetry, and multi-spectral AI detection feeds (RGB, FLIR Thermal, NVG).

---

## 📸 Key Capabilities & Highlights

- **📡 Real-Time Autonomous Swarm Telemetry**: Multi-threaded simulation worker streaming live drone coordinates, altitude (AGL), speed, heading, RSSI mesh signal, and battery levels via persistent SSE (`/api/stream`).
- **🗺️ Dual 2D/3D Geospatial Tactical Twin**:
  - **2D Tactical Map (Leaflet)**: Sector partitioning (A1–C2), dynamic 8-waypoint polygon perimeter editing, waypoint sweep routes, and drone trail visualizer.
  - **3D Digital Twin (CesiumJS)**: High-resolution terrain, 3D drone positioning, camera sensor frustum cones, and elevation-aware target tracking.
- **🎯 Multi-Spectral AI Target Classification**:
  - Real-time cross-spectral correlation (RGB visual, FLIR thermal imaging, Night Vision NVG).
  - Confidence scoring and multi-drone triangulation verification.
  - Incident resolution workflow alerting ground SAR rescue teams.
- **⚡ Mission Command & Control (C2)**:
  - **Deploy Swarm**: Dispatches all autonomous UAVs into assigned lawnmower sector sweeps.
  - **RTL All (Return-to-Launch)**: Autonomous coordinate guidance returning drones to base launch pads.
  - **Abort Mission**: Immediate station-hover failsafe.
  - **Dynamic Polygon Boundary Editor**: Live interactive search perimeter definition with immediate sweep recalculation.
- **🎬 Synthetic Data Scenario Generator**: Bundled Blender simulation script (`blender_scenario.py`) for generating multi-angle synthetic SAR datasets.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Browser Tactical HUD (Client)"]
        UI["Tactical HUD UI / Control Deck"]
        L2D["Leaflet 2D Tactical Map"]
        C3D["CesiumJS 3D Digital Twin"]
        SSE_Client["SSE Event Listener (/api/stream)"]
    end

    subgraph Backend ["Python / Flask Backend"]
        Server["Flask Core Application (app.py)"]
        WSGI["Gunicorn (gthread workers)"]
        Sim["Background Simulation Thread (1 Hz)"]
        State["Mission State Store (Thread-Safe Mutex)"]
    end

    subgraph External ["External Services & Data"]
        Blender["Blender Scenario Engine (blender_scenario.py)"]
        MapProviders["Mapbox / MapTiler / Stadia / OSM"]
    end

    Sim -->|Telemetry & Trajectories| State
    State -->|Push Events| Server
    Server -->|SSE Stream / JSON| SSE_Client
    SSE_Client --> UI
    SSE_Client --> L2D
    SSE_Client --> C3D
    UI -->|REST Actions (Deploy / RTL / Abort)| Server
    MapProviders -->|Basemap Tiles / 3D Terrain| L2D
    MapProviders -->|Satellite / Terrain| C3D
    Blender -.->|Synthetic Renders (RGB/FLIR/NVG)| State
```

---

## 📂 Repository Structure

```
AerialLink-DSHboard/
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # Automated CI/CD pipeline (Lint, Test, Render Deploy)
├── static/
│   ├── css/
│   │   └── style.css            # Dark tactical glassmorphism HUD styles & layout
│   ├── images/
│   │   ├── candidate_nvg.jpg    # Night vision candidate target imagery
│   │   ├── drone_fpv_view.jpg   # FPV stream HUD overlay
│   │   ├── victim_flir.jpg      # FLIR thermal target detection render
│   │   └── victim_rgb.jpg       # High-resolution RGB victim confirmation render
│   └── js/
│       ├── app.js               # Tactical HUD state, SSE subscriber, C2 controls
│       ├── cesium_sim.js        # 3D CesiumJS globe engine & frustum visualization
│       └── map.js               # 2D Leaflet map, sector partitions & perimeter editor
├── templates/
│   └── index.html               # Main tactical mission command interface
├── .env.example                 # Environment configuration template
├── .gitignore                   # Git ignore rules
├── app.py                       # Main Flask web application & simulation backend
├── blender_scenario.py          # Blender synthetic SAR scenario generator
├── requirements.txt             # Python dependencies
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Python**: 3.10, 3.11, or 3.12
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/omnox-dev/AerialLink-DSHboard.git
cd AerialLink-DSHboard
```

### 2. Set Up Virtual Environment
```bash
# Windows (PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` to configure your API keys or toggles:
```ini
# Enable or disable CesiumJS 3D globe visualization
ENABLE_3D_SIMULATION=true

# Optional Map Provider API Keys (falls back to OpenStreetMap & Esri World Imagery if empty)
BASEMAP_API_KEY=
MAPBOX_ACCESS_TOKEN=
MAPTILER_API_KEY=
STADIA_API_KEY=
```

### 5. Run the Local Development Server
```bash
python app.py
```
Open your browser at **`http://127.0.0.1:5000`** to access the Tactical Dashboard.

---

## 🛰️ Production Deployment

### Option A: Render (Recommended)

1. Connect your repository to **[Render](https://render.com/)** as a **Web Service**.
2. Configure settings:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**:
     ```bash
     gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 app:app
     ```
   - **Instance Type**: `Free`
3. Add any desired environment variables from `.env` in the Render dashboard.

### Option B: Docker / Container Deployment

Run with Gunicorn directly:
```bash
gunicorn --bind 0.0.0.0:5000 --workers 1 --threads 8 --timeout 0 app:app
```

---

## 📡 REST & Streaming API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/` | `GET` | Serves the main Mission Control Tactical HUD interface. |
| `/api/config` | `GET` | Returns 3D sim status and map provider configuration. |
| `/api/mission-state` | `GET` | Fetches the full current state of drones, sectors, targets, and alerts. |
| `/api/stream` | `GET` | **SSE Stream** providing real-time telemetry updates (2 Hz). |
| `/api/mission/deploy` | `POST` | Dispatches all UAVs to execute autonomous sector sweeps. |
| `/api/mission/rtl` | `POST` | Commands all UAVs to execute Return-to-Launch navigation. |
| `/api/mission/abort` | `POST` | Emergency abort: UAVs immediately halt into a stationary hover. |
| `/api/target/resolve` | `POST` | Marks target as resolved (`{"target_id": "target-1"}`) and notifies ground SAR. |
| `/api/mission/set-perimeter` | `POST` | Updates active search polygon boundary vertices. |

---

## 🧪 CI/CD Pipeline

The repository includes a GitHub Actions workflow in [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml):

1. **Linting & Quality**: Validates Python syntax using `flake8` across standard compliance rules.
2. **Smoke Testing**: Validates Flask routing, background threads, and dependency initialization.
3. **Automated CD**: Gated deployment hook triggering cloud deployments upon successful builds to `main`.

---

## 🎨 Synthetic Scenario Generator (`blender_scenario.py`)

To generate realistic synthetic terrain, multi-angle camera angles, and thermal target heatmaps:
1. Open **Blender** (v3.0+).
2. Open the **Scripting** workspace and load `blender_scenario.py`.
3. Run the script to generate:
   - Mountainous SAR terrain mesh with procedural vegetation.
   - 3 UAV cameras positioned along realistic flight paths.
   - RGB, FLIR, and NVG multi-spectral synthetic camera captures.

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built for Autonomous Search & Rescue Operations • <b>AerialLink AI</b>
</p>
