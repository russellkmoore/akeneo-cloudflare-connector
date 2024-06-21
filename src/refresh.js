import { Category } from "./model/Category.js";
import { Product } from "./model/Product.js";
import { Akeneo } from "./model/Akeneo.js";

export async function handleRefresh(env) {
	const akeneo = new Akeneo(
		env.AKENEO_HOST,
		env.AKENEO_USERNAME,
		env.AKENEO_PASSWORD,
		env.AKENEO_CLIENT_ID,
		env.AKENEO_SECRET
	);

	let newCategoryCount = 0;
	const oldCategoryCount = await countKeysInKV(env.CATEGORY_CACHE);
	let endCategoryCount = 0;
	let newProductCount = 0;
	const oldProductCount = await countKeysInKV(env.PRODUCT_CACHE);
	let endProductCount = 0;

	// Fetch all categories from Akeneo
	console.log('Fetching all categories...');
	const allCategories = await fetchAllCategories(akeneo);
	console.log('Fetching all categories... done.');

	// Map the categories to the Category class
	const categoryObjects = allCategories.map(cat => new Category(cat.code, cat.parent, cat.labels, [], [], []));
	newCategoryCount = categoryObjects.length;
	console.log('Mapped all categories into category objects. Total count is ' + newCategoryCount);

	// Fetch all products from Akeneo
	console.log('Fetching all products...');
	const allProducts = await fetchAllProducts(akeneo);
	console.log('Fetching all products... done.');

	// Map the products to the Product class
	const productObjects = allProducts.map(prod => new Product(prod.identifier, prod.family, prod.categories, prod.values));
	newProductCount = productObjects.length;
	console.log('Mapped all products into product objects. Total count is ' + newProductCount);

	// Update categories with child product IDs
	console.log('Updating Categories with Product IDs...');
	updateCategoriesWithProductIds(productObjects, categoryObjects);
	console.log('Updating Categories with Product IDs... done');

	// Build the navigational tree
	console.log('Building Categories Tree...');
	const categoryTree = buildCategoryTree(categoryObjects);
	console.log('Building Categories Tree... done');

	// Save the category tree in Cloudflare CATALOG_NAVIGATION_CACHE KV.
	console.log('Saving Category Tree...');
	await env.CATALOG_NAVIGATION_CACHE.put('catalog', JSON.stringify(categoryTree));
	console.log('Saving Category Tree... done.');

	// Save the products in Cloudflare PRODUCT_CACHE KV.
	console.log('Saving Products ...');
	await saveProductsToCache(env, productObjects);
	console.log('Saving Products ... done');

	// Save the categories in Cloudflare CATEGORY_CACHE KV.
	console.log('Saving Categories ...');
	await saveCategoriesToCache(env, categoryObjects);
	console.log('Saving Categories ... done.');

	endCategoryCount = await countKeysInKV(env.CATEGORY_CACHE);
	endProductCount = await countKeysInKV(env.PRODUCT_CACHE);
	console.log('Final Category Count is ' + endCategoryCount + ' and final product count is ' + endProductCount);

	return new Response(JSON.stringify({
		categoryTree: categoryTree,
		categoryCountBeforeUpdate: oldCategoryCount,
		categoryCountInUpdate: newCategoryCount,
		categoryCountAfterUpdate: endCategoryCount,
		productCountBeforeUpdate: oldProductCount,
		productCountInUpdate: newProductCount,
		productCountAfterUpdate: endProductCount
	}, null, 2), {
		headers: { 'Content-Type': 'application/json' }
	});


	async function countKeysInKV(kvNamespace) {
		const limit = 1000; // Maximum keys to retrieve per list request
		let keys = [];
		let cursor = null;

		do {
			const listResult = await kvNamespace.list({ limit, cursor });
			keys = keys.concat(listResult.keys);
			cursor = listResult.cursor;
		} while (cursor);

		return keys.length;
	}

	// Function to fetch all categories from Akeneo, handling pagination
	async function fetchAllCategories(akeneoInstance) {
		if (!akeneoInstance.bearerToken) {
			await akeneoInstance.authenticate();
		}

		let allCategories = [];
		let nextPageUrl = `http://${akeneoInstance.hostname}/api/rest/v1/categories?limit=100`;

		while (nextPageUrl) {
			const response = await fetch(nextPageUrl, {
				headers: { 'Authorization': `Bearer ${akeneoInstance.bearerToken}` }
			});
			const data = await response.json();
			allCategories = allCategories.concat(data._embedded.items);
			nextPageUrl = data._links.next ? data._links.next.href : null;
		}

		return allCategories;
	}

	// Function to fetch all products from Akeneo, handling pagination
	async function fetchAllProducts(akeneoInstance) {
		if (!akeneoInstance.bearerToken) {
			await akeneoInstance.authenticate();
		}

		let allProducts = [];
		let nextPageUrl = `http://${akeneoInstance.hostname}/api/rest/v1/products?limit=100`;

		while (nextPageUrl) {
			const response = await fetch(nextPageUrl, {
				headers: { 'Authorization': `Bearer ${akeneoInstance.bearerToken}` }
			});
			const data = await response.json();
			allProducts = allProducts.concat(data._embedded.items);
			nextPageUrl = data._links.next ? data._links.next.href : null;
		}

		return allProducts;
	}

	// Function to build a navigational tree based on the "parent" property
	function buildCategoryTree(categories) {
		const categoryMap = {};
		const categoryTree = [];

		categories.forEach(category => {
			categoryMap[category.code] = category;
		});

		categories.forEach(category => {
			if (category.parent) {
				categoryMap[category.parent].categories.push(categoryMap[category.code]);
			} else {
				categoryTree.push(categoryMap[category.code]);
			}
		});

		return categoryTree;
	}

	// Function to update categories with child product IDs
	function updateCategoriesWithProductIds(products, categories) {
		const categoryMap = {};
		categories.forEach(category => {
			categoryMap[category.code] = category;
		});

		products.forEach(product => {
			if (product.categories) {
				product.categories.forEach(categoryCode => {
					if (categoryMap[categoryCode]) {
						categoryMap[categoryCode].childProductIds.push(product.identifier);
					}
				});
			}
		});
	}

	// Function to save categories to CATEGORY_CACHE KV
	async function saveCategoriesToCache(env, categories) {
		console.log('saving ' + categories.length + ' categories...');
		//create the bulk KV upload object
		const bulkCategories = categories.map(cat => ({
			key: cat.code,
			value: JSON.stringify(new Category(cat.code, cat.parent, cat.labels, cat.categories, cat.values, cat.childProductIds))
		}));
		const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNTID}/storage/kv/namespaces/${env.CF_CATEGORYKVID}/bulk`;

		const response = await fetch(url, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${env.CF_APITOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(bulkCategories)
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('Failed to save categories:', errorData);
			throw new Error(`Failed to save categories: ${errorData.errors.map(e => e.message).join(', ')}`);
		}

		const data = await response.json();
		console.log('All categories saved successfully');
		return data;
	}

	// Function to save products to PRODUCT_CACHE KV
	async function saveProductsToCache(env, products) {
		console.log('saving ' + products.length + ' products...');
		//create the bulk KV upload object
		const bulkProducts = products.map(prod => ({
			key: prod.identifier,
			value: JSON.stringify(new Product(prod.identifier, prod.family, prod.categories, prod.values))
		}));
		const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNTID}/storage/kv/namespaces/${env.CF_PRODUCTKVID}/bulk`;

		const response = await fetch(url, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${env.CF_APITOKEN}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(bulkProducts)
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('Failed to save products:', errorData);
			throw new Error(`Failed to save products: ${errorData.errors.map(e => e.message).join(', ')}`);
		}

		const data = await response.json();
		console.log('All products saved successfully');
		return data;
	}
}
