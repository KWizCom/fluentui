import { Dialog, DialogActions, DialogBody, DialogContent, DialogModalType, DialogSurface, DialogTitle, DialogTrigger, useId } from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import { isNotEmptyArray, isNullOrEmptyString, noops, PushNoDuplicate, RemoveItemFromArr, stopEvent } from '@kwiz/common';
import React from 'react';
import { useKWIZFluentContext } from '../helpers/context-internal';
import { useKeyDown } from '../helpers/hooks-events';
import { ButtonEX, ButtonEXProps, ButtonEXSecondary } from './button';

export interface IPrompterProps {
    hideOk?: boolean;
    hideCancel?: boolean;
    showCancelInTitle?: boolean;
    /** return false to prevent closing the dialog. */
    onOK?: () => Promise<void> | void;
    onCancel?: () => void;
    /** OK */
    okButtonText?: string;
    /** Cancel */
    cancelButtonText?: string;
    title?: string | JSX.Element;
    okButtonProps?: Partial<ButtonEXProps>;
    cancelButtonProps?: Partial<ButtonEXProps>;
    children?: JSX.Element;

    /** allow to epand the dialog to be wider */
    maxWidth?: number | string;

    /** additional button actions at the bottom */
    actions?: JSX.Element[];

    /** dialog title actions */
    titleActions?: JSX.Element[];
    /** specify a specific mount node for this dialog */
    mountNode?: HTMLElement | null | {
        element?: HTMLElement | null;
        className?: string;
    }

    modalType?: DialogModalType;
    /** do not fire ok/cancel on esc/enter press */
    disableKeyboardActions?: boolean;
}
const dialogsOrder: string[] = [];
export const Prompter = React.forwardRef<HTMLDivElement, (IPrompterProps)>((props, ref) => {
    const ctx = useKWIZFluentContext();
    const disableKeyboardActions = React.useRef(props.disableKeyboardActions);
    disableKeyboardActions.current = props.disableKeyboardActions;

    const myId = useId();
    React.useEffect(() => {
        PushNoDuplicate(dialogsOrder, myId);
        //cleanup
        return () => RemoveItemFromArr(dialogsOrder, myId);
    }, [myId]);

    const onOK = props.onOK || noops;
    const onCancel = props.onCancel || noops;

    let okProps: ButtonEXProps = {
        ...(props.okButtonProps as any || {}),
        onClick: () => onOK(),
        title: props.okButtonText || 'OK'
    };
    let cancelProps: ButtonEXProps = {
        ...(props.cancelButtonProps as any || {}),
        onClick: () => onCancel(),
        title: props.cancelButtonText || 'Cancel'
    };

    useKeyDown({
        onEnter: (e) => {
            const topMost = dialogsOrder.indexOf(myId) === dialogsOrder.length - 1;
            if (topMost && !disableKeyboardActions.current) {
                stopEvent(e);
                onOK();
            }
        },
        onEscape: (e) => {
            const topMost = dialogsOrder.indexOf(myId) === dialogsOrder.length - 1;
            if (topMost && !disableKeyboardActions.current) {
                stopEvent(e);
                onCancel();
            }
        }
    });

    const actions: JSX.Element[] = [];
    if (!props.hideOk) actions.push(<DialogTrigger key='ok' disableButtonEnhancement>
        <ButtonEXSecondary {...okProps} />
    </DialogTrigger>);
    if (!props.hideCancel) actions.push(<DialogTrigger key='cancel' disableButtonEnhancement>
        <ButtonEXSecondary {...cancelProps} />
    </DialogTrigger>);
    if (isNotEmptyArray(props.actions))
        actions.push(...props.actions);

    const titleActions: JSX.Element[] = props.titleActions ? [...props.titleActions] : [];
    if (props.showCancelInTitle)
        titleActions.push(<DialogTrigger key='cancel' disableButtonEnhancement>
            <ButtonEX {...cancelProps} icon={<DismissRegular />} />
        </DialogTrigger>);


    return (
        <Dialog open modalType={props.modalType}>
            <DialogSurface mountNode={props.mountNode || ctx.mountNode}
                style={!isNullOrEmptyString(props.maxWidth) ? { maxWidth: props.maxWidth } : undefined}>
                <DialogBody>
                    {(!isNullOrEmptyString(props.title) || isNotEmptyArray(titleActions)) && <DialogTitle
                        action={titleActions}
                    >{props.title}</DialogTitle>}
                    <DialogContent ref={ref}>
                        {props.children}
                    </DialogContent>
                    {isNotEmptyArray(actions) && <DialogActions fluid={actions.length > 2}>
                        {actions}
                    </DialogActions>}
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
});