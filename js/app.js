import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { BVHLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/BVHLoader.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from './gui.js'
import { Exporter } from './exporter.js';

// Mediapipe
import vision from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0';

const { FaceLandmarker, FilesetResolver } = vision;

import { RGBELoader } from "https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/RGBELoader.js"

import MapNames from '../data/mapnames.json' assert { type: 'json' };

// Correct negative blenshapes shader of ThreeJS
THREE.ShaderChunk[ 'morphnormal_vertex' ] = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n	    objectNormal += getMorph( gl_VertexID, i, 1, 2 ) * morphTargetInfluences[ i ];\n		}\n	#else\n		objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n		objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n		objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n		objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_pars_vertex' ] = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];\n		uniform sampler2DArray morphTargetsTexture;\n		uniform vec2 morphTargetsTextureSize;\n		vec3 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset, const in int stride ) {\n			float texelIndex = float( vertexIndex * stride + offset );\n			float y = floor( texelIndex / morphTargetsTextureSize.x );\n			float x = texelIndex - y * morphTargetsTextureSize.x;\n			vec3 morphUV = vec3( ( x + 0.5 ) / morphTargetsTextureSize.x, y / morphTargetsTextureSize.y, morphTargetIndex );\n			return texture( morphTargetsTexture, morphUV ).xyz;\n		}\n	#else\n		#ifndef USE_MORPHNORMALS\n			uniform float morphTargetInfluences[ 8 ];\n		#else\n			uniform float morphTargetInfluences[ 4 ];\n		#endif\n	#endif\n#endif";
THREE.ShaderChunk[ 'morphtarget_vertex' ] = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	#ifdef MORPHTARGETS_TEXTURE\n		for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {\n			#ifndef USE_MORPHNORMALS\n				transformed += getMorph( gl_VertexID, i, 0, 1 ) * morphTargetInfluences[ i ];\n			#else\n				transformed += getMorph( gl_VertexID, i, 0, 2 ) * morphTargetInfluences[ i ];\n			#endif\n		}\n	#else\n		transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n		transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n		transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n		transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n		#ifndef USE_MORPHNORMALS\n			transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n			transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n			transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n			transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n		#endif\n	#endif\n#endif";

var prev_data = null;
var last_data = null;
var stream = new Stream();
var packet = null;
class App {

    constructor() {
        
        this.clock = new THREE.Clock(true);
        this.loaderBVH = new BVHLoader();
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;

        this.mixer = null;
        this.skeletonHelper = null;
        this.boneContainer = null;

        this.skeleton = null;
        this.model = null;
        this.srcModel = null;
        this.animSkeleton = null;
        this.srcBindPose = null;
        this.tgtBindPose = null;

        this.ECAcontroller = null;
        this.eyesTarget = null;
        this.headTarget = null;
        this.neckTarget = null;

        this.body = null;
        this.eyelashes = null;

        this.mediaRecorder = null;
        this.chunks = [];
        this.bsData = { dt: [], weights: []};
        this.isRecording = false;

        this.onSceneLoaded = null;

        this.gui = new GUI(MapNames.map_llnames);
        this.gui.onStartRecord = this.startRecord.bind(this);
        this.gui.onStopRecord = this.stopRecord.bind(this);
        
        this.modes = {LIVE : 0, CAPTURE : 1};
        this.mode = this.modes.LIVE;
        
        this.approaches = { LIVELINK: 0, MEDIAPIPE: 1};
        this.approach = this.approaches.MEDIAPIPE;

        this.character = "EVA";
        this.characters = {EVA : "./data/meshes/eva.glb", CLEO : "./data/meshes/cleo_with_body.glb"};

        this.applyRotation = false;

        this.server = null;
        this.device = "iPhone";
        this.host = "wss://tamats.com/live/"; //"wss://webglstudio.org/port/8087/ws/"
        
        this.video = document.getElementById("input-video");
    }
    
