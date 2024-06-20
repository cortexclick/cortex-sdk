type Method = "POST" | "GET" | "PUT" | "DELETE";

// body can be any object
/* eslint-disable  @typescript-eslint/no-explicit-any */


export class CortexApiClient {
    constructor(private org: string, private apiUrl: string, private accessToken: string) { }

    async POST(path: string, body?: any) {
        return this.makeRequest("POST", path, body);
    }

    async PUT(path: string, body?: any) {
        return this.makeRequest("PUT", path, body);
    }

    async GET(path: string, body?: any) {
        return this.makeRequest("GET", path, body);
    }

    async DELETE(path: string, body?: any) {
        return this.makeRequest("DELETE", path, body);
    }

    async POSTForm(path: string, form: FormData) {
        return fetch(`${this.apiUrl}/org/${this.org}${path}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`
            },
            body: form,
        })
    }

    private async makeRequest(method: Method, path: string, body?: any) {
        return fetch(`${this.apiUrl}/org/${this.org}${path}`, {
            method,
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined,
        })
    }

}