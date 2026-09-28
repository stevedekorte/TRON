window.Obj3dAnimation = ideal.Proto.clone().newSlots({ 
    name: null,
    target: null,
    methodName: null,
    startTime: 0,
    runTime: 1,
    repeats: false,
}).setSlots({
    init: function() {        
        return this
    },
    
    currentTime: function() {
        return new Date().getTime()/1000
    },
    
    start: function() {
        this.setStartTime(this.currentTime())
        return this
    },
    
    endTime: function() {
        return this.startTime() + this.runTime()
    },
    
    isDone: function() {
        return this.dt() > this.runTime()
    },
    
    dt: function() {
        return this.currentTime() - this.startTime()
    },
    
    ratioDone: function() {
        var dt = this.dt()
        var ratio = Math.min(dt/this.runTime(), 1)
        return ratio
    },
               
    update: function(time) {
        this.target()[this.methodName()].apply(this.target(), [this.dt(), this.ratioDone()])
    },
    
    removeIfDone: function() {
        if (this.isDone()) {
            this.target().removeAnimation(this)
        }
    },
})