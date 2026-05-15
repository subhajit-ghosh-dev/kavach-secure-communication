/**
 * Manages the raw WebSocket connection for real-time secure messaging.
 * Optimized for low-latency military communication.
 */
export class WebSocketManager {
    private socket: WebSocket | null = null;
    private onMessageReceived: ((data: any) => void) | null = null;

    connect(serverUrl: String, userId: string, onMessage: (data: any) => void) {
        this.onMessageReceived = onMessage;
        
        const fullUrl = serverUrl.includes('?') 
            ? `${serverUrl}&userId=${userId}` 
            : `${serverUrl}?userId=${userId}`;

        this.socket = new WebSocket(fullUrl);

        this.socket.onopen = () => {
            console.log(`[SECURE LINK] Established for user: ${userId}`);
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log(`[INCOMING] Payload type: ${data.type}`);
                if (this.onMessageReceived) {
                    this.onMessageReceived(data);
                }
            } catch (e) {
                console.error("[ERROR] Failed to parse incoming packet.");
            }
        };

        this.socket.onclose = (event) => {
            console.warn(`[SECURE LINK] Terminated: ${event.reason}`);
            // Auto-reconnect logic could go here
        };

        this.socket.onerror = (error) => {
            console.error(`[SECURE LINK] Error:`, error);
        };
    }

    send(type: string, senderId: string, receiverId: string, encryptedPayload: string) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.error("[ERROR] Secure link is down. Message not sent.");
            return;
        }

        const packet = JSON.stringify({
            type,
            senderId,
            receiverId,
            encryptedPayload
        });

        this.socket.send(packet);
    }

    sendEmergency(senderId: string, targetUnitId: string, encryptedPayload: string) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        const packet = JSON.stringify({
            type: 'emergency_broadcast',
            senderId,
            targetUnitId,
            encryptedPayload
        });

        this.socket.send(packet);
    }

    disconnect() {
        if (this.socket) {
            this.socket.close(1000, "User logout");
            this.socket = null;
        }
    }
}
