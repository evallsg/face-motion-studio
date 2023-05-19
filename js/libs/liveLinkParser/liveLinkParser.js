// PARSES ONE PACKET FROM LIVE LINK
// Javi Agenjo (@tamat) 9/7/22
// requires stream.js: https://github.com/jagenjo/jstoolbits/blob/main/stream.js

//var names as seen in the app
var livelink_names = [
    "EyeBlinkLeft",
    "EyeLookDownLeft",
    "EyeLookInLeft",
    "EyeLookOutLeft",
    "EyeLookUpLeft",
    "EyeSquintLeft",
    "EyeWideLeft",

    "EyeBlinkRight",
    "EyeLookDownRight",
    "EyeLookInRight",
    "EyeLookOutRight",
    "EyeLookUpRight",
    "EyeSquintRight",
    "EyeWideRight",

    "JawForward",
    "JawLeft",
    "JawRight",
    "JawOpen",

    "MouthClose",
    "MouthFunnel",
    "MouthPucker",
    "MouthRight",
    "MouthLeft",
    "MouthSmileLeft",
    "MouthSmileRight",
    "MouthFrownLeft",
    "MouthFrownRight",
    "MouthDimpleLeft",
    "MouthDimpleRight",
    "MouthStretchLeft",
    "MouthStretchRight",

    "MouthRollLower",
    "MouthRollUpper",
    "MouthShrugLower",
    "MouthShrugUpper",
    "MouthPressLeft",
    "MouthPressRight",
    "MouthLowerDownLeft",
    "MouthLowerDownRight",
    "MouthUpperUpLeft",
    "MouthUpperUpRight",

    "BrowDownLeft",
    "BrowDownRight",
    "BrowInnerUp",
    "BrowOuterUpLeft",
    "BrowOuterUpRight",
    
    "CheekPuff",
    "CheekSquintLeft",
    "CheekSquintRight",

    "NoseSneerLeft",
    "NoseSneerRight",

    "TongueOut",

    "HeadYaw",
    "HeadPitch",
    "HeadRoll",

    "LeftEyeYaw",
    "LeftEyePitch",
    "LeftEyeRoll",

    "RightEyeYaw",
    "RightEyePitch",
    "RightEyeRoll"
];

//stream must be of my own stream custom class
function parseLiveLinkPacket( stream, out )
{
    if(!stream || stream.constructor !== Stream)
        throw("Stream data must be of type Stream.js");

    out = out || {};

    stream.little_endian = false;

    //parse DATA
    stream.index = 0;
    var num = stream.readUint8(); //version?
    out.id = stream.readString(4);
    out.name = stream.readString(4);
    out.time = stream.readUint32();
    out.time2 = stream.readUint32();
    out.num_values = stream.readUint32();
    out.unknown = stream.readUint32();

    out.values = [];
    out.blends = {};

    //could end here
    if( stream.eof())
        return out;

    out.unknown2 = stream.readUint8();
    for(var i = 0; i < out.num_values; ++i)
    {
        if( stream.eof())
            return out;

        var value = stream.readFloat32();
        out.values[i] = value;
        out.blends[ livelink_names[i] ] = value;
    }       

    return out;
}


//from here https://docs.microsoft.com/es-es/dotnet/api/arkit.arblendshapelocationoptions.mouthdimpleright?view=xamarin-ios-sdk-12
var apple_names = [
    "BrowDownLeft",
    "BrowDownRight",
    "BrowInnerUp",
    "BrowOuterUpLeft",
    "BrowOuterUpRight",
    "CheekPuff",
    "CheekSquintLeft",
    "CheekSquintRight",
    "EyeBlinkLeft",
    "EyeBlinkRight",
    "EyeLookDownLeft",
    "EyeLookDownRight",
    "EyeLookInLeft",
    "EyeLookInRight",
    "EyeLookOutLeft",
    "EyeLookOutRight",
    "EyeLookUpLeft",
    "EyeLookUpRight",
    "EyeSquintLeft",
    "EyeSquintRight",
    "EyeWideLeft",
    "EyeWideRight",
    "JawForward",
    "JawLeft",
    "JawOpen",
    "JawRight",
    "MouthClose",
    "MouthDimpleLeft",
    "MouthDimpleRight",
    "MouthFrownLeft",
    "MouthFrownRight",
    "MouthFunnel",
    "MouthLeft",
    "MouthLowerDownLeft",
    "MouthLowerDownRight",
    "MouthPressLeft",
    "MouthPressRight",
    "MouthPucker",
    "MouthRight",
    "MouthRollLower",
    "MouthRollUpper",
    "MouthShrugLower",
    "MouthShrugUpper",
    "MouthSmileLeft",
    "MouthSmileRight",
    "MouthStretchLeft",
    "MouthStretchRight",
    "MouthUpperUpLeft",
    "MouthUpperUpRight",
    "NoseSneerLeft",
    "NoseSneerRight",
    "TongueOut"
];
