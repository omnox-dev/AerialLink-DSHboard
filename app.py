import os
import time
import math
import json
import random
import threading
import shutil
from flask import Flask, render_template, jsonify, request, Response, send_from_directory

app = Flask(__name__)

# Load .env file automatically
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    config = {
        'ENABLE_3D_SIMULATION': 'true',
        'BASEMAP_API_KEY': '',
        'MAPBOX_ACCESS_TOKEN': '',
        'MAPTILER_API_KEY': '',
        'STADIA_API_KEY': ''
    }
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    os.environ[k] = v
                    config[k] = v
    for k in config:
        if k in os.environ and os.environ[k]:
            config[k] = os.environ[k]
    return config

ENV_CONFIG = load_env()

# Ensure static/images directory exists
os.makedirs(os.path.join(app.static_folder, 'images'), exist_ok=True)

# Copy generated images to static/images if present
BRAIN_DIR = r"C:\Users\Om\.gemini\antigravity-ide\brain\58953fc8-22f5-4dc9-8bab-112d14582d97"
image_mappings = {
    "aerial_victim_rgb_1790698815933.jpg": "victim_rgb.jpg",
    "aerial_victim_flir_1790698856214.jpg": "victim_flir.jpg",
    "aerial_candidate_nvg_1790698882245.jpg": "candidate_nvg.jpg"
}

for src_name, dest_name in image_mappings.items():
    src_path = os.path.join(BRAIN_DIR, src_name)
    dest_path = os.path.join(app.static_folder, 'images', dest_name)
    if os.path.exists(src_path) and not os.path.exists(dest_path):
        try:
            shutil.copyfile(src_path, dest_path)
        except Exception as e:
            print(f"Warning copying image {src_name}: {e}")

# Base search area center (Pine Ridge Search & Rescue Sector)
CENTER_LAT = 34.1285
CENTER_LNG = -118.5720

# Initial Search Perimeter Boundary (8-point Polygon matching reference)
INITIAL_PERIMETER = [
    {"lat": 34.1350, "lng": -118.5820},
    {"lat": 34.1360, "lng": -118.5680},
    {"lat": 34.1330, "lng": -118.5580},
    {"lat": 34.1260, "lng": -118.5540},
    {"lat": 34.1200, "lng": -118.5600},
    {"lat": 34.1190, "lng": -118.5720},
    {"lat": 34.1220, "lng": -118.5810},
    {"lat": 34.1290, "lng": -118.5860},
]

# Sectors partitioning the search area
INITIAL_SECTORS = [
    {
        "id": "A1",
        "name": "Sector A1",
        "status": "completed",
        "coverage": 100,
        "color": "#0ea5e9",
        "coords": [
            [34.1350, -118.5820],
            [34.1355, -118.5740],
            [34.1300, -118.5730],
            [34.1290, -118.5860]
        ]
    },
    {
        "id": "A2",
        "name": "Sector A2",
        "status": "active",
        "coverage": 78,
        "color": "#10b981",
        "assigned_drone": "D1",
        "coords": [
            [34.1290, -118.5860],
            [34.1300, -118.5730],
            [34.1250, -118.5735],
            [34.1220, -118.5810]
        ]
    },
    {
        "id": "A3",
        "name": "Sector A3",
        "status": "completed",
        "coverage": 95,
        "color": "#854d0e",
        "coords": [
            [34.1220, -118.5810],
            [34.1250, -118.5735],
            [34.1210, -118.5730],
            [34.1190, -118.5720]
        ]
    },
    {
        "id": "B1",
        "name": "Sector B1",
        "status": "completed",
        "coverage": 100,
        "color": "#15803d",
        "coords": [
            [34.1355, -118.5740],
            [34.1360, -118.5680],
            [34.1310, -118.5670],
            [34.1300, -118.5730]
        ]
    },
    {
        "id": "B2",
        "name": "Sector B2",
        "status": "active",
        "coverage": 64,
        "color": "#6366f1",
        "coords": [
            [34.1300, -118.5730],
            [34.1310, -118.5670],
            [34.1245, -118.5665],
            [34.1250, -118.5735]
        ]
    },
    {
        "id": "B3",
        "name": "Sector B3",
        "status": "alert",
        "coverage": 82,
        "color": "#ef4444",
        "assigned_drone": "D2",
        "coords": [
            [34.1360, -118.5680],
            [34.1330, -118.5580],
            [34.1280, -118.5560],
            [34.1245, -118.5665],
            [34.1310, -118.5670]
        ]
    },
    {
        "id": "C1",
        "name": "Sector C1",
        "status": "completed",
        "coverage": 90,
        "color": "#78716c",
        "assigned_drone": "D3",
        "coords": [
            [34.1250, -118.5735],
            [34.1245, -118.5665],
            [34.1215, -118.5660],
            [34.1190, -118.5720]
        ]
    },
    {
        "id": "C2",
        "name": "Sector C2",
        "status": "active",
        "coverage": 45,
        "color": "#0284c7",
        "coords": [
            [34.1245, -118.5665],
            [34.1280, -118.5560],
            [34.1260, -118.5540],
            [34.1200, -118.5600],
            [34.1215, -118.5660]
        ]
    }
]

