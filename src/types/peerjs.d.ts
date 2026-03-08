declare module 'peerjs' {
  export interface PeerJSOption {
    key?: string;
    host?: string;
    port?: number;
    path?: string;
    secure?: boolean;
    config?: RTCConfiguration;
    debug?: number;
  }

  export interface DataConnection {
    send(data: any): void;
    close(): void;
    on(event: 'data', callback: (data: any) => void): void;
    on(event: 'open', callback: () => void): void;
    on(event: 'close', callback: () => void): void;
    on(event: 'error', callback: (err: any) => void): void;
  }

  export interface MediaConnection {
    answer(stream?: MediaStream): void;
    close(): void;
    on(event: 'stream', callback: (stream: MediaStream) => void): void;
    on(event: 'close', callback: () => void): void;
    on(event: 'error', callback: (err: any) => void): void;
  }

  export default class Peer {
    constructor(id?: string, options?: PeerJSOption);
    
    id: string;
    
    connect(peerId: string, options?: any): DataConnection;
    call(peerId: string, stream: MediaStream, options?: any): MediaConnection;
    
    on(event: 'open', callback: (id: string) => void): void;
    on(event: 'connection', callback: (conn: DataConnection) => void): void;
    on(event: 'call', callback: (call: MediaConnection) => void): void;
    on(event: 'close', callback: () => void): void;
    on(event: 'disconnected', callback: () => void): void;
    on(event: 'error', callback: (err: any) => void): void;
    
    disconnect(): void;
    destroy(): void;
  }
}
