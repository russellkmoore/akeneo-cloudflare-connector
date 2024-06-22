// src/index.js

import { handleRefresh } from './refresh.js';
import { handleProductRequest } from './product.js';
import { handleCategoryRequest } from './category.js';
import { handleNavigationRequest } from './navigation.js'

var src_default = {
	async fetch(request, env, ctx) {
		let url = new URL(request.url);
		let response = new Response;
		const pathSegments = url.pathname.split('/').filter(segment => segment);
		if (pathSegments.length > 0) {
			switch (pathSegments[0]) {
				case 'product':
					if (pathSegments.length === 2) {
						response = await handleProductRequest(env,pathSegments[1]);
					}
					break;
				case 'category':
					if (pathSegments.length === 2) {
						response = await handleCategoryRequest(env,pathSegments[1]);
					}
					break;
				case 'catalog':
					response = await handleNavigationRequest(env);
					break;
				case 'refresh':
					response =  await handleRefresh(env);
					break;
				default:
					return new Response('Not Found', { status: 404 });
			}
			// this is a hack to allow CORS. You should use validation in real code.
			response.headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
			response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
			response.headers.set("Access-Control-Allow-Credentials", "true");
			return response;
		} else {
			return new Response('Welcome to Akeneo Cloudflare Connector!', { status: 200 });
		}
	}
};
export {
	src_default as
	default
};
//# sourceMappingURL=index.js.map
