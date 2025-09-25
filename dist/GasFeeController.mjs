var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _GasFeeController_instances, _GasFeeController_getProvider, _GasFeeController_onNetworkControllerDidChange;
function $importDefault(module) {
    if (module?.__esModule) {
        return module.default;
    }
    return module;
}
import { convertHexToDecimal, safelyExecute, toHex } from "@metamask/controller-utils";
import $EthQuery from "@metamask/eth-query";
const EthQuery = $importDefault($EthQuery);
import { StaticIntervalPollingController } from "@metamask/polling-controller";
import { v1 as random } from "uuid";
import determineGasFeeCalculations from "./determineGasFeeCalculations.mjs";
import { fetchGasEstimates, fetchLegacyGasPriceEstimates, fetchEthGasPriceEstimate, calculateTimeEstimate } from "./gas-util.mjs";
export const LEGACY_GAS_PRICES_API_URL = `https://api.metaswap.codefi.network/gasPrices`;
/**
 * Indicates which type of gasEstimate the controller is currently returning.
 * This is useful as a way of asserting that the shape of gasEstimates matches
 * expectations. NONE is a special case indicating that no previous gasEstimate
 * has been fetched.
 */
export const GAS_ESTIMATE_TYPES = {
    FEE_MARKET: 'fee-market',
    LEGACY: 'legacy',
    ETH_GASPRICE: 'eth_gasPrice',
    NONE: 'none',
};
const metadata = {
    gasFeeEstimatesByChainId: {
        persist: true,
        anonymous: false,
    },
    gasFeeEstimates: { persist: true, anonymous: false },
    estimatedGasFeeTimeBounds: { persist: true, anonymous: false },
    gasEstimateType: { persist: true, anonymous: false },
    nonRPCGasFeeApisDisabled: { persist: true, anonymous: false },
};
const name = 'GasFeeController';
const defaultState = {
    gasFeeEstimatesByChainId: {},
    gasFeeEstimates: {},
    estimatedGasFeeTimeBounds: {},
    gasEstimateType: GAS_ESTIMATE_TYPES.NONE,
    nonRPCGasFeeApisDisabled: false,
};
/**
 * Controller that retrieves gas fee estimate data and polls for updated data on a set interval
 */
