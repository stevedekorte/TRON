window.Obj3dThing = Obj3d.clone().newSlots({ 
	protoType: "Obj3dThing",
	modelPath: null,
	model: null,
	audioPath: null,
    audio: null,
    modelScale: 1,
}).setSlots({
    init: function() {        
        Obj3d.init.apply(this)
        
        this.loadModelIfNeeded()
        this.loadAudioIfNeeded()
        
        return this
    },
    
    // audio
    
    loadAudioIfNeeded: function() {
        if (this.audioPath()) {
            this.loadAudio() 
        }        
    },
    
    loadAudio: function() {
        // Share the decoded startup cache; do not create a second media loader.
        BitSound.load(this.audioPath()).catch(error => console.warn("Bit sound preload failed:", error.message))
        return this
    },
    
    speak: function() {
        const path = this.audioPath()
        if (window.BitSound && path) {
            const pending = BitSound.play(path)
            if (pending && pending.catch) {
                pending.catch((error) => {
                    console.log(this.protoType() + " sound failed:", error && error.message)
                })
            }
            return pending
        }
        return null
    },

    start: function() {
        return this.speak()
    },
    
    // model
    
    loadModelIfNeeded: function() {
        if (this.modelPath()) {
            this.loadModel()
        }
    },
    
    loadModel: function() {
        //SharedResources.modelForPath(this.modelPath(), (object) => { this.loadedModel(object) })
        //return
        
        var loader = new THREE.OBJLoader();
        loader.load(this.modelPath(),
        	 ( group ) => {
        	    var object = group.children[0]
        	    group.remove(object)
        	    object.geometry.center()
	            object.material = this.flatMaterial()
                this.loadedModel(object)
        	},

        	function ( xhr ) {
        		//console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        	},

        	function ( error ) {
        		console.log( 'obj load error: ', error );
        	}
        );
        

    },
    
    loadedModel: function(object) {
        this._model = object //.clone()
	    var s = this.modelScale()
	    this._model.scale.x = s
	    this._model.scale.y = s
	    this._model.scale.z = s
 	    this._model.material = this.flatMaterial()
	    this._model.material.color = this.materialColor()
        this.object3d().add(this._model)
    },    
})