import { GriffelStyle, makeStyles, tokens } from "@fluentui/react-components";

export module mixins {
    export const main: GriffelStyle = {
        flexShrink: 1,
        flexGrow: 1
    };
    export const clickable: GriffelStyle = {
        cursor: "pointer",
        ['& label']: {
            cursor: "pointer"
        }
    }
    export const box: GriffelStyle = {
        padding: tokens.spacingHorizontalM,
        borderRadius: tokens.borderRadiusMedium,
        boxShadow: tokens.shadow4,
        margin: tokens.spacingHorizontalXXS
    }
    export const float: GriffelStyle = {
        ...box,
        /** make buttons work */
        position: "relative",
        /** make buttons work */
        maxWidth: "33%",
        /** stop bleeding into page */
        overflowX: "hidden",

        ['& img']: {
            maxWidth: "100%"
        }
    }

    export const flex: GriffelStyle = {
        display: 'flex',
        flexWrap: 'nowrap',
        rowGap: tokens.spacingVerticalM,
        columnGap: tokens.spacingVerticalM,
    }

    export const wrap: GriffelStyle = {
        flexWrap: "wrap"
    }
    export const nogap: GriffelStyle = {
        rowGap: 0,
        columnGap: 0
    }
    export const ellipsis: GriffelStyle = {
        whiteSpace: 'nowrap',
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    }

    // export const box: GriffelStyle = {
    // }
}

export const KnownClassNames = {
    print: 'print-root',
    printHide: 'print-hide',
    printShow: 'print-show',
    section: 'kfui-section',
    vertical: 'kfui-vertical',
    horizontal: 'kfui-horizontal',
    list: 'kfui-list',
    accordion: 'kfui-accordion',
    accordionHeader: 'kfui-accordion-header',
    accordionBody: 'kfui-accordion-body',
    accordionBodyWrapper: 'kfui-accordion-body-wrapper',
    isOpen: 'is-opened',
    progressBarStepLabel: 'step-label',
    left: 'float-left',
    right: 'float-right'
}
export const useCommonStyles = makeStyles({
    hintLabel: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightRegular,
        lineHeight: tokens.lineHeightBase200
    },
    validationLabel: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightRegular,
        lineHeight: tokens.lineHeightBase200
    },
    fullscreen: {
        position: "fixed",
        top: 0, bottom: 0, left: 0, right: 0,
        zIndex: 1,
        backgroundColor: tokens.colorNeutralBackground1,
        overflow: "auto",
        padding: tokens.spacingHorizontalL,
        paddingLeft: "20px",
        paddingRight: "20px"
    }
});

export const commonSizes = {
    widthMedium: 360,
    widthWide: 520,
    extraWidthWide: 820,
}