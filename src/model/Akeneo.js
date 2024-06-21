export class Akeneo {
	hostname = '';
	username = '';
	password = '';
	client_id = '';
	secret = '';
	bearerToken = '';

	constructor(hostname, username, password, clientId, secret) {
		this.hostname = hostname;
		this.username = username;
		this.password = password;
		this.clientId = clientId;
		this.secret = secret;
		this.bearerToken = null;
		this.authenticate();
	}

	async authenticate() {
		const response = await fetch(`http://${this.hostname}/api/oauth/v1/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				grant_type: 'password',
				client_id: this.clientId,
				client_secret: this.secret,
				username: this.username,
				password: this.password
			})
		});
		const data = await response.json();
		this.bearerToken = data.access_token;
		return this.bearerToken;
	}
}
