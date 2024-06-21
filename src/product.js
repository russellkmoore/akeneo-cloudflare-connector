export async function handleProductRequest(env,productId) {
	const productData = await env.PRODUCT_CACHE.get(productId);
	if (productData) {
		return new Response(productData, {
			headers: { 'Content-Type': 'application/json' }
		});
	} else {
		return new Response(JSON.stringify({ error: 'Product not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
