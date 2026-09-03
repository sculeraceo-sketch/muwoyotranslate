import { AudioPipelineState } from '../types';

export interface AudioPipelineService {
  state: AudioPipelineState;
  startListening(language: string): Promise<void>;
  stopListening(): Promise<{ audioBase64: string }>;
  play(audioUrl: string): Promise<void>;
  stopPlayback(): Promise<void>;
}

export const audioPipelineService: AudioPipelineService = {
  state: 'idle',
  async startListening() {
    throw new Error('Microphone pipeline is not configured yet.');
  },
  async stopListening() {
    throw new Error('Microphone pipeline is not configured yet.');
  },
  async play() {
    throw new Error('Audio playback pipeline is not configured yet.');
  },
  async stopPlayback() {
    return Promise.resolve();
  },
};
