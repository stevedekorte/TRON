// Adds a few helper attributes to THREE.Object3d

var proto = THREE.Object3D.prototype
proto.speed = {
  rotation: {
    x: 0,
    y: 0,
    z: 0
  },
  position: {
    x: 0,
    y: 0,
    z: 0
  },
  scale: {
    x: 0,
    y: 0,
    z: 0
  },
}

proto.needsUpdate = false;
proto.update = function() {}