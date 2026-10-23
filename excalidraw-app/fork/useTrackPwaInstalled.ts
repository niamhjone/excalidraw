import { getFrame } from "@excalidraw/common";
import { trackPendoEvent } from "@excalidraw/excalidraw/analytics";
import { useEffect } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import type { RefObject } from "react";

/**
 * Whether the in-app install prompt (command palette) is showing or was
 * accepted, so `pwa_installed` can tell its installs apart from installs
 * started from the browser's own UI, and be deduplicated against
 * `pwa_install_prompt_completed`.
 */
let isInAppPromptInstall = false;

/** Call when the in-app install prompt is shown, and with the user's choice. */
export const setPwaInstallPromptStatus = (
  status: "shown" | "accepted" | "dismissed",
) => {
  isInAppPromptInstall = status !== "dismissed";
};

/**
 * Tracks `pwa_installed` when the browser reports that the app was installed
 * as a PWA (`appinstalled`), whatever the entry point: the in-app prompt, or
 * the browser's own UI (address-bar install icon, browser menu, Android "Add
 * to Home screen"), which is outside the app's DOM.
 */
export const useTrackPwaInstalled = (
  /** a mounted node, whose window is listened on */
  containerRef: RefObject<HTMLElement | null>,
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  useEffect(() => {
    const ownerWindow = containerRef.current?.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }

    const onAppInstalled = () => {
      trackPendoEvent("pwa_installed", {
        installSource: isInAppPromptInstall ? "in_app_prompt" : "browser_ui",
        // device platform (ios/android/other), not the prompt's install
        // target that `pwa_install_prompt_completed` reports
        platform: excalidrawAPI?.getEditorInterface().userAgent.platform,
        isExcalidrawPlusSignedUser,
        frame: getFrame(),
      });
      isInAppPromptInstall = false;
    };

    ownerWindow.addEventListener("appinstalled", onAppInstalled);
    return () => {
      ownerWindow.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [containerRef, excalidrawAPI]);
};
