/**
 * AerialLink AI — Main Mission Control Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Initialize Leaflet Map Controller
    const mapController = new MissionMapController('leafletMap');

    // Initialize Cesium 3D Simulation Engine
    const cesiumEngine = new CesiumSimulationEngine('cesiumContainer');

    // Local State
    let currentState = null;
    let selectedTargetId = 'target-1';
    let currentSensorTab = 'images';
    let currentImageMode = 'rgb';
    let eventSource = null;
    let currentEngineMode = '2D'; // '2D' or '3D'

    // DOM Elements
    const droneListContainer = document.getElementById('droneListContainer');
    const alertFeedContainer = document.getElementById('alertFeedContainer');
    const targetDetailsPanel = document.getElementById('targetDetailsPanel');
    const coverageText = document.getElementById('coverageText');
    const coverageFill = document.getElementById('coverageFill');
    const missionTimeText = document.getElementById('missionTimeText');
    const linkStatusText = document.getElementById('linkStatusText');
    const activeDronesCount = document.getElementById('activeDronesCount');
    const droneCountBadge = document.getElementById('droneCountBadge');

    // Mode Switcher Elements
    const btnMode2D = document.getElementById('btnMode2D');
    const btnMode3D = document.getElementById('btnMode3D');
    const leafletCanvas = document.getElementById('leafletMap');
    const cesiumCanvas = document.getElementById('cesiumContainer');
    const layerSelector2D = document.getElementById('layerSelector2D');
    const cameraFollowSelector = document.getElementById('cameraFollowSelector');

    // 2D / 3D Engine Mode Toggle
    btnMode2D.addEventListener('click', () => {
        currentEngineMode = '2D';
        btnMode2D.classList.add('active');
        btnMode3D.classList.remove('active');
        leafletCanvas.style.display = 'block';
        cesiumCanvas.style.display = 'none';
        layerSelector2D.style.display = 'flex';
        cameraFollowSelector.style.display = 'none';
        mapController.map.invalidateSize();
        showToast('Switched to 2D Tactical GIS Map', 'info');
    });

    btnMode3D.addEventListener('click', async () => {
        currentEngineMode = '3D';
        btnMode3D.classList.add('active');
        btnMode2D.classList.remove('active');
        leafletCanvas.style.display = 'none';
        cesiumCanvas.style.display = 'block';
        layerSelector2D.style.display = 'none';
        cameraFollowSelector.style.display = 'flex';

        if (!cesiumEngine.isInitialized) {
            showToast('Loading 3D Mountainous Terrain & Vector Landcover...', 'info');
            await cesiumEngine.init(window.currentEnvConfig);
        }

        if (currentState) {
            cesiumEngine.updateState(currentState);
        }
        cesiumEngine.resize();
        showToast('Active: Cesium 3D Autonomous UAV Simulation', 'success');
    });

    // 3D Camera Follow Controls
    document.querySelectorAll('.camera-follow-selector .cam-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.camera-follow-selector .cam-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const camMode = btn.getAttribute('data-cam');
            cesiumEngine.setCameraMode(camMode);
            showToast(`3D Camera: ${btn.textContent}`, 'info');
        });
    });

    // Target Details Elements
    const targetTitle = document.getElementById('targetTitle');
    const targetTime = document.getElementById('targetTime');
    const targetSector = document.getElementById('targetSector');
    const targetDetectedBy = document.getElementById('targetDetectedBy');
    const targetConfidenceBadge = document.getElementById('targetConfidenceBadge');
    const mainTargetImage = document.getElementById('mainTargetImage');
    const bboxTag = document.getElementById('bboxTag');
    const targetNotesText = document.getElementById('targetNotesText');
    const targetAvatar = document.getElementById('targetAvatar');
    const btnResolveTarget = document.getElementById('btnResolveTarget');

    // Mission Control Buttons
    const btnDrawPerimeter = document.getElementById('btnDrawPerimeter');
    const btnDeploy = document.getElementById('btnDeploy');
    const btnRTLAll = document.getElementById('btnRTLAll');
    const btnAbort = document.getElementById('btnAbort');
    const btnSavePerimeter = document.getElementById('btnSavePerimeter');
    const btnCancelPerimeter = document.getElementById('btnCancelPerimeter');

    // Theme Toggle Handler
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    // Check saved theme or default to dark
    const savedTheme = localStorage.getItem('aeriallink_theme') || 'dark';
    applyTheme(savedTheme);

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            showToast(`Theme switched to ${newTheme.toUpperCase()} mode`, 'info');
        });
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
            if (btnThemeToggle) btnThemeToggle.setAttribute('title', 'Switch to Dark Mode');
            mapController.setTheme('light');
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
            if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
            if (btnThemeToggle) btnThemeToggle.setAttribute('title', 'Switch to Light Mode');
            mapController.setTheme('dark');
        }
        localStorage.setItem('aeriallink_theme', theme);
        if (window.lucide) lucide.createIcons();
    }

    // Layer Switcher Buttons
    document.querySelectorAll('.map-layer-selector .layer-btn[data-layer]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.map-layer-selector .layer-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const layer = btn.getAttribute('data-layer');
            mapController.setTileLayer(layer);
        });
    });

    // Interactive Map Legend Highlight Handlers (2D + 3D)
    document.querySelectorAll('.legend-item.interactive').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-legend-target');
            document.querySelectorAll('.legend-item.interactive').forEach(i => i.classList.remove('active-legend-glow'));
            item.classList.add('active-legend-glow');

            if (currentEngineMode === '3D') {
                if (targetId === 'D1' || targetId === 'D2' || targetId === 'D3') {
                    cesiumEngine.highlightEntity(targetId);
                    showToast(`Tracking Drone ${targetId} in 3D`, 'info');
                } else if (targetId === 'target-1' || targetId === 'target-2') {
                    selectTarget(targetId);
                    cesiumEngine.highlightEntity(targetId);
                    showToast(`Focusing Target ${targetId} in 3D`, 'info');
                } else if (targetId === 'relay') {
                    cesiumEngine.highlightEntity('relay');
                    showToast('Focusing Airborne Relay UAV in 3D', 'info');
                } else {
                    cesiumEngine.highlightEntity('all');
                }
            } else {
                // 2D Map Focus
                if (targetId === 'D1' || targetId === 'D2' || targetId === 'D3') {
                    if (currentState && currentState.drones[targetId]) {
                        const d = currentState.drones[targetId];
                        mapController.focusTarget(d.lat, d.lng);
                        showToast(`Tracking Drone ${targetId} on 2D Map`, 'info');
                    }
                } else if (targetId === 'relay') {
                    mapController.focusTarget(34.1285, -118.5720);
                    showToast('Tracking Airborne Relay UAV (750m AGL)', 'info');
                } else if (targetId === 'target-1' || targetId === 'target-2') {
                    selectTarget(targetId);
                } else if (targetId === 'boundary' || targetId === 'sectors') {
                    if (currentState && currentState.perimeter) {
                        mapController.fitPerimeter(currentState.perimeter);
                    }
                }
            }
        });
    });

    document.getElementById('btnRecenter').addEventListener('click', () => {
        if (currentState && currentState.perimeter) {
            mapController.fitPerimeter(currentState.perimeter);
        }
    });

    document.getElementById('btnFullscreen').addEventListener('click', () => {
        const elem = document.querySelector('.center-panel');
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => console.log(err));
        } else {
            document.exitFullscreen();
        }
    });

    // Sensor Tabs Switcher (Images / Telemetry / Notes)
    document.querySelectorAll('.sensor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sensor-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSensorTab = tab.getAttribute('data-tab');

            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            if (currentSensorTab === 'images') document.getElementById('tabPaneImages').classList.add('active');
            if (currentSensorTab === 'telemetry') document.getElementById('tabPaneTelemetry').classList.add('active');
            if (currentSensorTab === 'notes') document.getElementById('tabPaneNotes').classList.add('active');
        });
    });

    // Multi-spectral Thumbnail Selector
    document.querySelectorAll('.thumb-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.thumb-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const imgSrc = card.getAttribute('data-img');
            const imgType = card.getAttribute('data-type');
            currentImageMode = imgType;
            mainTargetImage.src = imgSrc;

            // Adjust bounding box label
            if (imgType === 'flir') {
                bboxTag.textContent = 'Thermal Sig: 34.5°C';
            } else if (imgType === 'nvg') {
                bboxTag.textContent = 'Target Match 94%';
            } else {
                bboxTag.textContent = 'Human 92%';
            }
        });
    });

    // Close Target Details Drawer
    document.getElementById('btnCloseTargetDetails').addEventListener('click', () => {
        targetDetailsPanel.classList.remove('open');
    });

    // Mark as Resolved Button
    btnResolveTarget.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/target/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: selectedTargetId })
            });
            const data = await resp.json();
            if (data.success) {
                showToast('Target marked as RESOLVED. Ground SAR team dispatched.', 'success');
                btnResolveTarget.innerHTML = `<i data-lucide="check-check"></i> <span>Resolved & Logged</span>`;
                btnResolveTarget.style.borderColor = '#10b981';
                btnResolveTarget.style.color = '#10b981';
                if (window.lucide) lucide.createIcons();
            }
        } catch (e) {
            console.error('Failed to resolve target:', e);
        }
    });

    // Mission Control Event Handlers
    btnDeploy.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/mission/deploy', { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                showToast('Mission Deployed: Autonomous swarm search active.', 'success');
            }
        } catch (e) {
            console.error('Deploy error:', e);
        }
    });

    btnRTLAll.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/mission/rtl', { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                showToast('RTL All: UAVs returning to launch pad.', 'warning');
            }
        } catch (e) {
            console.error('RTL error:', e);
        }
    });

    btnAbort.addEventListener('click', async () => {
        try {
            const resp = await fetch('/api/mission/abort', { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                showToast('Emergency ABORT: Swarm hovering.', 'danger');
            }
        } catch (e) {
            console.error('Abort error:', e);
        }
    });

    // Draw Perimeter Handlers
    btnDrawPerimeter.addEventListener('click', () => {
        showToast('Click points on the map to define custom perimeter.', 'info');
        mapController.startDrawPerimeter(async (newPerimeter) => {
            try {
                const resp = await fetch('/api/mission/set-perimeter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ perimeter: newPerimeter })
                });
                const res = await resp.json();
                if (res.success) {
                    showToast('Search perimeter updated successfully!', 'success');
                }
            } catch (err) {
                console.error('Save perimeter error:', err);
            }
        });
    });

    btnSavePerimeter.addEventListener('click', () => {
        mapController.saveDrawnPerimeter();
    });

    btnCancelPerimeter.addEventListener('click', () => {
        mapController.stopDrawPerimeter();
    });

    // Settings Modal Handlers
    const settingsModal = document.getElementById('settingsModal');
    document.getElementById('btnSettings').addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });
    document.getElementById('btnCloseSettings').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    document.getElementById('btnModalClose').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    document.getElementById('btnModalSave').addEventListener('click', () => {
        settingsModal.style.display = 'none';
        showToast('Settings updated successfully.', 'success');
    });

    // Slider inputs in modal
    const cfgConfidence = document.getElementById('cfgConfidence');
    const cfgConfidenceVal = document.getElementById('cfgConfidenceVal');
    cfgConfidence.addEventListener('input', () => {
        cfgConfidenceVal.textContent = `${cfgConfidence.value}%`;
    });

    const cfgSpeed = document.getElementById('cfgSpeed');
    const cfgSpeedVal = document.getElementById('cfgSpeedVal');
    cfgSpeed.addEventListener('input', () => {
        cfgSpeedVal.textContent = `${cfgSpeed.value} m/s`;
    });

    /**
     * Updates Dashboard UI from state
     */
    function updateDashboard(state) {
        currentState = state;

        // Top Header stats
        if (state.formatted_time) {
            missionTimeText.textContent = state.formatted_time;
        }

        const activeCount = Object.values(state.drones).filter(d => d.state !== 'Landed' && d.state !== 'Lost').length;
        const totalCount = Object.keys(state.drones).length;
        activeDronesCount.textContent = `${activeCount}/${totalCount}`;
        droneCountBadge.textContent = `(${activeCount}/${totalCount})`;

        // Coverage meter
        coverageText.textContent = `${state.coverage_percent}%`;
        coverageFill.style.width = `${state.coverage_percent}%`;

        // Render Left Panel Drone List
        renderDroneList(state.drones);

        // Render AI Decision Feed
        renderAlertFeed(state.alerts);

        // Update 2D Map Layers
        mapController.updatePerimeter(state.perimeter);
        mapController.updateSectors(state.sectors);
        mapController.updateDrones(state.drones);
        mapController.updateRelay(state.drones);
        mapController.updateTargets(state.targets, (tId) => selectTarget(tId));

        // Update 3D Cesium Simulation Engine
        if (cesiumEngine.isInitialized) {
            cesiumEngine.updateState(state);
        }

        // Update Target Details Drawer
        updateTargetDetailsView(state.targets);

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    /**
     * Render Left Panel Drone Status Rows matching reference
     */
    function renderDroneList(drones) {
        if (!drones) return;

        let html = '';
        Object.values(drones).forEach(d => {
            const dotClass = d.id.toLowerCase();
            const stateClass = d.state.toLowerCase();
            
            html += `
                <div class="drone-row" data-drone="${d.id}">
                    <div class="drone-identity">
                        <span class="drone-dot ${dotClass}"></span>
                        <span>${d.id}</span>
                    </div>

                    <div class="drone-metrics">
                        <div class="metric-item" title="Battery Level">
                            <i data-lucide="battery"></i>
                            <span>${d.battery}%</span>
                        </div>
                        <div class="metric-item" title="Link RSSI">
                            <i data-lucide="signal"></i>
                            <span>${d.rssi} dBm</span>
                        </div>
                    </div>

                    <span class="state-badge ${stateClass}">${d.state}</span>

                    <button class="drone-more-btn" title="Options">
                        <i data-lucide="more-vertical"></i>
                    </button>
                </div>
            `;
        });

        droneListContainer.innerHTML = html;
    }

    /**
     * Render Left Panel AI Decision / Alert Feed matching reference
     */
    function renderAlertFeed(alerts) {
        if (!alerts) return;

        let html = '';
        alerts.forEach(a => {
            let itemClass = '';
            let iconWrapperClass = 'info-icon';
            let iconName = 'info';

            if (a.type === 'verified_target') {
                itemClass = 'highlighted-critical';
                iconWrapperClass = 'victim-icon';
                iconName = 'user';
            } else if (a.type === 'candidate_target') {
                itemClass = 'highlighted-warning';
                iconWrapperClass = 'candidate-icon';
                iconName = 'crosshair';
            } else if (a.type === 'sector_complete') {
                iconWrapperClass = 'success-icon';
                iconName = 'check-circle-2';
            } else if (a.icon === 'battery-alert') {
                iconWrapperClass = 'warning-icon';
                iconName = 'alert-triangle';
            }

            html += `
                <div class="alert-item ${itemClass}" data-alert-id="${a.id}" data-target-id="${a.target_id || ''}" data-drone-id="${a.drone_id || ''}">
                    <span class="alert-time mono-font">${a.time}</span>
                    <div class="alert-icon-wrapper ${iconWrapperClass}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <div class="alert-details">
                        <span class="alert-title">${a.title}</span>
                        <span class="alert-sub">${a.subtitle}</span>
                    </div>
                    <i data-lucide="chevron-right" class="alert-arrow"></i>
                </div>
            `;
        });

        alertFeedContainer.innerHTML = html;

        // Add click listener to alert cards to focus target/drone on map
        alertFeedContainer.querySelectorAll('.alert-item').forEach(el => {
            el.addEventListener('click', () => {
                const targetId = el.getAttribute('data-target-id');
                const droneId = el.getAttribute('data-drone-id');

                if (targetId) {
                    selectTarget(targetId);
                } else if (droneId && currentState && currentState.drones[droneId]) {
                    const drone = currentState.drones[droneId];
                    mapController.focusTarget(drone.lat, drone.lng);
                }
            });
        });
    }

    /**
     * Focus and select a target
     */
    function selectTarget(targetId) {
        selectedTargetId = targetId;
        targetDetailsPanel.classList.add('open');

        if (currentState && currentState.targets) {
            const target = currentState.targets.find(t => t.id === targetId);
            if (target) {
                mapController.focusTarget(target.lat, target.lng);
                updateTargetDetailsView(currentState.targets);
            }
        }
    }

    /**
     * Update Target Details Panel view
     */
    function updateTargetDetailsView(targets) {
        if (!targets) return;
        const target = targets.find(t => t.id === selectedTargetId) || targets[0];
        if (!target) return;

        targetTitle.textContent = target.title;
        targetTime.textContent = target.time;
        targetSector.textContent = target.sector;
        targetDetectedBy.textContent = target.detected_by;
        targetConfidenceBadge.textContent = `Confidence: ${target.confidence}`;

        if (target.type === 'victim') {
            targetAvatar.className = 'target-avatar victim-avatar';
            targetAvatar.innerHTML = `<i data-lucide="user"></i>`;
            targetConfidenceBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            targetConfidenceBadge.style.color = '#34d399';
        } else {
            targetAvatar.className = 'target-avatar candidate-avatar';
            targetAvatar.innerHTML = `<i data-lucide="help-circle"></i>`;
            targetConfidenceBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            targetConfidenceBadge.style.color = '#fbbf24';
        }

        if (target.telemetry) {
            document.getElementById('telAltitude').textContent = target.telemetry.altitude || '38.2 m AGL';
            document.getElementById('telHeat').textContent = target.telemetry.heat_signature || '34.5°C';
            document.getElementById('telBearing').textContent = target.telemetry.bearing || '045° NNE';
            document.getElementById('telDistance').textContent = target.telemetry.distance || '142 m';
            document.getElementById('telCrossCorr').textContent = target.telemetry.cross_correlation || '98.4%';
        }

        if (target.notes) {
            targetNotesText.textContent = target.notes;
        }

        if (target.status === 'resolved') {
            btnResolveTarget.innerHTML = `<i data-lucide="check-check"></i> <span>Resolved & Logged</span>`;
            btnResolveTarget.style.borderColor = '#10b981';
            btnResolveTarget.style.color = '#10b981';
        } else {
            btnResolveTarget.innerHTML = `<i data-lucide="map-pin"></i> <span>Mark as Resolved</span>`;
            btnResolveTarget.style.borderColor = '#38bdf8';
            btnResolveTarget.style.color = '#38bdf8';
        }
    }

    /**
     * Toast notification system
     */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'warning') icon = 'alert-triangle';
        if (type === 'danger') icon = 'alert-octagon';

        toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        if (window.lucide) lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Connect to Server-Sent Events (SSE) stream for real-time telemetry
     */
    function startRealTimeSync() {
        // Fetch environment config and apply any basemap API keys & 3D toggle
        fetch('/api/config')
            .then(res => res.json())
            .then(cfg => {
                if (cfg) {
                    window.currentEnvConfig = cfg;
                    // Check if 3D simulation is enabled in .env
                    const engineGroup = document.querySelector('.engine-mode-group');
                    if (cfg.enable_3d_simulation === false) {
                        if (engineGroup) engineGroup.style.display = 'none';
                        if (btnMode3D) btnMode3D.style.display = 'none';
                    } else {
                        if (engineGroup) engineGroup.style.display = 'flex';
                        if (btnMode3D) btnMode3D.style.display = 'inline-flex';
                    }

                    // Configure custom basemap keys
                    if (cfg.basemap_api_key || cfg.mapbox_access_token || cfg.maptiler_api_key || cfg.stadia_api_key) {
                        mapController.configureApiKeys(cfg);
                    }
                }
            })
            .catch(err => console.log('Config load error:', err));

        // Initial state fetch
        fetch('/api/mission-state')
            .then(res => res.json())
            .then(data => {
                updateDashboard(data);
                // Initial fit to perimeter
                if (data.perimeter) {
                    mapController.fitPerimeter(data.perimeter);
                }
            })
            .catch(err => console.error('Initial state fetch failed:', err));

        let receivedFirstSSE = false;
        let sseWatchdog = null;

        function startPollingFallback() {
            if (window._isPollingActive) return;
            window._isPollingActive = true;
            console.log('Starting high-frequency polling fallback for real-time telemetry.');
            setInterval(() => {
                fetch('/api/mission-state')
                    .then(res => res.json())
                    .then(data => updateDashboard(data))
                    .catch(e => console.error('Poll failed:', e));
            }, 800);
        }

        // Connect SSE Stream
        if (window.EventSource) {
            try {
                eventSource = new EventSource('/api/stream');
                
                // Watchdog: If no SSE message arrives within 2.5s, activate fallback polling
                sseWatchdog = setTimeout(() => {
                    if (!receivedFirstSSE) {
                        console.warn('SSE stream delayed/buffered by proxy, activating fallback polling.');
                        startPollingFallback();
                    }
                }, 2500);

                eventSource.onmessage = (event) => {
                    try {
                        receivedFirstSSE = true;
                        if (sseWatchdog) clearTimeout(sseWatchdog);
                        const data = JSON.parse(event.data);
                        updateDashboard(data);
                    } catch (e) {
                        console.error('Error parsing SSE event:', e);
                    }
                };
                
                eventSource.onerror = (err) => {
                    console.warn('SSE connection interrupted, falling back to polling.');
                    try { eventSource.close(); } catch (e) {}
                    startPollingFallback();
                };
            } catch (err) {
                console.warn('EventSource initialization failed, using polling fallback.', err);
                startPollingFallback();
            }
        } else {
            startPollingFallback();
        }

    // Launch Real-time Sync
    startRealTimeSync();
});
