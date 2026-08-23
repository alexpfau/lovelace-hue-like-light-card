import { applyThemesOnElement, Themes } from 'custom-card-helpers';
import { HueDialog } from '../controls/dialog';
import { Consts } from './consts';

/**
 * Contains methods with styles, that allow changing theme of single element.
 */
export class ThemeHelper {

    /**
     * Copy the theme's custom properties from an element's themed context onto another.
     *
     * Home Assistant applies a view-level theme as inline custom properties on an ancestor
     * of the card — `hui-view-container` in practice. The Hue dialog is appended to
     * `<home-assistant>` instead, which sits *outside* that subtree, so it inherits none of
     * them and every `var(--ha-…)` in the dialog silently falls back to its hardcoded
     * default. That is why the dialog renders as a flat slab next to a glass dashboard.
     *
     * Copying across is done from the source's ancestor chain rather than by re-resolving a
     * theme name, because the theme may come from the user profile, the view or the card,
     * and only the source element knows which one actually won. The nearest declaration
     * wins, mirroring normal inheritance.
     *
     * @returns the number of custom properties copied.
     */
    public static copyThemeContext(source: HTMLElement | null, target: HTMLElement | null): number {
        if (!source || !target)
            return 0;

        const collected = new Map<string, string>();
        let node: HTMLElement | null = source;

        for (let depth = 0; node && depth < 40; depth++) {
            const inline = node.style;
            if (inline && inline.length) {
                for (let i = 0; i < inline.length; i++) {
                    const name = inline[i];
                    // Only theme variables. The card's own --hue-* values describe a single
                    // card's light state and must not leak onto the dialog.
                    if (!name.startsWith('--') || name.startsWith('--hue-'))
                        continue;
                    // Nearest declaration wins.
                    if (!collected.has(name)) {
                        collected.set(name, inline.getPropertyValue(name));
                    }
                }
            }

            const parent: HTMLElement | null = node.parentElement;
            if (parent) {
                node = parent;
            }
            else {
                const root = node.getRootNode();
                const host: Element | null = (root as ShadowRoot)?.host ?? null;
                node = host instanceof HTMLElement ? host : null;
            }
        }

        collected.forEach((value, name) => target.style.setProperty(name, value));
        return collected.size;
    }

    // #region Switch styles

    private static switchCheckedButtonColorVar = '--detected-switch-checked-button-color';
    private static switchCheckedTrackColorVar = '--detected-switch-checked-track-color';
    private static possibleSwitchCheckedButtonColors = [
        '--switch-checked-button-color',
        '--primary-color'
    ];
    private static possibleSwitchCheckedTrackColors = [
        '--switch-checked-track-color',
        '--switch-checked-color',
        '--dark-primary-color'
    ];

    /**
     * @returns style variables for switches. Needs to be called with @method detectSwitchColors.
     */
    public static getSwitchThemeStyle() {
        const styles = {
            '--switch-checked-button-color': `var(${ThemeHelper.switchCheckedButtonColorVar})`,
            '--switch-checked-track-color': `var(${ThemeHelper.switchCheckedTrackColorVar})`
        };
        return styles;
    }

    /**
     * Will detect and set switch color variables (for use with @method getSwitchThemeStyle)
     */
    public static detectSwitchColors(element: HTMLElement, force = false) {
        ThemeHelper.detectThemeVariable(element, ThemeHelper.switchCheckedButtonColorVar, ThemeHelper.possibleSwitchCheckedButtonColors, 'switchBtnDetected', force);
        ThemeHelper.detectThemeVariable(element, ThemeHelper.switchCheckedTrackColorVar, ThemeHelper.possibleSwitchCheckedTrackColors, 'switchTrckDetected', force);
    }

    // #endregion

