import { mergeClasses } from "@fluentui/react-components";
import { useDragDropContext } from "./drag-drop-context";
import { iDraggableProps, iDraggedItemType, iDroppableProps } from "./drag-drop.types";

interface one<DragItemType extends iDraggedItemType<string>> {
    dragInfo: iDraggableProps<DragItemType>;
}
interface other<
    DropInfoTypes extends string = never,
    DropInfoItemTypes extends iDraggedItemType<DropInfoTypes> = never,
> {
    dropInfo: iDroppableProps<DropInfoTypes, DropInfoItemTypes>;
}
type iDragDropProps<
    DragItemType extends iDraggedItemType<string>,
    DropInfoTypes extends string = never,
    DropInfoItemTypes extends iDraggedItemType<DropInfoTypes> = never,
> = one<DragItemType> & Partial<other<DropInfoTypes, DropInfoItemTypes>>
    | Partial<one<DragItemType>> & other<DropInfoTypes, DropInfoItemTypes>
    | (one<DragItemType> & other<DropInfoTypes, DropInfoItemTypes>);

type iProps<DragItemType extends iDraggedItemType<string>, DropInfoTypes extends string, DropInfoItemTypes extends iDraggedItemType<DropInfoTypes>> =
    //all DIV props, except ref - we need ref.
    Omit<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "ref">
    //pass drag class names
    & {
        onDraggingClassName?: string;
        onDragOverClassName?: string;
    }
    //drag/drop info
    & iDragDropProps<DragItemType, DropInfoTypes, DropInfoItemTypes>

export function DragDropContainer<
    DragItemType extends iDraggedItemType<string> = never,
    DropInfoTypes extends string = never,
    DropInfoItemTypes extends iDraggedItemType<DropInfoTypes> = never
>(props: React.PropsWithChildren<iProps<DragItemType, DropInfoTypes, DropInfoItemTypes>>) {

    const { drag, drop, dragDropRef } = useDragDropContext(props);

    const classNames: string[] = [];
    if (drag.isDragging && props.onDraggingClassName) classNames.push(props.onDraggingClassName);
    if (drop.isOver && props.onDragOverClassName) classNames.push(props.onDragOverClassName);

    const propsWithoutExtras = {
        ...props
    };
    delete propsWithoutExtras.dragInfo;
    delete propsWithoutExtras.dropInfo;
    delete propsWithoutExtras.onDraggingClassName;
    delete propsWithoutExtras.onDragOverClassName;

    return <div {...propsWithoutExtras} ref={dragDropRef} className={mergeClasses(...classNames, props.className)}>{props.children}</div>;
}