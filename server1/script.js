/**
 * script.js — Server1 client-side application
 * Lab 5: Patient DB
 *
 * Attribution: Initial fetch logic assisted by ChatGPT (OpenAI);
 * substantially revised and restructured by the development team.
 *
 * Architecture:
 *   ApiService      — owns all network communication with Server2
 *   ModalController — owns modal open/close/keyboard lifecycle
 *   AppController   — wires UI elements to ApiService and ModalController
 */

'use strict';

/* ─── Configuration ──────────────────────────────────────────────────────── */

const CONFIG = Object.freeze({
  API_BASE: 'https://api-db-c97g.onrender.com',
  ENDPOINT_INSERT: '/insert',
  ENDPOINT_SQL: '/api/v1/sql/',
});

/* ─── I18nService ────────────────────────────────────────────────────────── */

/**
 * Reads strings from a plain locale object (e.g. LANG_EN) and applies them
 * to DOM elements at runtime.
 *
 * To switch language:
 *   1. Add lang/fr/fr.js with the same keys as LANG_EN.
 *   2. Swap the <script> tag in index.html to point to the new file.
 *   No other changes are needed.
 */
class I18nService {
  /**
   * @param {object} strings - A frozen locale object (e.g. LANG_EN).
   */
  constructor(strings) {
    this._strings = strings;
  }

  /**
   * Applies all locale strings to the page in one pass.
   * Called once during init() before any user interaction.
   */
  apply() {
    document.title = this._strings.page_title ?? document.title;

    this._setText('siteTitle', 'siteTitle_text');

    this._setText('insertBtn', 'insertBtn_label');
    this._setAttr('insertBtn', 'aria-label', 'insertBtn_aria');

    this._setText('queryHeading', 'queryHeading_text');
    this._setAttr('sqlBox', 'placeholder', 'sqlBox_placeholder');
    this._setText('queryHint', 'queryHint_text');

    this._setText('submitBtn', 'submitBtn_label');
    this._setAttr('submitBtn', 'aria-label', 'submitBtn_aria');

    this._setText('modalHeading', 'modal_heading');
    this._setAttr('modalCloseBtn', 'aria-label', 'modalCloseBtn_aria');
  }

  /**
   * Sets the textContent of a DOM element from a locale key.
   * @param {string} id  - Element id.
   * @param {string} key - Key in the locale object.
   */
  _setText(id, key) {
    const el = document.getElementById(id);
    if (el) el.textContent = this._strings[key] ?? '';
  }

  /**
   * Sets an attribute of a DOM element from a locale key.
   * @param {string} id   - Element id.
   * @param {string} attr - Attribute name (e.g. "placeholder", "aria-label").
   * @param {string} key  - Key in the locale object.
   */
  _setAttr(id, attr, key) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, this._strings[key] ?? '');
  }
}

/* ─── ApiService ─────────────────────────────────────────────────────────── */

/**
 * Handles all HTTP communication with the Server2 API.
 * Each method returns a parsed JSON object or throws on network/HTTP error.
 */
class ApiService {
  /**
   * @param {string} baseUrl - Root URL of the API server (no trailing slash).
   */
  constructor(baseUrl) {
    this._baseUrl = baseUrl;
  }

  /**
   * POST /insert — triggers seed-row insertion on the server.
   * @returns {Promise<object>} Server JSON response.
   */
  async insertRows() {
    const url = `${this._baseUrl}${CONFIG.ENDPOINT_INSERT}`;
    const response = await fetch(url, { method: 'POST' });
    return this._parseResponse(response);
  }

  /**
   * GET /api/v1/sql/<encoded> — runs a SELECT query via the read-only user.
   * @param {string} sql - Raw SQL string entered by the user.
   * @returns {Promise<object>} Server JSON response.
   */
  async runQuery(sql) {
    const encoded = encodeURIComponent(sql);
    const url = `${this._baseUrl}${CONFIG.ENDPOINT_SQL}${encoded}`;
    const response = await fetch(url, { method: 'GET' });
    return this._parseResponse(response);
  }

  /**
   * Parses a fetch Response into a JSON object.
   * Throws a descriptive Error if the response is not OK.
   * @param {Response} response
   * @returns {Promise<object>}
   */
  async _parseResponse(response) {
    const data = await response.json();
    if (!response.ok) {
      const message = data?.error ?? `HTTP ${response.status}`;
      throw new Error(message);
    }
    return data;
  }
}

/* ─── ModalController ────────────────────────────────────────────────────── */

/**
 * Manages the response modal: opening, closing, content display,
 * and all close triggers (button, backdrop click, Escape key).
 */
class ModalController {
  /**
   * @param {object} elements - DOM element references.
   * @param {HTMLElement} elements.backdrop  - The full-screen backdrop div.
   * @param {HTMLElement} elements.content   - The <pre> that displays text.
   * @param {HTMLElement} elements.closeBtn  - The × close button.
   */
  constructor({ backdrop, content, closeBtn }) {
    this._backdrop = backdrop;
    this._content = content;
    this._closeBtn = closeBtn;

    this._bindEvents();
  }