# Initial Drones State matching reference
INITIAL_DRONES = {
    "D1": {
        "id": "D1",
        "callsign": "Eagle-1",
        "color": "#3b82f6",  # Blue
        "battery": 78,
        "rssi": -67,
        "state": "Searching",  # Searching, Verifying, RTL, Hovering, Lost
        "lat": 34.1288,
        "lng": -118.5780,
        "altitude": 48.5,
        "speed": 12.4,
        "heading": 85,
        "target_sector": "A2",
        "history": [[34.1275, -118.5830], [34.1282, -118.5805], [34.1288, -118.5780]],
        "pattern_angle": 0.0
    },
    "D2": {
        "id": "D2",
        "callsign": "Falcon-2",
        "color": "#f97316",  # Orange
        "battery": 62,
        "rssi": -72,
        "state": "Verifying",  # Verifying
        "lat": 34.1272,
        "lng": -118.5652,
        "altitude": 32.0,
        "speed": 6.8,
        "heading": 42,
        "target_sector": "B3",
        "history": [[34.1235, -118.5680], [34.1255, -118.5660], [34.1272, -118.5652]],
        "pattern_angle": 1.2
    },
    "D3": {
        "id": "D3",
        "callsign": "Raven-3",
        "color": "#a855f7",  # Purple
        "battery": 85,
        "rssi": -70,
        "state": "Searching",
        "lat": 34.1228,
        "lng": -118.5675,
        "altitude": 55.2,
        "speed": 14.1,
        "heading": 210,
        "target_sector": "C1",
        "history": [[34.1210, -118.5700], [34.1220, -118.5685], [34.1228, -118.5675]],
        "pattern_angle": 2.4
    }
}

