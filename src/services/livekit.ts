import { Room, RoomEvent, ConnectionState, Track, RemoteTrackPublication } from 'livekit-client';

export type LiveKitStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export const liveKitService = {
  async connect(serverUrl: string, token: string, handlers: {
    onStatus?: (status: LiveKitStatus) => void;
    onParticipant?: (count: number) => void;
    recipientIdentity?: string;
  } = {}) {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    handlers.onStatus?.('connecting');
    room.on(RoomEvent.Reconnecting, () => handlers.onStatus?.('reconnecting'));
    room.on(RoomEvent.Reconnected, () => handlers.onStatus?.('connected'));
    room.on(RoomEvent.Disconnected, () => handlers.onStatus?.('disconnected'));
    const updateParticipants = () => handlers.onParticipant?.(room.remoteParticipants.size + 1);
    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    const subscribeTranslatedTrack = (publication: RemoteTrackPublication) => {
      if (publication.source !== Track.Source.Microphone) return;
      const trackName = (publication as RemoteTrackPublication & { trackName?: string }).trackName;
      const isTranslationForThisClient = Boolean(handlers.recipientIdentity && trackName?.includes(`target=${handlers.recipientIdentity}`));
      publication.setSubscribed(isTranslationForThisClient);
    };
    room.on(RoomEvent.TrackPublished, subscribeTranslatedTrack);
    try {
      await room.connect(serverUrl, token, { autoSubscribe: false });
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) subscribeTranslatedTrack(publication);
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      updateParticipants();
      handlers.onStatus?.('connected');
      return room;
    } catch (error) {
      handlers.onStatus?.('error');
      throw error;
    }
  },

  async setMicrophoneEnabled(room: Room, enabled: boolean) {
    await room.localParticipant.setMicrophoneEnabled(enabled);
  },

  disconnect(room: Room) {
    room.disconnect();
  },

  isConnected(room: Room) {
    return room.state === ConnectionState.Connected;
  },
};
