import { isNullOrUndefined } from "@kwiz/common";
import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useStateEX } from "../hooks";
import { DragDropContext, useDragDropContextInternal } from "./drag-drop-context-internal";
import { iDragDropContext, iDraggableProps, iDraggedItemType, iDroppableProps } from "./drag-drop.types";
import { useDraggable } from "./use-draggable";
import { useDroppable } from "./use-droppable";

export function useDragDropContext<
    DragItemType extends iDraggedItemType<string> = never,
    DropInfoType extends iDroppableProps<string, any> = never
>(info: {
    dragInfo?: iDraggableProps<DragItemType>;
    dropInfo?: DropInfoType;
}) {
    const dragDropContext = useDragDropContextInternal();
    const isDraggable = !isNullOrUndefined(info.dragInfo);
    const isDroppable = !isNullOrUndefined(info.dropInfo);
    const drag = useDraggable(info?.dragInfo);
    const drop = useDroppable(info?.dropInfo);
    const expectingDrop = isDroppable && !drag.isDragging && dragDropContext.isDragging
        //check if item being dragged is allowed in this context...
        && info.dropInfo.acceptTypes.indexOf(dragDropContext.dragItem.type) >= 0;

    return {
        dragDropContext,
        drag,
        drop,
        /** an item that this control can handler is being dragged */
        expectingDrop,
        dragDropRef: isDraggable && !isDroppable
            ? drag.dragRef
            : !isDraggable && isDroppable
                ? drop.dropRef
                //both drag and drop allowed
                : expectingDrop ? drop.dropRef : drag.dragRef
    };
}
export function useDragDropContextProvider(): iDragDropContext {
    const [dragItem, setDragItem] = useStateEX<iDraggedItemType<string>>(null);

    //build context
    const ctx: iDragDropContext = {
        isDragging: !isNullOrUndefined(dragItem),
        dragItem, setDragItem
    };

    return ctx;
}

interface iProps {
}
export const DragDropContextProvider: React.FunctionComponent<React.PropsWithChildren<iProps>> = (props) => {
    const provider = useDragDropContextProvider();
    return <DragDropContext.Provider value={provider}>
        <DndProvider backend={HTML5Backend} context={window}>
            {props.children}
        </DndProvider>
    </DragDropContext.Provider>;
}