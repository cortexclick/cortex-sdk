type Method = "POST" | "GET" | "PUT" | "DELETE";

// body can be any object
/* eslint-disable  @typescript-eslint/no-explicit-any */

export class CortexApiClient {
  private readonly maxRequestSize = 32 * 1000 * 1000; // API is configured with max request body size of 32mb

  constructor(
    private org: string,
    private apiUrl: string,
    private accessToken: string,
  ) {}

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
    const requestSize = CortexApiClient.getFormDataSize(form);
    if (requestSize > this.maxRequestSize) {
      throw new Error("Request body too large");
    }

    return fetch(`${this.apiUrl}/org/${this.org}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: form,
    });
    form.values.length;
  }

  private async makeRequest(method: Method, path: string, body?: any) {
    const requestBody = body ? JSON.stringify(body) : undefined;
    // Note that we use character size instead of byte size. This is still a useful heuristic as we don't want to incur the overhead
    // of using TextEncoder to calculate the precise byte count
    if (requestBody && requestBody.length >= this.maxRequestSize) {
      throw new Error("Request body too large");
    }

    return fetch(`${this.apiUrl}/org/${this.org}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });
  }

  private static getFormDataSize(formData: FormData) {
    return [...formData].reduce(
      (size, [name, value]) =>
        size + (typeof value === "string" ? value.length : value.size),
      0,
    );
  }
}
