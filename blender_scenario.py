"""
AerialLink AI — Blender 3D SAR Mission Scenario Generator
Universal Compatibility: Works with Blender 2.80, 3.x, 4.x+

How to run:
1. Open Blender
2. Go to the 'Scripting' tab (top workspace bar)
3. Click 'Open' and select this file (blender_scenario.py), or paste this code
4. Click 'Run Script' (Play button ▶)
"""

import bpy
import math

def get_active():
    """Safely retrieves the active object across all Blender versions."""
    if hasattr(bpy.context, "active_object") and bpy.context.active_object:
        return bpy.context.active_object
    if hasattr(bpy.context, "view_layer") and bpy.context.view_layer.objects.active:
        return bpy.context.view_layer.objects.active
    if bpy.context.selected_objects:
        return bpy.context.selected_objects[0]
    return None

def setup_scene():
    # 1. Clean existing scene objects without corrupting context
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 250

    # 2. Create Mountainous SAR Terrain
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=64,
        y_subdivisions=64,
        size=100,
        location=(0, 0, 0)
    )
    terrain = get_active()
    terrain.name = "Pine_Ridge_Terrain"
    
    # Add displacement modifier for mountain peaks & ridgelines
    disp_mod = terrain.modifiers.new(name="Displace", type='DISPLACE')
    tex = bpy.data.textures.new("Clouds_Mountain", type='CLOUDS')
    tex.noise_scale = 1.8
    tex.noise_depth = 4
    disp_mod.texture = tex
    disp_mod.strength = 14.0

    # Terrain Dark Forest Material
    mat_terrain = bpy.data.materials.new(name="Terrain_Mat")
    mat_terrain.use_nodes = True
    nodes = mat_terrain.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        if 'Base Color' in bsdf.inputs:
            bsdf.inputs['Base Color'].default_value = (0.05, 0.10, 0.05, 1.0) # Forest pine green
        if 'Roughness' in bsdf.inputs:
            bsdf.inputs['Roughness'].default_value = 0.95
    terrain.data.materials.append(mat_terrain)

    # 3. Add Victim (Red Emergency Jacket in Sector B3 Clearing)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.4, depth=1.7, location=(18, 12, 4.5))
    victim = get_active()
    victim.name = "Victim_RedJacket"
    mat_red = bpy.data.materials.new(name="Red_Jacket")
    mat_red.use_nodes = True
    bsdf_red = mat_red.node_tree.nodes.get("Principled BSDF")
    if bsdf_red:
        if 'Base Color' in bsdf_red.inputs:
            bsdf_red.inputs['Base Color'].default_value = (0.95, 0.05, 0.05, 1.0)
        # Compatible emission across Blender 3.x and 4.x
        if 'Emission Color' in bsdf_red.inputs:
            bsdf_red.inputs['Emission Color'].default_value = (0.9, 0.0, 0.0, 1.0)
        elif 'Emission' in bsdf_red.inputs:
            bsdf_red.inputs['Emission'].default_value = (0.9, 0.0, 0.0, 1.0)
        if 'Emission Strength' in bsdf_red.inputs:
            bsdf_red.inputs['Emission Strength'].default_value = 1.0
    victim.data.materials.append(mat_red)

    # 4. Create UAV Drones
    drones = [
        {"name": "Drone_D1_Blue", "color": (0.1, 0.4, 0.95, 1.0), "start": (-20, -10, 16)},
        {"name": "Drone_D2_Orange", "color": (0.95, 0.4, 0.05, 1.0), "start": (15, 10, 14)},
        {"name": "Drone_D3_Purple", "color": (0.6, 0.1, 0.9, 1.0), "start": (-5, -20, 15)}
    ]

    for d in drones:
        # UAV Body Frame
        bpy.ops.mesh.primitive_cube_add(size=1.4, location=d["start"])
        uav = get_active()
        uav.name = d["name"]
        
        mat_uav = bpy.data.materials.new(name=f"Mat_{d['name']}")
        mat_uav.use_nodes = True
        bsdf_uav = mat_uav.node_tree.nodes.get("Principled BSDF")
        if bsdf_uav:
            if 'Base Color' in bsdf_uav.inputs:
                bsdf_uav.inputs['Base Color'].default_value = d["color"]
            if 'Metallic' in bsdf_uav.inputs:
                bsdf_uav.inputs['Metallic'].default_value = 0.85
        uav.data.materials.append(mat_uav)

        # UAV Downward Spotlight / Tactical Sensor Beam
        bpy.ops.object.light_add(type='SPOT', radius=1.0, location=(d["start"][0], d["start"][1], d["start"][2] - 0.6))
        spot = get_active()
        spot.name = f"Spotlight_{d['name']}"
        spot.data.energy = 800
        spot.data.spot_size = math.radians(50)
        spot.data.color = (d["color"][0], d["color"][1], d["color"][2])
        spot.parent = uav

        # Animate Flight Path Keyframes
        uav.keyframe_insert(data_path="location", frame=1)
        if d["name"] == "Drone_D2_Orange":
            # D2 Orbits Victim at frame 120 and 240
            uav.location = (18 + 6 * math.cos(0), 12 + 6 * math.sin(0), 14)
            uav.keyframe_insert(data_path="location", frame=120)
            uav.location = (18 + 6 * math.cos(math.pi), 12 + 6 * math.sin(math.pi), 14)
            uav.keyframe_insert(data_path="location", frame=240)
        elif d["name"] == "Drone_D1_Blue":
            uav.location = (-10, 5, 16)
            uav.keyframe_insert(data_path="location", frame=120)
            uav.location = (0, -10, 16)
            uav.keyframe_insert(data_path="location", frame=240)

    # 5. Mission Camera (Angled 3D SAR Perspective)
    bpy.ops.object.camera_add(location=(32, -8, 28), rotation=(math.radians(60), 0, math.radians(50)))
    cam = get_active()
    cam.name = "SAR_Mission_Camera"
    scene.camera = cam

    # 6. Sun / Tactical Lighting
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 50))
    sun = get_active()
    sun.data.energy = 2.0
    sun.data.color = (0.85, 0.9, 1.0)

    print("AerialLink 3D SAR Mission Scenario successfully generated in Blender!")

if __name__ == "__main__":
    setup_scene()
