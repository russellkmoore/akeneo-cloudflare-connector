export class Category {
	constructor(code, parent, labels, categories = [], values = [], childProductIds = []) {
		this.code = code;
		this.parent = parent;
		this.labels = labels;
		this.categories = categories;
		this.values = values;
		this.childProductIds = childProductIds;
	}
}