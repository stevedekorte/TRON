

document.addEventListener('DOMContentLoaded', () => { VizApp.init() }, false);

// Try to resume audio on entry and again on available user gestures.
// A clip that only ever played muted cannot be unmuted later, so answers go
// through this context instead of the media element.
BitSound = {
    context: null,
    buffers: {},
    pending: {},

    unlock: function(paths) {
        const Context = window.AudioContext || window.webkitAudioContext
        if (!Context) {
            return
        }
        if (!this.context) {
            this.context = new Context()
        }
        if (this.context.state !== "running") {
            const resumed = this.context.resume()
            if (resumed && resumed.catch) {
                resumed.catch(() => {})
            }
        }
        paths.forEach((path) => this.load(path))
    },

    load: function(path) {
        if (this.buffers[path]) {
            return Promise.resolve(this.buffers[path])
        }
        if (this.pending[path]) {
            return this.pending[path]
        }
        const context = this.context
        this.pending[path] = fetch(path).then((response) => {
            if (!response.ok) {
                throw new Error(path + " " + response.status)
            }
            return response.arrayBuffer()
        }).then((bytes) => context.decodeAudioData(bytes)).then((buffer) => {
            this.buffers[path] = buffer
            return buffer
        })
        return this.pending[path]
    },

    // The context keeps the output it was created with. After the microphone
    // closes, AirPods have moved back to music playback and that old output
    // is gone, so the clip comes out as a click instead of the recording.
    retarget: function() {
        const context = this.context
        if (!context || !context.setSinkId || !navigator.mediaDevices) {
            return Promise.resolve()
        }
        const listed = navigator.mediaDevices.enumerateDevices()
        if (!listed || !listed.then) {
            return Promise.resolve()
        }
        return listed.then((devices) => {
            const outputs = devices.filter((device) => device.kind === "audiooutput")
            const preferred = outputs.find((device) => /airpod/i.test(device.label || ""))
                || outputs.find((device) => /bluetooth|headset/i.test(device.label || ""))
            const sinkId = preferred ? preferred.deviceId : ""
            const pointed = context.sinkId === sinkId ? Promise.resolve() : context.setSinkId(sinkId)
            return Promise.resolve(pointed).then(() => {
                if (context.state !== "running") {
                    return context.resume()
                }
            })
        }).catch(() => {})
    },

    startBuffer: function(buffer) {
        const source = this.context.createBufferSource()
        source.buffer = buffer
        source.connect(this.context.destination)
        source.start(0)
        return new Promise((resolve) => {
            source.onended = () => resolve()
        })
    },

    // A cached clip starts immediately. Retargeting the speakers happens
    // earlier, while the microphone is closing, so it does not hold the word
    // past the start of the answer animation.
    play: function(path) {
        if (!this.context || !path) {
            return null
        }
        const begin = () => {
            if (this.buffers[path]) {
                return this.startBuffer(this.buffers[path])
            }
            if (this.pending[path]) {
                return this.pending[path].then((buffer) => this.startBuffer(buffer))
            }
            return null
        }
        if (this.context.state === "running") {
            return begin()
        }
        const resumed = this.context.resume()
        if (resumed && resumed.then) {
            return resumed.then(begin)
        }
        return begin()
    }
}

