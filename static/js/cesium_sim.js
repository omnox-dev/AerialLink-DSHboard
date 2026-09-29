/**
 * AerialLink AI — CesiumJS 3D Mountainous SAR Simulation Engine
 * Synchronized with Flask Real-Time Multi-Drone Telemetry
 */

class CesiumSimulationEngine {
    constructor(containerId) {
        this.containerId = containerId;
        this.viewer = null;
        this.isInitialized = false;

        // Entities
        this.droneEntities = {};
        this.relayEntity = null;
        this.targetEntities = {};
        this.sectorEntities = [];
        this.perimeterEntity = null;
        this.commLines = [];

        // Camera Tracking State
        this.activeCameraMode = 'orbit'; // 'orbit', 'D1', 'D2', 'D3', 'target-1'
        this.baseAltitude = 450; // meters above sea level in mountainous terrain

        // Launch Coordinates (Pine Ridge Base)
        this.centerCoords = { lat: 34.1285, lng: -118.5720 };
        
        // ROI Bounding Box Cache (~2x2 km Pine Ridge Search Area)
        this.roiBounds = {
            minLat: 34.1180,
            maxLat: 34.1370,
            minLng: -118.5880,
            maxLng: -118.5520
        };
    }

    async init(config) {
        if (this.isInitialized || !window.Cesium) return;

        try {
            const key = (config && config.basemap_api_key) || '';
            const keyParam = key ? `?key=${key}` : '';

            // 1. High-Resolution Satellite Base Layer (ROI Bounded)
            const esriImagery = new Cesium.ArcGisMapServerImageryProvider({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
                rectangle: Cesium.Rectangle.fromDegrees(
                    this.roiBounds.minLng - 0.08,
                    this.roiBounds.minLat - 0.08,
                    this.roiBounds.maxLng + 0.08,
                    this.roiBounds.maxLat + 0.08
                )
            });

            this.viewer = new Cesium.Viewer(this.containerId, {
                imageryProvider: esriImagery,
                baseLayerPicker: false,
                geocoder: false,
                homeButton: false,
                infoBox: false,
                selectionIndicator: false,
                timeline: false,
                animation: false,
                sceneModePicker: false,
                navigationHelpButton: false,
                fullscreenButton: false,
                scene3DOnly: true
            });

            // 2. Real Vector Landcover & Vegetation Layer (CARTO Voyager Topography & Forest Coverage)
            try {
                const voyagerProvider = new Cesium.UrlTemplateImageryProvider({
                    url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${keyParam}`,
                    rectangle: Cesium.Rectangle.fromDegrees(
                        this.roiBounds.minLng - 0.04,
                        this.roiBounds.minLat - 0.04,
                        this.roiBounds.maxLng + 0.04,
                        this.roiBounds.maxLat + 0.04
                    ),
                    maximumLevel: 19,
                    credit: 'OpenStreetMap, CARTO'
                });
                
                // Add Voyager vector landcover layer with subtle overlay alpha for high terrain detail
                const voyagerLayer = this.viewer.imageryLayers.addImageryProvider(voyagerProvider);
                voyagerLayer.alpha = 0.55; // Blends real vector vegetation, roads, and trails with satellite elevation
                voyagerLayer.brightness = 1.1;
            } catch (e) {
                console.warn("Voyager vector landcover overlay notice:", e);
            }

            // 3. World Terrain with real 3D mountain relief
            try {
                const terrainProvider = await Cesium.createWorldTerrainAsync({
                    requestWaterMask: true,
                    requestVertexNormals: true
                });
                this.viewer.terrainProvider = terrainProvider;
            } catch (e) {
                console.warn("Cesium World Terrain fallback to default:", e);
            }

            // Atmosphere & Lighting
            this.viewer.scene.globe.enableLighting = true;
            this.viewer.scene.globe.depthTestAgainstTerrain = true;
            this.viewer.scene.fog.enabled = true;
            this.viewer.scene.fog.density = 0.00015;

            // 4. Custom Intuitive GIS Mouse Controls & Cursor Handling
            this.setupCustomControls();

            // Initial 45-degree Tactical Orbit Camera over Pine Ridge SAR Area
            this.setCameraOrbitView();

            this.isInitialized = true;
            console.log("CesiumJS 3D SAR Engine Initialized with Custom Cursor & GIS Controls.");
        } catch (err) {
            console.error("Cesium init error:", err);
        }
    }

    /**
     * Reconfigures Cesium bindings for both Mouse & Multi-Touch Screen Gestures:
     * - 1-Finger Drag: Pan / Move Map
     * - 2-Finger Pinch / Spread: Smooth Zoom
     * - 2-Finger Drag (Vertical): 3D Pitch / Tilt angle
     * - 2-Finger Twist: Compass Rotation
     * - Tap: Select Drone / Target
     * - Right Drag / Ctrl+Left Drag: 3D Orbit & Tilt
     * - Scroll Wheel: Smooth Desktop Zoom
     */
    setupCustomControls() {
        if (!this.viewer) return;

        const controller = this.viewer.scene.screenSpaceCameraController;

        // 1. Pan / Rotate (1-Finger Touch or Left Mouse Drag)
        controller.rotateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
        controller.translateEventTypes = [
            Cesium.CameraEventType.LEFT_DRAG,
            {
                eventType: Cesium.CameraEventType.LEFT_DRAG,
                modifier: Cesium.KeyboardEventModifier.SHIFT
            }
        ];

        // 2. 3D Tilt / Pitch (2-Finger Touch Drag, Right Mouse Drag, Middle Drag, or Ctrl+Left Drag)
        controller.tiltEventTypes = [
            Cesium.CameraEventType.PINCH,
            Cesium.CameraEventType.RIGHT_DRAG,
            Cesium.CameraEventType.MIDDLE_DRAG,
            {
                eventType: Cesium.CameraEventType.LEFT_DRAG,
                modifier: Cesium.KeyboardEventModifier.CTRL
            }
        ];

        // 3. Zoom (2-Finger Pinch / Spread & Mouse Wheel & Right Drag)
        controller.zoomEventTypes = [
            Cesium.CameraEventType.WHEEL,
            Cesium.CameraEventType.PINCH,
            Cesium.CameraEventType.RIGHT_DRAG
        ];

        // Smooth Touch & Mouse Momentum
        controller.inertiaSpin = 0.82;
        controller.inertiaTranslate = 0.82;
        controller.inertiaZoom = 0.75;

        // Prevent underground camera clipping
        controller.minimumZoomDistance = 35.0;
        controller.maximumZoomDistance = 7500.0;
        controller.enableCollisionDetection = true;

        // Canvas Touch-Action configuration to prevent browser page-scroll collisions
        const canvas = this.viewer.canvas;
        canvas.style.touchAction = 'none';
        canvas.style.cursor = 'grab';

        canvas.addEventListener('mousedown', () => { canvas.style.cursor = 'grabbing'; });
        canvas.addEventListener('mouseup', () => { canvas.style.cursor = 'grab'; });

        // Touch & Mouse ScreenSpaceEventHandler
        const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

        // Hover entity detection for cursor pointer
        handler.setInputAction((movement) => {
            if (!movement || !movement.endPosition) return;
            try {
                const pickedObject = this.viewer.scene.pick(movement.endPosition);
                if (Cesium.defined(pickedObject) && pickedObject.id) {
                    canvas.style.cursor = 'pointer';
                } else {
                    canvas.style.cursor = 'grab';
                }
            } catch (e) {
                // Safeguard against transient picking errors during rapid camera shifts
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Click / Single-Tap Selection (Cesium handles single touch taps as LEFT_CLICK)
        const handleSelection = (position) => {
            if (!position || !Cesium.defined(position)) return;
            try {
                const pickedObject = this.viewer.scene.pick(position);
                if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.name) {
                    const name = pickedObject.id.name;
                    if (name.includes('D1')) this.highlightEntity('D1');
                    else if (name.includes('D2')) this.highlightEntity('D2');
                    else if (name.includes('D3')) this.highlightEntity('D3');
                    else if (name.includes('Victim') || name.includes('Target')) this.highlightEntity('target-1');
                }
            } catch (e) {
                console.warn('Selection pick error:', e);
            }
        };

        // Desktop Left Click & Touch Screen Tap
        handler.setInputAction((click) => {
            if (click && click.position) {
                handleSelection(click.position);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    setCameraOrbitView() {
        if (!this.viewer) return;
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                this.centerCoords.lng,
                this.centerCoords.lat - 0.025,
                1600.0
            ),
            orientation: {
                heading: Cesium.Math.toRadians(0.0),
                pitch: Cesium.Math.toRadians(-35.0),
                roll: 0.0
            },
            duration: 2.0
        });
        this.viewer.trackedEntity = undefined;
    }

    setCameraMode(mode) {
        this.activeCameraMode = mode;
        if (!this.viewer) return;

        if (mode === 'orbit') {
            this.setCameraOrbitView();
        } else if (this.droneEntities[mode]) {
            // Follow Drone
            this.viewer.trackedEntity = this.droneEntities[mode];
        } else if (this.targetEntities[mode]) {
            // Focus Target
            const targetEnt = this.targetEntities[mode];
            this.viewer.flyTo(targetEnt, {
                offset: new Cesium.HeadingPitchRange(
                    Cesium.Math.toRadians(45.0),
                    Cesium.Math.toRadians(-30.0),
                    350.0
                ),
                duration: 1.5
            });
            this.viewer.trackedEntity = undefined;
        }
    }

    updateState(state) {
        if (!this.isInitialized || !state) return;

        // 1. Update 3D Search Boundary Perimeter
        this.update3DPerimeter(state.perimeter);

        // 2. Update 3D Sectors
        this.update3DSectors(state.sectors);

        // 3. Update 3D Drones + Relay UAV
        this.update3DDrones(state.drones);

        // 4. Update 3D Targets (Victim)
        this.update3DTargets(state.targets);

        // 5. Update 3D Mesh Relay Links
        this.update3DMeshLinks(state.drones);
    }

    update3DPerimeter(perimeter) {
        if (!perimeter || perimeter.length < 3) return;

        const flatPositions = [];
        perimeter.forEach(p => {
            flatPositions.push(p.lng, p.lat);
        });
        // Close loop
        flatPositions.push(perimeter[0].lng, perimeter[0].lat);

        if (!this.perimeterEntity) {
            // Clamped perimeter polyline directly touching the globe terrain
            this.perimeterEntity = this.viewer.entities.add({
                name: "3D Search Boundary (Ground Clamped)",
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArray(flatPositions),
                    width: 4.0,
                    clampToGround: true,
                    material: new Cesium.PolylineDashMaterialProperty({
                        color: Cesium.Color.RED,
                        dashLength: 18.0
                    })
                }
            });

            // Vertex pins touching the ground
            perimeter.forEach(p => {
                this.viewer.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
                    point: {
                        pixelSize: 8,
                        color: Cesium.Color.RED,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    }
                });
            });
        }
    }

    update3DSectors(sectors) {
        if (!sectors || this.sectorEntities.length > 0) return;

        sectors.forEach(sec => {
            const flatCoords = [];
            sec.coords.forEach(pt => {
                flatCoords.push(pt[1], pt[0]); // lng, lat
            });

            const isAlert = sec.status === 'alert';
            const sectorColor = isAlert 
                ? Cesium.Color.RED.withAlpha(0.25)
                : Cesium.Color.fromCssColorString(sec.color || '#3b82f6').withAlpha(0.18);

            // Draped directly on the globe terrain (no fixed altitude offset)
            const ent = this.viewer.entities.add({
                name: sec.name || sec.id,
                polygon: {
                    hierarchy: Cesium.Cartesian3.fromDegreesArray(flatCoords),
                    material: sectorColor,
                    classificationType: Cesium.ClassificationType.TERRAIN,
                    outline: true,
                    outlineColor: isAlert ? Cesium.Color.RED : Cesium.Color.WHITE.withAlpha(0.6),
                    outlineWidth: 2
                }
            });
            this.sectorEntities.push(ent);
        });
    }

    update3DDrones(drones) {
        if (!drones) return;

        // Enhanced Decent Tactical Palette
        const dronePalette = {
            'D1': { color: Cesium.Color.fromCssColorString('#00d2ff'), hex: '#00d2ff' }, // Electric Cyan
            'D2': { color: Cesium.Color.fromCssColorString('#ff9100'), hex: '#ff9100' }, // Safety Amber/Orange
            'D3': { color: Cesium.Color.fromCssColorString('#c084fc'), hex: '#c084fc' }  // Neon Violet
        };

        // 1. Airborne Relay UAV (750m AGL)
        if (!this.relayEntity) {
            const relayPos = Cesium.Cartesian3.fromDegrees(this.centerCoords.lng, this.centerCoords.lat, 750);
            this.relayEntity = this.viewer.entities.add({
                name: "Relay UAV (Alpha Mesh)",
                position: relayPos,
                point: {
                    pixelSize: 12,
                    color: Cesium.Color.fromCssColorString('#38bdf8'),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                },
                // Crisp Tactical Label Plate (Zero noise / artifacts)
                label: {
                    text: "📡 AIRBORNE RELAY [750m]",
                    font: "bold 12px 'JetBrains Mono', sans-serif",
                    fillColor: Cesium.Color.fromCssColorString('#38bdf8'),
                    showBackground: true,
                    backgroundColor: Cesium.Color.fromCssColorString('rgba(11, 17, 32, 0.92)'),
                    backgroundPadding: new Cesium.Cartesian2(8, 4),
                    style: Cesium.LabelStyle.FILL,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -18)
                },
                cylinder: {
                    length: 400,
                    topRadius: 0.5,
                    bottomRadius: 25.0,
                    material: Cesium.Color.fromCssColorString('#38bdf8').withAlpha(0.08),
                    outline: false
                }
            });
        }

        // 2. Active Drones (D1, D2, D3)
        Object.values(drones).forEach(drone => {
            const alt = 480 + (drone.altitude || 50);
            const dronePos = Cesium.Cartesian3.fromDegrees(drone.lng, drone.lat, alt);
            const palette = dronePalette[drone.id] || { color: Cesium.Color.CYAN, hex: '#38bdf8' };

            const isHighlighted = this.highlightedDroneId === drone.id;
            const pointSize = isHighlighted ? 18 : 13;

            if (!this.droneEntities[drone.id]) {
                const ent = this.viewer.entities.add({
                    name: `UAV ${drone.id} (${drone.callsign || 'Searcher'})`,
                    position: dronePos,
                    point: {
                        pixelSize: pointSize,
                        color: palette.color,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: isHighlighted ? 3 : 2
                    },
                    // Crisp Tactical HUD Plate
                    label: {
                        text: `🚁 ${drone.id} • ${drone.state.toUpperCase()} (${drone.battery}%)`,
                        font: "bold 12px 'JetBrains Mono', monospace",
                        fillColor: palette.color,
                        showBackground: true,
                        backgroundColor: Cesium.Color.fromCssColorString('rgba(11, 17, 32, 0.92)'),
                        backgroundPadding: new Cesium.Cartesian2(9, 5),
                        style: Cesium.LabelStyle.FILL,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20)
                    },
                    // Vertical altitude drop-line to terrain
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            const curPos = ent.position.getValue(Cesium.JulianDate.now());
                            if (!curPos) return [];
                            const carto = Cesium.Cartographic.fromCartesian(curPos);
                            const groundPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
                            return [curPos, groundPos];
                        }, false),
                        width: 1.5,
                        material: new Cesium.PolylineDashMaterialProperty({
                            color: palette.color.withAlpha(0.6),
                            dashLength: 8.0
                        })
                    }
                });
                this.droneEntities[drone.id] = ent;
            } else {
                const ent = this.droneEntities[drone.id];
                ent.position = dronePos;
                ent.point.pixelSize = pointSize;
                ent.point.outlineWidth = isHighlighted ? 3 : 2;
                ent.label.text = `🚁 ${drone.id} • ${drone.state.toUpperCase()} (${drone.battery}%)`;
            }
        });
    }

    update3DTargets(targets) {
        if (!targets) return;

        targets.forEach(t => {
            if (t.status === 'resolved') {
                if (this.targetEntities[t.id]) {
                    this.viewer.entities.remove(this.targetEntities[t.id]);
                    delete this.targetEntities[t.id];
                }
                return;
            }

            const targetPos = Cesium.Cartesian3.fromDegrees(t.lng, t.lat);

            if (!this.targetEntities[t.id]) {
                const ent = this.viewer.entities.add({
                    name: t.title,
                    position: targetPos,
                    point: {
                        pixelSize: 15,
                        color: Cesium.Color.fromCssColorString('#ef4444'),
                        outlineColor: Cesium.Color.fromCssColorString('#fef08a'),
                        outlineWidth: 2,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    },
                    // Ultra-Crisp Tactical Plate (No noise/static)
                    label: {
                        text: `🚨 ${t.title.toUpperCase()} • ${(t.confidence * 100).toFixed(0)}% MATCH`,
                        font: "bold 12px 'Inter', sans-serif",
                        fillColor: Cesium.Color.fromCssColorString('#fef08a'),
                        showBackground: true,
                        backgroundColor: Cesium.Color.fromCssColorString('rgba(11, 17, 32, 0.94)'),
                        backgroundPadding: new Cesium.Cartesian2(10, 6),
                        style: Cesium.LabelStyle.FILL,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -22),
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    },
                    ellipse: {
                        semiMinorAxis: 24.0,
                        semiMajorAxis: 24.0,
                        material: Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.35),
                        outline: true,
                        outlineColor: Cesium.Color.fromCssColorString('#fef08a'),
                        outlineWidth: 2,
                        classificationType: Cesium.ClassificationType.TERRAIN
                    }
                });
                this.targetEntities[t.id] = ent;
            }
        });
    }

    /**
     * Highlights drone or target when hovering/clicking on the legend
     */
    highlightEntity(id) {
        this.highlightedDroneId = id;
        if (id && this.droneEntities[id]) {
            this.setCameraMode(id);
        } else if (id && this.targetEntities[id]) {
            this.setCameraMode(id);
        } else if (id === 'relay' && this.relayEntity) {
            this.viewer.flyTo(this.relayEntity, {
                offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-25), 450)
            });
        } else if (id === 'all') {
            this.setCameraOrbitView();
        }
    }

    update3DMeshLinks(drones) {
        if (!drones || !this.viewer) return;

        // Clear previous comm lines
        this.commLines.forEach(line => this.viewer.entities.remove(line));
        this.commLines = [];

        const relayPos = Cesium.Cartesian3.fromDegrees(this.centerCoords.lng, this.centerCoords.lat, 650);

        // Draw dynamic mesh comm lines from each UAV to Airborne Relay
        Object.values(drones).forEach(d => {
            const droneAlt = 420 + (d.altitude || 50);
            const dronePos = Cesium.Cartesian3.fromDegrees(d.lng, d.lat, droneAlt);

            const isWeak = d.rssi < -75;
            const linkColor = isWeak ? Cesium.Color.ORANGE.withAlpha(0.7) : Cesium.Color.CYAN.withAlpha(0.7);

            const lineEnt = this.viewer.entities.add({
                polyline: {
                    positions: [dronePos, relayPos],
                    width: 2.0,
                    material: new Cesium.PolylineGlowMaterialProperty({
                        glowPower: 0.25,
                        color: linkColor
                    })
                }
            });
            this.commLines.push(lineEnt);
        });
    }

    resize() {
        if (this.viewer) {
            this.viewer.resize();
        }
    }
}

window.CesiumSimulationEngine = CesiumSimulationEngine;
