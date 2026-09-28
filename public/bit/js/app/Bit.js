
window.Bit = Obj3d.clone().newSlots({
	protoType: "Bit",
	bitYes: null,
	bitIdleGroup: null,
	bitNo: null,
}).setSlots({
    init: function() {   
        Obj3d.init.apply(this)
        this.setScale(5)
        this.initParts()
        this.scaleIn()
        this.listenForQuestions()
        console.log("--- using Jev ---")
    	return this
    },
    
    showResponse: function(text) {
        const output = document.getElementById('answer');
        clearTimeout(this._answerFadeTimer);
        output.textContent = text;
        output.style.opacity = 1;
        this._answerFadeTimer = setTimeout(() => {output.style.opacity = 0;}, 2000);
    },

    searchRequest: async function(question) {
        if (this._request) return;
        const controller = new AbortController();
        this._request = controller;
        const output = document.getElementById('answer');
        const timer = setTimeout(() => controller.abort(), 10000);
        clearTimeout(this._answerFadeTimer);
        output.style.opacity = 1;
        output.textContent = 'THINKING';
        try {
            const response = await fetch((window.BIT_API_BASE || '') + '/api/jev/decision', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({controller: 'bit', question: question.slice(0, 1000)}),
                signal: controller.signal,
            });
            if (!response.ok) throw new Error('Bit relay unavailable');
            const result = await response.json();
            if (!['m0','m1','m2'].includes(result.id)) throw new Error('Invalid Bit answer');
            if (result.id === 'm0') {this.showResponse('YES'); this.doBitYes();}
            else if (result.id === 'm1') {this.showResponse('NO'); this.doBitNo();}
            else {this.showResponse('???'); this.jumpAround();}
        } catch (error) {
            if (!window.bitLeaving) this.showResponse(navigator.onLine ? 'BIT IS UNAVAILABLE. TRY AGAIN.' : 'BIT NEEDS A CONNECTION TO ANSWER.');
        } finally {clearTimeout(timer); this._request = null;}
    },

    listenForQuestions: function() {
        const instructionsElement = document.getElementById("instructions")
        instructionsElement.style.transition = "all 0.5s"
        



        const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
        const SpeechGrammarList = globalThis.SpeechGrammarList || globalThis.webkitSpeechGrammarList;
        const SpeechRecognitionEvent = globalThis.SpeechRecognitionEvent || globalThis.webkitSpeechRecognitionEvent;

        console.log("---")

        if (!SpeechRecognition) {
            console.log("instructionsElement.style.color = ", instructionsElement.style.color)
            instructionsElement.innerHTML = "This browser doesn't support speech recognition. Try Chrome?"
            instructionsElement.style.color = "red"
            return
        }

        var recognition = new SpeechRecognition();
        this._recognition = recognition
        this._listeningPaused = false

        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = true
        recognition.onend = () => {
            const done = this._afterListenStopped
            if (done) {
                this._afterListenStopped = null
                done()
            }
        }
        // The recognizer often emits a junk result in the first moment,
        // including whatever just came out of the speakers.
        this._ignoreSpeechUntil = Date.now() + 800
        recognition.onerror = event => {
            instructionsElement.textContent = event.error === 'not-allowed' ? 'MICROPHONE ACCESS REQUIRED. REOPEN BIT TO TRY AGAIN.' : 'SPEECH INPUT UNAVAILABLE. REOPEN BIT TO TRY AGAIN.';
        };
        recognition.start();

        const inputElement = document.getElementById("input")
        inputElement.style.transition = "all 0.5s"


        recognition.onresult = (event) => {
            if (this._listeningPaused || Date.now() < (this._ignoreSpeechUntil || 0)) {
                return
            }
            const speechResult = event.results[event.results.length-1][0].transcript.toLowerCase();
            let speechString = ('' + speechResult).strip().toLowerCase()
            if (this.echoOfLastAnswer(speechString)) {
                return
            }
            instructionsElement.style.opacity = 0
            document.querySelector(".exit-hint").style.opacity = 0
            this.searchRequest(speechString)

            inputElement.style.color = ""
            inputElement.textContent = speechString + "?"
            setTimeout(() => { inputElement.style.opacity = 1 }, 1)
            setTimeout(() => { inputElement.style.opacity = 0 }, 2000)
        }

        recognition.onaudiostart = function(event) {
            inputElement.style.color = ""
            inputElement.innerHTML = ""
            inputElement.style.opacity = 1
        }
        console.log("Listening")
    },
    
    // A lone "yes" or "no" just after we played that clip is the microphone
    // hearing the answer, not a new question.
    echoOfLastAnswer: function(speechString) {
        if (Date.now() - (this._lastAnswerAt || 0) > 2500) {
            return false
        }
        const heard = speechString.replace(/[^a-z]/g, "")
        if (this._lastAnswerWord === "yes") {
            return heard === "yes" || heard === "yeah" || heard === "yep"
        }
        if (this._lastAnswerWord === "no") {
            return heard === "no" || heard === "nope" || heard === "nah"
        }
        return false
    },

    // Echo cancellation on the open microphone turns the answer clips into
    // a buzz and a series of clicks, then hears that audio as the next
    // question. Close the mic, play, then listen again.
    pauseListening: function(done) {
        const recognition = this._recognition
        if (!recognition || this._listeningPaused) {
            done()
            return
        }
        this._listeningPaused = true
        let finished = false
        const finish = () => {
            if (finished) {
                return
            }
            finished = true
            this._afterListenStopped = null
            done()
        }
        this._afterListenStopped = finish
        try {
            recognition.stop()
        } catch (e) {
            finish()
            return
        }
        // stop() sometimes never ends. Abort so the clip does not play
        // into a microphone that is still open.
        setTimeout(() => {
            if (finished) {
                return
            }
            try { recognition.abort() } catch (e) {}
            finish()
        }, 700)
    },

    resumeListening: function() {
        const recognition = this._recognition
        if (!recognition || !this._listeningPaused) {
            return
        }
        this._listeningPaused = false
        this._ignoreSpeechUntil = Date.now() + 700
        try {
            recognition.start()
        } catch (e) {}
    },

    playAnswerNow: function(thing) {
        const path = thing.audioPath && thing.audioPath()
        const cached = window.BitSound && path && BitSound.buffers[path]
        const begin = () => {
            this.bitIdleGroup().startShrinkAnimation()
            const pending = thing.start()
            const resumeLater = () => {
                setTimeout(() => this.resumeListening(), 400)
            }
            if (pending && pending.then) {
                pending.then(resumeLater).catch((error) => {
                    console.log("answer sound failed:", error && error.message)
                    this.resumeListening()
                })
            } else {
                resumeLater()
            }
        }
        if (cached || !window.BitSound || !path) {
            begin()
            return
        }
        const loading = BitSound.pending[path] || BitSound.load(path)
        if (loading && loading.then) {
            loading.then(begin).catch(begin)
        } else {
            begin()
        }
    },

    // Closing the mic drops AirPods out of the phone-call link. The first
    // devicechange is the start of that switch. The yes/no recording played
    // then comes out as a buzz, so wait until music playback is back.
    afterMicReleased: function(done) {
        let finished = false
        const finish = () => {
            if (finished) {
                return
            }
            finished = true
            try {
                navigator.mediaDevices.removeEventListener("devicechange", onChange)
            } catch (e) {}
            done()
        }
        const onChange = () => {
            try {
                navigator.mediaDevices.removeEventListener("devicechange", onChange)
            } catch (e) {}
            if (window.BitSound && BitSound.retarget) {
                BitSound.retarget()
            }
            setTimeout(finish, 700)
        }
        const arm = (ms) => {
            try {
                navigator.mediaDevices.addEventListener("devicechange", onChange)
            } catch (e) {}
            if (ms > 700) {
                setTimeout(() => {
                    if (!finished && window.BitSound && BitSound.retarget) {
                        BitSound.retarget()
                    }
                }, ms - 700)
            } else if (window.BitSound && BitSound.retarget) {
                BitSound.retarget()
            }
            setTimeout(finish, ms)
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            arm(900)
            return
        }
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            const headset = devices.some((device) => {
                return device.kind === "audiooutput" && /airpod|bluetooth|headset/i.test(device.label || "")
            })
            if (headset) {
                arm(1600)
            } else {
                setTimeout(finish, 200)
            }
        }).catch(() => arm(900))
    },

    playAnswer: function(thing) {
        const micOpen = !!(this._recognition && !this._listeningPaused)
        this.pauseListening(() => {
            if (micOpen) {
                this.afterMicReleased(() => this.playAnswerNow(thing))
            } else {
                this.playAnswerNow(thing)
            }
        })
    },

    doBitYes: function() {
        this._lastAnswerWord = "yes"
        this._lastAnswerAt = Date.now()
        this.playAnswer(this.bitYes())
    },
    
    doBitNo: function() {
        this._lastAnswerWord = "no"
        this._lastAnswerAt = Date.now()
        this.playAnswer(this.bitNo())
    },
    
    keydown: function(event, c) {
        Obj3d.keydown.apply(this, [event, c])
        //console.log(this.protoType() + " keydown('" + c + "')")
                
        if(c == "Y") { 
            this.doBitYes()
        }
        
        if(c == "N") { 
            this.doBitNo()
        }
        
        if (c == "M") {
            this.chooseRandomTargetPosition()
        }

        if (c == "O") {
            this.chooseOriginTargetPosition()
        }
        
        /*
        if (c == "R") {
            if (Math.random() < 0.5) {
                this.shrinkAndRemove()
            }
        }
        
        if (c == "D") {
            var dup = this.duplicate()
            dup.chooseRandomTargetPosition()
            dup.addToScene()
        }
        */
        
        if (c == " ") {
            this._spaceKeyDownDate = Date.now()
        }
    },
    
    doRandomAnswer: function() {
        var flip = Math.random() > 0.5
        if (flip) {
            this.doBitYes()
        } else { 
            this.doBitNo()
        }
    },

    jumpAround: function() {
        var count = 3 //2 + Math.floor(Math.random() * 3)
        var nextFunc = () => { 
            count --
            //console.log("count =", count)
            if (count == 0) {
                this.chooseOriginTargetPosition()
            } else {
                this.chooseRandomTargetPosition(5, nextFunc)
            }
        }
            
        this.chooseRandomTargetPosition(5, nextFunc)
    },
    
    keyup: function(event, c) {
        /*
        var dt = (Date.now() - this._spaceKeyDownDate)
        console.log("keyup '" + c + "' dt=", dt)
        if (dt > 2) {
            var count = 1 + Math.floor(Math.random() * 5)
            var nextFunc = () => { 
                count --
                console.log("count =", count)
                if (count > 0) {
                    if (count == 1) {
                        this.chooseOriginTargetPosition(20, nextFunc)
                    } else {
                        this.chooseRandomTargetPosition(20, nextFunc)
                    }
                } else {
                    this.doRandomAnswer()
                }
            }
                
            this.chooseRandomTargetPosition(20, nextFunc)
        }
        */
    },
    
    /*
    chooseRandomTargetPosition: function() {
        Obj3d.chooseRandomTargetPosition.apply(this)
          //  this.doBitYes()

        if (Math.random() < 0.33) {
            this.doBitYes()
        } else {
         if (Math.random() < 0.5) {
             this.doBitNo()
          }
        }
    },
    */
    
    duplicate: function() {
        var dup = this.clone()
        dup.object3d().position.copy(this.object3d().position)
        setTimeout(() => { dup.shrinkAndRemove() }, 5000)
        return dup
    },

    
    initParts: function() {
        this.setBitIdleGroup(BitIdleGroup.clone())
        this.addObject(this.bitIdleGroup())
        
        this.setBitYes(BitYes.clone())
        this.addObject(this.bitYes())    
     
        this.setBitNo(BitNo.clone())
        this.addObject(this.bitNo())      
    },

	update: function(time) {
        Obj3d.update.apply(this, [time])
	},
	
    scaleIn: function() {
         
        var s = this.object3d().scale.x
        //console.log("this.object3d().scale = ", this.object3d().scale)
        //console.log("s = ", s)
        this.setScale(0.001)
        
        var tween = new TWEEN.Tween(this.object3d().scale) 
        .to( { x:s, y:s, z:s }, 1000) 
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();            
    },
    
})