    initServer(host = null) {
        //var server = new WebSocket("wss://webglstudio.org/port/8087/ws/");
        host = host || this.host;
        this.server = new WebSocket(host);
        this.server.binaryType = "arraybuffer";

        this.server.onopen = () => {
            console.log("Connected to", host)
            this.server.send(JSON.stringify({type:"info", device: this.device}));
        }
        this.server.onmessage = (msg) =>
        {
            console.log(msg)
            if( msg.data.constructor === ArrayBuffer )
            {
                var data = new Uint8Array(msg.data);
                if( last_data )
                    prev_data = last_data;
                last_data = data;
                stream.copyFrom(data);
                let parsed_data = parseLiveLinkPacket(stream,{});
                if(this.device == parsed_data.name)
                    packet = parsed_data;

            }
            else{
                console.log("serve msg:", msg.data);
                let data = JSON.parse(msg.data)
                if(data.type == "error") {
                    this.initServer( "wss://webglstudio.org/port/8087/ws/")
                }
            }
        }
        this.server.onerror = function(err){

            console.error(err)
        }
    }

    async initMediapipe() {


        const filesetResolver = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );

        this.faceLandmarker = await FaceLandmarker.createFromOptions( filesetResolver, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate: 'GPU'
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: 'VIDEO',
            numFaces: 1
        } );

        if(this.mode != this.modes.CAPTURE) {

            let video = document.getElementById("recording");
            video.addEventListener('loadedmetadata', async function () {
                while(video.duration === Infinity) {
                    await new Promise(r => setTimeout(r, 1000));
                    video.currentTime = 10000000*Math.random();
                }
                video.currentTime = video.startTime > 0 ? video.startTime : 0;
            });
        
       
            if(!this.mediaDevicesSupported(video, ()=> { })) {
                console.log("This app is not supported in your browser");
            }
        }
        
    }

    init() {

        // this.gui.showChoice("Choose character", Object.keys(this.characters), { callback: (v) => {
        //     this.character = v;

        //     this.gui.showChoice("Choose mode", ["Live", "Record"],{ widgets: [ {type: "checkbox", title: "Apply head rotation", value: false}], callback: (v, rotation) => {
        //         this.applyRotation = rotation;
        //         if(v == "Record")
        //         {
        //             this.mode = App.modes.CAPTURE;
        //             this.initRecord();
        //         }
        //         else{
        //             this.mode = App.modes.LIVE;
        //             this.initLive();
        //         }
        //     }});
        // }});
        this.gui.showChoice(this, async (data) => {
            this.applyRotation = data.applyRotation;
            this.character = data.character;
            this.device = data.device;
            this.approach = this.approaches.MEDIAPIPE;

            if(data.approach == "Live Link") {
                this.approach = this.approaches.LIVELINK;
                this.initServer();
            }
            else {
                await this.initMediapipe();
            }


            if(data.mode == "Record")
            {
                this.mode = app.modes.CAPTURE;
                this.initRecord();
            }
            else{
                this.mode = app.modes.LIVE;
                this.initLive();
            }

        });
    }
    
    initRecord() {
       
        let video = this.video = document.getElementById("recording");
        video.addEventListener('loadedmetadata', async function () {
            while(video.duration === Infinity) {
                await new Promise(r => setTimeout(r, 1000));
                video.currentTime = 10000000*Math.random();
            }
            video.currentTime = video.startTime > 0 ? video.startTime : 0;
        });
        
        if(!this.mediaDevicesSupported(video, ()=> { this.gui.createCaptureGUI( this.character )})) {
            console.log("This app is not supported in your browser");
        }
    
        // this.update(0);
        this.onSceneLoaded = (v) => { this.processWeights(); this.gui.createExportPanel(this.export.bind(this))};
    }
    
    mediaDevicesSupported(video, callback) {
        
        // prepare the device to capture the video
        if (navigator.mediaDevices) {
            console.log("UserMedia supported");
                       
            let constraints = {  video: {
                width: { min: 1024, ideal: 1280, max: 1920 },
                height: { min: 776, ideal: 720, max: 1080 }
              }, audio: false };

            navigator.mediaDevices.getUserMedia(constraints).then( (stream) => {

                
                let videoElement = this.video = document.getElementById("input-video");
                videoElement.srcObject = stream;
                videoElement.onloadedmetadata = () => {
                    videoElement.play();
                    this.mediaRecorder = new MediaRecorder(videoElement.srcObject);
    
                    this.mediaRecorder.onstop =  (e) => {
    
                        video.addEventListener("play", function() {});
                        video.addEventListener("pause", function() {});
                        video.setAttribute('controls', 'name');
                        video.controls = false;
                        video.loop = true;
                        
                        let blob = new Blob(this.chunks, { "type": "video/mp4; codecs=avc1" });
                        let videoURL = URL.createObjectURL(blob);
                        video.src = videoURL;
                        console.log("Recording correctly saved");
                    }
    
                    this.mediaRecorder.ondataavailable = (e) => {
                        this.chunks.push(e.data);
                    }
                    if(callback)
                        callback();
                    return true;
                }
                
            })
            .catch(function (err) {
                console.error("The following error occurred: " + err);
            });
        }
        else {
            return false;
        }
    }

    initLive() {
        this.gui.showBSInfo = false;
        this.loadScene(this.gui.createPanel.bind(this.gui, this));
        
        this.onSceneLoaded = this.update.bind(this);
    }

    loadScene(callback) {
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xbfbebd );
        this.scene.fog = new THREE.Fog( 0xbfbebd, 100, 150 );
        
        const hdrUrls = [ 'venice_sunset_4k.hdr', ];
        // let hdrCubeMap = new RGBELoader()
        //     .setPath( './data/imgs/textures/' )
        //     .load( hdrUrls, (texture) => {

        //         texture.mapping = THREE.EquirectangularReflectionMapping;
        //         this.scene.background = texture;
        //         this.scene.environment = texture;
        //         this.hdrTexture = texture;
        //     } );

        this.initLights();

        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.position.y = -7; // it is moved because of the mesh scale
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        // this.scene.add( ground );

        // Create 3D renderer
        const pixelRatio = window.innerWidth/window.innerHeight;
        let canvas = document.getElementById("threejs-canvas");
        this.renderer = new THREE.WebGLRenderer({ antialias: true , canvas: canvas});
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.gammaInput = true; // applies degamma to textures ( not applied to material.color and roughness, metalnes, etc. Only to colour textures )
        this.renderer.gammaOutput = true; // applies gamma after all lighting operations ( which are done in linear space )
        this.renderer.shadowMap.enabled = true;

        //document.body.appendChild(this.renderer.domElement);

        // camera
        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth/window.innerHeight, 0.01, 1000 );
        this.camera.position.set(0, 1.5, 1);
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 100;
        this.controls.target.set(0, 1.3, -0.017019104933513607);
        this.controls.update();

        this.renderer.render( this.scene, this.camera );
        
  
        this.loadCharacter(callback); 


        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        document.addEventListener( 'keydown', this.onKeyDown.bind(this) );
    }

    initLights() {

        // Lights
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444, 0.3 );
        hemiLight.position.set( 0, 20, 0 );
        this.scene.add( hemiLight );

        const dirLight = new THREE.DirectionalLight( 0xffffff, 0.1 );
        dirLight.position.set( 3, 10, -50 );
        dirLight.castShadow = false;
        this.scene.add( dirLight );

        // Left spotlight
        let spotLight = new THREE.SpotLight( 0xffffff, 0.5 );
        spotLight.position.set(-2,2,2);
        spotLight.penumbra = 1;
        spotLight.castShadow = false;
        this.scene.add( spotLight );
        
        // Right spotlight
        let spotLight2 = new THREE.SpotLight( 0xffffff, 0.5 );
        spotLight2.position.set(1, 3, 1.5);
        spotLight2.penumbra = 1;
        spotLight2.castShadow = true;
        spotLight2.shadow.bias = -0.0001;
        spotLight2.shadow.mapSize.width = 2048;
        spotLight2.shadow.mapSize.height = 2048;
        this.scene.add( spotLight2 );
        
        let spotLightTarget = new THREE.Object3D();
        spotLightTarget.position.set(0, 1.5, 0); 
        spotLight.target = spotLightTarget;
        spotLight2.target = spotLightTarget;
        this.scene.add( spotLightTarget );

    }

    loadCharacter(callback) {
        
        // Load the model
        if(this.scene){
            let allLoaded = true;
            for(let c in this.characters)
            {
                let character = this.scene.getObjectByName(c);
                if(c == this.character){
                    if(character)
                        character.visible = true;
                    else
                        allLoaded = false;
                }
                else {
                    if(character)
                        character.visible = false;
                }
            }
            
            if(allLoaded)
                return;    
        }
        this.gui.changeModalState(true);
        this.loaderGLB.load( this.characters[this.character], (glb) => {

            this.model = glb.scene;
            this.model.name = this.character;
            this.model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            //this.model.position.set(0, 0.75, 0);
            //this.model.scale.set(8.0, 8.0, 8.0);
            this.skinnedMeshes = [];
            this.model.traverse( object => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = object.receiveShadow = true;
                    if (object.name == "Eyelashes" || object.name == "Hair" || object.name == "Female_Trimmed") {
                        object.material.transparent = true;
                        object.material.side = THREE.DoubleSide;
                        object.castShadow = false;
                        object.material.emissiveIntensity = 0;
                    }
                    if(object.material.map) object.material.map.anisotropy = 16; 
                    if(object.morphTargetDictionary)
                        this.skinnedMeshes.push(object);
                    object.material.environment = this.hdrTexture;
                } else if (object.isBone) object.scale.set(1.0, 1.0, 1.0);
            } );    

            this.scene.add(this.model);

            if(callback)
                callback();
            if(this.onSceneLoaded)
                this.onSceneLoaded();

            this.gui.changeModalState(false);
            // this.mixer = new THREE.AnimationMixer( this.model );
            // this.loaderGLB.load( './data/anim/idle.glb', (glb) => {

            //     const clip = glb.animations[0];
            //     // Play a specific animation
            //     const action = this.mixer.clipAction( clip );
            //     action.play();  
            //  }, ()=>{
            //     this.animate();

            //     $('#loading').fadeOut();
            // })


        } );  
    }

    startRecord() {
        this.mediaRecorder.start();
        this.isRecording = true;
        this.update(0);
    }

    stopRecord() {
        this.mediaRecorder.stop();
        this.isRecording = false;
        this.gui.showBSInfo = false;
        this.createAnimation();
        
    }

    createAnimation() {

        this.loadScene();
        
    }

    update(dt) {
        requestAnimationFrame( this.update.bind(this) );
        let delta = this.clock.getDelta();
       // let et = this.clock.getElapsedTime();
        if(this.approach == this.approaches.MEDIAPIPE && this.video) {
            const transform = new THREE.Object3D();
            const results = this.faceLandmarker.detectForVideo( this.video, Date.now() );
            if ( results.faceBlendshapes.length > 0  ) {

                const faceBlendshapes = results.faceBlendshapes[ 0 ].categories;;
                packet = { blends: {}};
                for ( const blendshape of faceBlendshapes ) {

                    const name =  blendshape.categoryName.charAt(0).toUpperCase() + blendshape.categoryName.slice(1);
                    packet.blends[name] = blendshape.score;

                }
            }

            if ( results.facialTransformationMatrixes.length > 0 ) {

                const facialTransformationMatrixes = results.facialTransformationMatrixes[ 0 ].data;

                transform.matrix.fromArray( facialTransformationMatrixes );
                transform.matrix.decompose( transform.position, transform.quaternion, transform.scale );

                // object.position.x = transform.position.x;
                // object.position.y = transform.position.z + 35;
                // object.position.z = - transform.position.y;
                // object.rotation.x = transform.rotation.x;
                // object.rotation.y = transform.rotation.z;
                // object.rotation.z = - transform.rotation.y;

                packet.blends["HeadYaw"] = - transform.rotation.y;
                packet.blends["HeadPitch"] = - transform.rotation.x;
                packet.blends["HeadRoll"] = - transform.rotation.z;
 

            }
        }

        this.gui.update(packet);

        if(this.model && !this.isRecording)
            this.animate(delta);
        else if(packet) {
            this.bsData.dt.push(delta)
            this.bsData.weights.push(packet.blends);
        }
        
        
    }

    animate(delta = 0) {

        //requestAnimationFrame( this.animate.bind(this) );


        // if (delta > 0.02) {
        //     this.clock.stop();
        //     this.clock.start();
        //     return;
        // }

        // if(this.mixer && this.mixer._actions.length)
        //     this.mixer.update(delta);
        if(this.mode == app.modes.LIVE && packet){
            this.applyWeights(packet.blends);
        }

        else if(this.mode == app.modes.CAPTURE && this.mixer)
            this.mixer.update(delta);
        this.renderer.render( this.scene, this.camera );
    }
    
    processWeights() {

        let body = this.model.getObjectByName("Body") ||  this.model.getObjectByName("Head");
        let eyelashes = this.model.getObjectByName("Eyelashes");
        let mt = body.morphTargetDictionary;

        let clipData = {};
        let times = [];
        let {dt, weights} = this.bsData;

        for (let idx = 0; idx < weights.length; idx++) {
            if(times.length)
                times.push(times[idx-1] + dt[idx]);
            else
                times.push(dt[idx]);

            for(let i in weights[idx])
            {
                var value = weights[idx][i];
                let map = MapNames.map_llnames[this.character][i];
                if(map == null) 
                {
                    if(!this.applyRotation) 
                        continue;

                    let axis = i.split("Yaw");
                    if(axis.length > 1)
                    {
                        switch(axis[0]){
                            case "LeftEye":
                                if(!clipData["mixamorig_LeftEye"])
                                {
                                    clipData["mixamorig_LeftEye"] = [];
                                    clipData["mixamorig_LeftEye"].length = dt.length;
                                    clipData["mixamorig_LeftEye"] = clipData["mixamorig_LeftEye"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                    clipData["mixamorig_LeftEye"][idx].y = value;
                            break;
                            case "RightEye":
                                if(!clipData["mixamorig_RightEye"])
                                {
                                    clipData["mixamorig_RightEye"] = [];
                                    clipData["mixamorig_RightEye"].length = dt.length;
                                    clipData["mixamorig_RightEye"] = clipData["mixamorig_RightEye"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_RightEye"][idx].y = value;
                            break;
                            case "Head":
                                if(!clipData["mixamorig_Head"])
                                {
                                    clipData["mixamorig_Head"] = [];
                                    clipData["mixamorig_Head"].length = dt.length;
                                    clipData["mixamorig_Head"] = clipData["mixamorig_Head"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_Head"][idx].y = value;
                            break;
                        }
                        continue;
                    }
                    axis = i.split("Pitch");
                    if(axis.length > 1)
                    {
                        switch(axis[0]){
                            case "LeftEye":
                                if(!clipData["mixamorig_LeftEye"])
                                {
                                    clipData["mixamorig_LeftEye"] = [];
                                    clipData["mixamorig_LeftEye"].length = dt.length;
                                    clipData["mixamorig_LeftEye"] = clipData["mixamorig_LeftEye"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_LeftEye"][idx].x = value;
                            break;
                            case "RightEye":
                                if(!clipData["mixamorig_RightEye"])
                                {
                                    clipData["mixamorig_RightEye"] = [];
                                    clipData["mixamorig_RightEye"].length = dt.length;
                                    clipData["mixamorig_RightEye"] = clipData["mixamorig_RightEye"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_RightEye"][idx].x = value;
                            break;
                            case "Head":
                                if(!clipData["mixamorig_Head"])
                                {
                                    clipData["mixamorig_Head"] = [];
                                    clipData["mixamorig_Head"].length = dt.length;
                                    clipData["mixamorig_Head"] = clipData["mixamorig_Head"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_Head"][idx].x = value;
                            break;
                        }
                        continue;
                    }
                    axis = i.split("Roll");
                    if(axis.length > 1)
                    {
                        switch(axis[0]){
                            case "LeftEye":
                                if(!clipData["mixamorig_LeftEye"])
                                {
                                    clipData["mixamorig_LeftEye"] = [];
                                    clipData["mixamorig_LeftEye"].length = dt.length;
                                    clipData["mixamorig_LeftEye"] = clipData["mixamorig_LeftEye"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_LeftEye"][idx].z = value;
                            break;

                            case "RightEye":
                                if(!clipData["mixamorig_RightEye"])
                                {
                                    clipData["mixamorig_RightEye"] = [];
                                    clipData["mixamorig_RightEye"].length = dt.length;
                                    clipData["mixamorig_RightEye"] = clipData["mixamorig_RightEye"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_RightEye"][idx].z = -value;
                            break;

                            case "Head":
                                if(!clipData["mixamorig_Head"])
                                {
                                    clipData["mixamorig_Head"] = [];
                                    clipData["mixamorig_Head"].length = dt.length;
                                    clipData["mixamorig_Head"] = clipData["mixamorig_Head"].fill(null).map(() => new THREE.Euler( 0, 0, 0, 'XYZ' ));

                                }
                                clipData["mixamorig_Head"][idx].z = value;
                            break;
                        }
                        continue;
                    }
                    else
                        continue;
                }
                else if (typeof(map) == 'string'){
                    if(!clipData[map])
                    {
                        clipData[map] = [];
                        clipData[map].length = dt.length;
                        clipData[map].fill(0);
                    }
                    clipData[map][idx] = value;
                }
                else if( typeof(map) == 'object'){
                    for(let j = 0; j < map.length; j++){
                        if(!clipData[map[j]])
                        {
                            clipData[map[j]] = [];
                            clipData[map[j]].length = dt.length;
                            clipData[map[j]].fill(0);
                        }
                        clipData[map[j]][idx] = value; 
                    }
                }
              
            }

        }
        let tracks = [];
        for(let bs in clipData)
        {

            if(typeof(clipData[bs][0]) == 'object' )
            {
                let data = []; 
                clipData[bs].map((x) => {
                    let q = new THREE.Quaternion().setFromEuler(x);
                    data.push(q.x);
                    data.push(q.y);
                    data.push(q.z);
                    data.push(q.w);
                }, data)
                //clipData[bs] = [].concat.apply([], clipData[bs])
                tracks.push( new THREE.QuaternionKeyframeTrack(bs + '.quaternion', times, data ));

                // let data = []; 
                // clipData[bs].map((x) => {
                //     x.toArray(data, data.length)
                // },data)
                // data = [].concat.apply([], data)
                // tracks.push( new THREE.VectorKeyframeTrack(bs + '.rotation', times, data ));
            }
            else
            {
                
                for(let mesh of this.skinnedMeshes)
                {
                    let mt_idx = mesh.morphTargetDictionary[bs]
                    if(mt_idx>-1)
                        tracks.push( new THREE.NumberKeyframeTrack(mesh.name +'.morphTargetInfluences['+ bs + ']', times, clipData[bs]) );

                }
                    // body.morphTargetInfluences[mt[map]] = value;
                    // eyelashes.morphTargetInfluences[mt[map]] = value;
                
                // tracks.push( new THREE.NumberKeyframeTrack('Body.morphTargetInfluences['+ mt[bs] + ']', times, clipData[bs]) );
                // tracks.push( new THREE.NumberKeyframeTrack('Eyelashes.morphTargetInfluences['+ mt[bs] + ']', times, clipData[bs]) );
            }
        }

        // use -1 to automatically calculate
        // the length from the array of tracks
        const length = -1;

        this.clipAnimation = new THREE.AnimationClip("liveLinkAnim", length, tracks);
        // play animation
        this.mixer = new THREE.AnimationMixer( this.model );
        this.mixer.clipAction(this.clipAnimation).setEffectiveWeight( 1.0 ).play();

          
    }

    applyWeights(blends) {

        let body = this.model.getObjectByName("Body") || this.model.getObjectByName("Head");
        if(!body) return;
        let eyelashes = this.model.getObjectByName("Eyelashes");
        let mt = body.morphTargetDictionary;

        if(blends["LeftEyeYaw"] == null);
        {
            blends["LeftEyeYaw"] = (blends["EyeLookOutLeft"] - blends["EyeLookInLeft"])/2;
            blends["RightEyeYaw"] = - (blends["EyeLookOutRight"] - blends["EyeLookInRight"])/2;
            blends["LeftEyePitch"] = (blends["EyeLookDownLeft"] - blends["EyeLookUpLeft"])/2;
            blends["RightEyePitch"] = (blends["EyeLookDownRight"] - blends["EyeLookUpRight"])/2;
        }

        for(let i in blends)
            {
                var value = blends[i];
                let map = MapNames.map_llnames[this.character][i];
                if(map == null) 
                {
                    if(!this.applyRotation) 
                        continue;

                    let axis = i.split("Yaw");
                    if(axis.length > 1)
                    {
                        switch(axis[0]){
                            case "LeftEye":
                                let leftEye = this.model.getObjectByName("mixamorig_LeftEye");
                                if(leftEye)
                                    leftEye.rotation.y = value;
                            break;
                            case "RightEye":
                                let rightEye = this.model.getObjectByName("mixamorig_RightEye");
                                if(rightEye)
                                    rightEye.rotation.y = value;
                            break;
                            case "Head":
                                let head = this.model.getObjectByName("mixamorig_Head");
                                if(head)
                                    head.rotation.y = -value;
                            break;
                        }
                        continue;
                    }
                    axis = i.split("Pitch");
                    if(axis.length > 1)
                    {
                        switch(axis[0]){
                            case "LeftEye":
                                let leftEye = this.model.getObjectByName("mixamorig_LeftEye");
                                if(leftEye)
                                    leftEye.rotation.x = value;
                            break;
                            case "RightEye":
                                let rightEye = this.model.getObjectByName("mixamorig_RightEye");
                                if(rightEye)
                                    rightEye.rotation.x = value;
                            break;
                            case "Head":
                                let head = this.model.getObjectByName("mixamorig_Head");
                                if(head)
                                    head.rotation.x = -value;;
                            break;
                        }
                        continue;
                    }
                    axis = i.split("Roll");
                    if(axis.length > 1)
                    {
                        switch(axis[0]){
                            case "LeftEye":
                                let leftEye = this.model.getObjectByName("mixamorig_LeftEye");
                                if(leftEye)
                                    leftEye.rotation.z = -value;
                            break;
                            case "RightEye":
                                let rightEye = this.model.getObjectByName("mixamorig_RightEye");
                                if(rightEye)
                                    rightEye.rotation.z = -value;
                            break;
                            case "Head":
                                let head = this.model.getObjectByName("mixamorig_Head");
                                if(head)
                                    head.rotation.z = -value;
                            break;
                        }
                        continue;
                    }

                    else
                        continue;
                }
                else if (typeof(map) == 'string'){
                    for(let mesh of this.skinnedMeshes)
                    {
                        let mt_idx = mesh.morphTargetDictionary[map]
                        mesh.morphTargetInfluences[mt_idx] = value;

                    }
                    // body.morphTargetInfluences[mt[map]] = value;
                    // eyelashes.morphTargetInfluences[mt[map]] = value;
                }
                else if( typeof(map) == 'object'){
                    for(let j = 0; j < map.length; j++){
                        for(let mesh of this.skinnedMeshes)
                        {
                            let mt_idx = mesh.morphTargetDictionary[map[j]]
                            mesh.morphTargetInfluences[mt_idx] = value;

                        }
                        // body.morphTargetInfluences[mt[map[j]]] = value; 
                        // eyelashes.morphTargetInfluences[mt[map[j]]] = value; 
                    }
                }
              
            }   
    }

    export(data) {
        let {format, filename} = data;

        switch(format){
            case 'LiveLink':
                //BVHExporter.export(this.mixer._actions[0], this.skeletonHelper, this.animationClip);
                break;
            case 'GLB':
                let options = {
                    binary: true,
                    animations: []
                };
                for(let i = 0; i < this.mixer._actions.length; i++) {
                    options.animations.push(this.mixer._actions[i]._clip);
                }
                let model = this.mixer._root.getChildByName('Armature');
                options.filename = filename;
                Exporter.exportGLB(model, { options })
                
                break;
            case 'BVH extended':
                Exporter.exportMorphTargets(this.mixer._actions[0], this.skinnedMeshes, this.mixer._actions[0]._clip, null, filename);
                break;
            default:
                console.log(type + " ANIMATION EXPORTATION IS NOT YET SUPPORTED");
                break;
        }
    }

    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

    onKeyDown( e ) {
        // basic movement
        switch(e.key) {
            default: break; // skip
        }
    }

    
}

let app = new App();
app.init();

// {
//     "Blink_Left": 0,
//     "Blink_Right": 1,
//     "BrowsDown_Left": 2,
//     "BrowsDown_Right": 3,
//     "BrowsIn_Left": 4,
//     "BrowsIn_Right": 5,
//     "BrowsOuterLower_Left": 6,
//     "BrowsOuterLower_Right": 7,
//     "BrowsUp_Left": 8,
//     "BrowsUp_Right": 9,
//     "CheekPuff_Left": 10,
//     "CheekPuff_Right": 11,
//     "EyesWide_Left": 12,
//     "EyesWide_Right": 13,
//     "Frown_Left": 14,
//     "Frown_Right": 15,
//     "JawBackward": 16,
//     "JawForeward": 17,
//     "JawRotateY_Left": 18,
//     "JawRotateY_Right": 19,
//     "JawRotateZ_Left": 20,
//     "JawRotateZ_Right": 21,
//     "Jaw_Down": 22,
//     "Jaw_Left": 23,
//     "Jaw_Right": 24,
//     "Jaw_Up": 25,
//     "LowerLipDown_Left": 26,
//     "LowerLipDown_Right": 27,
//     "LowerLipIn": 28,
//     "LowerLipOut": 29,
//     "Midmouth_Left": 30,
//     "Midmouth_Right": 31,
//     "MouthDown": 32,
//     "MouthNarrow_Left": 33,
//     "MouthNarrow_Right": 34,
//     "MouthOpen": 35,
//     "MouthUp": 36,
//     "MouthWhistle_NarrowAdjust_Left": 37,
//     "MouthWhistle_NarrowAdjust_Right": 38,
//     "NoseScrunch_Left": 39,
//     "NoseScrunch_Right": 40,
//     "Smile_Left": 41,
//     "Smile_Right": 42,
//     "Squint_Left": 43,
//     "Squint_Right": 44,
//     "TongueUp": 45,
//     "UpperLipIn": 46,
//     "UpperLipOut": 47,
//     "UpperLipUp_Left": 48,
//     "UpperLipUp_Right": 49
// }
export { app };