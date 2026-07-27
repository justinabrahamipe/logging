import NetInfo from "@react-native-community/netinfo";

let online = true;
const listeners = new Set<(online: boolean) => void>();

export function isConnected(): boolean {
  return online;
}

export function subscribe(cb: (online: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function init(): void {
  NetInfo.addEventListener((state) => {
    const next = !!state.isConnected && state.isInternetReachable !== false;
    if (next === online) return;
    online = next;
    listeners.forEach((cb) => cb(online));
  });
}