// -------------------------------------------------------------------------

window.BitYes = Obj3dThing.clone().newSlots({ 
	protoType: "BitYes",
	audioPath: "resources/entities/Bit/sounds/yes.wav",
	modelPath: "resources/entities/Bit/models/bit_yes.obj",
	materialColor: new THREE.Color("rgb(237, 179, 84)"),
	modelScale: 0.02,
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        this.loadAudioIfNeeded()
        this.setScale(0.01)
        return this
    },
    
    start: function() {
        const pending = Obj3dThing.start.apply(this)
        this.addAnimation(Obj3dAnimation.clone().setTarget(this).setMethodName("inflateAndDeflate").setRunTime(1).start())
        return pending
    },
                   
    inflateAndDeflate: function(dt, ratioDone) {
        this.setScale(0.1 + (0 + Math.sin(ratioDone * Math.PI)) * 1.5)
    }, 
    
//	    object.rotation.y = Math.PI*0.6
})

// -------------------------------------------------------------------------

window.BitNo = Obj3dThing.clone().newSlots({ 
	protoType: "BitNo",
	audioPath: "resources/entities/Bit/sounds/no.wav",
	modelPath: "resources/entities/Bit/models/bit_no.obj",
	materialColor: new THREE.Color("rgb(237, 20, 20)"),
	modelScale: 0.02,
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        this.setScale(0.01)
        return this
    },
    
    start: function() {
        const pending = Obj3dThing.start.apply(this)
        this.addAnimation(Obj3dAnimation.clone().setTarget(this).setMethodName("inflateAndDeflate").setRunTime(1).start())
        return pending
    },
                   
    inflateAndDeflate: function(dt, ratioDone) {
        this.setScale(0.01 + (0 + Math.sin(ratioDone * Math.PI)) * 1.5)
    }, 
    
	update: function(time) {
        Obj3d.update.apply(this, [time])
        if (true) {
    	    var o = this.object3d()
    	    var rate = 0.0018
    	    //o.rotation.x += 0.01
    	    o.rotation.y += rate * Math.sin(time)
    	    o.rotation.z += rate * Math.cos(time)
        }
    },
	
    loadedModel: function(object) {
        Obj3dThing.loadedModel.apply(this, [object])
	    object.rotation.x = Math.PI/4
    },    
})


