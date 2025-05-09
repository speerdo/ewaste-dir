import { FunctionsClient } from '@supabase/functions-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { RealtimeClient } from '@supabase/realtime-js';
import { StorageClient } from '@supabase/storage-js';
import nodeFetch, { Headers as Headers$1 } from '@supabase/node-fetch';
import { AuthClient } from '@supabase/auth-js';

const version = '2.49.4';

let JS_ENV = '';
// @ts-ignore
if (typeof Deno !== 'undefined') {
    JS_ENV = 'deno';
}
else if (typeof document !== 'undefined') {
    JS_ENV = 'web';
}
else if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    JS_ENV = 'react-native';
}
else {
    JS_ENV = 'node';
}
const DEFAULT_HEADERS = { 'X-Client-Info': `supabase-js-${JS_ENV}/${version}` };
const DEFAULT_GLOBAL_OPTIONS = {
    headers: DEFAULT_HEADERS,
};
const DEFAULT_DB_OPTIONS = {
    schema: 'public',
};
const DEFAULT_AUTH_OPTIONS = {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
};
const DEFAULT_REALTIME_OPTIONS = {};

var __awaiter$2 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const resolveFetch = (customFetch) => {
    let _fetch;
    if (customFetch) {
        _fetch = customFetch;
    }
    else if (typeof fetch === 'undefined') {
        _fetch = nodeFetch;
    }
    else {
        _fetch = fetch;
    }
    return (...args) => _fetch(...args);
};
const resolveHeadersConstructor = () => {
    if (typeof Headers === 'undefined') {
        return Headers$1;
    }
    return Headers;
};
const fetchWithAuth = (supabaseKey, getAccessToken, customFetch) => {
    const fetch = resolveFetch(customFetch);
    const HeadersConstructor = resolveHeadersConstructor();
    return (input, init) => __awaiter$2(void 0, void 0, void 0, function* () {
        var _a;
        const accessToken = (_a = (yield getAccessToken())) !== null && _a !== void 0 ? _a : supabaseKey;
        let headers = new HeadersConstructor(init === null || init === void 0 ? void 0 : init.headers);
        if (!headers.has('apikey')) {
            headers.set('apikey', supabaseKey);
        }
        if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${accessToken}`);
        }
        return fetch(input, Object.assign(Object.assign({}, init), { headers }));
    });
};

var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function stripTrailingSlash(url) {
    return url.replace(/\/$/, '');
}
function applySettingDefaults(options, defaults) {
    const { db: dbOptions, auth: authOptions, realtime: realtimeOptions, global: globalOptions, } = options;
    const { db: DEFAULT_DB_OPTIONS, auth: DEFAULT_AUTH_OPTIONS, realtime: DEFAULT_REALTIME_OPTIONS, global: DEFAULT_GLOBAL_OPTIONS, } = defaults;
    const result = {
        db: Object.assign(Object.assign({}, DEFAULT_DB_OPTIONS), dbOptions),
        auth: Object.assign(Object.assign({}, DEFAULT_AUTH_OPTIONS), authOptions),
        realtime: Object.assign(Object.assign({}, DEFAULT_REALTIME_OPTIONS), realtimeOptions),
        global: Object.assign(Object.assign({}, DEFAULT_GLOBAL_OPTIONS), globalOptions),
        accessToken: () => __awaiter$1(this, void 0, void 0, function* () { return ''; }),
    };
    if (options.accessToken) {
        result.accessToken = options.accessToken;
    }
    else {
        // hack around Required<>
        delete result.accessToken;
    }
    return result;
}

class SupabaseAuthClient extends AuthClient {
    constructor(options) {
        super(options);
    }
}

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * Supabase Client.
 *
 * An isomorphic Javascript client for interacting with Postgres.
 */
class SupabaseClient {
    /**
     * Create a new client for use in the browser.
     * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
     * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
     * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
     * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
     * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
     * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
     * @param options.realtime Options passed along to realtime-js constructor.
     * @param options.global.fetch A custom fetch implementation.
     * @param options.global.headers Any additional headers to send with each network request.
     */
    constructor(supabaseUrl, supabaseKey, options) {
        var _a, _b, _c;
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        if (!supabaseUrl)
            throw new Error('supabaseUrl is required.');
        if (!supabaseKey)
            throw new Error('supabaseKey is required.');
        const _supabaseUrl = stripTrailingSlash(supabaseUrl);
        this.realtimeUrl = `${_supabaseUrl}/realtime/v1`.replace(/^http/i, 'ws');
        this.authUrl = `${_supabaseUrl}/auth/v1`;
        this.storageUrl = `${_supabaseUrl}/storage/v1`;
        this.functionsUrl = `${_supabaseUrl}/functions/v1`;
        // default storage key uses the supabase project ref as a namespace
        const defaultStorageKey = `sb-${new URL(this.authUrl).hostname.split('.')[0]}-auth-token`;
        const DEFAULTS = {
            db: DEFAULT_DB_OPTIONS,
            realtime: DEFAULT_REALTIME_OPTIONS,
            auth: Object.assign(Object.assign({}, DEFAULT_AUTH_OPTIONS), { storageKey: defaultStorageKey }),
            global: DEFAULT_GLOBAL_OPTIONS,
        };
        const settings = applySettingDefaults(options !== null && options !== void 0 ? options : {}, DEFAULTS);
        this.storageKey = (_a = settings.auth.storageKey) !== null && _a !== void 0 ? _a : '';
        this.headers = (_b = settings.global.headers) !== null && _b !== void 0 ? _b : {};
        if (!settings.accessToken) {
            this.auth = this._initSupabaseAuthClient((_c = settings.auth) !== null && _c !== void 0 ? _c : {}, this.headers, settings.global.fetch);
        }
        else {
            this.accessToken = settings.accessToken;
            this.auth = new Proxy({}, {
                get: (_, prop) => {
                    throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(prop)} is not possible`);
                },
            });
        }
        this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.global.fetch);
        this.realtime = this._initRealtimeClient(Object.assign({ headers: this.headers, accessToken: this._getAccessToken.bind(this) }, settings.realtime));
        this.rest = new PostgrestClient(`${_supabaseUrl}/rest/v1`, {
            headers: this.headers,
            schema: settings.db.schema,
            fetch: this.fetch,
        });
        if (!settings.accessToken) {
            this._listenForAuthEvents();
        }
    }
    /**
     * Supabase Functions allows you to deploy and invoke edge functions.
     */
    get functions() {
        return new FunctionsClient(this.functionsUrl, {
            headers: this.headers,
            customFetch: this.fetch,
        });
    }
    /**
     * Supabase Storage allows you to manage user-generated content, such as photos or videos.
     */
    get storage() {
        return new StorageClient(this.storageUrl, this.headers, this.fetch);
    }
    /**
     * Perform a query on a table or a view.
     *
     * @param relation - The table or view name to query
     */
    from(relation) {
        return this.rest.from(relation);
    }
    // NOTE: signatures must be kept in sync with PostgrestClient.schema
    /**
     * Select a schema to query or perform an function (rpc) call.
     *
     * The schema needs to be on the list of exposed schemas inside Supabase.
     *
     * @param schema - The schema to query
     */
    schema(schema) {
        return this.rest.schema(schema);
    }
    // NOTE: signatures must be kept in sync with PostgrestClient.rpc
    /**
     * Perform a function call.
     *
     * @param fn - The function name to call
     * @param args - The arguments to pass to the function call
     * @param options - Named parameters
     * @param options.head - When set to `true`, `data` will not be returned.
     * Useful if you only need the count.
     * @param options.get - When set to `true`, the function will be called with
     * read-only access mode.
     * @param options.count - Count algorithm to use to count rows returned by the
     * function. Only applicable for [set-returning
     * functions](https://www.postgresql.org/docs/current/functions-srf.html).
     *
     * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
     * hood.
     *
     * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
     * statistics under the hood.
     *
     * `"estimated"`: Uses exact count for low numbers and planned count for high
     * numbers.
     */
    rpc(fn, args = {}, options = {}) {
        return this.rest.rpc(fn, args, options);
    }
    /**
     * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
     *
     * @param {string} name - The name of the Realtime channel.
     * @param {Object} opts - The options to pass to the Realtime channel.
     *
     */
    channel(name, opts = { config: {} }) {
        return this.realtime.channel(name, opts);
    }
    /**
     * Returns all Realtime channels.
     */
    getChannels() {
        return this.realtime.getChannels();
    }
    /**
     * Unsubscribes and removes Realtime channel from Realtime client.
     *
     * @param {RealtimeChannel} channel - The name of the Realtime channel.
     *
     */
    removeChannel(channel) {
        return this.realtime.removeChannel(channel);
    }
    /**
     * Unsubscribes and removes all Realtime channels from Realtime client.
     */
    removeAllChannels() {
        return this.realtime.removeAllChannels();
    }
    _getAccessToken() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.accessToken) {
                return yield this.accessToken();
            }
            const { data } = yield this.auth.getSession();
            return (_b = (_a = data.session) === null || _a === void 0 ? void 0 : _a.access_token) !== null && _b !== void 0 ? _b : null;
        });
    }
    _initSupabaseAuthClient({ autoRefreshToken, persistSession, detectSessionInUrl, storage, storageKey, flowType, lock, debug, }, headers, fetch) {
        const authHeaders = {
            Authorization: `Bearer ${this.supabaseKey}`,
            apikey: `${this.supabaseKey}`,
        };
        return new SupabaseAuthClient({
            url: this.authUrl,
            headers: Object.assign(Object.assign({}, authHeaders), headers),
            storageKey: storageKey,
            autoRefreshToken,
            persistSession,
            detectSessionInUrl,
            storage,
            flowType,
            lock,
            debug,
            fetch,
            // auth checks if there is a custom authorizaiton header using this flag
            // so it knows whether to return an error when getUser is called with no session
            hasCustomAuthorizationHeader: 'Authorization' in this.headers,
        });
    }
    _initRealtimeClient(options) {
        return new RealtimeClient(this.realtimeUrl, Object.assign(Object.assign({}, options), { params: Object.assign({ apikey: this.supabaseKey }, options === null || options === void 0 ? void 0 : options.params) }));
    }
    _listenForAuthEvents() {
        let data = this.auth.onAuthStateChange((event, session) => {
            this._handleTokenChanged(event, 'CLIENT', session === null || session === void 0 ? void 0 : session.access_token);
        });
        return data;
    }
    _handleTokenChanged(event, source, token) {
        if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
            this.changedAccessToken !== token) {
            this.changedAccessToken = token;
        }
        else if (event === 'SIGNED_OUT') {
            this.realtime.setAuth();
            if (source == 'STORAGE')
                this.auth.signOut();
            this.changedAccessToken = undefined;
        }
    }
}

