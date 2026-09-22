// Lets apiClient's response interceptor notify authStore that the session
// expired without either module importing the other directly, which would
// otherwise be a require cycle (client.ts needs this signal, authStore.ts
// needs client.ts's apiClient transitively via auth.api.ts).
// `requestUrl` is the endpoint whose 401 triggered this — surfaced only for
// the session-end diagnostic breadcrumb (see authStore.ts), not otherwise used.
type Listener = (requestUrl?: string) => void;

let listener: Listener | null = null;

export function onSessionExpired(fn: Listener): void {
  listener = fn;
}

export function emitSessionExpired(requestUrl?: string): void {
  listener?.(requestUrl);
}