    public static setDialogThemeStyles(dialog: HueDialog, hueBgColorVariable: string, detectThemeBg: boolean) {
        if (detectThemeBg) {
        // Detect theme color if needed
            ThemeHelper.detectThemeVariableValue(
                dialog,
                Consts.ThemeDialogSurfaceBackground,
                Consts.ThemeDialogSurfacePossibleBackgrounds,
                'hueDialogBgDetected',
                true);
        }

        // To help change themes on the fly
        dialog.style.setProperty(
            '--ha-dialog-surface-background',
            `var(${hueBgColorVariable}, ${Consts.ThemeDialogSurfaceBackgroundVar})`
        );
    }

    /** 
     * Will try to apply theme on given element. 
     * @returns If the theme was applied (only when the theme changes).
     */
    public static applyTheme(element: HTMLElement, themes: Themes, theme: string): boolean {
        if (element.dataset.themeLocal == theme)
            return false;

        applyThemesOnElement(element, themes, theme);
        if (theme != Consts.ThemeDefault) {
            element.dataset.themeLocal = theme;
        }
        else {
            delete element.dataset.themeLocal;
        }

        // Detect switch colors
        ThemeHelper.detectSwitchColors(element, true);

        return true;
    }

    /**
     * Will detect card background from theme on this element.
     */
    public static detectThemeCardBackground(element: HTMLElement, force = false, offset = 0): void {

        ThemeHelper.detectThemeVariable(
            element,
            Consts.ThemeCardBackground,
            Consts.ThemeCardPossibleBackgrounds,
            'hueBgDetected',
            force,
            offset);
    }

    /**
     * Will detect and set variable to the first possible value.
     * @param element Main card element which has possible local theme variables set in style.
     * @param targetVariable Name of the variable the will be set after the detection.
     * @param possibleVariables Names of possible variables ordered from most specific.
     * @param detectedIdentifier Name of data attribute, which will hold the detected variable name.
     * @param force If set will again detect the variable name even when the detectedIdentifier attribute is already set.
     * @param offset Offset for the possibleVariables parameter. When set to 1, first possible variable is skipped.
     */
    private static detectThemeVariable(element: HTMLElement, targetVariable: string, possibleVariables: string[],
        detectedIdentifier: string, force = false, offset = 0): void {
        if (element.dataset[detectedIdentifier] && !force)
            return;

        // if element has applied custom theme - check theme locally
        const detectLocally = !!element.dataset.themeLocal;

        let possibleVar;
        for (possibleVar of possibleVariables) {
            if (offset > 0) {
                offset--;
                continue;
            }

            // for local theme - check properties on elements style attribute
            if (detectLocally) {

                // iterate all number indexes from zero, till variable found or undefined is returned
                let exists = false;
                let index = 0;
                while (element.style[index]) {
                    const s = element.style[index];
                    if (s == possibleVar) {
                        exists = true;
                        break;
                    }

                    index++;
                }

                // if variable found - set as theme background
                if (exists) {
                    element.style.setProperty(
                        targetVariable,
                        `var(${possibleVar})`
                    );
                    break;
                }
            }
            else {
                element.style.setProperty(
                    targetVariable,
                    `var(${possibleVar})`
                );

                const cptStyle = getComputedStyle(element);
                const actValue = cptStyle.getPropertyValue(targetVariable);

                if (actValue)
                    break;
            }
        }

        let attrValue = (possibleVar || 'none');
        if (detectLocally) {
            attrValue += ';local';
        }

        element.dataset[detectedIdentifier] = attrValue;
    }

    private static detectThemeVariableValue(element: HTMLElement, targetVariable: string, possibleVariables: string[],
        detectedIdentifier: string, force = false): void {
        if (element.dataset[detectedIdentifier] && !force)
            return;

        const cptStyle = getComputedStyle(element);
        let detectedVariable = 'none';
        for (const possibleVar of possibleVariables) {
            const value = cptStyle.getPropertyValue(possibleVar);
            if (!value) {
                continue;
            }

            element.style.setProperty(
                targetVariable,
                value.trim()
            );
            detectedVariable = possibleVar;
            break;
        }

        element.dataset[detectedIdentifier] = detectedVariable;
    }
}
