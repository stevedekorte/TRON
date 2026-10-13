  /*
  LightCycle.pov

  This Scene defines the LightCycle model (designed by Carl N. Hoff) and places 6 
  LightCycles of differnt colors on a Grid.

  Position of LightCycles is calculated based on frame number for animation.
  
  CREDIT: The LightCycle model used here was created by Carl N. Hoff

  */
  
  #include "colors.inc"
  #include "transforms.inc" 
  #include "math.inc"
  
  #include "textures.inc"
  #include "glass.inc"
  /* 
    ---- Define LightCycle Model ----
  */
  #declare trail = box {<-25000,0,-1>,<0,190,1> texture { T_Glass4 } interior {I_Glass caustics 1}} 
  
  #declare front_tire = difference {
    sphere {<355,85,0>, 85}                                                                            //  1 primitive
    sphere {<355,85,57.1615>, 57.0742}                                                                 //  2 primitives
    sphere {<355,85,-57.1615>, 57.0742}                                                                //  3 primitives
  }

  #declare front_axle = union {
    sphere {<355,85,-29>, 17}                                                                          //  4 primitives
    sphere {<355,85,29>, 17}                                                                           //  5 primitives
  }

  #declare front_hub = cylinder {<355,85,30>, <355,85,-30>, 60}                                        //  6 primitives

  #declare rear_tire = difference {
    sphere {<0,85,0>, 85 scale <1,1,0.2>}                                                              //  7 primitives
    sphere {<0,85,20.8732>, 58.7155}                                                                   //  8 primitives
    sphere {<0,85,-20.8732>, 58.7155}                                                                  //  9 primitives
  }

  #declare rear_axle = sphere {<0,85,0>, 17}                                                           // 10 primitives

  #declare rear_hub = cylinder {<0,85,1>, <0,85,-1>, 60}                                               // 11 primitives  
  
  #declare lower_body = union {
    intersection {
      union {
        cylinder {<192.447,-160,26.5>, <192.447,-160,-26.5>, 373.721}                                  // 12 primitives (main body)
        sphere {<0,0,0> 270.336 scale <50,0.575,1> rotate -18.1527*z translate <-12726.2,4308.38,0>}   // 13 primitives (back side cones)
        union {
          cylinder {<-1,165.823,0>, <86,165.823,0>, 26.5}                                              // 14 primitives (fender)
          box {<-1,38.5,-26.5>, <86,165.823,26.5>}                                                     // 15 primitives (fender)
          Shear_Trans(x-0.57735*y, y, z)
        }
      }
      box {<0,38.5,-60>,<290,229.721,60>}                                                              // 16 primitives
    }  
    difference {
      sphere {<0,0,0> 345.251 scale <50,0.567439,1> rotate 9.30205*z translate <-16783.3,-2700.57,0>}  // 17 primitives (side cones)   
      plane {<1,0,0> 148}                                                                              // 18 primitives (side cones)
    }   
    cone {<293,85,0>, 60 <219,85,0>, 26.5}                                                             // 19 primitives (front wheel cone)
  } 

  #declare fender_cutout = union {
    union {
      cylinder {<-86,165.823,0>, <86,165.823,0>, 21}                                                   // 20 primitives (fender)
      box {<-86,165.823,-21>, <86,0,21>}                                                               // 21 primitives (fender)
      Shear_Trans(x-0.57735*y, y, z)
    }
    cylinder {<0,85,28>, <0,85,-28> 28.5}                                                              // 22 primitives
  } 

  #declare window = intersection {
    union {
      cylinder {<192.447,-160,17.5>, <192.447,-160,-17.5>, 389.722}                                    // 23 primitives
      cone {<192.447,-160,-17.5>, 389.722 <192.447,-160,-22.5>, 373.722}                               // 24 primitives
      cone {<192.447,-160,17.5>, 389.722 <192.447,-160,22.5>, 373.722}                                 // 25 primitives
      sphere {<0,0,0>, 77.5 scale <1.83,0.75,1> translate <238,145.4,0>}                               // 26 primitives
    }
    prism {linear_sweep linear_spline -100, 100, 5,                                                    // 27 primitives
      <192.447,229.721>, <238,145.4>, <335.203,145.4>, <445.105,229.721>,<192.447,229.721>
      rotate -x*90
    }
  }   
  
  #declare upper_body = union {
    cylinder {<96.5,49.761,30>, <96.5,49.761,-30>, 5}                                                  // 28 primitives
    sphere {<218,105,26.5>, 11.5}                                                                      // 29 primitives
    sphere {<218,105,-26.5>, 11.5}                                                                     // 30 primitives
    sphere {<103,71.5,26.5>, 11.5}                                                                     // 31 primitives
    sphere {<103,71.5,-26.5>, 11.5}                                                                    // 32 primitives
    sphere {<47.1414,177.25,26.5>, 11.5}                                                               // 33 primitives
    sphere {<47.1414,177.25,-26.5>, 11.5}                                                              // 34 primitives
    cylinder {<47.1414,177.25,26.5>, <47.1414,177.25,-26.5>, 11.5}                                     // 35 primitives
    cylinder {<320,166.5,26.5>, <218,105,26.5>, 11.5}                                                  // 36 primitives
    cylinder {<218,105,26.5>, <125,105,26.5>, 11.5}                                                    // 37 primitives
    cylinder {<125,105,26.5>, <103,71.5,26.5>, 11.5}                                                   // 38 primitives
    cylinder {<103,71.5,26.5>, <103,145,26.5>, 11.5}                                                   // 39 primitives
    cylinder {<103,145,26.5>, <47.1414,177.25,26.5>, 11.5}                                             // 40 primitives
    cylinder {<320,166.5,-26.5>, <218,105,-26.5>, 11.5}                                                // 41 primitives
    cylinder {<218,105,-26.5>, <125,105,-26.5>, 11.5}                                                  // 42 primitives
    cylinder {<125,105,-26.5>, <103,71.5,-26.5>, 11.5}                                                 // 43 primitives
    cylinder {<103,71.5,-26.5>, <103,145,-26.5>, 11.5}                                                 // 44 primitives
    cylinder {<103,145,-26.5>, <47.1414,177.25,-26.5>, 11.5}                                           // 45 primitives 
    intersection {
      union {
        cylinder {<192.447,-160,17.5>, <192.447,-160,-17.5>, 389.721}                                  // 46 primitives (middle strip)
        cone {<192.447,-160,-17.5>, 389.721 <192.447,-160,-22.5>, 373.721}                             // 47 primitives (middle strip)
        cone {<192.447,-160,17.5>, 389.721 <192.447,-160,22.5>, 373.721}                               // 48 primitives (middle strip)
      }
      box {<1,145.4,-23>,<440,229.721,23>}                                                             // 49 primitives (middle strip)
    } 
    intersection {
      union {
        cylinder {<192.447,-160,-38>, <192.447,-160,38>, 367.221}                                      // 50 primitives (main body)
        cylinder {<192.447,-160,-26.5>, <192.447,-160,26.5>, 378.721}                                  // 51 primitives (main body)
        torus {367.221, 11.5 rotate -90*x translate <192.447,-160,26.5>}                               // 52 primitives (main body)
        torus {367.221, 11.5 rotate -90*x translate <192.447,-160,-26.5>}                              // 53 primitives (main body)
      }
      prism {                                                                                          // 54 primitives
        linear_sweep linear_spline -40, 40, 10,
        <285.005,145.4>, <218,105>, <125,105>, <103,71.5>, <103,145>, <47.1414,177.25>,
        <24.5339,229.721>, <440,229.721>, <440,145.4>, <285.005,145.4>
        rotate -x*90
      }
    }    
  } 
  
  #declare shiny_black = texture {
    pigment {Black} 
    finish {
      ambient .1
      diffuse .5
      phong 1
    }
  }
  
  #declare Foo = function {min(abs(x)-int(abs(x)),abs(z)-int(abs(z)),1-(abs(x)-int(abs(x))),1-(abs(z)-int(abs(z))))}
  
  #declare grid = plane {y, 0 
    pigment {
      function { Foo(x, y, z) }
      color_map { 
        [0 color White] 
        [0.01 color White]
        [0.02 rgb <0,0.05,0>]
        [0.98 rgb <0,0.05,0>]
        [0.99 color White]
        [1 color White] 
      }
    scale 5
    }
    finish {
      ambient .1
      diffuse .5
      reflection .25
      specular 1
      phong 1
    }  
  } 
  
  #macro LightCycle(bike_x,bike_z,bike_forward,bike_color) 
    // Game Grid is in the x-z plane.  
    // The two variables bike_x and bike_z give the coordinates of the placement of the rear tire on the Game Grid.
    // The variable bike_forward is a vector pointing in the direction the bike is moving.  Typical values should be x, -x, z, or -z.
    // The variable bike_color is a pigment used to color the bike.  Typical values would be Blue, Red, Yellow, etc.
    union {
      object {window texture {shiny_black}}
      // object {window texture { T_Glass3 } interior {I_Glass caustics 1}}
      difference {
        union {
          object {lower_body}
          object {upper_body pigment {bike_color}}
        }  
        object {fender_cutout}
      }
      object {front_tire pigment {bike_color}}
      object {front_hub texture {shiny_black}}
      object {front_axle}
      object {rear_tire pigment {bike_color}}
      object {rear_hub texture {shiny_black}}
      object {rear_axle}    
      object {trail pigment {bike_color}}
      pigment{Gray}
      scale <0.0125,0.0125,0.0125>
      rotate VRotationD(x,bike_forward,y)*y
      translate <10*bike_x-20,0,bike_z>
    } 
  #end     
  
  /* 
    ---- Scene Setup - Place LightCycles ----
  */
  LightCycle(12*clock,-5,x,Red)   
  LightCycle(8*clock,0,x,Orange)  
  LightCycle(17*clock*clock,5,x,Yellow)
  LightCycle(9*clock,10,x,Green) 
  LightCycle(15*clock,15,x,Blue)  
  LightCycle(8*clock,20,x,Magenta)  
  
  /* 
    ---- Scene Setup - Place Grid and set Background ----
  */
  object {grid}  
  background {Blue}

  /* 
    ---- Camera Placement ----
  */
  camera {location <25-(clock*50),25-(clock*5),-28+(clock*clock*clock*25)> look_at <10*17*clock*clock-20,0,5> angle 30}
  
  /* 
    ---- Light Source Setup ----
  */
  light_source {<7.2, 18.8, -12.5> 1.4*White shadowless}
  light_source {<7.2, 18.8, -12.5> 0.7*White}  
  