  /**
   * Opens the modal and renders the given text into it.
   * @param {string} text - Pre-formatted text to display.
   */
  open(text) {
    this._content.textContent = text;
    this._backdrop.classList.add('open');
    this._backdrop.setAttribute('aria-hidden', 'false');
    this._closeBtn.focus();
  }

  /** Closes the modal and resets aria state. */
  close() {
    this._backdrop.classList.remove('open');
    this._backdrop.setAttribute('aria-hidden', 'true');
  }

  /** Attaches all close-trigger event listeners. */
  _bindEvents() {
    this._closeBtn.addEventListener('click', () => this.close());

    // Click on the dark backdrop (outside the modal card) closes it.
    this._backdrop.addEventListener('click', (event) => {
      if (event.target === this._backdrop) this.close();
    });

    // Escape key closes the modal from anywhere on the page.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }
}

/* ─── AppController ──────────────────────────────────────────────────────── */

/**
 * Top-level controller that wires UI events to ApiService and ModalController.
 * Owns loading-state management to prevent duplicate in-flight requests.
 */
class AppController {
  /**
   * @param {object} deps - Injected dependencies and DOM references.
   * @param {ApiService}      deps.api       - Network layer.
   * @param {ModalController} deps.modal     - Modal UI layer.
   * @param {HTMLButtonElement} deps.insertBtn - The Insert button.
   * @param {HTMLButtonElement} deps.submitBtn - The Submit Query button.
   * @param {HTMLTextAreaElement} deps.sqlBox - The SQL textarea.
   */
  constructor({ api, modal, insertBtn, submitBtn, sqlBox }) {
    this._api = api;
    this._modal = modal;
    this._insertBtn = insertBtn;
    this._submitBtn = submitBtn;
    this._sqlBox = sqlBox;

    this._bindEvents();
  }

  /** Attaches click handlers to Insert and Submit buttons. */
  _bindEvents() {
    this._insertBtn.addEventListener('click', () => this._handleInsert());
    this._submitBtn.addEventListener('click', () => this._handleQuery());
  }

  /**
   * Handles the Insert button click.
   * Sends a POST request and displays the server response.
   */
  async _handleInsert() {
    this._setLoading(this._insertBtn, true);
    try {
      const data = await this._api.insertRows();
      this._modal.open(JSON.stringify(data, null, 2));
    } catch (err) {
      this._modal.open(`${LANG_EN.error_insertFailed}\n${err.message}`);
    } finally {
      this._setLoading(this._insertBtn, false);
    }
  }

  /**
   * Handles the Submit Query button click.
   * Validates input, sends a GET request, and displays the server response.
   */
  async _handleQuery() {
    const sql = this._sqlBox.value.trim();
    if (!sql) {
      this._modal.open(LANG_EN.error_emptyQuery);
      return;
    }

    this._setLoading(this._submitBtn, true);
    try {
      const data = await this._api.runQuery(sql);
      this._modal.open(JSON.stringify(data, null, 2));
    } catch (err) {
      this._modal.open(`${LANG_EN.error_queryFailed}\n${err.message}`);
    } finally {
      this._setLoading(this._submitBtn, false);
    }
  }

  /**
   * Enables or disables a button to prevent duplicate requests.
   * Uses data-label and data-loading-label set by init() from LANG_EN.
   * @param {HTMLButtonElement} button
   * @param {boolean} isLoading
   */
  _setLoading(button, isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading
      ? button.dataset.loadingLabel
      : button.dataset.label;
  }
}

/* ─── Bootstrap ──────────────────────────────────────────────────────────── */

/**
 * Entry point — runs after the DOM is fully parsed.
 * Queries DOM elements, constructs class instances, and injects dependencies.
 */
function init() {
  // Apply locale strings to the DOM before anything else runs.
  // LANG_EN is declared globally by lang/en/en.js, loaded before this script.
  const i18n = new I18nService(LANG_EN);
  i18n.apply();

  // DOM references (queried after i18n.apply() so labels are already set)
  const insertBtn = document.getElementById('insertBtn');
  const submitBtn = document.getElementById('submitBtn');
  const sqlBox = document.getElementById('sqlBox');
  const backdrop = document.getElementById('modalBackdrop');
  const content = document.getElementById('modalContent');
  const closeBtn = document.getElementById('modalCloseBtn');

  // Store labels from LANG_EN so _setLoading can restore them after a request.
  insertBtn.dataset.label = LANG_EN.insertBtn_label;
  insertBtn.dataset.loadingLabel = LANG_EN.insertBtn_loading;
  submitBtn.dataset.label = LANG_EN.submitBtn_label;
  submitBtn.dataset.loadingLabel = LANG_EN.submitBtn_loading;

  // Compose the application from its parts
  const api = new ApiService(CONFIG.API_BASE);
  const modal = new ModalController({ backdrop, content, closeBtn });

  new AppController({ api, modal, insertBtn, submitBtn, sqlBox });
}

document.addEventListener('DOMContentLoaded', init);