VizApp = {
    _container: null,
    _renderer: null,
    _objects: null,
    
    initCamera: function() {
		this._camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
		this._camera.position.x = 0;
		this._camera.position.y = 1;
		this._camera.position.z = 15;
    },
    
    initScene: function() {
		this._scene = new THREE.Scene();
	    window.scene = this._scene        
    },
    
    initSpotlight: function() {
		var spotLight = new THREE.SpotLight(0xffffff, 0.5);
        spotLight.position.set(-30, 60, 160);
        spotLight.target.position.set(0, 0, 0);
		this._scene.add( spotLight );
    },
    
    initAmbientLight: function() {
		var ambientLight = new THREE.AmbientLight( 0xffffff, 0.5);
		this._scene.add( ambientLight );
    },
    
    initLights: function() {
		this.initSpotlight()
        this.initAmbientLight()      
    },

    unlockAnswerSounds: function() {
        BitSound.unlock([
            "resources/entities/Bit/sounds/yes.wav",
            "resources/entities/Bit/sounds/no.wav"
        ])
    },

    beginIfNeeded: function () {
        if (this._didBegin) {
            this.unlockAnswerSounds()
            return
        }
        this._didBegin = true
        document.body.classList.add("bit-started")
        this.unlockAnswerSounds()

        this.initCamera()
        this.initScene()
        this.initLights()

        this._renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.autoClear = false;

        this._container = document.createElement('div');
        document.body.appendChild(this._container);
        this._container.appendChild(this._renderer.domElement);
        window.addEventListener('resize', function() { VizApp.onWindowResize() }, false );

        setTimeout(() => {
            var bit = Bit.clone()
            this.addObj3d(bit)

            this.animate();
        }, 1000)

        const instructionsElement = document.getElementById("instructions")
        instructionsElement.innerHTML = "Ask a yes or no question"
        instructionsElement.style.color = ""
    },
    
	init: function()  {
        this._objects = []
        
        document.addEventListener('touchstart', function(e) {
            //console.log("touchstart2")
            VizApp.touchstart(e)
        }, false);
        
        document.addEventListener('touchend', (e) => {
            //console.log("touchend")
            VizApp.touchend(e)
            this.activate()
        }, false);

                
        window.addEventListener('mouseup', (e) => {
            //console.log("mouseup")
            this.activate()
        }, false);
        
        
        ControlsElement = function() {
            return document.getElementById("controls")
        }
        
        window.mobileAndTabletcheck = function() {
          var check = false;
          (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
          return check;
        };
        
            ControlsElement().style.opacity = 1

        
        document.addEventListener('keydown', (event) => {
            this.keydown(event)
        });
        
        document.addEventListener('keyup', (event) => {
            this.keyup(event)
        });
 
	},
	
	pressKey: function(keyString) {
        var event = document.createEvent('KeyboardEvent');
        event.keyCode = keyString.charCodeAt(0)
	    //console.log("keyString = '" + keyString + "' code = ", event.keyCode, " string = ", String.fromCharCode(event.keyCode))
        console.log("event = ", event)
        VizApp.keydown(event, keyString)            
	},
	
	keyup: function(event, c) {
        if (!c) {
            c = String.fromCharCode(event.keyCode)
        }

        //console.log("c = ", c)
        this._objects.forEach((obj) => { obj.keyup(event, c) })
    },
    
    
	keydown: function(event, c) {
	        if (!c) {
	            c = String.fromCharCode(event.keyCode)
	        }

            //console.log("c = ", c)
            this._objects.forEach((obj) => { obj.keydown(event, c) })

			if (c == "A") {
			    var bit = Bit.clone()
		        this.addObj3d(bit)
            }
            
            
            if (c == "C") {
                var e = ControlsElement();
                //console.log("toggle controls opacity = ", e.style.opacity)
                
                if (e.style.opacity != 0) {
                    e.style.opacity = 0
                } else {
                    e.style.opacity = 1
                }
            }

	        
	        // background

            
            if (c == "H") {
                this.toggleCycleBackground()
            }
    },
    
    touchstart: function(e) {
        // Cache the client X/Y coordinates
        this._touchClientX = e.touches[0].clientX;
        this._touchClientY = e.touches[0].clientY;
    },

    touchend: function(e) {
        var x = e.changedTouches[0].clientX
        var y = e.changedTouches[0].clientY
        var dx = x - this._touchClientX;
        var dy = y - this._touchClientY;
        var d = dx*dx + dy*dy
        
        //console.log("VizApp touchend ", rx, y, d)
        
        var rx = x / window.innerWidth
        
        /*
        if (d < 10) {
            if (rx < 1/3) {
               VizApp.pressKey("Y")
            } else if (rx < 2/3) {
               VizApp.pressKey("M")
            } else {
               VizApp.pressKey("N")
            }
        }
        */
    },

    
    _backgroundNumber: 0,
    _backgroundCount: 6,
    _isCyclingBackground: false,
    
    pickBackground: function(n) {
        if (n >= 0 && n < this._backgroundCount) {
            this.setBackgroundNumber(n-1)
        }
    },
    
    nextBackground: function() {
        this.setBackgroundNumber(this._backgroundNumber +1)
    },
    
    setBackgroundNumber: function(n) {
        this._backgroundNumber = Math.floor(n) % this._backgroundCount
        document.body.style.backgroundImage = "url('images/gifs/" + this._backgroundNumber + ".gif')";
    },

    toggleCycleBackground: function() {
        this._isCyclingBackground = !this._isCyclingBackground
    },
    
    cycleBackgroundIfNeeded: function(time) {
        if (this._isCyclingBackground) {
            var r = Math.floor((time * 30)) % 5
            
            var n = 2 + r
            //this.setBackgroundNumber( n )
        }
    },
    
    // ----------------------
    
    addObj3d: function(obj) {
		this._objects.push(obj)
		this._scene.add(obj.object3d())
		return obj
	},
	
	removeObj3d: function(obj) {
		this._objects.remove(obj)
		this._scene.remove(obj.object3d())
		return this
	},

	onWindowResize: function() 
	{
		this._camera.aspect = window.innerWidth / window.innerHeight;
		this._camera.updateProjectionMatrix();
		this._renderer.setSize( window.innerWidth, window.innerHeight );
	},

	animate: function() 
	{
		requestAnimationFrame(() => { this.animate() });
		this.render();
	},

	render: function() 
	{
        var time = new Date().getTime()/1000
        
		for(var i = 0; i < this._objects.length; i++) {
			var child = this._objects[i];
			
		    if (child.update) { 
		        child.update(time) 
		    }
		}

        this.cycleBackgroundIfNeeded(time)
		TWEEN.update()

		this._renderer.render(this._scene, this._camera);
	},
}