window.ShrinkOnKeyGroup = Obj3dThing.clone().newSlots({ 
	protoType: "ShrinkOnKeyGroup",
	shrinkKey: "S",
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        return this
    },

    keydown: function(event, c) {
        Obj3d.keydown.apply(this, [event, c])        
        console.log("ShrinkOnKeyGroup c = ", c)
        
        if(c == this.shrinkKey()) { 
            this.startShrinkAnimation()
        }
    },
    
	startShrinkAnimation: function() {
        this.addAnimation(Obj3dAnimation.clone().setTarget(this).setMethodName("shrinkAnimation").setRunTime(1).start())
    },
    
    shrinkAnimation: function(dt, ratioDone) {
        var s = Math.cos(ratioDone * Math.PI) * Math.cos(ratioDone * Math.PI)
        this.setScale(s * 0.9 + 0.1)
    },
})

window.BitIdleGroup = Obj3dThing.clone().newSlots({ 
	protoType: "BitIdleGroup",
	audioPath: null,
	modelPath: null,
	materialColor: null,
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        
        var p = PulsatingGroup.clone()
        this.addObject(p)
        
        var s = SpinningGroup.clone()
        p.addObject(s)
        
        s.addObject(BitIdleGroup1.clone())
        s.addObject(BitIdleGroup2.clone())
        return this
    },
	
	startShrinkAnimation: function() {
        this.addAnimation(Obj3dAnimation.clone().setTarget(this).setMethodName("shrinkAnimation").setRunTime(1).start())
    },
    
    shrinkAnimation: function(dt, ratioDone) {
        var s = Math.cos(ratioDone * Math.PI)*Math.cos(ratioDone * Math.PI)
        this.setScale(s*0.9 + 0.1)
    },
})



