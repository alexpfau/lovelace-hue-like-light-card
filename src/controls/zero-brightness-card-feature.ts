import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Consts } from '../types/consts';

type FeatureContext = {
    entity_id?: string;
};

type FeatureConfig = {
    type: string;
};

type CustomCardFeatureEntry = {
    type: string;
    name?: string;
    isSupported?: (hass: HomeAssistant, context: FeatureContext) => boolean;
    configurable?: boolean;
};

type CardFeatureWindow = Window & {
    customCardFeatures?: CustomCardFeatureEntry[];
};

const ModesSupportingBrightness = [
    'brightness',
    'color_temp',
    'hs',
    'xy',
    'rgb',
    'rgbw',
    'rgbww',
    'white'
];

const ZeroEdgeThreshold = 3;

const supportsBrightness = (stateObj?: HassEntity): boolean => {
    if (!stateObj || !stateObj.entity_id.startsWith('light.')) {
        return false;
    }

    const modes = stateObj.attributes.supported_color_modes;
    return Array.isArray(modes) && modes.some((mode) => ModesSupportingBrightness.includes(mode));
};

@customElement(HueZeroBrightnessCardFeature.ElementName)
export class HueZeroBrightnessCardFeature extends LitElement {
    public static readonly ElementName = 'hue-zero-brightness-card-feature' + Consts.ElementPostfix;
    public static readonly FeatureType = `custom:${HueZeroBrightnessCardFeature.ElementName}`;

    @property({ attribute: false })
    public hass?: HomeAssistant;

    @property({ attribute: false })
    public context?: FeatureContext;

    @state()
    private _config?: FeatureConfig;

    public setConfig(config: FeatureConfig): void {
        if (!config) {
            throw new Error('Invalid configuration');
        }
        this._config = config;
    }

    protected override render() {
        const stateObj = this.getStateObj();
        if (!this._config || !stateObj || !supportsBrightness(stateObj)) {
            return nothing;
        }

        const position = stateObj.state === 'off'
            ? 0
            : Math.max(Math.round(((stateObj.attributes.brightness as number | undefined) ?? 0) * 100 / 255), 1);

        return html`
            <ha-control-slider
                .value=${position}
                min="0"
                max="100"
                .showHandle=${stateObj.state !== 'off'}
                .disabled=${stateObj.state === 'unavailable'}
                @value-changed=${this.valueChanged}
                .label=${this.hass?.localize('ui.card.light.brightness') || 'Brightness'}
                unit="%"
                .locale=${this.hass?.locale}
            ></ha-control-slider>
        `;
    }

    private getStateObj(): HassEntity | undefined {
        const entityId = this.context?.entity_id;
        if (!entityId || !this.hass) {
            return undefined;
        }
        return this.hass.states[entityId];
    }

    private valueChanged(ev: CustomEvent<{ value: number }>): void {
        ev.stopPropagation();
        const stateObj = this.getStateObj();
        if (!this.hass || !stateObj) {
            return;
        }

        const value = ev.detail.value;
        if (value <= ZeroEdgeThreshold) {
            this.hass.callService('light', 'turn_off', {
                entity_id: stateObj.entity_id
            });
            return;
        }

        this.hass.callService('light', 'turn_on', {
            entity_id: stateObj.entity_id,
            brightness_pct: value
        });
    }

    public static override get styles() {
        return css`
            ha-control-slider {
                --control-slider-color: var(--feature-color);
                --control-slider-background: var(--feature-color);
                --control-slider-background-opacity: 0.2;
                --control-slider-thickness: var(--feature-height);
                --control-slider-border-radius: var(--feature-border-radius);
            }
        `;
    }
}

const cardFeatureWindow = window as CardFeatureWindow;
cardFeatureWindow.customCardFeatures = cardFeatureWindow.customCardFeatures || [];
if (!cardFeatureWindow.customCardFeatures.some((feature) => feature.type === HueZeroBrightnessCardFeature.ElementName)) {
    cardFeatureWindow.customCardFeatures.push({
        type: HueZeroBrightnessCardFeature.ElementName,
        name: 'Hue zero brightness',
        configurable: false,
        isSupported: (hass, context) => supportsBrightness(context.entity_id ? hass.states[context.entity_id] : undefined)
    });
}