# Initial Targets matching reference
INITIAL_TARGETS = [
    {
        "id": "target-1",
        "type": "victim",
        "title": "Verified Victim",
        "confidence": 0.92,
        "time": "00:23:41",
        "sector": "B3",
        "lat": 34.1282,
        "lng": -118.5612,
        "detected_by": "D2 + D3 (Cross-verified)",
        "status": "verified",  # verified, candidate, resolved
        "images": {
            "rgb": "/static/images/victim_rgb.jpg",
            "flir": "/static/images/victim_flir.jpg",
            "nvg": "/static/images/candidate_nvg.jpg"
        },
        "telemetry": {
            "altitude": "38.2 m AGL",
            "heat_signature": "34.5°C (+12.3° above ambient)",
            "bearing": "045° NNE",
            "distance": "142 m from D2",
            "cross_correlation": "98.4% (Multi-spectral match)"
        },
        "notes": "Hiker in red thermal jacket located near rocky clearing. Conscious and waving. Immediate aerial monitoring active."
    },
    {
        "id": "target-2",
        "type": "candidate",
        "title": "Candidate Target",
        "confidence": 0.68,
        "time": "00:21:18",
        "sector": "A2",
        "lat": 34.1278,
        "lng": -118.5802,
        "detected_by": "D1",
        "status": "candidate",
        "images": {
            "rgb": "/static/images/victim_rgb.jpg",
            "flir": "/static/images/victim_flir.jpg",
            "nvg": "/static/images/candidate_nvg.jpg"
        },
        "telemetry": {
            "altitude": "46.0 m AGL",
            "heat_signature": "28.1°C (+4.2° above ambient)",
            "bearing": "270° W",
            "distance": "85 m from D1",
            "cross_correlation": "68.2% (Visual only)"
        },
        "notes": "Anomalous visual contrast detected on trail. D1 maintaining sweep perimeter."
    }
]

# Initial AI Alert Feed matching reference
INITIAL_ALERTS = [
    {
        "id": "alert-1",
        "type": "verified_target",
        "icon": "person",
        "title": "Verified target (0.92)",
        "subtitle": "Sector B3 (D2 + D3)",
        "time": "00:23:41",
        "target_id": "target-1",
        "severity": "critical"
    },
    {
        "id": "alert-2",
        "type": "candidate_target",
        "icon": "target",
        "title": "Candidate target (0.68)",
        "subtitle": "Sector A2 (D1)",
        "time": "00:21:18",
        "target_id": "target-2",
        "severity": "warning"
    },
    {
        "id": "alert-3",
        "type": "system",
        "icon": "battery-alert",
        "title": "Drone D1 low battery (20%)",
        "subtitle": "Advisory - RTB scheduled",
        "time": "00:18:05",
        "drone_id": "D1",
        "severity": "warning"
    },
    {
        "id": "alert-4",
        "type": "sector_complete",
        "icon": "check-circle",
        "title": "Sector B1 search complete",
        "subtitle": "100% coverage verified",
        "time": "00:12:33",
        "severity": "success"
    },
    {
        "id": "alert-5",
        "type": "system",
        "icon": "wifi",
        "title": "D3 reconnected (link restored)",
        "subtitle": "Mesh latency 18ms",
        "time": "00:09:17",
        "drone_id": "D3",
        "severity": "info"
    }
]

# Global Mission State
mission_state = {
    "status": "active",  # active, rtl, paused, aborted
    "link_status": "OK",
    "mission_time_seconds": 1450,  # 00:24:10
    "coverage_percent": 62,
    "active_drones_count": 3,
    "total_drones_count": 3,
    "perimeter": INITIAL_PERIMETER,
    "sectors": INITIAL_SECTORS,
    "drones": INITIAL_DRONES,
    "targets": INITIAL_TARGETS,
    "alerts": INITIAL_ALERTS,
    "selected_target_id": "target-1",
    "launch_pad": {"lat": 34.1195, "lng": -118.5725}
}

state_lock = threading.Lock()

def format_mission_time(total_seconds):
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

