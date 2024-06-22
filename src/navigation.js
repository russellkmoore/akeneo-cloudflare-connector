export async function handleNavigationRequest(env) {
	const catalogNav = await env.CATALOG_NAVIGATION_CACHE.get('catalog');
	if (catalogNav) {
		return new Response(catalogNav, {
			headers: { 'Content-Type': 'application/json' }
		});
	} else {
		return new Response(JSON.stringify({ error: 'Navigation not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});

	}
};
