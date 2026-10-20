// place here categories that you want to track. We want to track just a

import { MIME_TYPES, isDevEnv } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { LibraryItems } from "./types";

// small subset of categories at a given time.
const ALLOWED_CATEGORIES_TO_TRACK = new Set([
  "command_palette",
  "export",
  "ai",
]);

export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number,
) => {
  try {
    if (
      typeof window === "undefined" ||
      import.meta.env.VITE_WORKER_ID ||
      import.meta.env.VITE_APP_ENABLE_TRACKING !== "true"
    ) {
      return;
    }

    if (!ALLOWED_CATEGORIES_TO_TRACK.has(category)) {
      return;
    }

    if (isDevEnv()) {
      // comment out to debug in dev
      return;
    }

    if (!import.meta.env.PROD) {
      console.info("trackEvent", { category, action, label, value });
    }

    if (window.sa_event) {
      window.sa_event(action, {
        category,
        label,
        value,
      });
    }
  } catch (error) {
    console.error("error during analytics", error);
  }
};

// -----------------------------------------------------------------------------
// Pendo track events
// -----------------------------------------------------------------------------

/**
 * Names of the track events registered in Pendo. Metrics are matched on the
 * exact (case-sensitive) name, so never reword them.
 */
export type PendoTrackEventName =
  | "image_exported"
  | "canvas_copied_as_image"
  | "scene_file_saved"
  | "scene_file_opened"
  | "local_storage_quota_exceeded"
  | "shareable_link_created"
  | "shared_scene_opened"
  | "collab_session_started"
  | "collab_session_joined"
  | "collab_session_ended"
  | "collab_room_link_shared"
  | "collaborator_followed"
  | "collab_save_failed"
  | "element_link_copied"
  | "library_item_added"
  | "library_items_inserted"
  | "library_imported"
  | "library_exported"
  | "library_published"
  | "library_items_removed"
  | "library_searched"
  | "ai_text_to_diagram_generated"
  | "ai_diagram_inserted"
  | "ai_diagram_to_code_generated"
  | "mermaid_diagram_inserted"
  | "chart_inserted_from_spreadsheet"
  | "excalidraw_plus_export_completed"
  | "ai_usage_limit_reached"
  | "excalidraw_plus_scene_handoff_completed"
  | "command_palette_command_executed"
  | "canvas_search_performed"
  | "theme_changed"
  | "language_changed"
  | "editor_preference_changed"
  | "first_element_created"
  | "pwa_install_prompt_completed"
  | "app_crashed"
  | "canvas_cleared"
  | "tool_dragged_to_canvas"
  | "flowchart_nodes_created"
  | "images_inserted"
  | "embeddable_inserted"
  | "element_hyperlink_changed"
  | "element_type_converted"
  | "editor_action_performed"
  | "bucket_fill_completed"
  | "draw_to_shape_completed"
  | "element_link_opened"
  | "collab_image_upload_failed";

export type PendoTrackEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Pendo caps the serialized properties of a track event at 512 bytes, so
 * free-form strings (e.g. localized error messages) are truncated.
 */
const PENDO_MAX_STRING_PROPERTY_LENGTH = 64;

/**
 * Sends a track event to Pendo when the Pendo agent is loaded on the page
 * (no-op otherwise). `undefined`/`null` and non-finite values are omitted.
 *
 * Never pass user content (scene text, queries, prompts), URLs or any keys —
 * share links and room links carry their encryption key in the URL hash.
 */
export const trackPendoEvent = (
  eventName: PendoTrackEventName,
  properties: PendoTrackEventProperties = {},
) => {
  try {
    if (typeof window === "undefined" || !window.pendo?.track) {
      return;
    }

    const sanitizedProperties: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === "string") {
        sanitizedProperties[key] = value.slice(
          0,
          PENDO_MAX_STRING_PROPERTY_LENGTH,
        );
      } else if (
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
      ) {
        sanitizedProperties[key] = value;
      }
    }

    window.pendo.track(eventName, sanitizedProperties);
  } catch (error) {
    console.error("error during pendo analytics", error);
  }
};

/** number of elements which aren't deleted */
export const getNonDeletedElementCount = (
  elements: readonly ExcalidrawElement[],
) => {
  let count = 0;
  for (const element of elements) {
    if (!element.isDeleted) {
      count++;
    }
  }
  return count;
};

/** number of distinct image files referenced by non-deleted elements */
export const getImageFileCount = (elements: readonly ExcalidrawElement[]) => {
  const fileIds = new Set<string>();
  for (const element of elements) {
    if (!element.isDeleted && element.type === "image" && element.fileId) {
      fileIds.add(element.fileId);
    }
  }
  return fileIds.size;
};

/** sorted, comma-separated distinct types of the elements */
export const getElementTypes = (elements: readonly ExcalidrawElement[]) => {
  return Array.from(new Set(elements.map((element) => element.type)))
    .sort()
    .join(",");
};

/** item, element & published item counts of a set of library items */
export const getLibraryItemsStats = (libraryItems: LibraryItems) => {
  let elementCount = 0;
  let publishedItemCount = 0;
  for (const item of libraryItems) {
    elementCount += item.elements.length;
    if (item.status === "published") {
      publishedItemCount++;
    }
  }
  return { itemCount: libraryItems.length, elementCount, publishedItemCount };
};

/** hostname of a URL (without `www.`) — never track full URLs */
export const getUrlHostname = (url: string | null | undefined) => {
  if (!url) {
    return undefined;
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
};

/** short label for the mime type of an opened scene file */
export const getSceneFileType = (mimeType: string) => {
  switch (mimeType) {
    case MIME_TYPES.png:
      return "png";
    case MIME_TYPES.svg:
      return "svg";
    case MIME_TYPES.excalidrawlib:
      return "excalidrawlib";
    default:
      return "excalidraw";
  }
};

/**
 * Reports a conversational AI agent interaction to Pendo. No-op unless the
 * host page has loaded the Pendo agent.
 */
export const trackAgent = (
  ownerWindow: Window,
  eventType: "prompt" | "agent_response" | "user_reaction",
  metadata: {
    agentId: string;
    conversationId: string;
    messageId: string;
    /** message text, or the reaction type for `user_reaction` events */
    content: string;
    modelUsed?: string;
    suggestedPrompt?: boolean;
    toolsUsed?: string[];
    fileUploaded?: boolean;
  },
) => {
  try {
    if (ownerWindow.pendo?.trackAgent) {
      ownerWindow.pendo.trackAgent(eventType, metadata);
    }
  } catch (error) {
    console.error("error during agent analytics", error);
  }
};
