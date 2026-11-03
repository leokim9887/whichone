const STORAGE_KEY = "whichone.content-policy.visible";
const CHANGE_EVENT = "whichone-content-policy-change";

export function readContentPolicyVisible(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw !== "0";
  } catch {
    return true;
  }
}

export function writeContentPolicyVisible(visible: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, visible ? "1" : "0");
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeContentPolicyVisible(onStoreChange: () => void): () => void {
  const onChange = () => onStoreChange();
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
