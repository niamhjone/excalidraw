import { useCallback, useEffect, useState } from "react";

import { normalizeLink, KEYS } from "@excalidraw/common";

import {
  defaultGetElementLinkFromSelection,
  getLinkIdAndTypeFromSelection,
} from "@excalidraw/element";

import { isElementLink, parseElementLinkFromURL } from "@excalidraw/element"; // FORK:

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types"; // FORK:

import type { Scene } from "@excalidraw/element";

import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import DialogActionButton from "./DialogActionButton";
import { TextField } from "./TextField";
import { IconButton } from "./IconButton";
import { TrashIcon } from "./icons";
import { trackHyperlinkChanged } from "./hyperlink/Hyperlink"; // FORK:

import "./ElementLinkDialog.scss";

import type { AppProps, AppState, UIAppState } from "../types";

// FORK: Pendo track event — what an element link points to in this scene
const getElementLinkTargetType = (
  link: string | null,
  elementsMap: ElementsMap,
) => {
  const id = link && isElementLink(link) ? parseElementLinkFromURL(link) : null;
  if (!id) {
    return undefined;
  }
  if (elementsMap.has(id)) {
    return "element";
  }
  for (const element of elementsMap.values()) {
    if (element.groupIds.includes(id)) {
      return "group";
    }
  }
  return "unresolved";
};

const ElementLinkDialog = ({
  sourceElementId,
  onClose,
  appState,
  scene,
  generateLinkForSelection = defaultGetElementLinkFromSelection,
}: {
  sourceElementId: ExcalidrawElement["id"];
  appState: UIAppState;
  scene: Scene;
  onClose?: () => void;
  generateLinkForSelection: AppProps["generateLinkForSelection"];
}) => {
  const elementsMap = scene.getNonDeletedElementsMap();
  const originalLink = elementsMap.get(sourceElementId)?.link ?? null;

  const [nextLink, setNextLink] = useState<string | null>(originalLink);
  const [linkEdited, setLinkEdited] = useState(false);

  useEffect(() => {
    const selectedElements = getSelectedElements(elementsMap, appState);
    let nextLink = originalLink;

    if (selectedElements.length > 0 && generateLinkForSelection) {
      const idAndType = getLinkIdAndTypeFromSelection(
        selectedElements,
        appState as AppState,
      );

      if (idAndType) {
        nextLink = normalizeLink(
          generateLinkForSelection(idAndType.id, idAndType.type),
        );
      }
    }

    setNextLink(nextLink);
  }, [
    elementsMap,
    appState,
    appState.selectedElementIds,
    originalLink,
    generateLinkForSelection,
  ]);

  const handleConfirm = useCallback(() => {
    if (nextLink && nextLink !== elementsMap.get(sourceElementId)?.link) {
      const elementToLink = elementsMap.get(sourceElementId);
      elementToLink &&
        scene.mutateElement(elementToLink, {
          link: nextLink,
        });
    }

    if (!nextLink && linkEdited && sourceElementId) {
      const elementToLink = elementsMap.get(sourceElementId);
      elementToLink &&
        scene.mutateElement(elementToLink, {
          link: null,
        });
    }

    onClose?.();
  }, [sourceElementId, nextLink, elementsMap, linkEdited, scene, onClose]);

  // FORK: Pendo track event — `handleConfirm`, then report the link change.
  // The element is mutated in place, and the helper is a no-op when the link
  // didn't change (e.g. on the second, window-level, Enter confirm)
  const confirmAndTrack = useCallback(
    (confirmMethod: "button" | "enter_key") => {
      const elementToTrack = elementsMap.get(sourceElementId);
      const previousLink = elementToTrack?.link ?? null;
      handleConfirm();
      if (elementToTrack) {
        trackHyperlinkChanged(
          elementToTrack,
          previousLink,
          elementToTrack.link,
          {
            source: "element_link_dialog",
            targetType: getElementLinkTargetType(
              elementToTrack.link ?? previousLink,
              elementsMap,
            ),
            confirmMethod,
          },
        );
      }
    },
    [elementsMap, sourceElementId, handleConfirm],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        appState.openDialog?.name === "elementLinkSelector" &&
        event.key === KEYS.ENTER
      ) {
        confirmAndTrack("enter_key"); // FORK: Pendo track event
      }

      if (
        appState.openDialog?.name === "elementLinkSelector" &&
        event.key === KEYS.ESCAPE
      ) {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [appState, onClose, confirmAndTrack]); // FORK: Pendo track event

  return (
    <div className="ElementLinkDialog">
      <div className="ElementLinkDialog__header">
        <h2>{t("elementLink.title")}</h2>
        <p>{t("elementLink.desc")}</p>
      </div>

      <div className="ElementLinkDialog__input">
        <TextField
          value={nextLink ?? ""}
          onChange={(value) => {
            if (!linkEdited) {
              setLinkEdited(true);
            }
            setNextLink(value);
          }}
          onKeyDown={(event) => {
            if (event.key === KEYS.ENTER) {
              confirmAndTrack("enter_key"); // FORK: Pendo track event
            }
          }}
          className="ElementLinkDialog__input-field"
          selectOnRender
        />

        {originalLink && nextLink && (
          <IconButton
            type="button"
            title={t("buttons.remove")}
            aria-label={t("buttons.remove")}
            label={t("buttons.remove")}
            onClick={() => {
              // removes the link from the input
              // but doesn't update the element

              // when confirmed, will remove the link from the element
              setNextLink(null);
              setLinkEdited(true);
            }}
            className="ElementLinkDialog__remove"
            icon={TrashIcon}
          />
        )}
      </div>

      <div className="ElementLinkDialog__actions">
        <DialogActionButton
          label={t("buttons.cancel")}
          onClick={() => {
            onClose?.();
          }}
          style={{
            marginRight: 10,
          }}
        />

        <DialogActionButton
          label={t("buttons.confirm")}
          // FORK: Pendo track event
          onClick={() => confirmAndTrack("button")}
          actionType="primary"
        />
      </div>
    </div>
  );
};

export default ElementLinkDialog;
