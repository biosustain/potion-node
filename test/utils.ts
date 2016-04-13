// Create paginated items
export function toPages(items: any[], perPage: number): Array<any[]> {
	let i;
	let j;
	let pages = [];

	for (i = 0, j = items.length; i < j; i += perPage) {
		pages.push(items.slice(i, i + perPage));
	}

	return pages;
}