window.SpinningGroup = Obj3dThing.clone().newSlots({ 
	protoType: "SpinningGroup",
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        return this
    },
    
	update: function(time) {
        Obj3dThing.update.apply(this, [time])
        if (true) {
    	    var o = this.object3d()
    	    var r = 0.028
    	    //var r = 1.5
    	    //var t = Math.ceil(4 * time * 2)/4
    	    var t = time * 3 // (1 + Math.random()*0.001)
    	    //o.rotation.x += 0.01
    	    o.rotation.y += r * Math.sin(t)
    	    o.rotation.x += r * Math.cos(t) 
    	   // o.rotation.z += r * Math.sin(t*1.3) 
        }
        //this.setScale(1 + 0.03*Math.sin(time*10))
	},
})


window.PulsatingGroup = Obj3dThing.clone().newSlots({ 
	protoType: "PulsatingGroup",
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        return this
    },
    
	update: function(time) {
        Obj3d.update.apply(this, [time])
        this.setScale(1 + 0.03*Math.sin(time*10))
	},
})


window.BitIdleGroup1 = Obj3dThing.clone().newSlots({ 
	protoType: "BitIdleGroup1",
	audioPath: null,
	modelPath: "resources/entities/Bit/models/bit_idle_1.obj",
	materialColor: new THREE.Color("rgb(200, 200, 255)"),
	modelScale: 0.03,
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        return this
    },
})


window.BitIdleGroup2 = Obj3dThing.clone().newSlots({ 
	protoType: "BitIdleGroup2",
	audioPath: null,
	modelPath: "resources/entities/Bit/models/bit_idle_2.obj",
	materialColor: new THREE.Color("rgb(200, 200, 255)"),
	modelScale: 0.03,
}).setSlots({
    init: function() {        
        Obj3dThing.init.apply(this)
        return this
    },
    
	update: function(time) {
        var t = time * 1.9
        var s = Math.sin(t)*Math.sin(t)
        this.setScale(0.1 + 1.1*s)
	},
    
    loadedModel: function(object) {
        Obj3dThing.loadedModel.apply(this, [object])
	    object.rotation.x = Math.PI/2
    },    
})

        