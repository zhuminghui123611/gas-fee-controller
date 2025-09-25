"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTimeEstimate = exports.fetchEthGasPriceEstimate = exports.fetchLegacyGasPriceEstimates = exports.fetchGasEstimates = exports.normalizeGWEIDecimalNumbers = void 0;
const controller_utils_1 = require("@metamask/controller-utils");
const bn_js_1 = __importDefault(require("bn.js"));
const makeClientIdHeader = (clientId) => ({ 'X-Client-Id': clientId });
/**
 * Convert a decimal GWEI value to a decimal string rounded to the nearest WEI.
 *
 * @param n - The input GWEI amount, as a decimal string or a number.
 * @returns The decimal string GWEI amount.
 */
function normalizeGWEIDecimalNumbers(n) {
    const numberAsWEIHex = (0, controller_utils_1.gweiDecToWEIBN)(n).toString(16);
    const numberAsGWEI = (0, controller_utils_1.weiHexToGweiDec)(numberAsWEIHex);
    return numberAsGWEI;
}
exports.normalizeGWEIDecimalNumbers = normalizeGWEIDecimalNumbers;
/**
 * Fetch gas estimates from the given URL.
 *
 * @param url - The gas estimate URL.
 * @param clientId - The client ID used to identify to the API who is asking for estimates.
 * @returns The gas estimates.
 */
async function fetchGasEstimates(url, clientId) {
    const estimates = await (0, controller_utils_1.handleFetch)(url, clientId ? { headers: makeClientIdHeader(clientId) } : undefined);
    return {
        low: {
            ...estimates.low,
            suggestedMaxPriorityFeePerGas: normalizeGWEIDecimalNumbers(estimates.low.suggestedMaxPriorityFeePerGas),
            suggestedMaxFeePerGas: normalizeGWEIDecimalNumbers(estimates.low.suggestedMaxFeePerGas),
        },
        medium: {
            ...estimates.medium,
            suggestedMaxPriorityFeePerGas: normalizeGWEIDecimalNumbers(estimates.medium.suggestedMaxPriorityFeePerGas),
            suggestedMaxFeePerGas: normalizeGWEIDecimalNumbers(estimates.medium.suggestedMaxFeePerGas),
        },
        high: {
            ...estimates.high,
            suggestedMaxPriorityFeePerGas: normalizeGWEIDecimalNumbers(estimates.high.suggestedMaxPriorityFeePerGas),
            suggestedMaxFeePerGas: normalizeGWEIDecimalNumbers(estimates.high.suggestedMaxFeePerGas),
        },
        estimatedBaseFee: normalizeGWEIDecimalNumbers(estimates.estimatedBaseFee),
        historicalBaseFeeRange: estimates.historicalBaseFeeRange,
        baseFeeTrend: estimates.baseFeeTrend,
        latestPriorityFeeRange: estimates.latestPriorityFeeRange,
        historicalPriorityFeeRange: estimates.historicalPriorityFeeRange,
        priorityFeeTrend: estimates.priorityFeeTrend,
        networkCongestion: estimates.networkCongestion,
    };
}
exports.fetchGasEstimates = fetchGasEstimates;
/**
 * Hit the legacy MetaSwaps gasPrices estimate api and return the low, medium
 * high values from that API.
 *
 * @param url - The URL to fetch gas price estimates from.
 * @param clientId - The client ID used to identify to the API who is asking for estimates.
 * @returns The gas price estimates.
 */
async function fetchLegacyGasPriceEstimates(url, clientId) {
    const result = await (0, controller_utils_1.handleFetch)(url, {
        referrer: url,
        referrerPolicy: 'no-referrer-when-downgrade',
        method: 'GET',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
            ...(clientId && makeClientIdHeader(clientId)),
        },
    });
    return {
        low: result.SafeGasPrice,
        medium: result.ProposeGasPrice,
        high: result.FastGasPrice,
    };
}
exports.fetchLegacyGasPriceEstimates = fetchLegacyGasPriceEstimates;
/**
 * Get a gas price estimate from the network using the `eth_gasPrice` method.
 *
 * @param ethQuery - The EthQuery instance to call the network with.
 * @returns A gas price estimate.
 */
async function fetchEthGasPriceEstimate(ethQuery) {
    const gasPrice = await (0, controller_utils_1.query)(ethQuery, 'gasPrice');
    return {
        gasPrice: (0, controller_utils_1.weiHexToGweiDec)(gasPrice).toString(),
    };
}
exports.fetchEthGasPriceEstimate = fetchEthGasPriceEstimate;
/**
 * Estimate the time it will take for a transaction to be confirmed.
 *
 * @param maxPriorityFeePerGas - The max priority fee per gas.
 * @param maxFeePerGas - The max fee per gas.
 * @param gasFeeEstimates - The gas fee estimates.
 * @returns The estimated lower and upper bounds for when this transaction will be confirmed.
 */
function calculateTimeEstimate(maxPriorityFeePerGas, maxFeePerGas, gasFeeEstimates) {
    const { low, medium, high, estimatedBaseFee } = gasFeeEstimates;
    const maxPriorityFeePerGasInWEI = (0, controller_utils_1.gweiDecToWEIBN)(maxPriorityFeePerGas);
    const maxFeePerGasInWEI = (0, controller_utils_1.gweiDecToWEIBN)(maxFeePerGas);
    const estimatedBaseFeeInWEI = (0, controller_utils_1.gweiDecToWEIBN)(estimatedBaseFee);
    const effectiveMaxPriorityFee = bn_js_1.default.min(maxPriorityFeePerGasInWEI, maxFeePerGasInWEI.sub(estimatedBaseFeeInWEI));
    const lowMaxPriorityFeeInWEI = (0, controller_utils_1.gweiDecToWEIBN)(low.suggestedMaxPriorityFeePerGas);
    const mediumMaxPriorityFeeInWEI = (0, controller_utils_1.gweiDecToWEIBN)(medium.suggestedMaxPriorityFeePerGas);
    const highMaxPriorityFeeInWEI = (0, controller_utils_1.gweiDecToWEIBN)(high.suggestedMaxPriorityFeePerGas);
    let lowerTimeBound;
    let upperTimeBound;
    if (effectiveMaxPriorityFee.lt(lowMaxPriorityFeeInWEI)) {
        lowerTimeBound = null;
        upperTimeBound = 'unknown';
    }
    else if (effectiveMaxPriorityFee.gte(lowMaxPriorityFeeInWEI) &&
        effectiveMaxPriorityFee.lt(mediumMaxPriorityFeeInWEI)) {
        lowerTimeBound = low.minWaitTimeEstimate;
        upperTimeBound = low.maxWaitTimeEstimate;
    }
    else if (effectiveMaxPriorityFee.gte(mediumMaxPriorityFeeInWEI) &&
        effectiveMaxPriorityFee.lt(highMaxPriorityFeeInWEI)) {
        lowerTimeBound = medium.minWaitTimeEstimate;
        upperTimeBound = medium.maxWaitTimeEstimate;
    }
    else if (effectiveMaxPriorityFee.eq(highMaxPriorityFeeInWEI)) {
        lowerTimeBound = high.minWaitTimeEstimate;
        upperTimeBound = high.maxWaitTimeEstimate;
    }
    else {
        lowerTimeBound = 0;
        upperTimeBound = high.maxWaitTimeEstimate;
    }
    return {
        lowerTimeBound,
        upperTimeBound,
    };
}
exports.calculateTimeEstimate = calculateTimeEstimate;
//# sourceMappingURL=gas-util.cjs.map