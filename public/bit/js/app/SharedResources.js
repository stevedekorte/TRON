
/*
Example usage:
sharedInstance = SharedResources.shared();
*/

class SharedResources {

    static _sharedInstance = null;

    static shared() {
        if (SharedResources._sharedInstance === null) {
            SharedResources._sharedInstance = new SharedResources();
        }
        return SharedResources._sharedInstance;

    }

    constructor() {
        this._map = {};
    }
    
    map() {
        return this._map;
    }
    
    audioForPath(path) {
        const a = this.map()[path];
        if (a) {
            return a;
        }
        
        const newAudio = new Audio(path);
        this.map()[path] = newAudio;
        return newAudio;
    }
    
    modelForPath(modelPath, doneCallback) {
        const m = this.map()[modelPath];
        if (m) { 
            return m; 
        }

        const loader = new THREE.OBJLoader();
        loader.load(
            modelPath,
            (group) => {
                const object = group.children[0];
                this.map()[modelPath] = object;
                group.remove(object);
                object.geometry.center();
                doneCallback(object.clone());
            },
            (xhr) => {
                // Progress callback
                // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.log('obj load error: ', error);
            }
        );
    }
}
