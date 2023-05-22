class GUI {
    constructor(map_names) {
        this.create();
        this.recording = false;
        this.mapNames = map_names;
    }

    create()
    {
        LiteGUI.init(); 
    }

    showChoice(app, callback = null) {//title, values, options)
        
        let device = app.device || "iPhone";
        let applyRotation = false;
        let character = app.character;
        let mode = app.mode == app.modes.LIVE ? "Live" : "Record";
        let approach = app.approach == app.approaches.LIVELINK ? "Live Link" : "Mediapipe";

        LiteGUI.init();

        let dialog = new LiteGUI.Dialog({ title: "Settings", width: 300, height: 350, closable: true, on_close:null, scroll: false});
        
        dialog.refresh = () => {

            dialog.content.innerHTML = "";
            dialog = this.addChoice("Choose character", Object.keys(app.characters), {value: character, callback: (v) => {
                character = v;
                dialog.refresh();
            }, dialog: dialog});
    
            dialog = this.addChoice("Choose mode", ["Live", "Record"], { value: mode, callback: (v) => {
                mode = v;
                dialog.refresh();
            }, dialog: dialog});
            
            dialog = this.addChoice("Choose capture", ["Live Link", "Mediapipe"], { value: approach, callback: (v) => {
                approach = v;
                dialog.refresh();
            }, dialog: dialog});
            
            let inspector = new LiteGUI.Inspector();
            
            if(approach == "Live Link") {
    

                inspector.addInfo("Target IP", "178.79.158.38:11111", {})
                inspector.addString("Device name", device, {callback: (v)=> {
                    device = v;
                    
                }})
            }
    
            inspector.addCheckbox("Apply head rotation", applyRotation, {callback: (v)=> {
                applyRotation = v;
            }})
    
            dialog.add(inspector);
        }
        dialog.refresh();
        let btn = dialog.addButton("Save", {callback: (v) => {
            dialog.close();
            if(callback)
                callback({device, applyRotation, character, mode, approach});
        }})
        
        btn.style.width = "20%";
        btn.style["font-size"] = "small";
        dialog.show();
        
        // let choice = LiteGUI.choice(title, values, (v) => {
        //     options.callback(v, applyRotation);
        // })
        // let choice2 = LiteGUI.choice(title, values, (v) => {
        //     options.callback(v, applyRotation);
        // })
        // if(options.widgets){
        //     let inspector = new LiteGUI.Inspector();
        //     for(let i = 0; i < options.widgets.length; i++) {
        //         let widget = options.widgets[i];
        //         switch(widget.type) {
        //             case "checkbox":
        //                 inspector.addCheckbox(widget.title, widget.value || false, {callback: (v)=> {
        //                     applyRotation = v;
        //                 }});
        //                 break;
        //         }
        //     }
        //     choice.add(inspector);
        // }

        
    }
    
    addChoice(content, choices, options ) {
        options = options || {};
        options.id = options.id || content;
        options.id = options.id.replaceAll(" ", "-");
		options.className = "alert";
		options.title = options.title || "Select one option";
		options.width = options.width || 280;
        options.value = options.value || null;
		//options.height = 100;
		if (typeof(content) == "string")
			content = "<p>" + content + "</p>";

		for(var i in choices)
		{
            let selected = options.value == choices[i] ? "selected" : "";

			content +="<button class='litebutton "+ selected+"' data-value='"+i+"' style='width:45%; margin-left: 10px'>"+(choices[i].content || choices[i])+"</button>";
		}
		options.noclose = true;

        let dialog = null;
        if(options.dialog) {
            let div = document.createElement("div");
            div.innerHTML = "<div id = '" + options.id + "'class='content'>" + content + "</div>";
            content = div.querySelector(".content");
            dialog = options.dialog;
            dialog.add(content);
        }
        else{
		    dialog = this.showMessage(content,options);
            dialog.content.id = options.id;
            dialog.content.style.paddingBottom = "10px";
        }

		var buttons = dialog.content.querySelectorAll("#" + options.id + " button");
		for(var i = 0; i < buttons.length; i++)
        {
			buttons[i].addEventListener("click", (v, e) => {
                v.preventDefault();
                v.stopPropagation();
                var v = v.target.textContent;//choices[ this.dataset["value"] ];
                var idx = choices.indexOf(v);
                if(!options.dialog)
                    dialog.close(); //close before callback
                if(options.callback) {
                    let buttons = content.querySelectorAll('[data-value]');
                    for(let i = 0; i < buttons.length; i++) {
                        if(buttons[i].getAttribute("data-value") == idx)
                            buttons[i].classList.add("selected");
                        else
                            buttons[i].classList.remove("selected");
                    }
                    options.callback(v);
                }
            })
        }
		return dialog;
    }

    createCaptureGUI(character){

        this.showBSInfo = true;
        // Adjust video canvas
        let captureDiv = document.getElementById("capture");
        captureDiv.classList.add("expanded");
        captureDiv.classList.remove("hidden");
        let videoElement = document.getElementById("input-video");
        videoElement.classList.remove("hidden");
        let h = captureDiv.clientHeight * 0.8;

        // Create capture info area
        let mainCapture = document.getElementById("capture");
        let captureArea = document.getElementById("capture-area");

        this.createCaptureButtons(captureArea);

        let videoArea = document.getElementById("video-area");
        videoArea.classList.add("video-area");

        let i = document.createElement("i");
        i.id = "expand-capture-gui";
        i.style = "position: relative;top: 35px;left: -19px;"
        i.className = "fas fa-solid fa-circle-chevron-left drop-icon";
        i.addEventListener("click", () => this.changeCaptureGUIVisivility(i.classList.contains("fa-circle-chevron-right")) );
        //videoArea.appendChild(i);

        let inspector = this.createBlendShapesInspector(this.mapNames[character]);
        mainCapture.appendChild(i);
        mainCapture.appendChild(inspector.root)
        videoArea.appendChild(buttonContainer);
    }

    createCaptureButtons(area) {

        const buttonContainer = document.createElement('div');
        buttonContainer.id = "capture-buttons";
        //buttonContainer.style.margin = "0 auto";
        buttonContainer.style.display = "flex";
        const buttons = [
            {
                id: "capture_btn",
                text: " <i class='bi bi-record-circle' style= 'margin:5px; font-size:initial;'></i> Start recording",
                callback: (v, e) => {
                    let capture = document.getElementById("capture_btn");
                    if (!this.recording) {
                        capture.innerHTML = " <i class='fa fa-stop' style= 'margin:5px; font-size:initial;'></i>"//"Stop" + " <i class='bi bi-stop-fill'></i>"
                        capture.classList.add("stop");
                        videoElement.classList.add("border-animation");
                        // Start the capture
                        this.recording = true;
                        this.startTime = Date.now();
                        console.log("Start recording");
                        if(this.onStartRecord){
                            this.onStartRecord();
                        }
                        
                    }
                    else 
                    {
                        // Stop the video recording
                        this.recording = false;
                        
                        console.log("Stop recording");
                        
                        videoElement.classList.remove("border-animation");
                        capture.classList.remove("stop");
                        capture.classList.add("hidden");

                        mainCapture.classList.add("hidden");

                        let endTime = Date.now();
                        this.duration = endTime - this.startTime;
 
                        if(this.onStopRecord){
                            this.onStopRecord();
                        }
                            
                    }
                }
            },
            {
                id: "trim_btn",
                text: "Convert to animation",
                display: "none",
                callback: () => {
                    VideoUtils.unbind( (start, end) => window.globals.app.onRecordLandmarks(start, end));
                    let capture = document.getElementById("capture_btn");
                    capture.disabled = true;
                    capture.style.display = "none"
                }
            },
            {
                id: "redo_btn",
                text: " <i class='fa fa-redo'></i>",
                title: "Redo video",
                display: "none",
                callback: async () => {
                        let capture = document.getElementById("capture_btn");
                        capture.disabled = true;
                        capture.style.display = "none"

                        let trimBtn = document.getElementById("trim_btn");
                        trimBtn.style.display = "none";

                        // TRIM VIDEO - be sure that only the sign is recorded
                        let canvas = document.getElementById("outputVideo");
                        let video = document.getElementById("recording");
                        let input = document.getElementById("input-video");
                        
                       // await VideoUtils.unbind();
                }
            }
        ];
       for(let b of buttons) {
            const button = document.createElement("button");
            button.id = b.id;
            button.title = b.title || "";
            button.style.display = b.display || "block";
            button.innerHTML = b.text;
            button.classList.add("btn-primary", "captureButton");
            if(b.styles) Object.assign(button.style, b.styles);
            if(b.callback) button.addEventListener('click', b.callback);
            buttonContainer.appendChild(button);
        }
        if(area)
            area.appendChild(buttonContainer);
        return buttonContainer;
    }

    createBlendShapesInspector(bsNames, inspector = null) {
        
        inspector = inspector || new LiteGUI.Inspector("capture-inspector");
        if(inspector.id)
            inspector.addTitle("Blend shapes weights");
        
        inspector.root.hidden = true;
       // inspector.root.style.margin = "0px 25px";
        //inspector.addSection("User positioning");

        for(let name in bsNames) {
            let info = inspector.addInfo(null, name, {width: "150px"});
            let progressVar = document.createElement('div');
            progressVar.className = "progress mb-3";
            progressVar.innerHTML = 
            '<div id="progressbar-' + name + '" class="progress-bar bg-danger" role="progressbar" style="width: 50%" aria-valuenow="15" aria-valuemin="0" aria-valuemax="100"></div>'
          
            info.appendChild(progressVar);
        }
        
        return inspector;
    }

    changeCaptureGUIVisivility(hidde) {

        document.getElementById("capture-inspector").hidden = hidde;
        let i = document.getElementById("expand-capture-gui");
        if(hidde) {
            i.classList.remove("fa-circle-chevron-right") ;
            i.classList.add("fa-circle-chevron-left");
        }
        else{
            i.classList.remove("fa-circle-chevron-left"); 
            i.classList.add("fa-circle-chevron-right");
        }
    }

    update(packet) {

        if(!packet || !this.showBSInfo){
            return;
        }
        for(let i in packet.blends)
        {
            let value = packet.blends[i];
            let progressBarT = document.getElementById("progressbar-"+i);
            if(!progressBarT) 
                continue;
            progressBarT.setAttribute("aria-valuenow", value*100);
            progressBarT.style.width = value*100 + '%';
            progressBarT.className = "progress-bar";
            if(value < 0.25) 
                progressBarT.classList.add("bg-danger")
            else if(value > 0.25 && value < 0.5) 
                progressBarT.classList.add("bg-warning")
            else 
                progressBarT.classList.add("bg-success")
        }

    }

    changeModalState(show) {
        let modal = document.getElementById("loading");
        if(show)
            modal.classList.remove("hidden");
        else    
            modal.classList.add("hidden");
    }

    createPanel(app) {

        this.createIcons();
        this.makeDraggableVideo();
        //create the dialog paenel
        var dialog = new LiteGUI.Dialog({id: "settings-panel",  title:"GUI", width: "fit-content", minWidth: 200, close: false, scroll: false, draggable: true, resizable: true});
    
        //add some widgets
        var widgets = new LiteGUI.Inspector({scroll:true, height: "inherit"});
        dialog.add(widgets);
        
        //fill the widgets
        if(app.approach == app.approaches.LIVELINK) {

            widgets.addString("Device", app.device, {callback: (v) => {
                app.device = v;
            } });
        }

        widgets.addCheckbox("Show Video", this.showVideo, { callback: (v) => {
            this.showVideo = v;
            let e = document.getElementById("capture");

            if(this.showVideo)
                e.classList.remove("hidden");
            else
                e.classList.add("hidden");
        }})

        widgets.addCombo("Character", app.character, {values: Object.keys(app.characters), callback: (v) => {
            app.character = v;
            app.loadCharacter();
        } });
        
        widgets.addCheckbox("Apply head rotation", app.applyRotation, { callback: (v) => {
            app.applyRotation = v;
        }})

        dialog = this.addChoice("Mode", ["Live", "Capture"], { value: app.mode == app.modes.LIVE ? "Live" : "Capture", callback: (v) => {
            let buttons = document.getElementById("capture-buttons");

            if(v == "Live") {
                app.mode = app.modes.LIVE;
                if(buttons)
                    buttons.classList.add("hidden");
            }
            else {
                app.mode = app.modes.CAPTURE;
                if(buttons)
                    buttons.classList.remove("hidden");
                else
                    this.createCaptureButtons(dialog.content);
                dialog.adjustSize();
            }

        }, dialog: dialog});
        
        dialog.root.style["max-width"] = "20%";
        dialog.root.style["max-height"] = "calc(100vh - 20px)";
        dialog.root.style.width = "auto";

        let section = widgets.addSection("Weights", {collapsed: true, height: "100%", callback: (v) =>{
            if(v) {
                dialog.content.style.height = "calc(100% - 20px)";
                section.children[1].style.display = "flex";
                dialog.root.style.width = "fit-content";
                dialog.root.style.height = "inherit";
            }
            else {
                dialog.root.style.width = "auto";
                dialog.adjustSize();
            }
            this.showBSInfo = v;
        }});

        section.style["margin-top"] = "10px";
        //section.children[1].style.display = "flex";
        section.children[1].style["flex-wrap"] =  "wrap";
        let inspector = this.createBlendShapesInspector(this.mapNames[app.character], widgets);
        inspector.root.hidden = false
        //show and ensure the content fits
        dialog.show();
        dialog.setPosition(10, 10);
        dialog.adjustSize();
    }

    createIcons() {
        let buttonsContainer = document.getElementById("buttons-container");

        let settings = document.createElement("i");
        settings.className = "fa fa-gear button";
        let title = document.createElement("span");
        title.innerText ="Show settings";
        settings.appendChild(title);
        
        settings.addEventListener("click", (v) => {
            let panel = document.getElementById("settings-panel");
            if(panel.classList.contains("hidden")) {
                panel.classList.remove("hidden");
                v.target.classList.add("active")
            }
            else {
                panel.classList.add("hidden");
                v.target.classList.remove("active");
            }
        })

        buttonsContainer.appendChild(settings);
    }


    createExportPanel(callback) {
        //create the dialog paenel
        var dialog = new LiteGUI.Dialog({title:"Export", width: "fit-content", close: false, scroll: false, draggable: true, resizable: true});
            
        //add some widgets
        var widgets = new LiteGUI.Inspector({scroll:true, height: "inherit"});
        dialog.add(widgets);

        let filename = "animation";
        let format = "GLB";
        widgets.addString("Filename", filename, {callback: (v) => {
            filename = v;
        }})
        widgets.addCombo("Format", format, {values: ["GLB", "BVH extended", "LiveLink"], callback: (v) => {
            format = v;
        } });

        widgets.addButton(null, "Download", {callback: () => {callback({filename, format})}});
        dialog.show();
    }

    makeDraggableVideo() {

        let e = document.getElementById("capture");
        e.classList.add("draggable");
        e.style.top = "10px";
        e.style.right = "10px";
        dragElement(e);

        let videoArea = document.getElementById("video-area");
        videoArea.classList.add("thumbnail");
        videoArea.classList.add("mirror");
        let video = document.getElementById("input-video");
        video.classList.add("thumbnail");

    }

    
}

// Make the DIV element draggable:

function dragElement(elmnt) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (document.getElementById(elmnt.id + "header")) {
    // if present, the header is where you move the DIV from:
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}
export {GUI}