def simulation_worker():
    """Background thread simulating autonomous drone flights, sensor telemetry, and sector sweeps."""
    while True:
        time.sleep(1.0)
        with state_lock:
            if mission_state["status"] in ["active", "rtl"]:
                mission_state["mission_time_seconds"] += 1
                
                # Update coverage slowly if active
                if mission_state["status"] == "active" and mission_state["coverage_percent"] < 99:
                    if random.random() < 0.2:
                        mission_state["coverage_percent"] += 1

                for drone_id, drone in mission_state["drones"].items():
                    # Battery drain
                    if random.random() < 0.1 and drone["battery"] > 5:
                        drone["battery"] -= 1

                    # RSSI jitter
                    drone["rssi"] = -65 - random.randint(0, 12)

                    if mission_state["status"] == "rtl" or drone["state"] == "RTL":
                        # Move towards launch pad
                        drone["state"] = "RTL"
                        target_lat = mission_state["launch_pad"]["lat"]
                        target_lng = mission_state["launch_pad"]["lng"]
                        dlat = target_lat - drone["lat"]
                        dlng = target_lng - drone["lng"]
                        dist = math.hypot(dlat, dlng)
                        if dist > 0.0002:
                            drone["lat"] += (dlat / dist) * 0.00015
                            drone["lng"] += (dlng / dist) * 0.00015
                            drone["heading"] = (math.degrees(math.atan2(dlng, dlat)) + 360) % 360
                            drone["speed"] = 16.0
                        else:
                            drone["speed"] = 0.0
                            drone["state"] = "Landed"
                    elif drone["state"] == "Verifying":
                        # Orbit target-1 (Verified Victim in Sector B3)
                        target = next((t for t in mission_state["targets"] if t["id"] == "target-1"), None)
                        if target:
                            drone["pattern_angle"] += 0.15
                            radius = 0.0012
                            drone["lat"] = target["lat"] + radius * math.sin(drone["pattern_angle"])
                            drone["lng"] = target["lng"] + radius * math.cos(drone["pattern_angle"]) * 1.2
                            drone["heading"] = (math.degrees(drone["pattern_angle"]) + 90) % 360
                            drone["speed"] = 7.5
                    elif drone["state"] == "Searching":
                        # Lawnmower pattern sweep inside assigned sector
                        drone["pattern_angle"] += 0.08
                        if drone_id == "D1":
                            # Sector A2 sweep
                            drone["lat"] = 34.1270 + 0.0020 * math.sin(drone["pattern_angle"] * 0.8)
                            drone["lng"] = -118.5780 + 0.0035 * math.cos(drone["pattern_angle"] * 0.4)
                            drone["heading"] = (math.degrees(math.sin(drone["pattern_angle"])) * 45 + 90) % 360
                        elif drone_id == "D3":
                            # Sector C1 sweep
                            drone["lat"] = 34.1225 + 0.0018 * math.sin(drone["pattern_angle"] * 0.6)
                            drone["lng"] = -118.5670 + 0.0030 * math.cos(drone["pattern_angle"] * 0.5)
                            drone["heading"] = (math.degrees(math.cos(drone["pattern_angle"])) * 60 + 180) % 360

                    # Keep last 15 history positions for trail rendering
                    history = drone.get("history", [])
                    history.append([drone["lat"], drone["lng"]])
                    if len(history) > 20:
                        history.pop(0)
                    drone["history"] = history

# Start background simulation thread
sim_thread = threading.Thread(target=simulation_worker, daemon=True)
sim_thread.start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/config')
def get_config():
    # Reload env dynamically on request in case user edited .env
    config = load_env()
    enable_3d = str(config.get('ENABLE_3D_SIMULATION', 'true')).strip().lower() in ['true', '1', 'yes', 'on']
    return jsonify({
        "enable_3d_simulation": enable_3d,
        "basemap_api_key": config.get('BASEMAP_API_KEY', ''),
        "mapbox_access_token": config.get('MAPBOX_ACCESS_TOKEN', ''),
        "maptiler_api_key": config.get('MAPTILER_API_KEY', ''),
        "stadia_api_key": config.get('STADIA_API_KEY', '')
    })

@app.route('/api/mission-state')
def get_mission_state():
    with state_lock:
        data = dict(mission_state)
        data["formatted_time"] = format_mission_time(mission_state["mission_time_seconds"])
        return jsonify(data)