/**
 * Creates a new Supabase Client.
 */
const createClient = (supabaseUrl, supabaseKey, options) => {
    return new SupabaseClient(supabaseUrl, supabaseKey, options);
};

({
  "new-york": [
    {
      id: "new-york-city",
      name: "New York City",
      state_id: "new-york",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "albany",
      name: "Albany",
      state_id: "new-york",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  california: [
    {
      id: "los-angeles",
      name: "Los Angeles",
      state_id: "california",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "san-francisco",
      name: "San Francisco",
      state_id: "california",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ]
});
({
  "new-york": [
    {
      id: "1",
      name: "NYC E-Waste Center",
      city: "New York City",
      state: "New York",
      state_id: "new-york",
      city_id: "new-york-city",
      postal_code: 10001,
      phone: "555-123-4567",
      description: "E-waste recycling center in NYC",
      latitude: 40.7128,
      longitude: -74.006,
      full_address: "123 Example St, New York City, NY 10001",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  california: [
    {
      id: "2",
      name: "LA E-Waste Center",
      city: "Los Angeles",
      state: "California",
      state_id: "california",
      city_id: "los-angeles",
      postal_code: 90001,
      phone: "555-987-6543",
      description: "E-waste recycling center in LA",
      latitude: 34.0522,
      longitude: -118.2437,
      full_address: "456 Sample Blvd, Los Angeles, CA 90001",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ]
});

const supabaseUrl = "https://example.supabase.co";
const supabaseAnonKey = "dummy-key-for-build-process";
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  global: { headers: { "x-client-info": "astro-build" } }
});
const getAllStates = realGetAllStates;
const getState = realGetState;
const getRecyclingCentersByState = realGetRecyclingCentersByState;
const getRecyclingCentersByCity = realGetRecyclingCentersByCity;
const getCitiesByState = realGetCitiesByState;
const getFeaturedStates = realGetFeaturedStates;
const normalizeForUrl = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
};
async function realGetAllStates() {
  try {
    const { data, error } = await supabase.from("states").select("*").order("name");
    if (error) throw error;
    return (data || []).map((state) => ({
      id: normalizeForUrl(state.name),
      name: state.name,
      description: state.description || `Find electronics recycling centers in ${state.name}`,
      image_url: state.image_url || "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51",
      featured: state.featured,
      nearby_states: state.nearby_states
    }));
  } catch (error) {
    console.error("Error fetching states:", error);
    return [];
  }
}
async function realGetState(stateId) {
  try {
    const { data, error } = await supabase.from("states").select("*").eq("name", stateId.replace(/-/g, " ")).single();
    if (error) {
      const { data: likeData, error: likeError } = await supabase.from("states").select("*").ilike("name", stateId.replace(/-/g, " ")).single();
      if (likeError) return null;
      if (likeData) {
        return {
          id: normalizeForUrl(likeData.name),
          name: likeData.name,
          description: likeData.description,
          image_url: likeData.image_url,
          featured: likeData.featured,
          nearby_states: likeData.nearby_states
        };
      }
      return null;
    }
    return {
      id: normalizeForUrl(data.name),
      name: data.name,
      description: data.description,
      image_url: data.image_url,
      featured: data.featured,
      nearby_states: data.nearby_states
    };
  } catch (error) {
    console.error("Error fetching state:", error);
    return null;
  }
}
async function realGetRecyclingCentersByState(stateId) {
  try {
    const state = await getState(stateId);
    if (!state) return {};
    const { data, error } = await supabase.from("recycling_centers").select("*").ilike("state", state.name);
    if (error) throw error;
    const centersByCity = {};
    (data || []).forEach((center) => {
      const city = center.city || "Unknown";
      if (!centersByCity[city]) {
        centersByCity[city] = [];
      }
      centersByCity[city].push(center);
    });
    return centersByCity;
  } catch (error) {
    console.error("Error fetching recycling centers:", error);
    return {};
  }
}
async function realGetRecyclingCentersByCity(stateId, city) {
  try {
    const state = await getState(stateId);
    if (!state) return [];
    const { data, error } = await supabase.from("recycling_centers").select("*").ilike("state", state.name).ilike("city", city);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching recycling centers by city:", error);
    return [];
  }
}
async function realGetCitiesByState(stateId) {
  try {
    const state = await getState(stateId);
    if (!state) return [];
    const { data, error } = await supabase.from("recycling_centers").select("city").ilike("state", state.name).order("city");
    if (error) throw error;
    const uniqueCities = Array.from(
      new Set((data || []).map((item) => item.city))
    ).map((cityName) => ({
      id: normalizeForUrl(cityName),
      name: cityName,
      state_id: stateId,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
    return uniqueCities;
  } catch (error) {
    console.error("Error fetching cities:", error);
    return [];
  }
}
async function realGetFeaturedStates() {
  try {
    const { data, error } = await supabase.from("states").select("*").eq("featured", true).order("name");
    if (error) throw error;
    return (data || []).map((state) => ({
      id: normalizeForUrl(state.name),
      name: state.name,
      description: state.description || `Find electronics recycling centers in ${state.name}`,
      image_url: state.image_url || "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51",
      featured: state.featured,
      nearby_states: state.nearby_states
    }));
  } catch (error) {
    console.error("Error fetching featured states:", error);
    return [];
  }
}

let cityDataCache = null;
async function getAllCityStatePairs() {
  if (cityDataCache) {
    return cityDataCache;
  }
  const states = await getAllStates();
  const cityStatePairs = await Promise.all(
    states.map(async (state) => {
      const cities = await getCitiesByState(state.id);
      return cities.map((city) => ({
        city: city.name,
        state: state.name,
        url: `/states/${state.id}/${city.id}`
      }));
    })
  ).then((results) => results.flat());
  cityDataCache = cityStatePairs;
  return cityStatePairs;
}
const searchCache = /* @__PURE__ */ new Map();
const CACHE_DURATION = 1e3 * 60 * 5;
function searchLocations(query, cityStatePairs) {
  query = query.toLowerCase().trim();
  if (!query) return [];
  const cacheKey = query;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  const isZipCode = /^\d{5}(-\d{4})?$/.test(query);
  let results;
  if (isZipCode) {
    results = [
      {
        text: `Find recycling centers near ${query}`,
        type: "zip",
        zip: query
      }
    ];
  } else {
    const exactMatches = cityStatePairs.filter(({ city, state }) => {
      const cityLower = city.toLowerCase();
      const stateLower = state.toLowerCase();
      return cityLower === query || stateLower === query;
    });
    const partialMatches = cityStatePairs.filter(({ city, state }) => {
      const cityLower = city.toLowerCase();
      const stateLower = state.toLowerCase();
      return (cityLower.includes(query) || stateLower.includes(query)) && !exactMatches.find((m) => m.city === city && m.state === state);
    });
    results = [...exactMatches, ...partialMatches].slice(0, 8).map(({ city, state, url }) => ({
      text: `${city}, ${state}`,
      url,
      type: "city"
    }));
  }
  searchCache.set(cacheKey, {
    data: results,
    timestamp: Date.now()
  });
  return results;
}

export { searchLocations as a, getState as b, getRecyclingCentersByCity as c, getRecyclingCentersByState as d, getFeaturedStates as e, getAllStates as f, getAllCityStatePairs as g, supabase as s };
