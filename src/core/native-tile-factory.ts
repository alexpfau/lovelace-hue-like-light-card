import { HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';
import { HueLikeLightCardConfig } from '../types/config';

/**
 * Creates and owns an embedded, genuine Home Assistant tile card.
 *
 * Rather than imitating `hui-tile-card` with hand-written CSS — which means chasing every
 * restyle Home Assistant ever ships — this asks HA to build a real tile and renders it.
 * Parity is then structural rather than cosmetic, and the native `light-brightness`
 * feature supplies a slider that is, by construction, the one a tile would have.
 *
 * The tile is deliberately configured with every action set to `none`: the whole point of
 * this card is that a tap opens the Hue dialog instead of HA's more-info. Tap handling
 * lives in the card, which listens in the capture phase because `ha-tile-container` stops
 * click propagation before a bubbling listener on a wrapper would ever see it.
 */
export class NativeTileFactory {
    /**
     * Build the tile config that mirrors this card's configuration.
     *
     * `name` carries the Hue card's resolved title so a card configured with a custom
     * title keeps it. Everything else is left to the tile so it renders exactly as a
     * natively-configured tile would.
     */
    public static buildConfig(config: HueLikeLightCardConfig, title: string): LovelaceCardConfig {
        const none = { action: 'none' };
        const tileConfig: LovelaceCardConfig = {
            type: 'tile',
            entity: config.groupEntity,
            tap_action: none,
            icon_tap_action: none,
            hold_action: none,
            double_tap_action: none,
            features_position: 'bottom',
            features: [{ type: 'light-brightness' }]
        };

        if (config.icon) {
            tileConfig.icon = config.icon;
        }
        if (title) {
            tileConfig.name = title;
        }

        return tileConfig;
    }

    /**
     * Ask Home Assistant for a real tile element.
     *
     * `loadCardHelpers` is a de facto rather than contractual frontend API, so every
     * failure path here has to be survivable: the card falls back to its own rendering
     * when this returns null, instead of showing the user an empty card.
     */
    public static async create(
        config: HueLikeLightCardConfig,
        title: string,
        hass: HomeAssistant
    ): Promise<LovelaceCard | null> {
        const loader = (window as unknown as { loadCardHelpers?: () => Promise<unknown> })
            .loadCardHelpers;
        if (typeof loader != 'function') {
            return null;
        }

        try {
            const helpers = (await loader()) as {
                createCardElement?: (c: LovelaceCardConfig) => LovelaceCard | Promise<LovelaceCard>;
            };
            if (!helpers?.createCardElement) {
                return null;
            }

            const element = await helpers.createCardElement(
                NativeTileFactory.buildConfig(config, title)
            );
            if (!element) {
                return null;
            }

            element.hass = hass;
            return element;
        }
        catch {
            // A malformed tile config or a frontend change must degrade to the fallback
            // surface, never take the whole card down.
            return null;
        }
    }

    /**
     * Element tag names that own their own pointer handling inside a tile.
     *
     * A tap that passes through any of these is the user working the brightness slider,
     * not asking for the Hue dialog. Matching is done against the full composed path
     * because shadow-DOM retargeting makes `event.target` useless here.
     */
    private static readonly InteractiveTags = [
        'hui-card-features',
        'hui-light-brightness-card-feature',
        'ha-control-slider',
        'ha-control-switch',
        'ha-control-select',
        'ha-control-number-buttons'
    ];

    /**
     * True when the event originated inside a tile control that handles its own input.
     */
    public static isInteractiveTarget(ev: Event): boolean {
        const path = typeof ev.composedPath == 'function' ? ev.composedPath() : [];
        for (const node of path) {
            const tag = (node as HTMLElement)?.tagName?.toLowerCase?.();
            if (tag && NativeTileFactory.InteractiveTags.indexOf(tag) >= 0) {
                return true;
            }
        }
        return false;
    }
}
