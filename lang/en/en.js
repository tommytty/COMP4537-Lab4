/**
 * lang/en/en.js — English locale strings
 * Lab 5: Patient DB
 *
 * Exposed as a plain global const so no module system is required.
 * To add a new language, create lang/fr/fr.js (for example) with the
 * same keys and swap the <script> tag in index.html.
 *
 * Key naming convention:
 *   <component>_<element>_<property>
 *   e.g. insertBtn_label = visible button text
 *        insertBtn_aria   = aria-label attribute value
 */

const LANG_EN = Object.freeze({
  /* ── Page ───────────────────────────────────────────────────────────── */
  page_title: 'Lab 5 — Patient DB',
  siteTitle_text: 'Patient DB',

  /* ── Insert Button ──────────────────────────────────────────────────── */
  insertBtn_label: 'Insert',
  insertBtn_aria: 'Insert seed patient rows into the database',
  insertBtn_loading: 'Loading…',

  /* ── Query Section ──────────────────────────────────────────────────── */
  queryHeading_text: 'Query DB',
  sqlBox_placeholder: 'SELECT * FROM patient;',
  sqlBox_aria_describe: 'Only SELECT statements are permitted.',
  queryHint_text: 'Only SELECT statements are permitted.',

  /* ── Submit Button ──────────────────────────────────────────────────── */
  submitBtn_label: 'Submit Query',
  submitBtn_aria: 'Submit SQL query to the database',
  submitBtn_loading: 'Loading…',

  /* ── Modal ──────────────────────────────────────────────────────────── */
  modal_heading: 'Server Response',
  modalCloseBtn_aria: 'Close response dialog',

  /* ── Error / Feedback Messages ──────────────────────────────────────── */
  error_emptyQuery: 'Please enter a SQL SELECT statement before submitting.',
  error_insertFailed: 'Insert failed:',
  error_queryFailed: 'Query failed:',
});
