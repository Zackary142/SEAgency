/* Client for SEAgency-API. Every call sends the session cookie; the API never
   hands tokens to the page. Routes are documented in the API's README. */
const API = (() => {
  const base = () => window.SITE.apiUrl;

  async function request(method, path, body) {
    const res = await fetch(base() + path, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.error || res.statusText);
      err.status = res.status;
      err.code = data?.error;
      throw err;
    }
    return data;
  }

  return {
    /* False until SITE.apiUrl is set. Pages show sample data instead. */
    get connected() { return Boolean(base()); },
    /* True when the API answered but the route isn't built yet. */
    notBuilt: err => err.status === 501,

    signup: body => request("POST", "/auth/signup", body),
    verifyEmail: token => request("POST", "/auth/verify-email", { token }),
    login: body => request("POST", "/auth/login", body),
    logout: () => request("POST", "/auth/logout"),
    me: () => request("GET", "/auth/me").then(data => data.user),

    projects: status => request("GET", `/projects?status=${status}`),
    updates: projectId => request("GET", `/projects/${projectId}/updates`),
    colleagues: () => request("GET", "/projects/colleagues"),
    offerSupport: (projectId, message) => request("POST", `/projects/${projectId}/support-offers`, { message }),
    acceptOffer: (projectId, offerId) => request("POST", `/projects/${projectId}/support-offers/${offerId}/accept`),
    declineOffer: (projectId, offerId) => request("POST", `/projects/${projectId}/support-offers/${offerId}/decline`),
    requestProject: summary => request("POST", "/project-requests", { summary })
  };
})();
