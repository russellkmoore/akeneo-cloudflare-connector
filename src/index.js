// src/index.js

import { handleRefresh } from './refresh.js';
import { handleProductRequest } from './product.js';
import { handleCategoryRequest } from './category.js';
import { handleNavigationRequest } from './navigation.js'

var src_default = {
	async fetch(request, env, ctx) {
		let url = new URL(request.url);
		const pathSegments = url.pathname.split('/').filter(segment => segment);
		if (pathSegments.length > 0) {
			switch (pathSegments[0]) {
				case 'product':
					if (pathSegments.length === 2) {
						return await handleProductRequest(env,pathSegments[1]);
					}
					break;
				case 'category':
					if (pathSegments.length === 2) {
						return await handleCategoryRequest(env,pathSegments[1]);
					}
					break;
				case 'catalog':
					return await handleNavigationRequest(env);
					break;
				case 'refresh':
					return await handleRefresh(env);
					break;
				default:
					return new Response('Not Found', { status: 404 });
			}
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
