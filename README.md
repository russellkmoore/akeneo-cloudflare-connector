# Akeneo Cloudflare Connector

## Introduction
This project connects Akeneo PIM with Cloudflare Workers and Pages to provide a dynamic product and category catalog.
The catalog is displayed on web pages with navigation built from categories hierarchy displaying category and product detail data.

Note that this is an example project to learn about using the Akeneo REST AIP as well as how you can leverage Cloudflare Workers and Pages to cache data on the edge and display it super fast to end users.
In my testing, the time it takes to refresh the entire catalog to the edge has been under 20 seconds for about 70 categories and over 1200 products, and service calls to get all of this data to the browser are consistently around 50ms.

## Prerequisites
This readme will not walk you through the following, as there is extensive documentation for each, but you will need:
- [Node.js](https://nodejs.org/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update/)
- [Cloudflare Account](https://www.cloudflare.com/plans/) - Free should get you started.
- [Akeneo PIM Community Edition](https://www.akeneo.com/akeneo-pim-community-edition/)
- [NGrok](https://ngrok.com)
- [Docker](https://www.docker.com/products/docker-desktop/) - for my mac, I use this to launch the Docker daemon and see running images

## Project Structure
```
akeneo-cloudflare-connector/
├── pages/
│ ├── index.html - landing page for demoing the data
│ ├── category.html - displays a category
│ ├── product.html - displays a product
│ ├── styles.css
├── src/
│ ├── model/
│ │ ├── Category.js - a Category object
│ │ ├── Product.js - a Product object
│ │ └── Akeneo.js - the Akeneo object, represents a connection to the PIM
│ ├── index.js - your worker main file
│ ├── refresh.js - contains the function to pull data from the PIM and cache it in KVs
│ ├── category.js - contains the function to return a queried category
│ ├── product.js - contains the function to return a queried product
│ ├── navigation.js - contains the function to return the category tree to be used for navigation
├── wrangler.toml
└── README.md
```

## Akeneo Setup
1.  **Install Akeneo Community Edition.**
You will need to had Docker running. During installation, it will ask you if you want sample catalog data imported. The code works with the data provided in the sample set.
There is a place in the code where I have hardcoded references to "master" as I couldn't find a way to get categories to filter automatically by channel in the REST API, so I do my own filtering.
When complete, you should be able to log into localhost:8080 with admin/admin.

2. **Launch ngrok**
Use your own hostname and tunnel out port 8080. This will expose your Akeneo instance to the internet.
![Launching ngrok](/screenshots/ngrok.png?raw=true "Launching ngrok")
![Running ngrok](/screenshots/ngrok2.png?raw=true "Running ngrok")
You should be able to get to your instance now via public DNS.
![Running ngrok](/screenshots/akeneo.png?raw=true "akeneo")

3. **Set Up a Connection**
In Akeneo, a Connection is a channel for moving data in or out of the PIM. As Admin, go into the "Connect" menu on the left, and select "Connection Settings." Akeneo should have created a few demo ones for you , but we are going to set up our own.
![Connections Panel](/screenshots/connections1.png?raw=true "akeneo connections")
Create a new connection and set it as a Data Destination:
![New Connection](/screenshots/connections2.png?raw=true "akeneo new connection")
In the final panel, you will have the option to set an icon (here I used one for Cloudflare workers I found online).  Set the Role to "Data Destination." For the group, I reused the one they created for SAP. In a real environment you would created a dedicated group and mange the permissions appropriately.
![New Connection Details](/screenshots/connections3.png?raw=true "akeneo new connection")
*IMPORTANT* copy off the Client ID, Secret, Username, and Password now. You will need these and the password cannot be retrieved once you leave this panel.
Click save and you can safely exit.


## Cloudflare Setup
1. **Set Up Cloudflare Authentication**
First you'll need to create a [Cloudflare API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) using the steps available at that link.
In your Cloudflare account it is under Profile > API Tokens. We will be using the API to batch update the KVs as a catalog with many products can easily exceed the worker's limits.

For this project you will need to grand the token the following permissions:

| **Scope** | **Entity**         | **Permissions** |
| --------- | ------------------ | --------------- |
| Account   | Workers KV Storage | Edit            |

2.  **Account ID**
You'll also need to get your [Cloudflare Account ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/).

3. **Create the KV Namespaces**
In your Cloudflare dashboard, go to "Workers and Pages" and then KV.
If you are unfamiliar with KV stores in Cloudflare, they are simple key value pairs. Documentation of KVs [here](https://developers.cloudflare.com/workers/wrangler/workers-kv/).
We will need 3 separate KVs. One for storing products by IDs, one for categories by id, and a third one to store the catalog tree for navigation.
You can name these whatever you like ( I called mine akeneo-products, akeneo-categories, and akeneo-catalog). You will make these to the env variable name later.
You will want to keep track of the ID for the products and category KVs as we will need this value later for Cloudflare API calls.

## Project Setup
1. **Install Wrangler CLI**:
```bash
npm install -g @cloudflare/wrangler
```

2. **Authenticate with Cloudflare**:
```bash
wrangler login
```

3. **Clone the Repository**:
```bash
git clone https://github.com/russellkmoore/akeneo-cloudflare-connector.git
cd akeneo-cloudflare-connector
```

4. **Configure `wrangler.toml`**:
Ensure your `wrangler.toml` file includes your Cloudflare account ID and the KV namespace bindings:
```toml
name = "akeneo-cloudflare-connector"
type = "javascript"

account_id = "your-account-id"
workers_dev = true

[[kv_namespaces]]
binding = "MY_KV_NAMESPACE"
id = "your-my-kv-namespace-id"

[[kv_namespaces]]
binding = "CATEGORY_CACHE"
id = "your-category-cache-namespace-id"

[[kv_namespaces]]
binding = "PRODUCT_CACHE"
id = "your-product-cache-namespace-id"
```

5. **Deploy the Worker**:
	```bash
	wrangler publish
	```

6. **Deploy the Pages**:
	```bash
	wrangler pages deploy pages
	```

7. **Set Up You Secrets**
We have some credentials that shouldn't be shared that we captured previously. We can set these in Cloudflare as encrypted Environment Variables so they aren't redisplayed or checked into your wrangler.toml.

The ones we need to set up are:
+ AKENEO_CLIENT_ID -- the Client ID from the connection we set up in Akeneo
+ AKENEO_HOST -- your public hostname from ngrok
+ AKENEO_PASSWORD  -- the Client password from the connection we set up in Akeneo
+ AKENEO_SECRET -- the secret from the connection we set up in Akeneo
+ AKENEO_USERNAME -- the username from the connection we set up in Akeneo
+ CF_ACCOUNTID -- your Cloudflare account ID
+ CF_APITOKEN -- The API token you created to access your KVs via Cloudflare API
+ CF_CATEGORYKVID -- the id of the Category KV you saved earlier
+ CF_CPRODUCTKVID -- the id of the Product KV you saved earlier

In this screenshot, you can see all of these set up with their correct naming:
![Cloudflare Secrets and KVs](/screenshots/screenshots
/secretsandKVs.png?raw=true "cloudflare secrets and KVs")


Your code should all be set up.

Hit the /refresh URL to fetch your catalog data from the PIM and cache it in your KVs.
You can get the base URL in Cloudflare under your Worker - there is a link to "Visit". append /refresh to the URL to call that function.

Now you should be able to hit your Pages intstance and see this:
![Demo Page](/screenshots/demopages.png?raw=true "demo page")

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributions

Contributions are welcome! Please open an issue or submit a pull request with your changes.

## Contact

For any inquiries, please contact [russellkmoore@mac.com].

