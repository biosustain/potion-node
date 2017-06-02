import {QueryEncoder} from '@angular/http';

/**
 * Potion queries need special encoding (some queries have JSON objects as values for keys).
 */
export class PotionQueryEncoder extends QueryEncoder {
	encodeKey(key: string): string {
		return encodeURIComponent(key);
	}

	encodeValue(value: string): string {
		return encodeURIComponent(
			JSON.stringify(value)
		);
	}
}