export class GasFeeController extends StaticIntervalPollingController() {
    /**
     * Creates a GasFeeController instance.
     *
     * @param options - The controller options.
     * @param options.interval - The time in milliseconds to wait between polls.
     * @param options.messenger - The controller messenger.
     * @param options.state - The initial state.
     * @param options.getCurrentNetworkEIP1559Compatibility - Determines whether or not the current
     * network is EIP-1559 compatible.
     * @param options.getCurrentNetworkLegacyGasAPICompatibility - Determines whether or not the
     * current network is compatible with the legacy gas price API.
     * @param options.getCurrentAccountEIP1559Compatibility - Determines whether or not the current
     * account is EIP-1559 compatible.
     * @param options.getChainId - Returns the current chain ID.
     * @param options.getProvider - Returns a network provider for the current network.
     * @param options.onNetworkDidChange - A function for registering an event handler for the
     * network state change event.
     * @param options.legacyAPIEndpoint - The legacy gas price API URL. This option is primarily for
     * testing purposes.
     * @param options.EIP1559APIEndpoint - The EIP-1559 gas price API URL.
     * @param options.clientId - The client ID used to identify to the gas estimation API who is
     * asking for estimates.
     */
    constructor({ interval = 15000, messenger, state, getCurrentNetworkEIP1559Compatibility, getCurrentAccountEIP1559Compatibility, getChainId, getCurrentNetworkLegacyGasAPICompatibility, getProvider, onNetworkDidChange, legacyAPIEndpoint = LEGACY_GAS_PRICES_API_URL, EIP1559APIEndpoint, clientId, }) {
        super({
            name,
            metadata,
            messenger,
            state: { ...defaultState, ...state },
        });
        _GasFeeController_instances.add(this);
        _GasFeeController_getProvider.set(this, void 0);
        this.intervalDelay = interval;
        this.setIntervalLength(interval);
        this.pollTokens = new Set();
        this.getCurrentNetworkEIP1559Compatibility =
            getCurrentNetworkEIP1559Compatibility;
        this.getCurrentNetworkLegacyGasAPICompatibility =
            getCurrentNetworkLegacyGasAPICompatibility;
        this.getCurrentAccountEIP1559Compatibility =
            getCurrentAccountEIP1559Compatibility;
        __classPrivateFieldSet(this, _GasFeeController_getProvider, getProvider, "f");
        this.EIP1559APIEndpoint = EIP1559APIEndpoint;
        this.legacyAPIEndpoint = legacyAPIEndpoint;
        this.clientId = clientId;
        this.ethQuery = new EthQuery(__classPrivateFieldGet(this, _GasFeeController_getProvider, "f").call(this));
        if (onNetworkDidChange && getChainId) {
            this.currentChainId = getChainId();
            // TODO: Either fix this lint violation or explain why it's necessary to ignore.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onNetworkDidChange(async (networkControllerState) => {
                await __classPrivateFieldGet(this, _GasFeeController_instances, "m", _GasFeeController_onNetworkControllerDidChange).call(this, networkControllerState);
            });
        }
        else {
            const { selectedNetworkClientId } = this.messagingSystem.call('NetworkController:getState');
            this.currentChainId = this.messagingSystem.call('NetworkController:getNetworkClientById', selectedNetworkClientId).configuration.chainId;
            this.messagingSystem.subscribe('NetworkController:networkDidChange', 
            // TODO: Either fix this lint violation or explain why it's necessary to ignore.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            async (networkControllerState) => {
                await __classPrivateFieldGet(this, _GasFeeController_instances, "m", _GasFeeController_onNetworkControllerDidChange).call(this, networkControllerState);
            });
        }
    }
    async resetPolling() {
        if (this.pollTokens.size !== 0) {
            const tokens = Array.from(this.pollTokens);
            this.stopPolling();
            await this.getGasFeeEstimatesAndStartPolling(tokens[0]);
            tokens.slice(1).forEach((token) => {
                this.pollTokens.add(token);
            });
        }
    }
    async fetchGasFeeEstimates(options) {
        return await this._fetchGasFeeEstimateData(options);
    }
    async getGasFeeEstimatesAndStartPolling(pollToken) {
        const _pollToken = pollToken || random();
        this.pollTokens.add(_pollToken);
        if (this.pollTokens.size === 1) {
            await this._fetchGasFeeEstimateData();
            this._poll();
        }
        return _pollToken;
    }
    /**
     * Gets and sets gasFeeEstimates in state.
     *
     * @param options - The gas fee estimate options.
     * @param options.shouldUpdateState - Determines whether the state should be updated with the
     * updated gas estimates.
     * @returns The gas fee estimates.
     */
    async _fetchGasFeeEstimateData(options = {}) {
        const { shouldUpdateState = true, networkClientId } = options;
        let ethQuery, isEIP1559Compatible, isLegacyGasAPICompatible, decimalChainId;
        if (networkClientId !== undefined) {
            const networkClient = this.messagingSystem.call('NetworkController:getNetworkClientById', networkClientId);
            isLegacyGasAPICompatible = networkClient.configuration.chainId === '0x38';
            decimalChainId = convertHexToDecimal(networkClient.configuration.chainId);
            try {
                const result = await this.messagingSystem.call('NetworkController:getEIP1559Compatibility', networkClientId);
                isEIP1559Compatible = result || false;
            }
            catch {
                isEIP1559Compatible = false;
            }
            ethQuery = new EthQuery(networkClient.provider);
        }
        ethQuery ?? (ethQuery = this.ethQuery);
        isLegacyGasAPICompatible ?? (isLegacyGasAPICompatible = this.getCurrentNetworkLegacyGasAPICompatibility());
        decimalChainId ?? (decimalChainId = convertHexToDecimal(this.currentChainId));
        try {
            isEIP1559Compatible ?? (isEIP1559Compatible = await this.getEIP1559Compatibility());
        }
        catch (e) {
            console.error(e);
            isEIP1559Compatible ?? (isEIP1559Compatible = false);
        }
        const gasFeeCalculations = await determineGasFeeCalculations({
            isEIP1559Compatible,
            isLegacyGasAPICompatible,
            fetchGasEstimates,
            fetchGasEstimatesUrl: this.EIP1559APIEndpoint.replace('<chain_id>', `${decimalChainId}`),
            fetchLegacyGasPriceEstimates,
            fetchLegacyGasPriceEstimatesUrl: this.legacyAPIEndpoint.replace('<chain_id>', `${decimalChainId}`),
            fetchEthGasPriceEstimate,
            calculateTimeEstimate,
            clientId: this.clientId,
            ethQuery,
            nonRPCGasFeeApisDisabled: this.state.nonRPCGasFeeApisDisabled,
        });
        if (shouldUpdateState) {
            const chainId = toHex(decimalChainId);
            this.update((state) => {
                if (this.currentChainId === chainId) {
                    state.gasFeeEstimates = gasFeeCalculations.gasFeeEstimates;
                    state.estimatedGasFeeTimeBounds =
                        gasFeeCalculations.estimatedGasFeeTimeBounds;
                    state.gasEstimateType = gasFeeCalculations.gasEstimateType;
                }
                state.gasFeeEstimatesByChainId ?? (state.gasFeeEstimatesByChainId = {});
                state.gasFeeEstimatesByChainId[chainId] = {
                    gasFeeEstimates: gasFeeCalculations.gasFeeEstimates,
                    estimatedGasFeeTimeBounds: gasFeeCalculations.estimatedGasFeeTimeBounds,
                    gasEstimateType: gasFeeCalculations.gasEstimateType,
                };
            });
        }
        return gasFeeCalculations;
    }
    /**
     * Remove the poll token, and stop polling if the set of poll tokens is empty.
     *
     * @param pollToken - The poll token to disconnect.
     */
    disconnectPoller(pollToken) {
        this.pollTokens.delete(pollToken);
        if (this.pollTokens.size === 0) {
            this.stopPolling();
        }
    }
    stopPolling() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        this.pollTokens.clear();
        this.resetState();
    }
    /**
     * Prepare to discard this controller.
     *
     * This stops any active polling.
     */
    destroy() {
        super.destroy();
        this.stopPolling();
    }
    _poll() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        // TODO: Either fix this lint violation or explain why it's necessary to ignore.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.intervalId = setInterval(async () => {
            await safelyExecute(() => this._fetchGasFeeEstimateData());
        }, this.intervalDelay);
    }
    /**
     * Fetching token list from the Token Service API.
     *
     * @private
     * @param input - The input for the poll.
     * @param input.networkClientId - The ID of the network client triggering the fetch.
     * @returns A promise that resolves when this operation completes.
     */
    async _executePoll({ networkClientId }) {
        await this._fetchGasFeeEstimateData({ networkClientId });
    }
    resetState() {
        this.update(() => {
            return defaultState;
        });
    }
    async getEIP1559Compatibility() {
        const currentNetworkIsEIP1559Compatible = await this.getCurrentNetworkEIP1559Compatibility();
        const currentAccountIsEIP1559Compatible = this.getCurrentAccountEIP1559Compatibility?.() ?? true;
        return (currentNetworkIsEIP1559Compatible && currentAccountIsEIP1559Compatible);
    }
    getTimeEstimate(maxPriorityFeePerGas, maxFeePerGas) {
        if (!this.state.gasFeeEstimates ||
            this.state.gasEstimateType !== GAS_ESTIMATE_TYPES.FEE_MARKET) {
            return {};
        }
        return calculateTimeEstimate(maxPriorityFeePerGas, maxFeePerGas, this.state.gasFeeEstimates);
    }
    enableNonRPCGasFeeApis() {
        this.update((state) => {
            state.nonRPCGasFeeApisDisabled = false;
        });
    }
    disableNonRPCGasFeeApis() {
        this.update((state) => {
            state.nonRPCGasFeeApisDisabled = true;
        });
    }
}
_GasFeeController_getProvider = new WeakMap(), _GasFeeController_instances = new WeakSet(), _GasFeeController_onNetworkControllerDidChange = async function _GasFeeController_onNetworkControllerDidChange({ selectedNetworkClientId, }) {
    const newChainId = this.messagingSystem.call('NetworkController:getNetworkClientById', selectedNetworkClientId).configuration.chainId;
    if (newChainId !== this.currentChainId) {
        this.ethQuery = new EthQuery(__classPrivateFieldGet(this, _GasFeeController_getProvider, "f").call(this));
        await this.resetPolling();
        this.currentChainId = newChainId;
    }
};
export default GasFeeController;
//# sourceMappingURL=GasFeeController.mjs.map