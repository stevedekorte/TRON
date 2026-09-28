window.Obj3d = ideal.Proto.clone().newSlots({
	protoType: "Obj3d",
	object3d: null,
	children: null,
	animations: null,
	targetPosition: null,
	targetRate: 0.08,
}).setSlots({
    init: function() {   
        this.setObject3d(new THREE.Object3D())
        this.setChildren([])
        this.setAnimations([])
    	return this
    },
    
    keydown: function(event, c) {
    },
    
    // animations
    
    addAnimation: function(anim) {
        this.animations().push(anim)
    },
    
    hasAnimation: function(anim) {
        if (anim.name() == null) { 
            return false 
        }
        
        return this.animations().detect((anAnim) => {
            return anAnim.name() == anim.name()
        })
    },
    
    addAnimationIfAbsent: function(anim) {
        if (!this.hasAnimation(anim)) {
            this.addAnimation(anim)
        }
    },
    
    removeAnimation: function(anim) {
        this.animations().remove(anim)
    },
	
	addToScene: function() {
	    setTimeout(() => { VizApp.addObj3d(this) }, 1)
	},
	
	removeFromScene: function() {
	    setTimeout(() => { VizApp.removeObj3d(this) }, 1)
	},
	
	update: function(time) {
	    this.animations().forEach((anim) => {
	        anim.update(time)
	    })
	    
	    this.animations().slice().forEach((anim) => {
	        anim.removeIfDone()
	    })
	    
	    this.children().forEach((child) => {
	        child.update(time)
	    })

	    if (this.targetPosition()) {
	        var d = this.targetPosition().clone().sub(this.object3d().position)
	        d.multiplyScalar(this.targetRate())
	        this.object3d().position.add(d)

            /*
	        if (d.length() < 0.1) {
	            this.chooseRandomTargetPosition()
            }
            */
	        //console.log("d.length() = ", d.length())
            
	        if (d.length() < 0.03) {
	            //console.log("next")
                const tp = this.targetPosition()
	            this.object3d().position.set(tp.x, tp.y, tp.z)
	            this.setTargetPosition(null)
	            if (this._endMoveFunc) {
	                this._endMoveFunc()
	            }
	        }
	    }
	},

    chooseOriginTargetPosition: function(r, nextFunc) {
	    //console.log("chooseOriginTargetPosition")

	    var t = new THREE.Vector3()
	    
	    t.x = 0
	    t.y = 0
	    t.z = 0
	    
	    this.setTargetPosition(t)
	    this._endMoveFunc = nextFunc
	    return this
	},
    
	
	chooseRandomTargetPosition: function(r, nextFunc) {
	    //console.log("chooseRandomTargetPosition")
	    if (!r) {
	        r = 20
	    }
	    var t = new THREE.Vector3()
	    /*
	    t.x = r * (Math.random()*2 - 1)
	    t.y = r * (Math.random()*2 - 1)
	    t.z = r * (Math.random()*2 - 1)
	    */
	    
	    t.x = r * (Math.random()*2 - 1)
	    t.y = r * (Math.random()*2 - 1)
	    t.z = r * (-Math.random()*2)
	    
	    this.setTargetPosition(t)
	    this._endMoveFunc = nextFunc
	    return this
	},
	
	addObject: function(obj) {
	    this.children().push(obj)
        this.object3d().add(obj.object3d())        
	},
	
	removeObject: function(obj) {
	    this.children().remove(obj)
        this.object3d().remove(obj.object3d())        
	},
	
    setScale: function(s) {
	    var o = this.object3d()
	    o.scale.x = s
	    o.scale.y = s
	    o.scale.z = s
	    return this
    },
    
    scale: function() {
        return this.object3d().x
    },
    
    setX: function(v) {
	    this.object3d().position.x = v
	    return this
    },
    
    setY: function(v) {
	    this.object3d().position.y = v
	    return this
    },
    
    setZ: function(v) {
	    this.object3d().position.z = v
	    return this
    },
    
    setColor: function(c) {
        this.object3d().material.color = c
    },

    grayColor: function() {
        return new THREE.Color("rgb(200, 200, 255)")
    },
    
    lightBlueColor: function() {
        return new THREE.Color("rgb(200, 200, 255)")
    },
    
    pinkColor: function() {
        return new THREE.Color("rgb(255, 200, 200)")
    },
    
    flatMaterial: function() {
        var material = new THREE.MeshPhongMaterial( {
            color: this.grayColor(),
            shading: THREE.FlatShading,
            shininess: 50,
        })
        
        material.transparent = true

        return material
    },
    
    keydown: function(event, c) {

    },
    
    shrinkAndRemove: function() {
        this._initialShrinkScale = this.object3d().scale.x
        this.addAnimation(Obj3dAnimation.clone().setTarget(this).setMethodName("shrinkAndRemoveAnim").setRunTime(1).start())
        setTimeout(() => { this.removeFromScene() }, 1000)
    },
    
    shrinkAndRemoveAnim: function(dt, r) {
        this.setScale(this._initialShrinkScale * Math.cos(r*Math.PI/2))
        if (r == 1) {
           // this.removeFromScene()
        }
    },
})