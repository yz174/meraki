/**
 * AgentFlow Web — SSE Client
 *
 * Reconnecting EventSource wrapper with:
 *   - Typed event discriminator
 *   - Exponential backoff on connection drop
 *   - Authorization header via URL query param (EventSource doesn't support headers)
 */

export type SseEventType =
  | "log"
  | "agent_activity"
  | "approval_required"
  | "run_status"
  | "heartbeat";

export interface SseEvent<T = unknown> {
  type: SseEventType;
  data: T;
  id?: string;
}

export type SseHandler<T = unknown> = (event: SseEvent<T>) => void;

export interface SseClientOptions {
  url: string;
  onEvent: SseHandler;
  onError?: (err: Event) => void;
  onConnect?: () => void;
}

const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

export class SseClient {
  private es: EventSource | null = null;
  private backoff = MIN_BACKOFF_MS;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: SseClientOptions) {}

  connect(): void {
    if (typeof window === "undefined") return;
    this.closed = false;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.closed) return;

    const token = sessionStorage.getItem("agentflow_token");
    const url = token
      ? `${this.options.url}${this.options.url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
      : this.options.url;

    this.es = new EventSource(url);

    this.es.onopen = () => {
      this.backoff = MIN_BACKOFF_MS;
      this.options.onConnect?.();
    };

    this.es.onmessage = (raw) => {
      try {
        const parsed = JSON.parse(raw.data as string) as SseEvent;
        this.options.onEvent(parsed);
      } catch {
        // ignore malformed events
      }
    };

    this.es.onerror = (err) => {
      this.options.onError?.(err);
      this.es?.close();
      this.es = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.reconnectTimer = setTimeout(() => {
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
      this.doConnect();
    }, this.backoff);
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.es?.close();
    this.es = null;
  }
}

/** React hook that manages an SseClient lifecycle */
export function createSseHook(options: SseClientOptions): () => void {
  const client = new SseClient(options);
  client.connect();
  return () => client.close();
}