@app.route('/api/mission/deploy', methods=['POST'])
def deploy_mission():
    with state_lock:
        mission_state["status"] = "active"
        for d in mission_state["drones"].values():
            if d["state"] in ["RTL", "Landed", "Hovering"]:
                d["state"] = "Searching"
        
        # Add alert
        alert = {
            "id": f"alert-{int(time.time())}",
            "type": "system",
            "icon": "play",
            "title": "Autonomous search deployed",
            "subtitle": "All 3 UAVs executing sector partition sweep",
            "time": format_mission_time(mission_state["mission_time_seconds"]),
            "severity": "info"
        }
        mission_state["alerts"].insert(0, alert)
        return jsonify({"success": True, "status": mission_state["status"]})

@app.route('/api/mission/rtl', methods=['POST'])
def rtl_all():
    with state_lock:
        mission_state["status"] = "rtl"
        for d in mission_state["drones"].values():
            d["state"] = "RTL"
            
        alert = {
            "id": f"alert-{int(time.time())}",
            "type": "system",
            "icon": "home",
            "title": "RTL All command issued",
            "subtitle": "Drones returning to coordinates (34.1195, -118.5725)",
            "time": format_mission_time(mission_state["mission_time_seconds"]),
            "severity": "warning"
        }
        mission_state["alerts"].insert(0, alert)
        return jsonify({"success": True, "status": "rtl"})

@app.route('/api/mission/abort', methods=['POST'])
def abort_mission():
    with state_lock:
        mission_state["status"] = "aborted"
        for d in mission_state["drones"].values():
            d["state"] = "Hovering"
            d["speed"] = 0.0
            
        alert = {
            "id": f"alert-{int(time.time())}",
            "type": "system",
            "icon": "alert-octagon",
            "title": "Mission ABORT triggered",
            "subtitle": "All UAVs hovering at station",
            "time": format_mission_time(mission_state["mission_time_seconds"]),
            "severity": "critical"
        }
        mission_state["alerts"].insert(0, alert)
        return jsonify({"success": True, "status": "aborted"})

@app.route('/api/target/resolve', methods=['POST'])
def resolve_target():
    data = request.get_json() or {}
    target_id = data.get("target_id", "target-1")
    with state_lock:
        for t in mission_state["targets"]:
            if t["id"] == target_id:
                t["status"] = "resolved"
                
        # Re-assign verifying drone back to searching
        for d in mission_state["drones"].values():
            if d["state"] == "Verifying":
                d["state"] = "Searching"
                
        alert = {
            "id": f"alert-{int(time.time())}",
            "type": "system",
            "icon": "check",
            "title": f"Target {target_id} marked as RESOLVED",
            "subtitle": "Ground SAR rescue team notified",
            "time": format_mission_time(mission_state["mission_time_seconds"]),
            "severity": "success"
        }
        mission_state["alerts"].insert(0, alert)
        return jsonify({"success": True, "target_id": target_id, "status": "resolved"})

@app.route('/api/mission/set-perimeter', methods=['POST'])
def set_perimeter():
    data = request.get_json() or {}
    polygon = data.get("perimeter")
    if not polygon or len(polygon) < 3:
        return jsonify({"error": "Invalid polygon"}), 400
    with state_lock:
        mission_state["perimeter"] = polygon
        alert = {
            "id": f"alert-{int(time.time())}",
            "type": "system",
            "icon": "edit",
            "title": "Search perimeter updated",
            "subtitle": f"{len(polygon)} waypoint vertices defined",
            "time": format_mission_time(mission_state["mission_time_seconds"]),
            "severity": "info"
        }
        mission_state["alerts"].insert(0, alert)
        return jsonify({"success": True, "perimeter": polygon})

@app.route('/api/stream')
def event_stream():
    """Server-Sent Events stream for high-performance reactive updates."""
    def generate():
        while True:
            time.sleep(0.5)
            with state_lock:
                state_copy = dict(mission_state)
                state_copy["formatted_time"] = format_mission_time(mission_state["mission_time_seconds"])
                json_data = json.dumps(state_copy)
            yield f"data: {json_data}\n\n"
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache, no-transform'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers['Connection'] = 'keep-alive'
    return response

if __name__ == '__main__':
    print("AerialLink AI - Mission Control starting on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
