export async function handleCategoryRequest(env, categoryId) {
	const categoryData = await env.CATEGORY_CACHE.get(categoryId);
	if (categoryData) {
		return new Response(categoryData, {
			headers: { 'Content-Type': 'application/json' }
		});
	} else {
		return new Response(JSON.stringify({ error: 'Category not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		}
	)}
};
