/**
 * AerialLink AI — Leaflet Map Controller & Real-Time GIS Layer Management
 */

class MissionMapController {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.tileLayers = {};
        this.activeLayerName = 'satellite';

        // Feature Layer Groups
        this.sectorGroup = L.layerGroup();
        this.perimeterGroup = L.layerGroup();
        this.meshGroup = L.layerGroup();
        this.relayGroup = L.layerGroup();
        this.droneGroup = L.layerGroup();
        this.trailGroup = L.layerGroup();
        this.targetGroup = L.layerGroup();
        this.drawGroup = L.layerGroup();

        // Markers & Entity caches
        this.droneMarkers = {};
        this.droneTrails = {};
        this.relayMarker = null;
        this.meshLines = {};
        this.targetMarkers = {};
        this.sectorLayers = {};
        this.perimeterPolygon = null;

        // Interactive Draw Perimeter state
        this.isDrawingPerimeter = false;
        this.drawPoints = [];
        this.drawPolyline = null;
        this.drawMarkers = [];

        this.init();
    }

    init() {
        // Initialize Map with deep zoom support and smooth scrolling
        this.map = L.map(this.containerId, {
            center: [34.1285, -118.5720],
            zoom: 15,
            minZoom: 3,
            maxZoom: 21,
            zoomSnap: 0.25,
            zoomDelta: 0.5,
            wheelPxPerZoomLevel: 80,
            scrollWheelZoom: true,
            zoomControl: false,
            attributionControl: false
        });

        // Add standard zoom control at top-left
        L.control.zoom({ position: 'topleft' }).addTo(this.map);

        // Real-time Up-to-Date Global GIS Tile Layers with deep zoom
        this.tileLayers['satellite'] = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 21,
            maxNativeZoom: 19,
            subdomains: ['server', 'services'],
            attribution: 'Esri, Maxar, Earthstar Geographics'
        });

        this.tileLayers['google_sat'] = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 21,
            maxNativeZoom: 20,
            attribution: 'Google Hybrid Satellite HD'
        });

        this.tileLayers['voyager'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 21,
            maxNativeZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        });

        this.tileLayers['dark'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 21,
            maxNativeZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        });

        this.tileLayers['light'] = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 21,
            maxNativeZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        });

        this.tileLayers['terrain'] = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 21,
            maxNativeZoom: 17,
            subdomains: 'abc',
            attribution: 'OpenTopoMap, SRTM'
        });

        // Default: Esri High-Resolution Satellite
        this.currentTheme = 'dark';
        this.tileLayers['satellite'].addTo(this.map);

        // Add layer groups to map
        this.sectorGroup.addTo(this.map);
        this.perimeterGroup.addTo(this.map);
        this.meshGroup.addTo(this.map);
        this.trailGroup.addTo(this.map);
        this.droneGroup.addTo(this.map);
        this.relayGroup.addTo(this.map);
        this.targetGroup.addTo(this.map);
        this.drawGroup.addTo(this.map);

        // Setup map events & coordinate tracker
        this.map.on('click', (e) => this.handleMapClick(e));
        this.map.on('mousemove', (e) => this.handleMouseMove(e));
    }

    handleMouseMove(e) {
        const hudCoords = document.querySelector('.feed-hud');
        if (hudCoords) {
            const latEl = hudCoords.querySelector('.hud-item:first-child');
            const lngEl = hudCoords.querySelector('.hud-item:nth-child(2)');
            if (latEl && lngEl) {
                latEl.textContent = `CURSOR: ${e.latlng.lat.toFixed(5)}° N`;
                lngEl.textContent = `${e.latlng.lng.toFixed(5)}° W`;
            }
        }
    }

    configureApiKeys(config) {
        if (!config) return;
        const key = config.basemap_api_key || config.maptiler_api_key || '';
        const keyParam = key ? `?key=${key}` : '';

        // CARTO Raster Layers with user's API Key
        this.tileLayers['voyager'] = L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${keyParam}`, {
            maxZoom: 21,
            maxNativeZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        });

        this.tileLayers['dark'] = L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${keyParam}`, {
            maxZoom: 21,
            maxNativeZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        });

        this.tileLayers['light'] = L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${keyParam}`, {
            maxZoom: 21,
            maxNativeZoom: 19,
            subdomains: 'abcd',
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        });

        // Re-apply active layer with updated key
        this.setTileLayer(this.activeLayerName);
    }

    setTileLayer(layerName) {
        let actualLayer = layerName;
        if (layerName === 'map') {
            actualLayer = this.currentTheme === 'light' ? 'light' : 'dark';
        }
        if (!this.tileLayers[actualLayer]) return;
        Object.values(this.tileLayers).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        this.tileLayers[actualLayer].addTo(this.map);
        this.activeLayerName = layerName;
    }

    setTheme(themeName) {
        this.currentTheme = themeName;
        if (this.activeLayerName === 'map') {
            this.setTileLayer('map');
        }
    }

    /**
     * Render or update the red search boundary polygon with vertices
     */
    updatePerimeter(coordsList) {
        this.perimeterGroup.clearLayers();
        if (!coordsList || coordsList.length < 3) return;

        const latLngs = coordsList.map(c => [c.lat, c.lng]);

        // Red dashed outer polygon matching mockup
        this.perimeterPolygon = L.polygon(latLngs, {
            color: '#ef4444',
            weight: 2.5,
            dashArray: '6, 6',
            fillColor: 'transparent',
            fillOpacity: 0.0,
            interactive: false
        }).addTo(this.perimeterGroup);

        // Vertex points (red dots with white border)
        coordsList.forEach(pt => {
            const vertexIcon = L.divIcon({
                className: 'perimeter-vertex-pin',
                html: `<div style="width: 8px; height: 8px; background: #ef4444; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 6px #ef4444;"></div>`,
                iconSize: [8, 8],
                iconAnchor: [4, 4]
            });
            L.marker([pt.lat, pt.lng], { icon: vertexIcon, interactive: false }).addTo(this.perimeterGroup);
        });
    }

    /**
     * Render the sector partitions (A1..C2) with dashed dividers and labels
     */
    updateSectors(sectors) {
        if (!sectors) return;

        sectors.forEach(sec => {
            const isAlert = sec.status === 'alert';
            const isCompleted = sec.status === 'completed';

            let fillColor = sec.color || '#3b82f6';
            let fillOpacity = isAlert ? 0.35 : 0.18;
            let strokeColor = isAlert ? '#ef4444' : 'rgba(255, 255, 255, 0.6)';

            if (!this.sectorLayers[sec.id]) {
                const poly = L.polygon(sec.coords, {
                    color: strokeColor,
                    weight: 1.5,
                    dashArray: '4, 4',
                    fillColor: fillColor,
                    fillOpacity: fillOpacity,
                    smoothFactor: 1
                });

                // Rich Sector Tooltip
                const tooltipHtml = `
                    <div style="font-family: 'Inter', sans-serif; padding: 4px; font-size: 12px;">
                        <strong style="color: #38bdf8; font-size: 13px;">${sec.name || sec.id}</strong><br>
                        <span style="color: #94a3b8;">Status:</span> <strong style="color: ${isAlert ? '#ef4444' : isCompleted ? '#10b981' : '#fbbf24'};">${sec.status.toUpperCase()}</strong><br>
                        <span style="color: #94a3b8;">Coverage:</span> <strong>${sec.coverage || 0}%</strong><br>
                        ${sec.assigned_drone ? `<span style="color: #94a3b8;">Assigned UAV:</span> <strong style="color: #38bdf8;">${sec.assigned_drone}</strong>` : ''}
                    </div>
                `;
                poly.bindTooltip(tooltipHtml, { sticky: true, className: 'tactical-sector-tooltip' });

                // Calculate centroid for Sector Label
                const centroid = this.calculateCentroid(sec.coords);
                const labelIcon = L.divIcon({
                    className: 'sector-label-overlay',
                    html: `<div style="color: #ffffff; font-weight: 800; font-size: 13px; text-shadow: 0 1px 4px #000, 0 0 8px #000;">${sec.id}</div>`,
                    iconSize: [30, 20],
                    iconAnchor: [15, 10]
                });

                const labelMarker = L.marker(centroid, { icon: labelIcon, interactive: false });

                poly.addTo(this.sectorGroup);
                labelMarker.addTo(this.sectorGroup);

                this.sectorLayers[sec.id] = { poly, labelMarker };
            } else {
                this.sectorLayers[sec.id].poly.setStyle({
                    color: strokeColor,
                    fillColor: fillColor,
                    fillOpacity: fillOpacity
                });
            }
        });
    }

    /**
     * Render or animate drones (D1, D2, D3) with flight paths
     */
    updateDrones(drones) {
        if (!drones) return;

        Object.values(drones).forEach(drone => {
            const pos = [drone.lat, drone.lng];
            const droneColor = drone.color || '#3b82f6';

            // SVG Drone Icon with Heading & Radar Glow
            const droneSvgHtml = `
                <div class="drone-marker-wrapper" style="transform: rotate(${drone.heading || 0}deg);">
                    <div class="drone-scan-cone" style="background: radial-gradient(circle, ${droneColor}44 0%, transparent 70%);"></div>
                    <svg class="drone-svg" viewBox="0 0 32 32" fill="none">
                        <!-- Rotor Arms -->
                        <line x1="8" y1="8" x2="24" y2="24" stroke="${droneColor}" stroke-width="2.5" stroke-linecap="round"/>
                        <line x1="24" y1="8" x2="8" y2="24" stroke="${droneColor}" stroke-width="2.5" stroke-linecap="round"/>
                        <!-- Rotors -->
                        <circle cx="8" cy="8" r="4" fill="${droneColor}33" stroke="${droneColor}" stroke-width="1.5"/>
                        <circle cx="24" cy="8" r="4" fill="${droneColor}33" stroke="${droneColor}" stroke-width="1.5"/>
                        <circle cx="8" cy="24" r="4" fill="${droneColor}33" stroke="${droneColor}" stroke-width="1.5"/>
                        <circle cx="24" cy="24" r="4" fill="${droneColor}33" stroke="${droneColor}" stroke-width="1.5"/>
                        <!-- Drone Body -->
                        <rect x="11" y="11" width="10" height="10" rx="3" fill="#0f172a" stroke="${droneColor}" stroke-width="2"/>
                        <!-- Heading Arrow Pointing UP -->
                        <polygon points="16,12 13,18 19,18" fill="${droneColor}"/>
                    </svg>
                    <span class="drone-label" style="transform: rotate(-${drone.heading || 0}deg); border: 1px solid ${droneColor};">${drone.id}</span>
                </div>
            `;

            const icon = L.divIcon({
                className: 'custom-drone-icon',
                html: droneSvgHtml,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            if (!this.droneMarkers[drone.id]) {
                const marker = L.marker(pos, { icon: icon, zIndexOffset: 1000 });
                marker.addTo(this.droneGroup);
                this.droneMarkers[drone.id] = marker;

                // Drone Flight Trail Polyline
                const trail = L.polyline(drone.history || [pos], {
                    color: droneColor,
                    weight: 2,
                    dashArray: '4, 6',
                    opacity: 0.7,
                    smoothFactor: 1
                }).addTo(this.trailGroup);
                this.droneTrails[drone.id] = trail;
            } else {
                this.droneMarkers[drone.id].setLatLng(pos);
                this.droneMarkers[drone.id].setIcon(icon);

                if (drone.history && drone.history.length > 1) {
                    this.droneTrails[drone.id].setLatLngs(drone.history);
                }
            }
        });
    }

    /**
     * Render Airborne Relay UAV (Alpha Mesh, 750m AGL) and dynamic mesh communication links
     */
    updateRelay(drones) {
        const relayPos = [34.1285, -118.5720];

        // 1. Render or Update Airborne Relay UAV Marker
        if (!this.relayMarker) {
            const relayHtml = `
                <div class="relay-marker-wrapper">
                    <div class="relay-mesh-halo"></div>
                    <div class="relay-marker-core">
                        <svg class="relay-svg" viewBox="0 0 32 32" fill="none">
                            <circle cx="16" cy="16" r="14" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3"/>
                            <polygon points="16,4 20,12 28,16 20,20 16,28 12,20 4,16 12,12" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
                            <circle cx="16" cy="16" r="3.5" fill="#38bdf8"/>
                        </svg>
                    </div>
                    <span class="relay-plate-tag">📡 RELAY [750m]</span>
                </div>
            `;

            const relayIcon = L.divIcon({
                className: 'custom-relay-icon',
                html: relayHtml,
                iconSize: [48, 48],
                iconAnchor: [24, 24]
            });

            this.relayMarker = L.marker(relayPos, { icon: relayIcon, zIndexOffset: 1500 });
            
            const relayTooltipHtml = `
                <div class="tactical-relay-tooltip">
                    <div class="relay-tooltip-title">📡 AIRBORNE RELAY UAV (ALPHA)</div>
                    <div class="relay-tooltip-meta"><b>Altitude:</b> 750m AGL (Loiter Station)</div>
                    <div class="relay-tooltip-meta"><b>Mesh Channel:</b> 5.8 GHz COFDM Multi-Hop</div>
                    <div class="relay-tooltip-meta"><b>Link Status:</b> 100% Signal Integrity (86 Mbps)</div>
                </div>
            `;
            this.relayMarker.bindTooltip(relayTooltipHtml, { sticky: true, className: 'tactical-sector-tooltip' });
            this.relayMarker.addTo(this.relayGroup);
        }

        // 2. Draw Dynamic RF Mesh Links from each active Drone to the Airborne Relay
        if (drones) {
            Object.values(drones).forEach(drone => {
                const dronePos = [drone.lat, drone.lng];
                const linkId = `mesh-relay-${drone.id}`;

                if (!this.meshLines[linkId]) {
                    const poly = L.polyline([dronePos, relayPos], {
                        color: '#38bdf8',
                        weight: 1.5,
                        dashArray: '4, 8',
                        opacity: 0.65,
                        className: 'tactical-mesh-line'
                    }).addTo(this.meshGroup);

                    poly.bindTooltip(`COFDM Mesh Link: ${drone.id} ⇄ RELAY (${drone.rssi || -48} dBm)`, {
                        sticky: true,
                        className: 'tactical-sector-tooltip'
                    });
                    this.meshLines[linkId] = poly;
                } else {
                    this.meshLines[linkId].setLatLngs([dronePos, relayPos]);
                }
            });
        }
    }

    /**
     * Render Target Markers (Verified Victim / Candidate Target)
     */
    updateTargets(targets, onSelectTarget) {
        if (!targets) return;

        targets.forEach(target => {
            if (target.status === 'resolved') {
                if (this.targetMarkers[target.id]) {
                    this.targetGroup.removeLayer(this.targetMarkers[target.id]);
                    delete this.targetMarkers[target.id];
                }
                return;
            }

            const isVictim = target.type === 'victim';
            const iconColor = isVictim ? '#ef4444' : '#f59e0b';
            const iconSvg = isVictim 
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

            const markerHtml = `
                <div class="target-marker-pin ${isVictim ? 'victim-pin' : 'candidate-pin'}" style="background-color: ${iconColor};">
                    ${iconSvg}
                </div>
            `;

            const icon = L.divIcon({
                className: 'custom-target-icon',
                html: markerHtml,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            if (!this.targetMarkers[target.id]) {
                const marker = L.marker([target.lat, target.lng], { icon: icon, zIndexOffset: 900 });
                marker.on('click', () => {
                    if (onSelectTarget) onSelectTarget(target.id);
                });
                marker.addTo(this.targetGroup);
                this.targetMarkers[target.id] = marker;
            } else {
                this.targetMarkers[target.id].setLatLng([target.lat, target.lng]);
            }
        });
    }

    /**
     * Start interactive search perimeter drawing tool
     */
    startDrawPerimeter(onComplete, onCancel) {
        this.isDrawingPerimeter = true;
        this.drawPoints = [];
        this.drawGroup.clearLayers();
        this.onDrawComplete = onComplete;
        this.onDrawCancel = onCancel;

        document.getElementById('perimeterToolbar').style.display = 'flex';
        this.map.getContainer().style.cursor = 'crosshair';
    }

    stopDrawPerimeter() {
        this.isDrawingPerimeter = false;
        this.drawGroup.clearLayers();
        this.drawPoints = [];
        document.getElementById('perimeterToolbar').style.display = 'none';
        this.map.getContainer().style.cursor = '';
    }

    handleMapClick(e) {
        if (!this.isDrawingPerimeter) return;

        const { lat, lng } = e.latlng;
        this.drawPoints.push({ lat, lng });

        // Add marker
        const pin = L.circleMarker([lat, lng], {
            radius: 5,
            color: '#38bdf8',
            fillColor: '#ffffff',
            fillOpacity: 1
        }).addTo(this.drawGroup);

        this.drawMarkers.push(pin);

        // Update preview polyline
        if (this.drawPoints.length > 1) {
            if (this.drawPolyline) this.drawGroup.removeLayer(this.drawPolyline);
            this.drawPolyline = L.polyline(this.drawPoints.map(p => [p.lat, p.lng]), {
                color: '#38bdf8',
                weight: 2,
                dashArray: '5, 5'
            }).addTo(this.drawGroup);
        }
    }

    saveDrawnPerimeter() {
        if (this.drawPoints.length >= 3) {
            const perimeterData = [...this.drawPoints];
            this.stopDrawPerimeter();
            if (this.onDrawComplete) this.onDrawComplete(perimeterData);
        } else {
            alert("Please click at least 3 points on the map to define a search perimeter.");
        }
    }

    fitPerimeter(coordsList) {
        if (coordsList && coordsList.length > 0) {
            const bounds = L.latLngBounds(coordsList.map(c => [c.lat, c.lng]));
            this.map.fitBounds(bounds, { padding: [40, 40] });
        }
    }

    focusTarget(targetLat, targetLng) {
        this.map.flyTo([targetLat, targetLng], 16, { animate: true, duration: 1.2 });
    }

    calculateCentroid(pts) {
        let latSum = 0, lngSum = 0;
        pts.forEach(p => { latSum += p[0]; lngSum += p[1]; });
        return [latSum / pts.length, lngSum / pts.length];
    }
}

// Global instance handle
window.MissionMapController = MissionMapController;
