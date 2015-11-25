var BABYLON;
(function (BABYLON) {
    var Internals;
    (function (Internals) {
        var parseMaterialById = function (id, parsedData, scene, rootUrl) {
            for (var index = 0; index < parsedData.materials.length; index++) {
                var parsedMaterial = parsedData.materials[index];
                if (parsedMaterial.id === id) {
                    return BABYLON.Material.ParseMaterial(parsedMaterial, scene, rootUrl);
                }
            }
            return null;
        };
        var isDescendantOf = function (mesh, names, hierarchyIds) {
            names = (names instanceof Array) ? names : [names];
            for (var i in names) {
                if (mesh.name === names[i]) {
                    hierarchyIds.push(mesh.id);
                    return true;
                }
            }
            if (mesh.parentId && hierarchyIds.indexOf(mesh.parentId) !== -1) {
                hierarchyIds.push(mesh.id);
                return true;
            }
            return false;
        };
        BABYLON.SceneLoader.RegisterPlugin({
            extensions: ".babylon",
            importMesh: function (meshesNames, scene, data, rootUrl, meshes, particleSystems, skeletons) {
                var parsedData = JSON.parse(data);
                var loadedSkeletonsIds = [];
                var loadedMaterialsIds = [];
                var hierarchyIds = [];
                var index;
                for (index = 0; index < parsedData.meshes.length; index++) {
                    var parsedMesh = parsedData.meshes[index];
                    if (!meshesNames || isDescendantOf(parsedMesh, meshesNames, hierarchyIds)) {
                        if (meshesNames instanceof Array) {
                            // Remove found mesh name from list.
                            delete meshesNames[meshesNames.indexOf(parsedMesh.name)];
                        }
                        //Geometry?
                        if (parsedMesh.geometryId) {
                            //does the file contain geometries?
                            if (parsedData.geometries) {
                                //find the correct geometry and add it to the scene
                                var found = false;
                                ["boxes", "spheres", "cylinders", "toruses", "grounds", "planes", "torusKnots", "vertexData"].forEach(function (geometryType) {
                                    if (found || !parsedData.geometries[geometryType] || !(parsedData.geometries[geometryType] instanceof Array)) {
                                        return;
                                    }
                                    else {
                                        parsedData.geometries[geometryType].forEach(function (parsedGeometryData) {
                                            if (parsedGeometryData.id == parsedMesh.geometryId) {
                                                switch (geometryType) {
                                                    case "boxes":
                                                        BABYLON.Geometry.Primitives.Box.ParseBox(parsedGeometryData, scene);
                                                        break;
                                                    case "spheres":
                                                        BABYLON.Geometry.Primitives.Sphere.ParseSphere(parsedGeometryData, scene);
                                                        break;
                                                    case "cylinders":
                                                        BABYLON.Geometry.Primitives.Cylinder.ParseCylinder(parsedGeometryData, scene);
                                                        break;
                                                    case "toruses":
                                                        BABYLON.Geometry.Primitives.Torus.ParseTorus(parsedGeometryData, scene);
                                                        break;
                                                    case "grounds":
                                                        BABYLON.Geometry.Primitives.Ground.ParseGround(parsedGeometryData, scene);
                                                        break;
                                                    case "planes":
                                                        BABYLON.Geometry.Primitives.Plane.ParsePlane(parsedGeometryData, scene);
                                                        break;
                                                    case "torusKnots":
                                                        BABYLON.Geometry.Primitives.TorusKnot.ParseTorusKnot(parsedGeometryData, scene);
                                                        break;
                                                    case "vertexData":
                                                        BABYLON.Geometry.ParseGeometry(parsedGeometryData, scene, rootUrl);
                                                        break;
                                                }
                                                found = true;
                                            }
                                        });
                                    }
                                });
                                if (!found) {
                                    BABYLON.Tools.Warn("Geometry not found for mesh " + parsedMesh.id);
                                }
                            }
                        }
                        // Material ?
                        if (parsedMesh.materialId) {
                            var materialFound = (loadedMaterialsIds.indexOf(parsedMesh.materialId) !== -1);
                            if (!materialFound && parsedData.multiMaterials) {
                                for (var multimatIndex = 0; multimatIndex < parsedData.multiMaterials.length; multimatIndex++) {
                                    var parsedMultiMaterial = parsedData.multiMaterials[multimatIndex];
                                    if (parsedMultiMaterial.id == parsedMesh.materialId) {
                                        for (var matIndex = 0; matIndex < parsedMultiMaterial.materials.length; matIndex++) {
                                            var subMatId = parsedMultiMaterial.materials[matIndex];
                                            loadedMaterialsIds.push(subMatId);
                                            parseMaterialById(subMatId, parsedData, scene, rootUrl);
                                        }
                                        loadedMaterialsIds.push(parsedMultiMaterial.id);
                                        parsedMultiMaterial.ParseMultiMaterial(parsedMultiMaterial, scene);
                                        materialFound = true;
                                        break;
                                    }
                                }
                            }
                            if (!materialFound) {
                                loadedMaterialsIds.push(parsedMesh.materialId);
                                if (!parseMaterialById(parsedMesh.materialId, parsedData, scene, rootUrl)) {
                                    BABYLON.Tools.Warn("Material not found for mesh " + parsedMesh.id);
                                }
                            }
                        }
                        // Skeleton ?
                        if (parsedMesh.skeletonId > -1 && scene.skeletons) {
                            var skeletonAlreadyLoaded = (loadedSkeletonsIds.indexOf(parsedMesh.skeletonId) > -1);
                            if (!skeletonAlreadyLoaded) {
                                for (var skeletonIndex = 0; skeletonIndex < parsedData.skeletons.length; skeletonIndex++) {
                                    var parsedSkeleton = parsedData.skeletons[skeletonIndex];
                                    if (parsedSkeleton.id === parsedMesh.skeletonId) {
                                        skeletons.push(BABYLON.Skeleton.ParseSkeleton(parsedSkeleton, scene));
                                        loadedSkeletonsIds.push(parsedSkeleton.id);
                                    }
                                }
                            }
                        }
                        var mesh = BABYLON.Mesh.ParseMesh(parsedMesh, scene, rootUrl);
                        meshes.push(mesh);
                    }
                }
                // Connecting parents
                var currentMesh;
                for (index = 0; index < scene.meshes.length; index++) {
                    currentMesh = scene.meshes[index];
                    if (currentMesh._waitingParentId) {
                        currentMesh.parent = scene.getLastEntryByID(currentMesh._waitingParentId);
                        currentMesh._waitingParentId = undefined;
                    }
                }
                // freeze world matrix application
                for (index = 0; index < scene.meshes.length; index++) {
                    currentMesh = scene.meshes[index];
                    if (currentMesh._waitingFreezeWorldMatrix) {
                        currentMesh.freezeWorldMatrix();
                        currentMesh._waitingFreezeWorldMatrix = undefined;
                    }
                }
                // Particles
                if (parsedData.particleSystems) {
                    for (index = 0; index < parsedData.particleSystems.length; index++) {
                        var parsedParticleSystem = parsedData.particleSystems[index];
                        if (hierarchyIds.indexOf(parsedParticleSystem.emitterId) !== -1) {
                            particleSystems.push(BABYLON.ParticleSystem.ParseParticleSystem(parsedParticleSystem, scene, rootUrl));
                        }
                    }
                }
                return true;
            },
            load: function (scene, data, rootUrl) {
                var parsedData = JSON.parse(data);
                // Scene
                scene.useDelayedTextureLoading = parsedData.useDelayedTextureLoading && !BABYLON.SceneLoader.ForceFullSceneLoadingForIncremental;
                scene.autoClear = parsedData.autoClear;
                scene.clearColor = BABYLON.Color3.FromArray(parsedData.clearColor);
                scene.ambientColor = BABYLON.Color3.FromArray(parsedData.ambientColor);
                if (parsedData.gravity) {
                    scene.gravity = BABYLON.Vector3.FromArray(parsedData.gravity);
                }
                // Fog
                if (parsedData.fogMode && parsedData.fogMode !== 0) {
                    scene.fogMode = parsedData.fogMode;
                    scene.fogColor = BABYLON.Color3.FromArray(parsedData.fogColor);
                    scene.fogStart = parsedData.fogStart;
                    scene.fogEnd = parsedData.fogEnd;
                    scene.fogDensity = parsedData.fogDensity;
                }
                //Physics
                if (parsedData.physicsEnabled) {
                    var physicsPlugin;
                    if (parsedData.physicsEngine === "cannon") {
                        physicsPlugin = new BABYLON.CannonJSPlugin();
                    }
                    else if (parsedData.physicsEngine === "oimo") {
                        physicsPlugin = new BABYLON.OimoJSPlugin();
                    }
                    //else - default engine, which is currently oimo
                    var physicsGravity = parsedData.physicsGravity ? BABYLON.Vector3.FromArray(parsedData.physicsGravity) : null;
                    scene.enablePhysics(physicsGravity, physicsPlugin);
                }
                //collisions, if defined. otherwise, default is true
                if (parsedData.collisionsEnabled != undefined) {
                    scene.collisionsEnabled = parsedData.collisionsEnabled;
                }
                scene.workerCollisions = !!parsedData.workerCollisions;
                // Lights
                var index;
                for (index = 0; index < parsedData.lights.length; index++) {
                    var parsedLight = parsedData.lights[index];
                    BABYLON.Light.ParseLight(parsedLight, scene);
                }
                // Materials
                if (parsedData.materials) {
                    for (index = 0; index < parsedData.materials.length; index++) {
                        var parsedMaterial = parsedData.materials[index];
                        BABYLON.Material.ParseMaterial(parsedMaterial, scene, rootUrl);
                    }
                }
                if (parsedData.multiMaterials) {
                    for (index = 0; index < parsedData.multiMaterials.length; index++) {
                        var parsedMultiMaterial = parsedData.multiMaterials[index];
                        BABYLON.MultiMaterial.ParseMultiMaterial(parsedMultiMaterial, scene);
                    }
                }
                // Skeletons
                if (parsedData.skeletons) {
                    for (index = 0; index < parsedData.skeletons.length; index++) {
                        var parsedSkeleton = parsedData.skeletons[index];
                        BABYLON.Skeleton.ParseSkeleton(parsedSkeleton, scene);
                    }
                }
                // Geometries
                var geometries = parsedData.geometries;
                if (geometries) {
                    // Boxes
                    var boxes = geometries.boxes;
                    if (boxes) {
                        for (index = 0; index < boxes.length; index++) {
                            var parsedBox = boxes[index];
                            BABYLON.Geometry.Primitives.Box.ParseBox(parsedBox, scene);
                        }
                    }
                    // Spheres
                    var spheres = geometries.spheres;
                    if (spheres) {
                        for (index = 0; index < spheres.length; index++) {
                            var parsedSphere = spheres[index];
                            BABYLON.Geometry.Primitives.Sphere.ParseSphere(parsedSphere, scene);
                        }
                    }
                    // Cylinders
                    var cylinders = geometries.cylinders;
                    if (cylinders) {
                        for (index = 0; index < cylinders.length; index++) {
                            var parsedCylinder = cylinders[index];
                            BABYLON.Geometry.Primitives.Cylinder.ParseCylinder(parsedCylinder, scene);
                        }
                    }
                    // Toruses
                    var toruses = geometries.toruses;
                    if (toruses) {
                        for (index = 0; index < toruses.length; index++) {
                            var parsedTorus = toruses[index];
                            BABYLON.Geometry.Primitives.Torus.ParseTorus(parsedTorus, scene);
                        }
                    }
                    // Grounds
                    var grounds = geometries.grounds;
                    if (grounds) {
                        for (index = 0; index < grounds.length; index++) {
                            var parsedGround = grounds[index];
                            BABYLON.Geometry.Primitives.Ground.ParseGround(parsedGround, scene);
                        }
                    }
                    // Planes
                    var planes = geometries.planes;
                    if (planes) {
                        for (index = 0; index < planes.length; index++) {
                            var parsedPlane = planes[index];
                            BABYLON.Geometry.Primitives.Plane.ParsePlane(parsedPlane, scene);
                        }
                    }
                    // TorusKnots
                    var torusKnots = geometries.torusKnots;
                    if (torusKnots) {
                        for (index = 0; index < torusKnots.length; index++) {
                            var parsedTorusKnot = torusKnots[index];
                            BABYLON.Geometry.Primitives.TorusKnot.ParseTorusKnot(parsedTorusKnot, scene);
                        }
                    }
                    // VertexData
                    var vertexData = geometries.vertexData;
                    if (vertexData) {
                        for (index = 0; index < vertexData.length; index++) {
                            var parsedVertexData = vertexData[index];
                            BABYLON.Geometry.ParseGeometry(parsedVertexData, scene, rootUrl);
                        }
                    }
                }
                // Meshes
                for (index = 0; index < parsedData.meshes.length; index++) {
                    var parsedMesh = parsedData.meshes[index];
                    BABYLON.Mesh.ParseMesh(parsedMesh, scene, rootUrl);
                }
                // Cameras
                for (index = 0; index < parsedData.cameras.length; index++) {
                    var parsedCamera = parsedData.cameras[index];
                    BABYLON.Camera.ParseCamera(parsedCamera, scene);
                }
                if (parsedData.activeCameraID) {
                    scene.setActiveCameraByID(parsedData.activeCameraID);
                }
                // Browsing all the graph to connect the dots
                for (index = 0; index < scene.cameras.length; index++) {
                    var camera = scene.cameras[index];
                    if (camera._waitingParentId) {
                        camera.parent = scene.getLastEntryByID(camera._waitingParentId);
                        camera._waitingParentId = undefined;
                    }
                }
                for (index = 0; index < scene.lights.length; index++) {
                    var light = scene.lights[index];
                    if (light._waitingParentId) {
                        light.parent = scene.getLastEntryByID(light._waitingParentId);
                        light._waitingParentId = undefined;
                    }
                }
                // Sounds
                if (BABYLON.AudioEngine && parsedData.sounds) {
                    for (index = 0; index < parsedData.sounds.length; index++) {
                        var parsedSound = parsedData.sounds[index];
                        if (BABYLON.Engine.audioEngine.canUseWebAudio) {
                            BABYLON.Sound.ParseSound(parsedSound, scene, rootUrl);
                        }
                        else {
                            var emptySound = new BABYLON.Sound(parsedSound.name, null, scene);
                        }
                    }
                }
                // Connect parents & children and parse actions
                for (index = 0; index < scene.meshes.length; index++) {
                    var mesh = scene.meshes[index];
                    if (mesh._waitingParentId) {
                        mesh.parent = scene.getLastEntryByID(mesh._waitingParentId);
                        mesh._waitingParentId = undefined;
                    }
                    if (mesh._waitingActions) {
                        BABYLON.ActionManager.ParseActions(mesh._waitingActions, mesh, scene);
                        mesh._waitingActions = undefined;
                    }
                }
                // freeze world matrix application
                for (index = 0; index < scene.meshes.length; index++) {
                    var currentMesh = scene.meshes[index];
                    if (currentMesh._waitingFreezeWorldMatrix) {
                        currentMesh.freezeWorldMatrix();
                        currentMesh._waitingFreezeWorldMatrix = undefined;
                    }
                }
                // Particles Systems
                if (parsedData.particleSystems) {
                    for (index = 0; index < parsedData.particleSystems.length; index++) {
                        var parsedParticleSystem = parsedData.particleSystems[index];
                        BABYLON.ParticleSystem.ParseParticleSystem(parsedParticleSystem, scene, rootUrl);
                    }
                }
                // Lens flares
                if (parsedData.lensFlareSystems) {
                    for (index = 0; index < parsedData.lensFlareSystems.length; index++) {
                        var parsedLensFlareSystem = parsedData.lensFlareSystems[index];
                        BABYLON.LensFlareSystem.ParseLensFlareSystem(parsedLensFlareSystem, scene, rootUrl);
                    }
                }
                // Shadows
                if (parsedData.shadowGenerators) {
                    for (index = 0; index < parsedData.shadowGenerators.length; index++) {
                        var parsedShadowGenerator = parsedData.shadowGenerators[index];
                        BABYLON.ShadowGenerator.ParseShadowGenerator(parsedShadowGenerator, scene);
                    }
                }
                // Actions (scene)
                if (parsedData.actions) {
                    BABYLON.ActionManager.ParseActions(parsedData.actions, null, scene);
                }
                // Finish
                return true;
            }
        });
    })(Internals = BABYLON.Internals || (BABYLON.Internals = {}));
})(BABYLON || (BABYLON = {}));
