/**
 * Camel case to snake case
 */

export function fromCamelCase(str, separator = '_') {
	return str.replace(/([a-z][A-Z])/g, (g) => `${g[0]}${separator}${g[1].toLowerCase()}`);
}


/**
 * Snake case to camel case
 */

export function toCamelCase(str) {
	return str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
}


/**
 * Transform pairs of [[key, value]] to {[key]: value}
 */

export function pairsToObject(pairs: any[]) {
	let obj = {};
	for (let [key, value] of pairs) {
		obj[key] = value;
	}
	return obj;
}
