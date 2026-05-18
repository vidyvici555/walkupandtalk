'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';

const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || 'http://localhost:5001';

// STUN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useWebRTC({ matchId, userId, partnerId, onCallCompleted }) {
  const [callState, setCallState] = useState('idle'); // idle | ringing | incoming | connected | ended
  const [callType, setCallType] = useState('voice'); // voice | video
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const signalingRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callConnectedAtRef = useRef(null); // timestamp when call became connected

  // Connect to signaling server
  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem('wuag_token');

    signalingRef.current = io(SIGNALING_URL, { auth: { token } });

    signalingRef.current.on('incoming_call', async ({ callId, callerId, offer, callType: ct }) => {
      setIncomingCall({ callId, callerId, offer, callType: ct });
      setCallState('incoming');
      callIdRef.current = callId;
    });

    signalingRef.current.on('call_accepted', async ({ callId, answer }) => {
      if (pcRef.current && answer) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        callConnectedAtRef.current = Date.now();
        setCallState('connected');
      }
    });

    signalingRef.current.on('call_rejected', () => {
      cleanup();
      setCallState('idle');
    });

    signalingRef.current.on('ice_candidate', async ({ candidate }) => {
      if (pcRef.current && candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    signalingRef.current.on('call_ended', ({ reason }) => {
      cleanup();
      setCallState('ended');
      setTimeout(() => setCallState('idle'), 3000);
    });

    return () => {
      signalingRef.current?.disconnect();
    };
  }, [userId]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        signalingRef.current?.emit('ice_candidate', {
          callId: callIdRef.current,
          candidate,
          targetUserId: partnerId,
        });
      }
    };

    pc.ontrack = ({ streams }) => {
      remoteStreamRef.current = streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        callConnectedAtRef.current = Date.now();
        setCallState('connected');
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        cleanup();
        setCallState('ended');
      }
    };

    return pc;
  }, [partnerId]);

  const getLocalMedia = useCallback(async (video = false) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  // Initiate a call
  const startCall = useCallback(async (type = 'voice') => {
    setCallType(type);
    setCallState('ringing');

    const stream = await getLocalMedia(type === 'video');
    const pc = createPeerConnection();
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    signalingRef.current?.emit('call_user', {
      targetUserId: partnerId,
      matchId,
      offer,
      callType: type,
    });

    signalingRef.current?.once('call_ringing', ({ callId }) => {
      callIdRef.current = callId;
    });
  }, [matchId, partnerId, getLocalMedia, createPeerConnection]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { callId, offer, callType: ct } = incomingCall;
    callIdRef.current = callId;
    setCallType(ct);

    const stream = await getLocalMedia(ct === 'video');
    const pc = createPeerConnection();
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    signalingRef.current?.emit('call_accepted', { callId, answer });
    callConnectedAtRef.current = Date.now();
    setCallState('connected');
    setIncomingCall(null);
  }, [incomingCall, getLocalMedia, createPeerConnection]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    signalingRef.current?.emit('call_rejected', { callId: incomingCall.callId });
    setIncomingCall(null);
    setCallState('idle');
  }, [incomingCall]);

  // End call — calculate duration and pass it to the completion callback
  const endCall = useCallback(() => {
    const durationSeconds = callConnectedAtRef.current
      ? Math.floor((Date.now() - callConnectedAtRef.current) / 1000)
      : 0;
    callConnectedAtRef.current = null;

    signalingRef.current?.emit('end_call', { callId: callIdRef.current, matchId });
    cleanup();
    setCallState('ended');
    onCallCompleted?.(durationSeconds);
    setTimeout(() => setCallState('idle'), 3000);
  }, [matchId, onCallCompleted]);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    callIdRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted((m) => !m);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsCameraOff((c) => !c);
    }
  }, []);

  return {
    callState,
    callType,
    incomingCall,
    isMuted,
    isCameraOff,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
