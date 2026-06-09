async function convertCallToVideo() {
  if (!activeCallState?.stream || !activeCallState?.pc) return;
  const button = document.getElementById("adnnCallVideoToggle");
  
  if (activeCallState.videoOn) {
    // Turning video OFF
    const oldTracks = activeCallState.stream.getVideoTracks();
    oldTracks.forEach((track) => {
      track.enabled = false;
      track.stop();
      activeCallState.stream.removeTrack(track);
    });
    const sender = activeCallState.pc.getSenders?.().find((item) => item.track?.kind === "video") || getVideoSender(activeCallState.pc);
    await sender?.replaceTrack?.(null).catch(() => {});
    setVideoTransceiverDirection(activeCallState.pc, "sendrecv");
    activeCallState.videoOn = false;
    await announceCallMediaUpdate(false);
    await renegotiateActiveCall("video-off", { force: true });
    if (button) button.innerHTML = `${ADNN_ICON_VIDEO}<span>Video</span>`;
    renderCallOverlay();
    return;
  }
  
  try {
    // Turning video ON
    const videoStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: activeCallState.facingMode || callCameraFacingMode || "user" } 
    });
    const track = videoStream.getVideoTracks()[0];
    if (!track) throw new Error("No camera track");
    
    track.enabled = !activeCallState.holdOn;
    
    // Clean up old video tracks safely
    activeCallState.stream.getVideoTracks().forEach((oldTrack) => {
      oldTrack.stop();
      activeCallState.stream.removeTrack(oldTrack);
    });
    
    activeCallState.stream.addTrack(track);
    activeCallState.videoOn = true;
    activeCallState.kind = "video";
    
    // Attach locally and broadcast media update state immediately
    attachCallMedia();
    await announceCallMediaUpdate(true);
    
    // Replace track on the WebRTC Sender instance explicitly
    const sender = activeCallState.pc.getSenders?.().find((item) => item.track?.kind === "video") || getVideoSender(activeCallState.pc);
    if (sender && sender.replaceTrack) {
      await sender.replaceTrack(track);
    } else {
      await sendLocalVideoTrack(track);
    }
    
    // Allow state to settle, then execute WebRTC offer renegotiation
    window.setTimeout(async () => {
      await renegotiateActiveCall("video-on", { force: true });
    }, 400);

    if (button) button.innerHTML = `${ADNN_ICON_VIDEO}<span>Video On</span>`;
    renderCallOverlay();
  } catch (error) {
    console.error("Camera conversion failed:", error);
    showChatAlert({ text: "Camera permission is needed to convert to video." }, "Video blocked");
  }
}

function createPeerConnection(callId, isAnswerer) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] });
  ensureVideoTransceiver(pc);
  
  pc.onicecandidate = (event) => {
    if (event.candidate) addDoc(collection(db, "calls", callId, isAnswerer ? "answerCandidates" : "offerCandidates"), event.candidate.toJSON()).catch(() => {});
  };
  
  pc.ontrack = (event) => {
    if (!activeCallState) return;
    if (!activeCallState.remoteStream) activeCallState.remoteStream = new MediaStream();
    
    const incoming = event.streams?.[0]?.getTracks?.()?.length ? event.streams[0].getTracks() : (event.track ? [event.track] : []);
    
    incoming.forEach((track) => {
      const sameTrackExists = activeCallState.remoteStream.getTracks().some((existing) => existing.id === track.id);
      if (!sameTrackExists) {
        activeCallState.remoteStream.getTracks()
          .filter((existing) => existing.kind === track.kind)
          .forEach((oldTrack) => {
            try { activeCallState.remoteStream.removeTrack(oldTrack); } catch(_) {}
          });
        activeCallState.remoteStream.addTrack(track);
      }
      
      if (track.kind === "video") {
        markRemoteVideoActive(track);
        // Force rendering logic updates on immediate stream event status variations
        track.onunmute = () => { markRemoteVideoActive(track); attachCallMedia(); };
        track.onmute = () => {
          window.setTimeout(() => {
            if (!activeCallState || track.readyState === "ended") return;
            if (track.muted && activeCallState.remoteVideoDisabledByPeer) markRemoteVideoInactive(true);
            else attachCallMedia();
          }, 900);
        };
        track.onended = () => markRemoteVideoInactive(true);
      }
    });
    attachCallMedia();
  };
  
  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected", "closed"].includes(pc.connectionState) && activeCallState?.status === "connected") {
      endBrowserCall(true, "Call disconnected");
    }
  };
  return pc;
}
